#!/bin/bash

# Script to install and configure arduino-cli for SparkFun Pro Micro
# This sets up everything needed to upload Arduino sketches

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_step() {
    echo -e "${BLUE}==>${NC} $1"
}

echo "=================================================="
echo "Arduino CLI Setup for Sunrise Alarm"
echo "=================================================="
echo ""

# Check if arduino-cli is already installed
if command -v arduino-cli &> /dev/null; then
    CURRENT_VERSION=$(arduino-cli version | grep -oP 'arduino-cli.*Version: \K[0-9.]+' || echo "unknown")
    log_info "arduino-cli is already installed (version: $CURRENT_VERSION)"
    read -p "Reinstall? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        SKIP_INSTALL=true
    else
        SKIP_INSTALL=false
    fi
else
    SKIP_INSTALL=false
fi

# Install arduino-cli
if [ "$SKIP_INSTALL" = false ]; then
    log_step "Installing arduino-cli..."
    
    # Download and run the install script
    cd /tmp
    curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh > arduino_install.sh
    chmod +x arduino_install.sh
    
    # Run installer (creates bin/ directory in current location)
    sh arduino_install.sh
    
    # Move to /usr/local/bin
    sudo mv bin/arduino-cli /usr/local/bin/
    
    # Cleanup
    rm -rf bin arduino_install.sh
    
    log_info "arduino-cli installed to /usr/local/bin/arduino-cli"
    
    # Verify installation
    if ! command -v arduino-cli &> /dev/null; then
        log_error "Installation failed - arduino-cli not found in PATH"
        exit 1
    fi
    
    VERSION=$(arduino-cli version | grep -oP 'arduino-cli.*Version: \K[0-9.]+' || echo "unknown")
    log_info "Installed version: $VERSION"
fi

# Initialize configuration
log_step "Initializing arduino-cli configuration..."
if [ ! -f "$HOME/.arduino15/arduino-cli.yaml" ]; then
    arduino-cli config init
    log_info "Configuration initialized"
else
    log_info "Configuration already exists"
fi

# Add SparkFun boards URL
log_step "Adding SparkFun board manager URL..."
SPARKFUN_URL="https://raw.githubusercontent.com/sparkfun/Arduino_Boards/master/IDE_Board_Manager/package_sparkfun_index.json"

if arduino-cli config dump | grep -q "$SPARKFUN_URL"; then
    log_info "SparkFun URL already configured"
else
    arduino-cli config add board_manager.additional_urls "$SPARKFUN_URL"
    log_info "SparkFun URL added"
fi

# Update board index
log_step "Updating board package index..."
arduino-cli core update-index
log_info "Index updated"

# Install SparkFun AVR core
log_step "Installing SparkFun AVR boards..."
if arduino-cli core list | grep -qi "SparkFun:avr"; then
    INSTALLED_VERSION=$(arduino-cli core list | grep -i "SparkFun:avr" | awk '{print $2}')
    log_info "SparkFun AVR core already installed (version: $INSTALLED_VERSION)"
    
    # Check for updates
    log_step "Checking for updates..."
    if arduino-cli core upgrade SparkFun:avr 2>&1 | grep -q "already at the latest version"; then
        log_info "Core is up to date"
    else
        log_info "Core upgraded"
    fi
else
    arduino-cli core install SparkFun:avr
    log_info "SparkFun AVR core installed"
fi

# Install Adafruit NeoPixel library
log_step "Installing Adafruit NeoPixel library..."
if arduino-cli lib list | grep -q "Adafruit NeoPixel"; then
    INSTALLED_VERSION=$(arduino-cli lib list | grep "Adafruit NeoPixel" | awk '{print $2}')
    log_info "Adafruit NeoPixel already installed (version: $INSTALLED_VERSION)"
    
    # Check for updates
    log_step "Checking for library updates..."
    if arduino-cli lib upgrade "Adafruit NeoPixel" 2>&1 | grep -q "already at the latest version"; then
        log_info "Library is up to date"
    else
        log_info "Library upgraded"
    fi
else
    arduino-cli lib install "Adafruit NeoPixel"
    log_info "Adafruit NeoPixel library installed"
fi

# Add user to dialout group for serial port access
log_step "Configuring serial port permissions..."
if groups $USER | grep -q dialout; then
    log_info "User $USER is already in dialout group"
else
    log_warn "Adding user $USER to dialout group..."
    sudo usermod -a -G dialout $USER
    log_info "User added to dialout group"
    log_warn "You must log out and back in for this change to take effect"
    NEEDS_LOGOUT=true
fi

# List available boards
echo ""
log_step "Scanning for connected Arduino boards..."
BOARDS=$(arduino-cli board list 2>/dev/null)
if echo "$BOARDS" | grep -q "Port"; then
    echo "$BOARDS"
else
    log_warn "No Arduino boards detected"
    echo "Make sure your Arduino is connected via USB"
fi

# Display summary
echo ""
echo "=================================================="
log_info "Arduino CLI setup complete!"
echo "=================================================="
echo ""
echo "Installed components:"
echo "  ✓ arduino-cli"
echo "  ✓ SparkFun AVR boards (for Pro Micro)"
echo "  ✓ Adafruit NeoPixel library"
echo ""
echo "Configuration:"
echo "  Config file: $HOME/.arduino15/arduino-cli.yaml"
echo "  Libraries: $HOME/Arduino/libraries/"
echo ""
echo "Board FQBN for SparkFun Pro Micro 16MHz:"
echo "  SparkFun:avr:promicro:cpu=16MHzatmega32U4"
echo ""
echo "Add this to your ~/.config/sunrise-alarm/config.json:"
echo '  "arduino": {'
echo '    "boardType": "SparkFun:avr:promicro:cpu=16MHzatmega32U4",'
echo '    "port": "/dev/ttyACM0"'
echo '  }'
echo ""
echo "Usage:"
echo "  List boards: arduino-cli board list"
echo "  Upload sketch: ./scripts/upload_arduino.sh"
echo ""

if [ "$NEEDS_LOGOUT" = true ]; then
    log_warn "IMPORTANT: Log out and back in for serial port access to work"
fi
