// Rock Lamp - Rotary Encoder Control
// Arduino Uno

#include <Adafruit_NeoPixel.h>
#include <EEPROM.h>

// Pin definitions
const int PIN_NEOPIXEL = 11;
const int PIN_CLK = 2;
const int PIN_DT = 3;
const int PIN_SW = 4;
const int PIN_LED = LED_BUILTIN; // Pin 13

// NeoPixel setup
#define NUM_PIXELS 2  // Change this to match your strip length
Adafruit_NeoPixel strip(NUM_PIXELS, PIN_NEOPIXEL, NEO_GRBW + NEO_KHZ800);

// Operating modes
enum OperatingMode {
  MODE_OFF = 0,
  MODE_LED0_COLOR = 1,
  MODE_LED1_COLOR = 2,
  MODE_BRIGHTNESS = 3,
  MODE_COUNT = 4
};

OperatingMode currentMode = MODE_OFF;

// LED color state (RGBW for each LED)
struct LEDState {
  int r, g, b, w;
  int phase;  // 0=W->R, 1=R->W, 2=W->G, 3=G->W, 4=W->B, 5=B->W
};

LEDState led0 = {0, 0, 0, 255, 0};  // Start with white, phase 0 (ready for W->R)
LEDState led1 = {0, 0, 0, 255, 0};  // Start with white, phase 0 (ready for W->R)

// Global brightness multiplier (0-255)
int globalBrightness = 127;  // Start at 50%

// Color transition step (configurable)
const int COLOR_STEP = 20;
const int BRIGHTNESS_STEP = 20;

// Encoder change flag
volatile bool encoderChanged = false;
volatile int encoderDelta = 0;

// Encoder state
volatile bool clkState;
volatile bool lastClkState;

// Button state
bool buttonState = HIGH;
bool lastReading = HIGH;
unsigned long lastDebounceTime = 0;
unsigned long buttonPressTime = 0;
bool longPressTriggered = false;
const unsigned long debounceDelay = 50;
const unsigned long longPressTime = 3000;

// EEPROM save state
unsigned long lastStateChangeTime = 0;
bool stateChanged = false;
const unsigned long SAVE_DELAY = 60000;  // 1 minute in milliseconds
const int EEPROM_MAGIC = 0x524C;  // "RL" magic number to verify valid data
const int EEPROM_ADDR = 0;

void setup() {
  // Initialize serial communication
  Serial.begin(9600);
  Serial.println("Rock Lamp Starting...");
  
  // Configure encoder pins
  pinMode(PIN_CLK, INPUT_PULLUP);
  pinMode(PIN_DT, INPUT_PULLUP);
  pinMode(PIN_SW, INPUT_PULLUP);
  
  // Configure LED pin
  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, LOW);
  
  // Load saved state from EEPROM
  loadState();
  
  // Initialize NeoPixel strip
  strip.begin();
  strip.setBrightness(255);  // Use full brightness, control via color values
  updateStrip();
  strip.show();
  
  // Read initial state
  lastClkState = digitalRead(PIN_CLK);
  
  // Attach interrupt for encoder rotation
  attachInterrupt(digitalPinToInterrupt(PIN_CLK), readEncoder, CHANGE);
  
  Serial.println("Ready!");
}

