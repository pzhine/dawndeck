#!/bin/bash

# Script to configure Raspberry Pi OS Bookworm to boot into X session
# running only the Sunrise Alarm Electron app (kiosk mode)
# Usage: sudo ./setup_kiosk_mode.sh [username]

set -e

# Derive project root from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ELECTRON_PROD_DIR="$PROJECT_ROOT/electron/release/linux-arm64-unpacked"

# Get the user to configure (either passed as argument or the user who ran sudo)
TARGET_USER="${1:-${SUDO_USER:-$(whoami)}}"
USER_HOME=$(eval echo ~$TARGET_USER)

# Configuration files
XINITRC="$USER_HOME/.xinitrc"
BASH_PROFILE="$USER_HOME/.bash_profile"
XSESSION_SCRIPT="$USER_HOME/.xsession"
STARTUP_LOG="$USER_HOME/sunrise-alarm-kiosk.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to log messages
log_info() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to check if we're running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Function to validate directories and files
validate_setup() {
    log_info "Validating setup..."
    
    if [ ! -d "$PROJECT_ROOT" ]; then
        log_error "Project root not found at $PROJECT_ROOT"
        exit 1
    fi
    
    if [ ! -d "$ELECTRON_PROD_DIR" ]; then
        log_error "Production build not found at $ELECTRON_PROD_DIR"
        echo "Please build the production app first:"
        echo "  cd $PROJECT_ROOT/electron"
        echo "  npm run build"
        exit 1
    fi
    
    # Check for the Electron executable
    local electron_binary="$ELECTRON_PROD_DIR/sunrise-alarm"
    if [ ! -f "$electron_binary" ]; then
        log_error "Electron binary not found at $electron_binary"
        echo "Expected production build structure:"
        echo "  $ELECTRON_PROD_DIR/sunrise-alarm"
        exit 1
    fi
    
    log_info "Found Electron binary at $electron_binary"
    
    # Verify target user exists
    if ! id "$TARGET_USER" &>/dev/null; then
        log_error "User $TARGET_USER does not exist"
        exit 1
    fi
    
    log_info "Target user: $TARGET_USER"
    log_info "User home: $USER_HOME"
    
    # Check if Bluetooth has been configured
    if [ -f "/etc/bluetooth/main.conf" ] && systemctl is-enabled --quiet bluetooth.service 2>/dev/null; then
        log_info "Bluetooth configuration detected"
        if systemctl is-enabled --quiet bluetooth-media-agent.service 2>/dev/null; then
            log_info "Bluetooth media agent configured - media control will be available"
        fi
    else
        log_warn "Bluetooth not configured - Bluetooth features will be unavailable"
        echo ""
        echo "To enable Bluetooth speaker functionality, run:"
        echo "  sudo $PROJECT_ROOT/scripts/bluetooth-setup/setup-bluetooth-speaker.sh"
        echo ""
        echo "Press Enter to continue without Bluetooth, or Ctrl+C to abort..."
        read
    fi
}

# Function to install required packages
install_packages() {
    log_info "Installing required X11 and Bluetooth packages..."
    
    # Update package list
    apt-get update -qq
    
    # Install minimal X server and required libraries
    # xserver-xorg-core: Core X server
    # xserver-xorg-video-fbdev: Generic framebuffer driver
    # x11-xserver-utils: X server utilities (xset, xrandr, etc.)
    # xinit: X initialization tools
    # libgtk-3-0: GTK3 libraries for Electron
    # libnss3: Network Security Services for Electron
    # libasound2: ALSA sound support
    # pulseaudio: Sound server
    # bluetooth/bluez: Bluetooth support
    # pulseaudio-module-bluetooth: Bluetooth audio support
    # easyeffects: DSP effects for audio processing
    
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        xserver-xorg-core \
        xserver-xorg-video-fbdev \
        xserver-xorg-input-evdev \
        xserver-xorg-input-libinput \
        x11-xserver-utils \
        xinit \
        libgtk-3-0 \
        libnss3 \
        libasound2 \
        pulseaudio \
        pulseaudio-module-bluetooth \
        bluetooth \
        bluez \
        bluez-tools \
        dbus-x11 \
        unclutter \
        easyeffects \
        2>/dev/null || log_warn "Some packages may already be installed"
    
    log_info "Packages installed successfully"
}

