#include <Adafruit_NeoPixel.h>

// Serial input constants
#define INPUT_BUFFER_SIZE 64
#define MAX_INPUT_PARAMS 10
#define INPUT_DELIMETER ' '

// Strip identifiers for lerpLedTo
#define STRIP_LAMP 0
#define STRIP_SPOT 1

// Which pin on the Arduino is connected to the NeoPixels?
#define LAMP_PIN 5
#define SPOT_PIN 3

// How many LED "pixels" per strip (we use 1 pixel object per strip to control R,G,B channels)
#define LED_COUNT 1

// Initialize NeoPixel strips. Using NEO_RGB for direct mapping to R, G, B channels.
// If colors are swapped, try NEO_GRB.
Adafruit_NeoPixel lamp(LED_COUNT, LAMP_PIN, NEO_RGB + NEO_KHZ800);
Adafruit_NeoPixel spot(LED_COUNT, SPOT_PIN, NEO_RGB + NEO_KHZ800);

#define DEFAULT_BRIGHTNESS 255

// Serial INPUT for Unipixel comms
char *inputBuffer = new char[INPUT_BUFFER_SIZE];
size_t inputBufferIndex = 0;
bool inputBufferReady = false;
char* inputParams[MAX_INPUT_PARAMS];  // Array to store pointers to tokens
int inputParamCount = 0; // Number of params extracted

// Other state
bool testIsHigh = false;

// Structures for LED color management
struct RGB {
  int r, g, b;
  RGB(int red, int green, int blue) : r(red), g(green), b(blue) {}
  RGB() : r(0), g(0), b(0) {}
};

// Define color channel indices
#define CHANNEL_R 0
#define CHANNEL_G 1
#define CHANNEL_B 2
#define CHANNEL_COUNT 3

// Structure for keeping track of LED transitions per channel
struct LedTransition {
  bool active;
  int stripId;
  int pixel;
  int channelId;      // Which channel this transition is for (R, G, or B)
  int startValue;     // Start value for this channel
  int targetValue;    // Target value for this channel
  unsigned long startTime;
  unsigned long duration;
  
  LedTransition() : active(false), stripId(0), pixel(0), channelId(0), startValue(0), targetValue(0), startTime(0), duration(0) {}
};

// Track active LED transitions (increased to support per-channel transitions)
#define MAX_TRANSITIONS 20
LedTransition ledTransitions[MAX_TRANSITIONS];
unsigned long lastTransitionCheck = 0;

void handleSerialCommand() {
  if (strcmp(inputParams[0], "TEST") == 0) {
    digitalWrite(LED_BUILTIN, testIsHigh ? LOW : HIGH);
    testIsHigh = !testIsHigh;
  } else if (strcmp(inputParams[0], "LERP_LED") == 0) {
    // Parse parameters: strip, pixel, r, g, b, duration
    // Note: We now expect 6 parameters (no 'w' channel)
    if (inputParamCount >= 6) {
      int stripId = atoi(inputParams[1]);
      int pixel = atoi(inputParams[2]);
      int r = atoi(inputParams[3]); // Allow -1 for unchanged
      int g = atoi(inputParams[4]); // Allow -1 for unchanged
      int b = atoi(inputParams[5]); // Allow -1 for unchanged
      unsigned long duration = atol(inputParams[6]);
      
      lerpLedTo(stripId, pixel, r, g, b, duration);
    }
  } else if (strcmp(inputParams[0], "SET_BRIGHTNESS") == 0) {
    // Parse parameters: strip, brightness
    if (inputParamCount >= 3) {
      int stripId = atoi(inputParams[1]);
      int brightness = constrain(atoi(inputParams[2]), 0, 255);
      if (stripId == STRIP_LAMP) {
        lamp.setBrightness(brightness);
      } else if (stripId == STRIP_SPOT) {
        spot.setBrightness(brightness);
      }
    }
  }
}

void setup() {
  // Start serial connection
  Serial.begin(9600);
  pinMode(LED_BUILTIN, OUTPUT);

  // Start NeoPixels
  lamp.begin();
  lamp.setBrightness(DEFAULT_BRIGHTNESS);
  lamp.clear();
  lamp.show();
  
  spot.begin();
  spot.setBrightness(DEFAULT_BRIGHTNESS);
  spot.clear();
  spot.show();
}