void loop() {
  // Handle encoder changes
  if (encoderChanged) {
    encoderChanged = false;
    handleEncoderChange(encoderDelta);
    updateStrip();
    strip.show();
    markStateChanged();
  }
  
  // Check button state
  bool reading = digitalRead(PIN_SW);
  
  // Reset debounce timer on any change
  if (reading != lastReading) {
    lastDebounceTime = millis();
  }
  lastReading = reading;
  
  // Check if enough time has passed since last change
  if ((millis() - lastDebounceTime) > debounceDelay) {
    // If the reading has been stable and different from button state
    if (reading != buttonState) {
      buttonState = reading;
      
      // Detect button press (transition from HIGH to LOW)
      if (buttonState == LOW) {
        buttonPressTime = millis();
        longPressTriggered = false;
        Serial.println("Button pressed");
      }
      // Detect button release (transition from LOW to HIGH)
      else {
        // Only cycle mode if long press wasn't triggered
        if (!longPressTriggered) {
          currentMode = (OperatingMode)((currentMode + 1) % MODE_COUNT);
          Serial.print("Mode: ");
          switch (currentMode) {
            case MODE_OFF:         
              Serial.println("OFF"); 
              break;
            case MODE_LED0_COLOR:  
              Serial.println("LED 0 Color Transition");
              blinkLED(0, 2);  // Blink LED 0 twice
              break;
            case MODE_LED1_COLOR:  
              Serial.println("LED 1 Color Transition");
              blinkLED(1, 2);  // Blink LED 1 twice
              break;
            case MODE_BRIGHTNESS:  
              Serial.println("Global Brightness");
              blinkBothLEDs();  // Blink both LEDs once
              break;
          }
          updateStrip();
          strip.show();
          markStateChanged();
        }
      }
    }
  }
  
  // Check for long press while button is held
  if (buttonState == LOW && !longPressTriggered) {
    if ((millis() - buttonPressTime) >= longPressTime) {
      longPressTriggered = true;
      Serial.println("LONG PRESS (3s) - Resetting to white");
      led0 = {0, 0, 0, 255, 0};
      led1 = {0, 0, 0, 255, 0};
      updateStrip();
      strip.show();
      markStateChanged();
    }
  }
  
  // Save to EEPROM after 3 minutes of no changes
  if (stateChanged && (millis() - lastStateChangeTime) >= SAVE_DELAY) {
    saveState();
    stateChanged = false;
  }
  
  // Small delay to prevent CPU hogging
  delay(10);
}

// Interrupt service routine for encoder
void readEncoder() {
  clkState = digitalRead(PIN_CLK);
  bool dtState = digitalRead(PIN_DT);
  
  // Only process on falling edge of CLK
  if (clkState != lastClkState && clkState == LOW) {
    // Clockwise rotation
    if (dtState == HIGH) {
      encoderDelta = 1;
      encoderChanged = true;
    }
    // Counter-clockwise rotation
    else {
      encoderDelta = -1;
      encoderChanged = true;
    }
  }
  
  lastClkState = clkState;
}

// Handle encoder rotation based on current mode
void handleEncoderChange(int delta) {
  switch (currentMode) {
    case MODE_OFF:
      // Do nothing in off mode
      break;
      
    case MODE_LED0_COLOR:
      transitionColor(led0, delta);
      break;
      
    case MODE_LED1_COLOR:
      transitionColor(led1, delta);
      break;
      
    case MODE_BRIGHTNESS:
      globalBrightness += delta * BRIGHTNESS_STEP;
      globalBrightness = constrain(globalBrightness, 0, 255);
      Serial.print("Global Brightness: ");
      Serial.print(globalBrightness);
      Serial.print("/255 (");
      Serial.print((globalBrightness * 100) / 255);
      Serial.println("%)");
      break;
  }
}

