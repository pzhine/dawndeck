#!/bin/bash

# Script to enable SSH password authentication on Raspberry Pi
# Usage: sudo ./enable_ssh_password_auth.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SSHD_CONFIG="/etc/ssh/sshd_config"
BACKUP_DIR="/var/backups/ssh-config"

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

# Function to backup SSH config
backup_sshd_config() {
    log_info "Backing up SSH configuration..."
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Create timestamped backup
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    cp "$SSHD_CONFIG" "$BACKUP_DIR/sshd_config_$timestamp"
    
    log_info "Backup created: $BACKUP_DIR/sshd_config_$timestamp"
}

# Function to enable password authentication
enable_password_auth() {
    log_info "Configuring SSH to allow password authentication..."
    
    # Create a temporary file
    local temp_config=$(mktemp)
    
    # Read the config and modify settings
    local modified=false
    
    # Process the config file
    while IFS= read -r line; do
        # Handle PasswordAuthentication
        if [[ "$line" =~ ^[[:space:]]*#?[[:space:]]*PasswordAuthentication ]]; then
            echo "PasswordAuthentication yes"
            modified=true
        # Handle ChallengeResponseAuthentication (deprecated but may exist)
        elif [[ "$line" =~ ^[[:space:]]*#?[[:space:]]*ChallengeResponseAuthentication ]]; then
            echo "# ChallengeResponseAuthentication yes  # Deprecated, using PasswordAuthentication"
            modified=true
        # Handle KbdInteractiveAuthentication (newer alternative)
        elif [[ "$line" =~ ^[[:space:]]*#?[[:space:]]*KbdInteractiveAuthentication ]]; then
            echo "KbdInteractiveAuthentication yes"
            modified=true
        # Handle UsePAM (should be yes for password auth)
        elif [[ "$line" =~ ^[[:space:]]*#?[[:space:]]*UsePAM ]]; then
            echo "UsePAM yes"
            modified=true
        else
            echo "$line"
        fi
    done < "$SSHD_CONFIG" > "$temp_config"
    
    # If PasswordAuthentication wasn't in the file, add it
    if ! grep -q "^PasswordAuthentication" "$temp_config"; then
        echo "" >> "$temp_config"
        echo "# Enable password authentication" >> "$temp_config"
        echo "PasswordAuthentication yes" >> "$temp_config"
        echo "UsePAM yes" >> "$temp_config"
    fi
    
    # Move the temp config to replace the original
    mv "$temp_config" "$SSHD_CONFIG"
    chmod 644 "$SSHD_CONFIG"
    
    log_info "SSH configuration updated"
}

# Function to validate SSH config
validate_config() {
    log_info "Validating SSH configuration..."
    
    if sshd -t 2>&1; then
        log_info "SSH configuration is valid"
        return 0
    else
        log_error "SSH configuration has errors"
        log_warn "Restoring from backup..."
        
        # Find the most recent backup
        local latest_backup=$(ls -t "$BACKUP_DIR"/sshd_config_* 2>/dev/null | head -1)
        if [ -n "$latest_backup" ]; then
            cp "$latest_backup" "$SSHD_CONFIG"
            log_info "Restored configuration from: $latest_backup"
        fi
        return 1
    fi
}

# Function to restart SSH service
restart_ssh() {
    log_info "Restarting SSH service..."
    
    if systemctl restart sshd 2>/dev/null || systemctl restart ssh 2>/dev/null; then
        log_info "SSH service restarted successfully"
    else
        log_error "Failed to restart SSH service"
        return 1
    fi
}

# Function to show current SSH status
show_status() {
    echo ""
    echo "=================================================="
    log_info "SSH Password Authentication Enabled"
    echo "=================================================="
    echo ""
    echo "Current SSH configuration:"
    echo ""
    
    # Show relevant settings
    echo "PasswordAuthentication:"
    grep "^PasswordAuthentication" "$SSHD_CONFIG" || echo "  (not explicitly set)"
    
    echo ""
    echo "UsePAM:"
    grep "^UsePAM" "$SSHD_CONFIG" || echo "  (not explicitly set)"
    
    echo ""
    echo "KbdInteractiveAuthentication:"
    grep "^KbdInteractiveAuthentication" "$SSHD_CONFIG" || echo "  (not explicitly set)"
    
    echo ""
    echo "SSH Service Status:"
    if systemctl is-active --quiet sshd 2>/dev/null || systemctl is-active --quiet ssh 2>/dev/null; then
        echo "  ✓ Running"
    else
        echo "  ✗ Not running"
    fi
    
    echo ""
    echo "You can now SSH into this system using:"
    echo "  ssh username@$(hostname -I | awk '{print $1}')"
    echo ""
    echo "Backups are stored in: $BACKUP_DIR"
    echo ""
}

# Function to create script to disable password auth
create_disable_script() {
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local disable_script="$script_dir/disable_ssh_password_auth.sh"
    
    cat > "$disable_script" << 'EOF'
#!/bin/bash
# Script to disable SSH password authentication (key-only)

set -e

if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run as root (use sudo)"
    exit 1
fi

echo "Disabling SSH password authentication..."

SSHD_CONFIG="/etc/ssh/sshd_config"
temp_config=$(mktemp)

# Process the config file
while IFS= read -r line; do
    if [[ "$line" =~ ^[[:space:]]*#?[[:space:]]*PasswordAuthentication ]]; then
        echo "PasswordAuthentication no"
    elif [[ "$line" =~ ^[[:space:]]*#?[[:space:]]*KbdInteractiveAuthentication ]]; then
        echo "KbdInteractiveAuthentication no"
    else
        echo "$line"
    fi
done < "$SSHD_CONFIG" > "$temp_config"

mv "$temp_config" "$SSHD_CONFIG"
chmod 644 "$SSHD_CONFIG"

# Restart SSH
systemctl restart sshd 2>/dev/null || systemctl restart ssh 2>/dev/null

echo "✓ SSH password authentication disabled"
echo "✓ SSH now requires key-based authentication only"
EOF

    chmod +x "$disable_script"
    log_info "Created disable script: $disable_script"
}

# Main function
main() {
    echo "=================================================="
    echo "Enable SSH Password Authentication"
    echo "=================================================="
    echo ""
    
    check_root
    backup_sshd_config
    enable_password_auth
    
    if validate_config; then
        restart_ssh
        create_disable_script
        show_status
    else
        log_error "Configuration validation failed. Changes have been reverted."
        exit 1
    fi
}

# Run main function
main "$@"