# Function to configure quiet boot
configure_quiet_boot() {
    log_info "Configuring quiet boot..."
    
    local cmdline_file="/boot/firmware/cmdline.txt"
    
    if [ ! -f "$cmdline_file" ]; then
        log_warn "Boot cmdline not found at $cmdline_file - skipping quiet boot"
        return 0
    fi
    
    # Backup cmdline
    cp "$cmdline_file" "${cmdline_file}.backup-$(date +%Y%m%d_%H%M%S)"
    
    # If cmdline.txt is empty, populate it with current kernel parameters
    if [ ! -s "$cmdline_file" ]; then
        log_info "cmdline.txt is empty, populating from current kernel parameters..."
        cat /proc/cmdline > "$cmdline_file"
        log_info "Populated cmdline.txt with current boot parameters"
    fi
    
    # Redirect console to tty3 instead of tty1 to hide kernel messages
    if grep -q "console=tty1" "$cmdline_file"; then
        log_info "Redirecting console from tty1 to tty3..."
        sed -i 's/console=tty1/console=tty3/g' "$cmdline_file"
    fi
    
    # Check if quiet boot parameters are already present
    # We check for multiple key parameters to ensure full configuration
    if grep -q "systemd.show_status=false" "$cmdline_file" && \
       grep -q "logo.nologo" "$cmdline_file" && \
       grep -q "vt.global_cursor_default=0" "$cmdline_file"; then
        log_info "Silent boot parameters already fully configured"
        return 0
    fi
    
    log_info "Applying silent boot parameters..."
    # quiet - suppress most kernel messages
    # logo.nologo - hide Raspberry Pi logos
    # vt.global_cursor_default=0 - hide cursor
    # systemd.show_status=false - hide systemd starting messages
    # rd.udev.log_level=3 - hide udev messages
    
    # First remove any existing partial config to ensure clean slate
    sed -i 's/ quiet//g' "$cmdline_file"
    sed -i 's/ splash//g' "$cmdline_file"
    sed -i 's/ logo.nologo//g' "$cmdline_file"
    sed -i 's/ vt.global_cursor_default=0//g' "$cmdline_file"
    sed -i 's/ loglevel=[0-9]*//g' "$cmdline_file"
    sed -i 's/ plymouth.ignore-serial-consoles//g' "$cmdline_file"
    sed -i 's/ systemd.show_status=false//g' "$cmdline_file"
    sed -i 's/ rd.udev.log_level=3//g' "$cmdline_file"

    
    # Append full silent configuration
    # Note: Removed 'splash' as it can sometimes cause the logo to appear via Plymouth
    sed -i '$ s/$/ quiet logo.nologo vt.global_cursor_default=0 systemd.show_status=false rd.udev.log_level=3/' "$cmdline_file"
    
    log_info "Silent boot configured (console redirected to tty3)"
}

# Function to configure config.txt
configure_boot_config() {
    log_info "Configuring boot config (config.txt)..."
    
    # Try /boot/firmware/config.txt first, then /boot/config.txt
    local config_file=""
    if [ -f "/boot/firmware/config.txt" ]; then
        config_file="/boot/firmware/config.txt"
    elif [ -f "/boot/config.txt" ]; then
        config_file="/boot/config.txt"
    else
        log_warn "Boot config.txt not found - skipping config.txt updates"
        return 0
    fi
    
    log_info "Found config file at $config_file"
    
    # Backup config
    cp "$config_file" "${config_file}.backup-$(date +%Y%m%d_%H%M%S)"
    
    # Disable rainbow splash screen
    if ! grep -q "disable_splash=1" "$config_file"; then
        echo "disable_splash=1" >> "$config_file"
        log_info "Added disable_splash=1"
    fi
    
    # Disable warning overlays (lightning bolt, etc)
    if ! grep -q "avoid_warnings=1" "$config_file"; then
        echo "avoid_warnings=1" >> "$config_file"
        log_info "Added avoid_warnings=1"
    fi

    # Disable camera LED (optional, good for sleeping)
    if ! grep -q "disable_camera_led=1" "$config_file"; then
        echo "disable_camera_led=1" >> "$config_file"
        log_info "Added disable_camera_led=1"
    fi
    
    log_info "Boot config updated"
}

