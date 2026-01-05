#!/bin/bash
# Test script for Bluetooth media socket

echo "Testing Bluetooth media socket communication..."
echo ""

# Check if socket exists
if [ ! -S "/tmp/bluetooth_media.sock" ]; then
    echo "❌ Socket not found at /tmp/bluetooth_media.sock"
    echo "Make sure bluetooth-media-agent.service is running:"
    echo "  sudo systemctl status bluetooth-media-agent"
    exit 1
fi

echo "✓ Socket found"
echo ""

# Test connection and get metadata
echo "Sending get_metadata command..."
echo '{"type":"get_metadata"}' | nc -U /tmp/bluetooth_media.sock -W 2 | jq '.'

echo ""
echo "If you see metadata above, the socket is working!"
echo ""
echo "Now try changing tracks or playing/pausing on your phone."
echo "You should see updates appear automatically below:"
echo ""

# Listen for updates (will run until Ctrl+C)
echo "Listening for automatic updates (press Ctrl+C to stop)..."
while true; do
    nc -U /tmp/bluetooth_media.sock -l 2>/dev/null | while IFS= read -r line; do
        echo "[$(date '+%H:%M:%S')] Update received:"
        echo "$line" | jq '.'
    done
    sleep 1
done
