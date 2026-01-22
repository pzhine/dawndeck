#!/bin/bash

# Script to upload Arduino sketch from SSH session
# Reads port configuration from electron/config.json

set -e

# Derive project root from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$HOME/.config/sunrise-alarm/config.json"
SKETCH_PATH="$PROJECT_ROOT/arduino/sunrise-neo/sunrise-neo.ino"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if config.json exists
if [ ! -f "$CONFIG_FILE" ]; then
    log_error "Config file not found at $CONFIG_FILE"
    log_warn "Please create config.json based on config.example.json"
    exit 1
fi

# Check if sketch exists
if [ ! -f "$SKETCH_PATH" ]; then
    log_error "Arduino sketch not found at $SKETCH_PATH"
    exit 1
fi

# Extract Arduino configuration from config.json
ARDUINO_PORT=$(jq -r '.arduino.port // empty' "$CONFIG_FILE")
BOARD_TYPE=$(jq -r '.arduino.boardType // "arduino:avr:uno"' "$CONFIG_FILE")

if [ -z "$ARDUINO_PORT" ]; then
    log_error "Arduino port not configured in $CONFIG_FILE"
    echo "Please add the arduino.port field to your config.json:"
    echo '  "arduino": {'
    echo '    "port": "/dev/ttyUSB0"'
    echo '  }'
    exit 1
fi

# Check if arduino-cli is installed
if ! command -v arduino-cli &> /dev/null; then
    log_error "arduino-cli is not installed"
    echo ""
    echo "To install on Raspberry Pi:"
    echo "  curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh"
    echo "  sudo mv bin/arduino-cli /usr/local/bin/"
    echo "  arduino-cli config init"
    echo "  arduino-cli core update-index"
    echo "  arduino-cli core install arduino:avr"
    echo ""
    echo "Then install required libraries:"
    echo "  arduino-cli lib install \"Adafruit NeoPixel\""
    exit 1
fi

log_info "Found Arduino sketch at $SKETCH_PATH"
log_info "Board type: $BOARD_TYPE"
log_info "Port: $ARDUINO_PORT"

# Check if port exists
if [ ! -e "$ARDUINO_PORT" ]; then
    log_warn "Port $ARDUINO_PORT does not exist"
    echo ""
    echo "Available serial ports:"
    ls -la /dev/tty* 2>/dev/null | grep -E "(USB|ACM)" || echo "  No USB serial ports found"
    exit 1
fi

# Compile the sketch
log_info "Compiling sketch..."
if ! arduino-cli compile --fqbn "$BOARD_TYPE" "$SKETCH_PATH"; then
    log_error "Compilation failed"
    exit 1
fi

log_info "Compilation successful"

# Upload to Arduino
log_info "Uploading to Arduino on $ARDUINO_PORT..."
if ! arduino-cli upload -p "$ARDUINO_PORT" --fqbn "$BOARD_TYPE" "$SKETCH_PATH"; then
    log_error "Upload failed"
    echo ""
    echo "Troubleshooting:"
    echo "  - Check that Arduino is connected to $ARDUINO_PORT"
    echo "  - Ensure user has permission: sudo usermod -a -G dialout \$USER"
    echo "  - You may need to log out and back in for group changes to take effect"
    echo "  - Try: arduino-cli board list"
    exit 1
fi

log_info "Upload successful!"
echo ""
echo "Arduino is now running the updated sketch."
echo "The device will restart and enter startup pulse mode."