# Function to configure auto-login
configure_autologin() {
    log_info "Configuring auto-login for $TARGET_USER..."
    
    # Create systemd override directory for getty@tty1
    local override_dir="/etc/systemd/system/getty@tty1.service.d"
    mkdir -p "$override_dir"
    
    # Create .hushlogin to suppress last login message
    sudo -u "$TARGET_USER" touch "$USER_HOME/.hushlogin"
    
    # Create autologin configuration with quiet login options
    # --skip-login: do not prompt for login name
    # --nonewline: do not print a newline before issue
    # --noissue: do not print /etc/issue
    cat > "$override_dir/autologin.conf" << EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --skip-login --nonewline --noissue --autologin $TARGET_USER --noclear %I \$TERM
EOF
    
    log_info "Silent auto-login configured for tty1"
}

# Function to configure EasyEffects
configure_easyeffects() {
    log_info "Configuring EasyEffects DSP..."
    
    local easyeffects_config_dir="$USER_HOME/.config/easyeffects"
    local output_dir="$easyeffects_config_dir/output"
    local source_config="$PROJECT_ROOT/config/easyeffects.json"
    
    if [ ! -f "$source_config" ]; then
        log_warn "EasyEffects config not found at $source_config - skipping"
        return 0
    fi
    
    # Create EasyEffects config directory
    mkdir -p "$output_dir"
    
    # Copy the configuration
    cp "$source_config" "$output_dir/default.json"
    
    # Set proper ownership
    chown -R "$TARGET_USER:$TARGET_USER" "$easyeffects_config_dir"
    
    log_info "EasyEffects configuration installed"
}

# Function to create X session startup script
create_xsession_script() {
    log_info "Creating X session startup script..."
    
    cat > "$XINITRC" << 'EOF'
#!/bin/bash
# Sunrise Alarm Kiosk Mode - X Session Startup

LOG_FILE="$HOME/sunrise-alarm-kiosk.log"

# Function to log messages (silently, only to file)
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

log_message "=== Starting Sunrise Alarm Kiosk Mode ==="
log_message "User: $(whoami)"
log_message "Display: $DISPLAY"

# Set black background immediately
xsetroot -solid black 2>/dev/null

# Disable screen blanking and power saving
log_message "Disabling screen blanking..."
xset s off 2>/dev/null
xset s noblank 2>/dev/null
xset -dpms 2>/dev/null

# Hide mouse cursor after 2 seconds of inactivity
log_message "Starting unclutter..."
unclutter -idle 2 -root >/dev/null 2>&1 &

# Set X server to allow connections from localhost (for PulseAudio, etc.)
xhost +local: >> "$LOG_FILE" 2>&1

# Start D-Bus session if not already running
if [ -z "$DBUS_SESSION_BUS_ADDRESS" ]; then
    log_message "Starting D-Bus session..."
    eval $(dbus-launch --sh-syntax) 2>/dev/null
    export DBUS_SESSION_BUS_ADDRESS
fi

# Configure display resolution for Waveshare 3.4" DSI (800x800)
log_message "Configuring display resolution..."
if command -v xrandr &> /dev/null; then
    # Wait for display to be ready
    sleep 1
    
    log_message "Current xrandr output:"
    xrandr >> "$LOG_FILE" 2>&1
    
    # Find DSI output
    DSI_OUTPUT=$(xrandr --query 2>/dev/null | grep -E "^DSI-[0-9]+ connected" | awk '{print $1}' | head -1)
    
    if [ -n "$DSI_OUTPUT" ]; then
        log_message "Found DSI output: $DSI_OUTPUT"
        
        # Get current mode
        CURRENT_MODE=$(xrandr 2>/dev/null | grep "$DSI_OUTPUT" -A1 | grep -E "^\s+[0-9]+x[0-9]+" | grep "\*" | awk '{print $1}')
        log_message "Current mode: $CURRENT_MODE"
        
        # Check if 800x800 mode is available
        if xrandr 2>/dev/null | grep -A20 "$DSI_OUTPUT" | grep -q " 800x800"; then
            log_message "800x800 mode is available, setting it..."
            xrandr --output "$DSI_OUTPUT" --mode 800x800 >> "$LOG_FILE" 2>&1
        else
            log_message "800x800 mode not found in available modes"
        fi
        
        log_message "Final xrandr output:"
        xrandr >> "$LOG_FILE" 2>&1
    else
        log_message "⚠ No DSI output found, display may use default resolution"
    fi
else
    log_message "⚠ xrandr not available"
fi

# Start PulseAudio if not already running
if ! pgrep -x pulseaudio > /dev/null 2>&1; then
    log_message "Starting PulseAudio..."
    pulseaudio --start --log-target=syslog >> "$LOG_FILE" 2>&1
fi

# Ensure Bluetooth service is running
if ! systemctl is-active --quiet bluetooth.service 2>/dev/null; then
    log_message "Starting Bluetooth service..."
    sudo systemctl start bluetooth.service >> "$LOG_FILE" 2>&1 || log_message "Could not start Bluetooth (may not be configured)"
fi

# Start EasyEffects for DSP processing (run as background service)
if command -v easyeffects &> /dev/null; then
    log_message "Starting EasyEffects DSP..."
    easyeffects --gapplication-service >> "$LOG_FILE" 2>&1 &
    sleep 2
else
    log_message "EasyEffects not installed - no DSP processing"
fi

# Wait for services to be ready
sleep 3

# Path to Electron production binary
ELECTRON_BINARY="__ELECTRON_PROD_DIR__/sunrise-alarm"

if [ ! -f "$ELECTRON_BINARY" ]; then
    log_message "ERROR: Electron binary not found at $ELECTRON_BINARY"
    # Show error in xterm if available
    if command -v xterm &> /dev/null; then
        xterm -hold -e "echo 'ERROR: Electron binary not found'; echo 'Expected at: $ELECTRON_BINARY'; echo ''; echo 'Press Ctrl+C to exit'" &
    fi
    sleep infinity
fi

log_message "Starting Electron app: $ELECTRON_BINARY"
log_message "=========================================="

# Start the Electron app with proper environment
cd "$(dirname "$ELECTRON_BINARY")"
export ELECTRON_DISABLE_SANDBOX=1

# Run Electron app and restart it if it crashes
while true; do
    log_message "Launching Electron app..."
    "$ELECTRON_BINARY" >> "$LOG_FILE" 2>&1
    EXIT_CODE=$?
    log_message "Electron app exited with code: $EXIT_CODE"
    
    # If exit code is 0, it was a clean exit, so don't restart
    if [ $EXIT_CODE -eq 0 ]; then
        log_message "Clean exit detected, shutting down..."
        break
    fi
    
    log_message "Restarting in 5 seconds..."
    sleep 5
done

log_message "X session ending"
EOF

    # Replace the placeholder with actual path
    sed -i "s|__ELECTRON_PROD_DIR__|$ELECTRON_PROD_DIR|g" "$XINITRC"
    
    # Set permissions
    chown "$TARGET_USER:$TARGET_USER" "$XINITRC"
    chmod +x "$XINITRC"
    
    log_info "Created $XINITRC"
}

