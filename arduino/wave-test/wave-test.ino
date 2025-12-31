// SPDX-FileCopyrightText: 2024 Limor Fried for Adafruit Industries
//
// SPDX-License-Identifier: MIT

#include <Adafruit_NeoPixel.h>
#ifdef __AVR__
 #include <avr/power.h> // Required for 16 MHz Adafruit Trinket
#endif

// Pin definitions
#define LAMP_PIN   5
#define SPOT_PIN   3

// How many NeoPixels (RGB channels) per strip
#define LED_COUNT 3

// Declare NeoPixel strip objects
Adafruit_NeoPixel lamp(LED_COUNT, LAMP_PIN, NEO_RGB + NEO_KHZ800);
Adafruit_NeoPixel spot(LED_COUNT, SPOT_PIN, NEO_RGB + NEO_KHZ800);

// Base color for the wave
int baseR = 200;
int baseG = 255;
int baseB = 150;

// Wave parameters
#define WAVE_WIDTH 2.0  // How many LEDs wide is the brightness peak
#define WAVE_SPEED 0.1  // How fast the wave travels (higher = faster)

void setup() {
#if defined(__AVR_ATtiny85__) && (F_CPU == 16000000)
  clock_prescale_set(clock_div_1);
#endif

  lamp.begin();
  lamp.show();
  lamp.setBrightness(255);

  spot.begin();
  spot.show();
  spot.setBrightness(255);
}

void loop() {
  wave(10);
}

// Create a wave that travels from bottom (lamp) to top (spot)
void wave(int wait) {
  // Total number of LEDs in the system (6: 3 on lamp + 3 on spot)
  int totalLEDs = 6;
  
  // Animate wave traveling through all LEDs
  for (float wavePos = -WAVE_WIDTH; wavePos < totalLEDs + WAVE_WIDTH; wavePos += WAVE_SPEED) {
    // Update each LED based on distance from wave center
    for (int i = 0; i < totalLEDs; i++) {
      // Calculate brightness based on distance from wave center
      float distance = abs(i - wavePos);
      float brightness = 0;
      
      if (distance < WAVE_WIDTH) {
        // Use a smooth curve (cosine) for the wave shape
        brightness = (cos(distance * 3.14159 / WAVE_WIDTH) + 1.0) / 2.0;
      }
      
      // Scale RGB values by brightness
      int r = (int)(baseR * brightness);
      int g = (int)(baseG * brightness);
      int b = (int)(baseB * brightness);
      
      // Set the color on the appropriate strip and LED
      if (i < 3) {
        // Lamp strip (bottom 3 LEDs)
        // Lamp order: B(0), R(1), G(2)
        if (i == 0) {
          lamp.setPixelColor(0, 0, 0, b);  // B channel
        } else if (i == 1) {
          lamp.setPixelColor(1, r, 0, 0);  // R channel
        } else {
          lamp.setPixelColor(2, 0, g, 0);  // G channel
        }
      } else {
        // Spot strip (top 3 LEDs)
        // Spot order: G(0), B(1), R(2)
        int spotIndex = i - 3;
        if (spotIndex == 0) {
          spot.setPixelColor(0, 0, g, 0);  // G channel
        } else if (spotIndex == 1) {
          spot.setPixelColor(1, 0, 0, b);  // B channel
        } else {
          spot.setPixelColor(2, r, 0, 0);  // R channel
        }
      }
    }
    
    lamp.show();
    spot.show();
    delay(wait);
  }
}
