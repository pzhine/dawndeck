// SPDX-FileCopyrightText: 2024 Limor Fried for Adafruit Industries
//
// SPDX-License-Identifier: MIT

#include <Adafruit_NeoPixel.h>
#ifdef __AVR__
 #include <avr/power.h> // Required for 16 MHz Adafruit Trinket
#endif

// Which pin on the Arduino is connected to the NeoPixels?
// On a Trinket or Gemma we suggest changing this to 1:
#define LED_PIN    5

// How many NeoPixels are attached to the Arduino?
#define LED_COUNT 1

// Declare our NeoPixel strip object:
Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_RGB + NEO_KHZ800);
// Argument 1 = Number of pixels in NeoPixel strip
// Argument 2 = Arduino pin number (most are valid)
// Argument 3 = Pixel type flags

// Base color for lamp (orange/white/pink)
int baseR = 200;
int baseG = 255;
int baseB = 150;

void setup() {
  // These lines are specifically to support the Adafruit Trinket 5V 16 MHz.
  // Any other board, you can remove this part (but no harm leaving it):
#if defined(__AVR_ATtiny85__) && (F_CPU == 16000000)
  clock_prescale_set(clock_div_1);
#endif
  // END of Trinket-specific code.

  strip.begin();           // INITIALIZE NeoPixel strip object (REQUIRED)
  strip.show();            // Turn OFF all pixels ASAP
  strip.setBrightness(100); // Set BRIGHTNESS to max (max = 255)

  strip.setPixelColor(0, baseR, baseG, baseB);
  strip.show();
}
void loop() {
//  breathe(10);
}

// Breathe brightness from 0 to 255 and back
void breathe(int wait) {
  // Fade up from 0 to 255
  for (int brightness = 0; brightness < 256; brightness++) {
    int r = (baseR * brightness) / 255;
    int g = (baseG * brightness) / 255;
    int b = (baseB * brightness) / 255;
    strip.setPixelColor(0, r, g, b);
    strip.show();
    delay(wait);
  }
  
  // Fade down from 255 to 0
  for (int brightness = 255; brightness >= 0; brightness--) {
    int r = (baseR * brightness) / 255;
    int g = (baseG * brightness) / 255;
    int b = (baseB * brightness) / 255;
    strip.setPixelColor(0, r, g, b);
    strip.show();
    delay(wait);
  }
}