// Transition color for an LED: W -> R -> W -> G -> W -> B -> W (continuous cycle)
void transitionColor(LEDState &led, int delta) {
  int step = delta * COLOR_STEP;
  
  // Phase 0: W -> R (white decreasing, red increasing)
  if (led.phase == 0) {
    if (step > 0) {
      led.w = constrain(led.w - step, 0, 255);
      led.r = constrain(led.r + step, 0, 255);
      if (led.w == 0) { led.r = 255; led.phase = 1; }  // Move to phase 1
    } else {
      // Backward from W->R: decrease red, increase white
      led.r = constrain(led.r + step, 0, 255);  // step is negative, decreases r
      led.w = constrain(led.w - step, 0, 255);  // step is negative, increases w
      if (led.r == 0) { 
        // Switch to phase 5 (B->W), with current white value and start bringing in blue
        led.w = 255 - led.w;  // Invert white position to match B->W phase
        led.b = led.w;  // Set blue to mirror white's progress
        led.w = 255 - led.b;  // White is inverse of blue in B->W
        led.phase = 5;
      }
    }
  }
  // Phase 1: R -> W (red decreasing, white increasing)
  else if (led.phase == 1) {
    if (step > 0) {
      led.r = constrain(led.r - step, 0, 255);
      led.w = constrain(led.w + step, 0, 255);
      if (led.r == 0) { led.w = 255; led.phase = 2; }  // Move to phase 2
    } else {
      // Backward from R->W: increase red, decrease white
      led.r = constrain(led.r - step, 0, 255);  // step is negative, increases r
      led.w = constrain(led.w + step, 0, 255);  // step is negative, decreases w
      if (led.w == 0) { led.r = 255; led.phase = 0; }
    }
  }
  // Phase 2: W -> G (white decreasing, green increasing)
  else if (led.phase == 2) {
    if (step > 0) {
      led.w = constrain(led.w - step, 0, 255);
      led.g = constrain(led.g + step, 0, 255);
      if (led.w == 0) { led.g = 255; led.phase = 3; }  // Move to phase 3
    } else {
      // Backward from W->G: decrease green, increase white
      led.g = constrain(led.g + step, 0, 255);  // step is negative, decreases g
      led.w = constrain(led.w - step, 0, 255);  // step is negative, increases w
      if (led.g == 0) { 
        // Switch to phase 1 (R->W), with current white value
        led.w = 255 - led.w;  // Invert white position
        led.r = led.w;  // Set red to mirror white's progress
        led.w = 255 - led.r;  // White is inverse of red in R->W
        led.phase = 1;
      }
    }
  }
  // Phase 3: G -> W (green decreasing, white increasing)
  else if (led.phase == 3) {
    if (step > 0) {
      led.g = constrain(led.g - step, 0, 255);
      led.w = constrain(led.w + step, 0, 255);
      if (led.g == 0) { led.w = 255; led.phase = 4; }  // Move to phase 4
    } else {
      // Backward from G->W: increase green, decrease white
      led.g = constrain(led.g - step, 0, 255);  // step is negative, increases g
      led.w = constrain(led.w + step, 0, 255);  // step is negative, decreases w
      if (led.w == 0) { led.g = 255; led.phase = 2; }
    }
  }
  // Phase 4: W -> B (white decreasing, blue increasing)
  else if (led.phase == 4) {
    if (step > 0) {
      led.w = constrain(led.w - step, 0, 255);
      led.b = constrain(led.b + step, 0, 255);
      if (led.w == 0) { led.b = 255; led.phase = 5; }  // Move to phase 5
    } else {
      // Backward from W->B: decrease blue, increase white
      led.b = constrain(led.b + step, 0, 255);  // step is negative, decreases b
      led.w = constrain(led.w - step, 0, 255);  // step is negative, increases w
      if (led.b == 0) { 
        // Switch to phase 3 (G->W), with current white value
        led.w = 255 - led.w;  // Invert white position
        led.g = led.w;  // Set green to mirror white's progress
        led.w = 255 - led.g;  // White is inverse of green in G->W
        led.phase = 3;
      }
    }
  }
  // Phase 5: B -> W (blue decreasing, white increasing)
  else if (led.phase == 5) {
    if (step > 0) {
      led.b = constrain(led.b - step, 0, 255);
      led.w = constrain(led.w + step, 0, 255);
      if (led.b == 0) { led.w = 255; led.phase = 0; }  // Wrap to phase 0
    } else {
      // Backward from B->W: increase blue, decrease white
      led.b = constrain(led.b - step, 0, 255);  // step is negative, increases b
      led.w = constrain(led.w + step, 0, 255);  // step is negative, decreases w
      if (led.w == 0) { led.b = 255; led.phase = 4; }
    }
  }
  
  printLEDState(led);
}

