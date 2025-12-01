#!/bin/bash

# Waveshare Display I2C Traffic Sniffer
# This script captures the I2C commands sent by the kernel driver during display initialization
# Run this on the Raspberry Pi to see what commands wake up the display

echo "Waveshare Display I2C Sniffer"
echo "=============================="
echo ""
echo "This script will:"
echo "1. Enable I2C kernel debugging"
echo "2. Remove the display driver"
echo "3. Capture I2C traffic while reloading the driver"
echo "4. Show you the exact I2C commands sent to address 0x45"
echo ""
echo "Prerequisites:"
echo "  - Display must be currently working with kernel driver"
echo "  - Run as root (sudo)"
echo "  - i2c-tools package installed: sudo apt-get install i2c-tools"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "Error: Please run as root (sudo $0)"
  exit 1
fi

# Check if i2c-tools is installed
if ! command -v i2cdump &> /dev/null; then
    echo "Installing i2c-tools..."
    apt-get update
    apt-get install -y i2c-tools
fi

echo "Which I2C bus is your display on? (I2C0 or I2C1)"
read -p "Enter bus number (0 or 1): " I2C_BUS

if [ "$I2C_BUS" != "0" ] && [ "$I2C_BUS" != "1" ]; then
    echo "Invalid bus number. Using I2C1 (most common)"
    I2C_BUS=1
fi

echo ""
echo "Step 1: Current I2C devices on bus $I2C_BUS:"
i2cdetect -y $I2C_BUS

echo ""
echo "Step 2: Reading current registers from display controller (0x45)..."
echo "First 16 registers:"
i2cdump -y $I2C_BUS 0x45 b 0x00 0x0F 2>/dev/null || echo "Could not read registers"

echo ""
echo "Step 3: Enabling I2C debugging..."
# Enable I2C debugging in kernel
echo 8 > /proc/sys/kernel/printk
modprobe i2c-dev

echo ""
echo "Step 4: Capturing kernel messages..."
# Start capturing kernel messages in background
dmesg -C  # Clear existing messages
dmesg -w > /tmp/i2c_capture.log &
DMESG_PID=$!

echo "Waiting 2 seconds for logger to start..."
sleep 2

echo ""
echo "Step 5: Reloading display driver..."
echo "Removing WS_xinchDSI_Screen module..."
rmmod WS_xinchDSI_Screen 2>/dev/null || echo "Driver not loaded"

sleep 2

echo "Reloading WS_xinchDSI_Screen module..."
modprobe WS_xinchDSI_Screen

sleep 3

echo ""
echo "Step 6: Stopping capture..."
kill $DMESG_PID
sleep 1

echo ""
echo "Step 7: Display controller registers after initialization:"
i2cdump -y $I2C_BUS 0x45 b 0x00 0x0F 2>/dev/null || echo "Could not read registers"

echo ""
echo "Step 8: Analyzing captured I2C traffic..."
echo "=========================================="
grep -i "i2c\|0x45" /tmp/i2c_capture.log | grep -v "^$" > /tmp/i2c_filtered.log

if [ -s /tmp/i2c_filtered.log ]; then
    echo "I2C-related kernel messages:"
    cat /tmp/i2c_filtered.log
else
    echo "No I2C debug messages captured."
    echo "The driver might use direct I2C transactions that aren't logged."
    echo ""
    echo "Alternative: Checking dmesg for driver messages..."
    dmesg | tail -50 | grep -i "dsi\|display\|0x45"
fi

echo ""
echo "=========================================="
echo "Complete log saved to: /tmp/i2c_capture.log"
echo ""
echo "If no I2C commands were captured, the driver might:"
echo "1. Use direct memory-mapped I2C (bypasses logging)"
echo "2. Initialize via device tree overlays"
echo "3. Use GPIO bit-banging instead of I2C driver"
echo ""
echo "Next step: Try using i2c-trace or logic analyzer for hardware-level capture"
