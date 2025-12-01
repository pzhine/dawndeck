#!/bin/bash

# Simple I2C Traffic Monitor
# Works with device tree overlay-based drivers (newer Raspberry Pi OS)

echo "Simple I2C Traffic Monitor for Waveshare Display"
echo "=================================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "Please run as root: sudo $0"
  exit 1
fi

# Install i2c-tools if needed
if ! command -v i2cget &> /dev/null; then
    echo "Installing i2c-tools..."
    apt-get update && apt-get install -y i2c-tools
fi

# Detect which I2C bus the display is on
echo "Detecting I2C configuration..."
for bus in 0 1 10; do
    if i2cdetect -y $bus 2>/dev/null | grep -q "45"; then
        DISPLAY_BUS=$bus
        echo "Display controller found on I2C bus $bus"
        break
    fi
done

if [ -z "$DISPLAY_BUS" ]; then
    echo "Error: Display controller (0x45) not found on any I2C bus"
    echo "Make sure display is connected and powered"
    exit 1
fi

# Also check for touch controller
for bus in 0 1 10; do
    if i2cdetect -y $bus 2>/dev/null | grep -q "14"; then
        TOUCH_BUS=$bus
        echo "Touch controller found on I2C bus $bus"
        break
    fi
done

echo ""
echo "=== Current I2C Device Scan ==="
i2cdetect -y $DISPLAY_BUS

echo ""
echo "=== Reading Display Controller Registers (0x45) ==="
echo "Attempting to read first 32 registers..."
echo ""

# Read and display registers that respond
for reg in $(seq 0 31); do
    REG_HEX=$(printf "0x%02X" $reg)
    VALUE=$(i2cget -y $DISPLAY_BUS 0x45 $REG_HEX 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        echo "Register $REG_HEX = $VALUE"
    fi
done

echo ""
echo "=== Testing Write Capability ==="
# Try writing to register 0x00 and reading back
echo "Current value of register 0x00:"
ORIG_VAL=$(i2cget -y $DISPLAY_BUS 0x45 0x00 2>/dev/null)
echo "  Before: $ORIG_VAL"

echo ""
echo "Attempting to write 0x01 to register 0x00..."
i2cset -y $DISPLAY_BUS 0x45 0x00 0x01 2>/dev/null

sleep 0.1

NEW_VAL=$(i2cget -y $DISPLAY_BUS 0x45 0x00 2>/dev/null)
echo "  After:  $NEW_VAL"

if [ "$ORIG_VAL" != "$NEW_VAL" ]; then
    echo "✓ Register changed! Display controller accepts writes."
else
    echo "✗ Register unchanged. Controller may be read-only or ignoring writes."
fi

echo ""
echo "=== Checking dmesg for Display Messages ==="
dmesg | grep -i "dsi\|display\|waveshare\|0x45" | tail -20

echo ""
echo "=== Device Tree Overlays ==="
echo "Active overlays in /boot/firmware/config.txt:"
grep -E "^dtoverlay=.*dsi|^dtoverlay=.*waveshare" /boot/firmware/config.txt 2>/dev/null || \
grep -E "^dtoverlay=.*dsi|^dtoverlay=.*waveshare" /boot/config.txt 2>/dev/null || \
echo "No DSI overlays found in config.txt"

echo ""
echo "=== Next Steps ==="
echo "1. The display controller at 0x45 responds to I2C but may need specific sequence"
echo "2. Check if register values change after reboot (when display works)"
echo "3. The device tree overlay handles initialization, not kernel modules"
echo "4. You may need to capture I2C at hardware level (logic analyzer)"
echo ""
echo "To compare, run this script twice:"
echo "  - Once when display is NOT working (before Pi initializes it)"
echo "  - Once when display IS working (after Pi boots)"
echo "  - Compare the register values to see what changed"