# Function to configure bash profile to start X
configure_bash_profile() {
    log_info "Configuring bash profile to start X on login..."
    
    # Create or update .bash_profile to start X on tty1
    cat > "$BASH_PROFILE" << 'EOF'
# Start X session on tty1 login
if [[ -z $DISPLAY ]] && [[ $(tty) = /dev/tty1 ]]; then
    # Redirect all output to log file for silent boot
    exec > "$HOME/x-startup.log" 2>&1
    exec startx "$HOME/.xinitrc" -- -dpi 96 -quiet
fi
EOF
    
    # Set permissions
    chown "$TARGET_USER:$TARGET_USER" "$BASH_PROFILE"
    chmod +x "$BASH_PROFILE"
    
    log_info "Created $BASH_PROFILE"
}

# Function to disable desktop environments
disable_desktop_environments() {
    log_info "Disabling desktop environments..."
    
    # Disable lightdm (display manager)
    if systemctl is-enabled lightdm &>/dev/null; then
        systemctl disable lightdm
        log_info "Disabled lightdm"
    fi
    
    # Disable other common display managers
    for dm in gdm gdm3 sddm xdm; do
        if systemctl is-enabled "$dm" &>/dev/null; then
            systemctl disable "$dm"
            log_info "Disabled $dm"
        fi
    done
    
    # Set default target to multi-user (text mode)
    systemctl set-default multi-user.target
    log_info "Set default target to multi-user.target"
    
    # Ensure NetworkManager stays enabled for WiFi connectivity
    if systemctl list-unit-files | grep -q NetworkManager.service; then
        systemctl enable NetworkManager.service 2>/dev/null || log_warn "Could not enable NetworkManager"
        log_info "NetworkManager enabled (WiFi settings preserved)"
    fi
}