void readSerialInput() {
  if (Serial.available() <= 0) {
    return;
  }
  char c = Serial.read(); // Read a single character

  // Ignore carriage return characters to prevent empty commands/double newlines
  if (c == '\r') {
    return;
  }

  if (c == '\n' || inputBufferIndex >= INPUT_BUFFER_SIZE - 1) { // End of line or buffer full
    inputBuffer[inputBufferIndex] = '\0'; // Null-terminate the string
    inputBufferReady = true; // flag the buffer ready to read
    inputBufferIndex = 0; // reset the index
    return;
  }
  inputBuffer[inputBufferIndex] = c; // Append character to buffer
  inputBufferIndex += 1;
}

void parseSerialCommand() {
  char* buffer = new char[strlen(inputBuffer) + 1]; // Allocate memory for a modifiable copy of the input
  strcpy(buffer, inputBuffer);  // Copy input to the buffer
  char delimiterStr[2] = {INPUT_DELIMETER, '\0'};  // Delimiter as a C-string
  char* token = strtok(buffer, delimiterStr); // Get the first token
  inputParamCount = 0;
  while (token != nullptr && inputParamCount < MAX_INPUT_PARAMS) {
    inputParams[inputParamCount] = new char[strlen(token) + 1]; // Allocate space for the token
    strcpy(inputParams[inputParamCount], token); // Copy token into tokens array
    inputParamCount += 1;
    token = strtok(nullptr, delimiterStr); // Get the next token
  }
  delete[] buffer; // Free the temporary buffer
}

void freeInputParams() {
  for (int i = 0; i < inputParamCount; ++i) {
    delete[] inputParams[i]; 
  }
}

void readAndHandleSerialCommands() {
  if (inputBufferReady) {
    inputBufferReady = false;
    parseSerialCommand();
    
    // Only handle and ACK if we actually have parameters
    if (inputParamCount > 0) {
      handleSerialCommand();
      Serial.print("ACK ");
      Serial.println(inputBuffer);
    }
    
    freeInputParams();
  }
  // read from serial until newline
  readSerialInput();
}

void lerpLedTo(int stripId, int pixel, int r, int g, int b, unsigned long duration) {
  // Ensure stripId is valid
  if (stripId != STRIP_LAMP && stripId != STRIP_SPOT) {
    return;
  }

  // Get the current color of the pixel
  int currentR = 0, currentG = 0, currentB = 0;
  if (stripId == STRIP_LAMP) {
    if (pixel >= 0 && pixel < LED_COUNT) {
      uint32_t color = lamp.getPixelColor(pixel);
      currentR = (color >> 16) & 0xFF;
      currentG = (color >> 8) & 0xFF;
      currentB = color & 0xFF;
    } else {
      return; // Invalid pixel
    }
  } else if (stripId == STRIP_SPOT) {
    if (pixel >= 0 && pixel < LED_COUNT) {
      uint32_t color = spot.getPixelColor(pixel);
      currentR = (color >> 16) & 0xFF;
      currentG = (color >> 8) & 0xFF;
      currentB = color & 0xFF;
    } else {
      return; // Invalid pixel
    }
  }

  // Store the target color values in an array for easier processing
  int currentValues[CHANNEL_COUNT] = {currentR, currentG, currentB};
  int targetValues[CHANNEL_COUNT] = {r, g, b};
  
  // Process each channel
  for (int channel = 0; channel < CHANNEL_COUNT; channel++) {
    // Skip this channel if target is -1 (meaning: leave unchanged)
    if (targetValues[channel] == -1) {
      continue;
    }
    
    // Constrain the target value to valid range
    targetValues[channel] = constrain(targetValues[channel], 0, 255);
    
    // Find a transition slot for this channel
    int slotIndex = -1;
    
    // First try to find an existing transition for this pixel+strip+channel to replace
    for (int i = 0; i < MAX_TRANSITIONS; i++) {
      if (ledTransitions[i].active && 
          ledTransitions[i].stripId == stripId && 
          ledTransitions[i].pixel == pixel &&
          ledTransitions[i].channelId == channel) {
        slotIndex = i;
        break;
      }
    }
    
    // If no existing transition found for this channel, find an inactive slot
    if (slotIndex == -1) {
      for (int i = 0; i < MAX_TRANSITIONS; i++) {
        if (!ledTransitions[i].active) {
          slotIndex = i;
          break;
        }
      }
    }
    
    // If still no slot available, find the oldest transition and replace it
    if (slotIndex == -1) {
      unsigned long oldestTime = millis();
      for (int i = 0; i < MAX_TRANSITIONS; i++) {
        if (ledTransitions[i].startTime < oldestTime) {
          oldestTime = ledTransitions[i].startTime;
          slotIndex = i;
        }
      }
    }
    
    // Initialize the transition for this channel
    LedTransition& transition = ledTransitions[slotIndex];
    transition.active = true;
    transition.stripId = stripId;
    transition.pixel = pixel;
    transition.channelId = channel;
    transition.startValue = currentValues[channel];
    transition.targetValue = targetValues[channel];
    transition.startTime = millis();
    transition.duration = duration;
  }
}

