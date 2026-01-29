#!/bin/bash

# Script to disable laptop touchscreen
# Run with: sudo bash disable_touchscreen.sh

echo "Checking for touchscreen devices..."

# Check if xinput is installed
if ! command -v xinput &> /dev/null; then
    echo "Installing xinput..."
    sudo apt update && sudo apt install -y xinput
fi

# List all input devices
echo ""
echo "Available input devices:"
xinput list

# Find touchscreen device
TOUCHSCREEN=$(xinput list | grep -iE "touchscreen|touch screen|ELAN.*touch" | head -1 | sed 's/.*id=\([0-9]*\).*/\1/')

if [ -z "$TOUCHSCREEN" ]; then
    echo ""
    echo "Touchscreen not found in xinput list. Trying alternative method..."
    # Try to find by name pattern
    TOUCHSCREEN=$(xinput list | grep -i "ELAN" | grep -v "Stylus" | head -1 | sed 's/.*id=\([0-9]*\).*/\1/')
fi

if [ -z "$TOUCHSCREEN" ]; then
    echo ""
    echo "Could not automatically detect touchscreen."
    echo "Please run 'xinput list' and identify your touchscreen device ID, then run:"
    echo "  xinput disable <device_id>"
    exit 1
fi

echo ""
echo "Found touchscreen device ID: $TOUCHSCREEN"
echo "Disabling touchscreen..."

# Disable the touchscreen
xinput disable $TOUCHSCREEN

if [ $? -eq 0 ]; then
    echo "✓ Touchscreen disabled successfully!"
    echo ""
    echo "To re-enable it later, run:"
    echo "  xinput enable $TOUCHSCREEN"
    echo ""
    echo "To make this permanent, add this line to your ~/.bashrc or ~/.profile:"
    echo "  xinput disable $TOUCHSCREEN"
else
    echo "✗ Failed to disable touchscreen. You may need to run this script with sudo."
    exit 1
fi