# Function to create uninstall script
create_uninstall_script() {
    local uninstall_script="$SCRIPT_DIR/disable_kiosk_mode.sh"
    
    cat > "$uninstall_script" << EOF
#!/bin/bash
# Script to disable kiosk mode and restore normal boot
#
# To run this script when in kiosk mode:
#   1. Press Ctrl+Alt+F2 to switch to TTY2 (or F3, F4, F5, F6)
#   2. Login with your username and password
#   3. Run: sudo $SCRIPT_DIR/disable_kiosk_mode.sh
#   4. Press Ctrl+Alt+F1 to return to the kiosk display (or just reboot)

set -e

if [ "\$EUID" -ne 0 ]; then
    echo "Error: This script must be run as root (use sudo)"
    exit 1
fi

echo "Disabling kiosk mode..."

# Remove autologin
rm -f /etc/systemd/system/getty@tty1.service.d/autologin.conf
rmdir /etc/systemd/system/getty@tty1.service.d 2>/dev/null || true

# Remove X session files
rm -f "$XINITRC"
rm -f "$BASH_PROFILE"

# Re-enable desktop environment
systemctl set-default graphical.target
systemctl enable lightdm 2>/dev/null || true

echo "✓ Kiosk mode disabled"
echo "✓ System will boot normally on next restart"
echo ""
echo "To reboot now: sudo reboot"
EOF

    chmod +x "$uninstall_script"
    log_info "Created uninstall script: $uninstall_script"
}

# Function to show completion message
show_completion() {
    echo ""
    echo "=================================================="
    log_info "Kiosk mode configuration complete!"
    echo "=================================================="
    echo ""
    echo "Configuration:"
    echo "  User: $TARGET_USER"
    echo "  Electron app: $ELECTRON_PROD_DIR/sunrise-alarm"
    echo "  X session: $XINITRC"
    echo "  Auto-login: enabled on tty1"
    echo ""
    
    # Check network status
    if systemctl is-enabled --quiet NetworkManager.service 2>/dev/null; then
        echo "Network: NetworkManager enabled (WiFi settings preserved)"
    elif systemctl is-enabled --quiet networking.service 2>/dev/null; then
        echo "Network: Networking service enabled"
    else
        log_warn "No network management service detected"
    fi
    
    # Check Bluetooth status
    if [ -f "/etc/bluetooth/main.conf" ] && systemctl is-enabled --quiet bluetooth.service 2>/dev/null; then
        echo "Bluetooth: Configured (will start automatically)"
        if systemctl is-enabled --quiet bluetooth-media-agent.service 2>/dev/null; then
            echo "  Media control: Enabled"
        fi
    else
        echo "Bluetooth: Not configured"
        echo "  To enable: sudo $PROJECT_ROOT/scripts/bluetooth-setup/setup-bluetooth-speaker.sh"
    fi
    
    # Check EasyEffects status
    if [ -f "$USER_HOME/.config/easyeffects/output/default.json" ]; then
        echo "EasyEffects DSP: Configured (will start automatically)"
    else
        echo "EasyEffects DSP: Not configured"
    fi
    
    echo ""
    echo "The system will boot into X and run only the Electron app."
    echo "No desktop environment will be loaded."
    echo ""
    echo "Accessing terminal in kiosk mode:"
    echo "  Press Ctrl+Alt+F2 to switch to TTY2 (text console)"
    echo "  Login and run commands as needed"
    echo "  Press Ctrl+Alt+F1 to return to kiosk display"
    echo ""
    echo "Useful commands:"
    echo "  View logs: tail -f $STARTUP_LOG"
    echo "  Disable kiosk mode: sudo $SCRIPT_DIR/disable_kiosk_mode.sh"
    echo "  Test X session: sudo -u $TARGET_USER startx $XINITRC"
    if systemctl is-enabled --quiet bluetooth.service 2>/dev/null; then
        echo "  Bluetooth status: systemctl status bluetooth"
        echo "  Media agent status: systemctl status bluetooth-media-agent"
    fi
    echo ""
    echo "To apply changes, reboot the system:"
    echo "  sudo reboot"
    echo ""
}

# Main function
main() {
    echo "=================================================="
    echo "Sunrise Alarm Kiosk Mode Setup"
    echo "=================================================="
    echo ""
    
    check_root
    validate_setup
    install_packages
    configure_quiet_boot
    configure_boot_config
    configure_autologin
    configure_easyeffects
    create_xsession_script
    configure_bash_profile
    disable_desktop_environments
    create_uninstall_script
    show_completion
}

# Run main function
main "$@"