// Smooth blink animation for a single LED
void blinkLED(int ledIndex, int count) {
  // Save current state
  LEDState savedLed = (ledIndex == 0) ? led0 : led1;
  LEDState otherLed = (ledIndex == 0) ? led1 : led0;
  int otherIndex = (ledIndex == 0) ? 1 : 0;
  int savedBrightness = globalBrightness;
  
  const int fadeSteps = 20;
  const int fadeDelay = 15;  // milliseconds per step
  
  // Calculate other LED's current colors
  int otherR = (otherLed.r * savedBrightness) / 255;
  int otherG = (otherLed.g * savedBrightness) / 255;
  int otherB = (otherLed.b * savedBrightness) / 255;
  int otherW = (otherLed.w * savedBrightness) / 255;
  
  for (int i = 0; i < count; i++) {
    // Fade out
    for (int j = fadeSteps; j >= 0; j--) {
      int fadeBrightness = (savedBrightness * j) / fadeSteps;
      int r = (savedLed.r * fadeBrightness) / 255;
      int g = (savedLed.g * fadeBrightness) / 255;
      int b = (savedLed.b * fadeBrightness) / 255;
      int w = (savedLed.w * fadeBrightness) / 255;
      
      // Update both LEDs - target LED fades, other LED stays constant
      strip.setPixelColor(ledIndex, r, g, b, w);
      strip.setPixelColor(otherIndex, otherR, otherG, otherB, otherW);
      strip.show();
      delay(fadeDelay);
    }
    
    // Fade in
    for (int j = 0; j <= fadeSteps; j++) {
      int fadeBrightness = (savedBrightness * j) / fadeSteps;
      int r = (savedLed.r * fadeBrightness) / 255;
      int g = (savedLed.g * fadeBrightness) / 255;
      int b = (savedLed.b * fadeBrightness) / 255;
      int w = (savedLed.w * fadeBrightness) / 255;
      
      // Update both LEDs - target LED fades, other LED stays constant
      strip.setPixelColor(ledIndex, r, g, b, w);
      strip.setPixelColor(otherIndex, otherR, otherG, otherB, otherW);
      strip.show();
      delay(fadeDelay);
    }
    
    // Short pause between blinks
    if (i < count - 1) {
      delay(100);
    }
  }
}

// Smooth blink animation for both LEDs simultaneously
void blinkBothLEDs() {
  // Save current state
  int savedBrightness = globalBrightness;
  
  const int fadeSteps = 20;
  const int fadeDelay = 15;  // milliseconds per step
  
  // Fade out
  for (int j = fadeSteps; j >= 0; j--) {
    int fadeBrightness = (savedBrightness * j) / fadeSteps;
    
    int r0 = (led0.r * fadeBrightness) / 255;
    int g0 = (led0.g * fadeBrightness) / 255;
    int b0 = (led0.b * fadeBrightness) / 255;
    int w0 = (led0.w * fadeBrightness) / 255;
    
    int r1 = (led1.r * fadeBrightness) / 255;
    int g1 = (led1.g * fadeBrightness) / 255;
    int b1 = (led1.b * fadeBrightness) / 255;
    int w1 = (led1.w * fadeBrightness) / 255;
    
    strip.setPixelColor(0, r0, g0, b0, w0);
    strip.setPixelColor(1, r1, g1, b1, w1);
    strip.show();
    delay(fadeDelay);
  }
  
  // Fade in
  for (int j = 0; j <= fadeSteps; j++) {
    int fadeBrightness = (savedBrightness * j) / fadeSteps;
    
    int r0 = (led0.r * fadeBrightness) / 255;
    int g0 = (led0.g * fadeBrightness) / 255;
    int b0 = (led0.b * fadeBrightness) / 255;
    int w0 = (led0.w * fadeBrightness) / 255;
    
    int r1 = (led1.r * fadeBrightness) / 255;
    int g1 = (led1.g * fadeBrightness) / 255;
    int b1 = (led1.b * fadeBrightness) / 255;
    int w1 = (led1.w * fadeBrightness) / 255;
    
    strip.setPixelColor(0, r0, g0, b0, w0);
    strip.setPixelColor(1, r1, g1, b1, w1);
    strip.show();
    delay(fadeDelay);
  }
}

// Print LED state for debugging
void printLEDState(LEDState &led) {
  Serial.print("LED: R=");
  Serial.print(led.r);
  Serial.print(" G=");
  Serial.print(led.g);
  Serial.print(" B=");
  Serial.print(led.b);
  Serial.print(" W=");
  Serial.print(led.w);
  Serial.print(" Phase=");
  Serial.println(led.phase);
}

