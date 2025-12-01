#!/bin/bash

# Compare display controller state before and after initialization
# This helps identify which registers the Pi driver changes

echo "Waveshare Display State Comparison Tool"
echo "========================================"
echo ""

if [ "$EUID" -ne 0 ]; then 
  echo "Please run as root: sudo $0"
  exit 1
fi

# Install i2c-tools if needed
if ! command -v i2cget &> /dev/null; then
    apt-get install -y i2c-tools
fi

# Detect I2C bus
DISPLAY_BUS=""
for bus in 0 1 10; do
    if i2cdetect -y $bus 2>/dev/null | grep -q "45"; then
        DISPLAY_BUS=$bus
        break
    fi
done

if [ -z "$DISPLAY_BUS" ]; then
    echo "Error: Display controller (0x45) not found"
    exit 1
fi

echo "Display controller found on I2C bus $DISPLAY_BUS"
echo ""

# Function to dump all readable registers
dump_registers() {
    local output_file=$1
    echo "# Display Controller Register Dump" > $output_file
    echo "# Generated: $(date)" >> $output_file
    echo "# Bus: $DISPLAY_BUS, Address: 0x45" >> $output_file
    echo "" >> $output_file
    
    for reg in $(seq 0 255); do
        REG_HEX=$(printf "0x%02X" $reg)
        VALUE=$(i2cget -y $DISPLAY_BUS 0x45 $REG_HEX 2>/dev/null)
        
        if [ $? -eq 0 ] && [ "$VALUE" != "" ]; then
            echo "reg_${REG_HEX}=${VALUE}" >> $output_file
        fi
    done
    
    echo "Registers saved to: $output_file"
}

# Check if we have a previous dump
BEFORE_FILE="/tmp/display_regs_before.txt"
AFTER_FILE="/tmp/display_regs_after.txt"

if [ -f "$BEFORE_FILE" ]; then
    echo "Found previous dump from before display initialization."
    echo "Creating 'after' dump to compare..."
    echo ""
    
    dump_registers "$AFTER_FILE"
    
    echo ""
    echo "=== COMPARISON: What Changed ==="
    echo ""
    
    # Compare the files
    diff_output=$(diff -u "$BEFORE_FILE" "$AFTER_FILE" | grep "^[-+]reg_" | grep -v "^[-+][-+][-+]")
    
    if [ -z "$diff_output" ]; then
        echo "✗ No register changes detected"
        echo "  This could mean:"
        echo "  - Display init happens via DSI, not I2C"
        echo "  - Init happens in device tree before Linux boots"
        echo "  - Registers are write-only and can't be read back"
    else
        echo "✓ Register changes detected:"
        echo ""
        echo "$diff_output" | while IFS= read -r line; do
            if [[ $line == -reg_* ]]; then
                reg=$(echo $line | cut -d= -f1 | sed 's/-reg_//')
                val=$(echo $line | cut -d= -f2)
                echo "  $reg was $val"
            elif [[ $line == +reg_* ]]; then
                reg=$(echo $line | cut -d= -f1 | sed 's/+reg_//')
                val=$(echo $line | cut -d= -f2)
                echo "  $reg now $val"
                echo ""
            fi
        done
    fi
    
    echo ""
    echo "Full dumps available:"
    echo "  Before: $BEFORE_FILE"
    echo "  After:  $AFTER_FILE"
    
else
    echo "No previous dump found. Creating 'before' dump..."
    echo ""
    echo "INSTRUCTIONS:"
    echo "1. Run this script now (BEFORE display is initialized)"
    echo "2. Reboot the Raspberry Pi"
    echo "3. Wait for display to fully initialize and work"
    echo "4. Run this script again (AFTER display works)"
    echo "5. The script will show which registers changed"
    echo ""
    
    dump_registers "$BEFORE_FILE"
    
    echo ""
    echo "✓ Baseline dump created"
    echo "Now reboot and run this script again after display initializes"
fi

echo ""
echo "=== Additional Info ==="
echo "Display status LED: $(ls /sys/class/leds/ 2>/dev/null | grep -i display || echo 'No display LED found')"
echo "DSI status: $(ls /sys/class/drm/ 2>/dev/null | grep DSI || echo 'No DSI device found')"
