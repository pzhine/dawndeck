#!/usr/bin/env python3
# Test script for Bluetooth media socket

import socket
import json
import sys
import os
from datetime import datetime

SOCKET_PATH = "/tmp/bluetooth_media.sock"

def print_json(data):
    """Pretty print JSON data"""
    try:
        if isinstance(data, str):
            data = json.loads(data)
        print(json.dumps(data, indent=2))
    except:
        print(data)

def main():
    print("Testing Bluetooth media socket communication...")
    print()
    
    # Check if socket exists
    if not os.path.exists(SOCKET_PATH):
        print(f"❌ Socket not found at {SOCKET_PATH}")
        print("Make sure bluetooth-media-agent.service is running:")
        print("  sudo systemctl status bluetooth-media-agent")
        sys.exit(1)
    
    print("✓ Socket found")
    print()
    
    # Connect to socket
    try:
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.connect(SOCKET_PATH)
        print("✓ Connected to socket")
        print()
    except Exception as e:
        print(f"❌ Failed to connect: {e}")
        sys.exit(1)
    
    # Test get_metadata command
    try:
        print("Sending get_metadata command...")
        command = json.dumps({"type": "get_metadata"}) + "\n"
        sock.send(command.encode('utf-8'))
        
        # Read response
        response = sock.recv(4096).decode('utf-8')
        if response:
            print("Response:")
            print_json(response)
        else:
            print("No response received")
    except Exception as e:
        print(f"❌ Error: {e}")
        sock.close()
        sys.exit(1)
    
    print()
    print("✓ Socket is working!")
    print()
    print("Now try changing tracks or playing/pausing on your phone.")
    print("You should see updates appear automatically below:")
    print()
    print("Listening for automatic updates (press Ctrl+C to stop)...")
    print()
    
    # Listen for updates
    try:
        while True:
            data = sock.recv(4096).decode('utf-8')
            if data:
                timestamp = datetime.now().strftime('%H:%M:%S')
                for line in data.strip().split('\n'):
                    if line:
                        print(f"[{timestamp}] Update received:")
                        print_json(line)
                        print()
            else:
                print("Connection closed by server")
                break
    except KeyboardInterrupt:
        print("\n\nStopped listening.")
    except Exception as e:
        print(f"\n❌ Error: {e}")
    finally:
        sock.close()

if __name__ == "__main__":
    main()
