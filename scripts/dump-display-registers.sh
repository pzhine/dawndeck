#!/bin/bash

# Simple I2C Register Dumper
# Dumps all registers from display controller before and after Pi initialization

I2C_BUS=1  # Change to 0 if using I2C0
DISPLAY_ADDR=0x45

echo "Waveshare Display Register Dumper"
echo "=================================="
echo ""

if [ "$EUID" -ne 0 ]; then 
  echo "Please run as root: sudo $0"
  exit 1
fi

# Install i2c-tools if needed
if ! command -v i2cget &> /dev/null; then
    apt-get install -y i2c-tools
fi

echo "Reading all registers (0x00 to 0xFF) from display controller at 0x$DISPLAY_ADDR"
echo "on I2C bus $I2C_BUS..."
echo ""

# Try to read each register
for reg in $(seq 0 255); do
    REG_HEX=$(printf "0x%02X" $reg)
    VALUE=$(i2cget -y $I2C_BUS $DISPLAY_ADDR $REG_HEX 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        echo "Register $REG_HEX = $VALUE"
    fi
done

echo ""
echo "Dump complete. Look for patterns in the register values."
echo "Common patterns:"
echo "  - 0x00 or 0xFF = unimplemented/reset"
echo "  - Consecutive readable registers = valid register range"
echo "  - Look for power/enable bits that differ from Arduino tests"
