# Touch Input Tester

## Overview

The Touch Input Tester is a visual debugging tool designed to help analyze and filter problematic touch inputs from touchscreens that report false touches. It provides real-time visualization of touch gestures and helps identify patterns in touch behavior.

## Accessing the Tester

### Via Menu
- **macOS/Linux**: Navigate to `Advanced -> Touch Input Tester`
- **Keyboard Shortcut**: `Cmd+Shift+T` (macOS) or `Ctrl+Shift+T` (Linux/Windows)

The tester will open in a full-screen debugging interface.

## Features

### Visual Feedback

1. **Drag Path Visualization**
   - Continuous touch movements are drawn as colored paths on the screen
   - Each touch point is assigned a unique color for easy tracking
   - Paths automatically fade out after 5 seconds to keep the display clean
   - Path color indicates the touch identifier

2. **Tap Hotspots**
   - Quick taps (< 300ms, < 10px movement) are shown as circular hotspots
   - Hotspots display a unique ID number
   - Green color indicates a valid tap gesture
   - Hotspots fade out after 2 seconds

3. **False Touch Detection**
   - Very brief touches (< 50ms with < 5px movement) are classified as false touches
   - False touches increment the counter but don't create visual marks
   - Helps identify noise from the touchscreen

### Statistics Panel

The top stats bar displays real-time metrics:
- **Active Touches**: Number of fingers/touches currently on screen
- **Total Taps**: Count of valid tap gestures detected
- **Total Drags**: Count of drag/swipe gestures detected
- **False Touches**: Count of detected false/spurious touches

### Touch Details Panel

The bottom panel shows detailed information about each active touch:
- Touch ID with color-coded identifier
- Current position (X, Y coordinates)
- Distance traveled from start point
- Duration of the touch
- Gesture type classification (tap/drag/false)

### Controls

- **Clear Paths**: Removes all visual paths and resets counters
- **Back**: Returns to the main clock screen

## Touch Gesture Classification

The tester uses the following logic to classify touches:

| Gesture Type | Criteria |
|--------------|----------|
| **False Touch** | Duration < 50ms AND distance < 5px |
| **Tap** | Duration < 300ms AND distance < 10px |
| **Drag** | Duration > 300ms OR distance > 10px |

## Use Cases

### 1. Identifying False Touches
Monitor the "False Touches" counter to see how frequently spurious touches occur. High counts indicate hardware issues or need for better filtering.

### 2. Testing Touch Sensitivity
Draw patterns on the screen and observe:
- Are paths smooth or jittery?
- Do touches start/end predictably?
- Are there gaps in continuous movements?

### 3. Multi-touch Testing
Use multiple fingers simultaneously to test:
- How many simultaneous touches are detected?
- Do touches interfere with each other?
- Are all touch points tracked accurately?

### 4. Calibrating Touch Filters
Use the visual feedback to determine appropriate thresholds for:
- Minimum touch duration
- Minimum movement distance
- Touch debouncing intervals

## Color Legend

- 🟢 **Green (#00ff88)**: Valid tap gestures
- 🔴 **Red (#ff6b6b)**: Drag gestures
- 🟡 **Yellow (#ffd93d)**: False/spurious touches
- 🌈 **Various Colors**: Individual touch identifiers for multi-touch scenarios

## Desktop Testing

The tester also supports mouse input for testing on development machines:
- Click and hold to start a touch
- Move while holding to create a drag path
- Release to end the touch
- Single clicks create taps

## Implementation Notes

### For Future Touch Filtering

Based on observations from the tester, consider implementing:

1. **Debouncing**: Ignore touches shorter than a threshold (e.g., 50ms)
2. **Movement Threshold**: Require minimum movement before treating as drag
3. **Touch Delay**: Add slight delay before accepting touch input
4. **Palm Rejection**: Filter large touch areas or touches near edges
5. **Velocity Analysis**: Track touch velocity to identify legitimate gestures

### Data Export (Future Enhancement)

Consider adding:
- CSV export of touch event data
- Session recording/playback
- Statistical analysis of touch patterns
- Heat map visualization of frequent touch areas
