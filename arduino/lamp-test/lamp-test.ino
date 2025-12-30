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

void setup() {
  // These lines are specifically to support the Adafruit Trinket 5V 16 MHz.
  // Any other board, you can remove this part (but no harm leaving it):
#if defined(__AVR_ATtiny85__) && (F_CPU == 16000000)
  clock_prescale_set(clock_div_1);
#endif
  // END of Trinket-specific code.

  strip.begin();           // INITIALIZE NeoPixel strip object (REQUIRED)
  strip.show();            // Turn OFF all pixels ASAP
  strip.setBrightness(0); // Set BRIGHTNESS to about 1/5 (max = 255)

                    //    orng  wht  pnk
  strip.setPixelColor(0,  200,  255, 150);
  strip.show();
}
void loop() {
  breathe(10);
  //rainbow(10);             // Flowing rainbow cycle along the whole strip
}

// Breathe brightness from 0 to 255 and back
void breathe(int wait) {
  for (int b = 0; b < 256; b++) {
    strip.setBrightness(b);
    strip.show();
    delay(wait);
  }
  for (int b = 255; b >= 0; b--) {
    strip.setBrightness(b);
    strip.show();
    delay(wait);
  }
}
