#!/bin/bash

# Script to test Sunrise Alarm NeoPixel controller via Serial
# Usage: ./test-sunrise-neo.sh <serial_port>

PORT=$1

if [ -z "$PORT" ]; then
    echo "Usage: $0 <serial_port>"
    echo "Example: $0 /dev/ttyUSB0"
    echo "Available ports:"
    ls /dev/ttyUSB* /dev/ttyACM* 2>/dev/null
    exit 1
fi

if [ ! -e "$PORT" ]; then
    echo "Error: Port $PORT does not exist."
    exit 1
fi

echo "Configuring $PORT..."
# Configure serial port (Linux/Raspi syntax)
# 9600 baud, 8 data bits, no parity, 1 stop bit, no flow control
stty -F "$PORT" 9600 cs8 -cstopb -parenb -crtscts

# Open file descriptor 3 to the serial port
# This keeps the connection open prevents Arduino reset on each echo
exec 3<> "$PORT"

echo "Waiting for Arduino to stabilize..."
sleep 2

send_cmd() {
    local cmd="$1"
    echo "Sending: $cmd"
    echo "$cmd" >&3
    # Small delay to ensure Arduino processes command
    sleep 0.1 
}

echo "Starting LED Test Suite..."

# 1. Initialize Brightness
send_cmd "SET_BRIGHTNESS 0 255"
send_cmd "SET_BRIGHTNESS 1 255"

# 2. Test Lamp (Strip 0) Basic Colors
echo "--- Testing Lamp (Strip 0) ---"
send_cmd "LERP_LED 0 0 255 0 0 500"   # Red
sleep 0.8
send_cmd "LERP_LED 0 0 0 255 0 500"   # Green
sleep 0.8
send_cmd "LERP_LED 0 0 0 0 255 500"   # Blue
sleep 0.8
send_cmd "LERP_LED 0 0 0 0 0 500"     # Off
sleep 0.8

# 3. Test Spot (Strip 1) Basic Colors
echo "--- Testing Spot (Strip 1) ---"
send_cmd "LERP_LED 1 0 255 0 0 500"   # Red
sleep 0.8
send_cmd "LERP_LED 1 0 0 255 0 500"   # Green
sleep 0.8
send_cmd "LERP_LED 1 0 0 0 255 500"   # Blue
sleep 0.8
send_cmd "LERP_LED 1 0 0 0 0 500"     # Off
sleep 0.8

# 4. Color Mixing and Crossfading
echo "--- Testing Mixing & Crossfading ---"
# Lamp becomes Warm White, Spot becomes Cool White
send_cmd "LERP_LED 0 0 255 180 40 1000"  # Warm
send_cmd "LERP_LED 1 0 200 200 255 1000" # Cool
sleep 2

# Swap
send_cmd "LERP_LED 0 0 200 200 255 1000"
send_cmd "LERP_LED 1 0 255 180 40 1000"
sleep 2

# 5. Fade Out
echo "--- Fading Out ---"
send_cmd "LERP_LED 0 0 0 0 0 2000"
send_cmd "LERP_LED 1 0 0 0 0 2000"
sleep 2.5

echo "Test Complete."

# Close file descriptor
exec 3>&-