// Update LED transitions based on elapsed time
void updateLedTransitions() {
  unsigned long currentTime = millis();
  
  // Arrays to track which pixels need updating
  bool lampPixelsUpdated[LED_COUNT] = {false};
  bool spotPixelsUpdated[LED_COUNT] = {false};
  
  // Current color values for each pixel being processed
  int lampColors[LED_COUNT][CHANNEL_COUNT];
  int spotColors[LED_COUNT][CHANNEL_COUNT];
  
  // First, get the current color values for all pixels
  for (int p = 0; p < LED_COUNT; p++) {
    uint32_t color = lamp.getPixelColor(p);
    lampColors[p][CHANNEL_R] = (color >> 16) & 0xFF;
    lampColors[p][CHANNEL_G] = (color >> 8) & 0xFF;
    lampColors[p][CHANNEL_B] = color & 0xFF;
  }
  
  for (int p = 0; p < LED_COUNT; p++) {
    uint32_t color = spot.getPixelColor(p);
    spotColors[p][CHANNEL_R] = (color >> 16) & 0xFF;
    spotColors[p][CHANNEL_G] = (color >> 8) & 0xFF;
    spotColors[p][CHANNEL_B] = color & 0xFF;
  }
  
  // Process each transition
  for (int i = 0; i < MAX_TRANSITIONS; i++) {
    LedTransition& transition = ledTransitions[i];
    
    if (transition.active) {
      // Calculate the elapsed time and progress
      unsigned long elapsed = currentTime - transition.startTime;
      float progress = min(1.0f, (float)elapsed / transition.duration);
      
      // Calculate the interpolated value for this channel
      int interpolatedValue = transition.startValue + 
                            ((transition.targetValue - transition.startValue) * progress);
      
      // Update the appropriate color array based on strip and pixel
      if (transition.stripId == STRIP_LAMP && transition.pixel < LED_COUNT) {
        lampColors[transition.pixel][transition.channelId] = interpolatedValue;
        lampPixelsUpdated[transition.pixel] = true;
      } 
      else if (transition.stripId == STRIP_SPOT && transition.pixel < LED_COUNT) {
        spotColors[transition.pixel][transition.channelId] = interpolatedValue;
        spotPixelsUpdated[transition.pixel] = true;
      }
      
      // Mark transition as inactive if complete
      if (progress >= 1.0) {
        transition.active = false;
      }
    }
  }
  
  // Update pixels with new color values
  bool lampUpdated = false;
  bool spotUpdated = false;
  
  for (int p = 0; p < LED_COUNT; p++) {
    if (lampPixelsUpdated[p]) {
      lamp.setPixelColor(p, 
                         lampColors[p][CHANNEL_R],
                         lampColors[p][CHANNEL_G],
                         lampColors[p][CHANNEL_B]);
      lampUpdated = true;
    }
  }
  
  for (int p = 0; p < LED_COUNT; p++) {
    if (spotPixelsUpdated[p]) {
      spot.setPixelColor(p,
                         spotColors[p][CHANNEL_R],
                         spotColors[p][CHANNEL_G],
                         spotColors[p][CHANNEL_B]);
      spotUpdated = true;
    }
  }
  
  // Update strips only if changes were made
  if (lampUpdated) {
    lamp.show();
  }
  if (spotUpdated) {
    spot.show();
  }
}

// Main loop
void loop() {
  readAndHandleSerialCommands();
  
  // Update LED transitions at most every 16ms (approx. 60fps)
  unsigned long currentTime = millis();
  if (currentTime - lastTransitionCheck >= 16) {
    updateLedTransitions();
    lastTransitionCheck = currentTime;
  }
}