// Update the NeoPixel strip
void updateStrip() {
  if (currentMode == MODE_OFF) {
    // Turn off all LEDs
    for (int i = 0; i < NUM_PIXELS; i++) {
      strip.setPixelColor(i, 0, 0, 0, 0);
    }
  } else {
    // Apply brightness scaling
    int r0 = (led0.r * globalBrightness) / 255;
    int g0 = (led0.g * globalBrightness) / 255;
    int b0 = (led0.b * globalBrightness) / 255;
    int w0 = (led0.w * globalBrightness) / 255;
    
    int r1 = (led1.r * globalBrightness) / 255;
    int g1 = (led1.g * globalBrightness) / 255;
    int b1 = (led1.b * globalBrightness) / 255;
    int w1 = (led1.w * globalBrightness) / 255;
    
    strip.setPixelColor(0, r0, g0, b0, w0);
    if (NUM_PIXELS > 1) {
      strip.setPixelColor(1, r1, g1, b1, w1);
    }
  }
}

// Mark that state has changed (for EEPROM save debouncing)
void markStateChanged() {
  lastStateChangeTime = millis();
  stateChanged = true;
}

// Save current state to EEPROM
void saveState() {
  int addr = EEPROM_ADDR;
  
  // Write magic number
  EEPROM.put(addr, EEPROM_MAGIC);
  addr += sizeof(int);
  
  // Write LED 0 state
  EEPROM.put(addr, led0.r);
  addr += sizeof(int);
  EEPROM.put(addr, led0.g);
  addr += sizeof(int);
  EEPROM.put(addr, led0.b);
  addr += sizeof(int);
  EEPROM.put(addr, led0.w);
  addr += sizeof(int);
  EEPROM.put(addr, led0.phase);
  addr += sizeof(int);
  
  // Write LED 1 state
  EEPROM.put(addr, led1.r);
  addr += sizeof(int);
  EEPROM.put(addr, led1.g);
  addr += sizeof(int);
  EEPROM.put(addr, led1.b);
  addr += sizeof(int);
  EEPROM.put(addr, led1.w);
  addr += sizeof(int);
  EEPROM.put(addr, led1.phase);
  addr += sizeof(int);
  
  // Write global brightness
  EEPROM.put(addr, globalBrightness);
  addr += sizeof(int);
  
  // Write current mode
  EEPROM.put(addr, (int)currentMode);
  
  Serial.println("State saved to EEPROM");
}

// Load state from EEPROM
void loadState() {
  int addr = EEPROM_ADDR;
  int magic;
  
  // Read and verify magic number
  EEPROM.get(addr, magic);
  addr += sizeof(int);
  
  if (magic != EEPROM_MAGIC) {
    Serial.println("No valid saved state found, using defaults");
    return;
  }
  
  // Read LED 0 state
  EEPROM.get(addr, led0.r);
  addr += sizeof(int);
  EEPROM.get(addr, led0.g);
  addr += sizeof(int);
  EEPROM.get(addr, led0.b);
  addr += sizeof(int);
  EEPROM.get(addr, led0.w);
  addr += sizeof(int);
  EEPROM.get(addr, led0.phase);
  addr += sizeof(int);
  
  // Read LED 1 state
  EEPROM.get(addr, led1.r);
  addr += sizeof(int);
  EEPROM.get(addr, led1.g);
  addr += sizeof(int);
  EEPROM.get(addr, led1.b);
  addr += sizeof(int);
  EEPROM.get(addr, led1.w);
  addr += sizeof(int);
  EEPROM.get(addr, led1.phase);
  addr += sizeof(int);
  
  // Read global brightness
  EEPROM.get(addr, globalBrightness);
  addr += sizeof(int);
  
  // Read current mode
  int modeInt;
  EEPROM.get(addr, modeInt);
  currentMode = (OperatingMode)modeInt;
  
  Serial.println("State loaded from EEPROM");
  Serial.print("LED0: R=");
  Serial.print(led0.r);
  Serial.print(" G=");
  Serial.print(led0.g);
  Serial.print(" B=");
  Serial.print(led0.b);
  Serial.print(" W=");
  Serial.print(led0.w);
  Serial.print(" Phase=");
  Serial.println(led0.phase);
  Serial.print("LED1: R=");
  Serial.print(led1.r);
  Serial.print(" G=");
  Serial.print(led1.g);
  Serial.print(" B=");
  Serial.print(led1.b);
  Serial.print(" W=");
  Serial.print(led1.w);
  Serial.print(" Phase=");
  Serial.println(led1.phase);
  Serial.print("Brightness: ");
  Serial.println(globalBrightness);
  Serial.print("Mode: ");
  Serial.println(currentMode);
}
