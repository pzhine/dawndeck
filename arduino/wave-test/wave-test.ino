@ -1,100 +1,83 @@
#include <Adafruit_NeoPixel.h>

#define LAMP_PIN   5
#define SPOT_PIN   3
#define LED_COUNT  1 // Using 1 pixel object per strip to control 3 channels (R,G,B)

// Initialize strips. Using NEO_RGB because we want to map directly to R, G, B channels.
// If colors are swapped, try NEO_GRB.
Adafruit_NeoPixel lamp(LED_COUNT, LAMP_PIN, NEO_RGB + NEO_KHZ800);
Adafruit_NeoPixel spot(LED_COUNT, SPOT_PIN, NEO_RGB + NEO_KHZ800);

void setup() {
  lamp.begin();
  lamp.show(); // Initialize all pixels to 'off'
  spot.begin();
  spot.show(); // Initialize all pixels to 'off'

  night();
}

// Global variables for animation state
float wavePhase = 0.0;
const float waveSpeed = 0.05;
const float waveWidth = 1;
const float waveSpacing = 6.0; // Distance between peaks. 6 LEDs + 1 gap unit
const int numVirtualLeds = 6;

void loop() {
  //wave();
}

void night() {
  spot.setPixelColor(0, 255, 0, 0);
  spot.show();
}

void wave() {
  // Variables to hold the calculated brightness for each channel
  uint8_t lampR = 0, lampG = 0, lampB = 0;
  uint8_t spotR = 0, spotG = 0, spotB = 0;
  
  for (int i = 0; i < numVirtualLeds; i++) {
    // Calculate distance to the nearest wave peak
    // We check the current phase, and wrapped phases to handle continuity
    float dist = abs(i - wavePhase);
    float distPrev = abs(i - (wavePhase - waveSpacing));
    float distNext = abs(i - (wavePhase + waveSpacing));
    
    // Take the closest wave peak
    dist = min(dist, min(distPrev, distNext));
    
    float brightness = 0;
    if (dist < waveWidth) {
      brightness = (cos(dist * PI / waveWidth) + 1.0) / 2.0;
    }
    
    uint8_t val = (uint8_t)(brightness * 255);
    
    // Map the virtual LED index to the specific hardware channel
    switch (i) {
      case 0: lampB = val; break; // Lamp Bottom
      case 1: lampR = val; break; // Lamp Middle
      case 2: lampG = val; break; // Lamp Top
      case 3: spotG = val; break; // Spot Bottom
      case 4: spotB = val; break; // Spot Middle
      case 5: spotR = val; break; // Spot Top
    }
  }
  
  lamp.setPixelColor(0, lampR, lampG, lampB);
  spot.setPixelColor(0, spotR, spotG, spotB);
  
  lamp.show();
  spot.show();
  
  // Advance the wave
  wavePhase += waveSpeed;
  if (wavePhase >= waveSpacing) {
    wavePhase -= waveSpacing;
  }
  
  delay(10);
}