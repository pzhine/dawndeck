/*
 * Waveshare Touchscreen to Mouse Coordinates Converter
 * 
 * This sketch reads touch input from a Waveshare capacitive touchscreen
 * via I2C (SDL/SCA pins) and transforms the raw coordinates to normalized
 * X/Y mouse coordinates.
 * 
 * Connections:
 * - SDA (SDL) -> Arduino SDA pin (A4 on Uno, 20 on Mega, D2 on Leonardo/Micro)
 * - SCL (SCA) -> Arduino SCL pin (A5 on Uno, 21 on Mega, D3 on Leonardo/Micro)
 * - VCC -> 3.3V or 5V (check your touchscreen specs)
 * - GND -> GND
 */

#include <Wire.h>

// I2C addresses for Waveshare 3.4" DSI LCD (C)
#define DISPLAY_I2C_ADDR 0x45  // Display controller (for wake/power)
#define TOUCH_I2C_ADDR 0x14    // Touch controller (GT911 at alternate address)
#define TOUCH_I2C_ADDR_ALT 0x5D // GT911 standard address (backup)

// Screen resolution for Waveshare 3.4" DSI LCD (C)
#define SCREEN_WIDTH 800
#define SCREEN_HEIGHT 800  // Round display: 800x800

// Touch controller registers (FT5x06 example)
#define REG_NUM_TOUCHES 0x02
#define REG_TOUCH_DATA 0x03

// Touch point structure
struct TouchPoint {
  uint16_t x;
  uint16_t y;
  uint8_t pressure;
  bool isValid;
};

TouchPoint currentTouch;
TouchPoint lastTouch;
unsigned long lastTouchTime = 0;
const unsigned long DEBOUNCE_DELAY = 50; // milliseconds

void setup() {
  Serial.begin(115200);
  Wire.begin();
  
  Serial.println("Waveshare 3.4\" DSI LCD (C) Touchscreen to Mouse Coordinates");
  Serial.println("=============================================================");
  
  // First, scan I2C bus to see what's connected
  Serial.println("\n--- I2C Bus Scan ---");
  scanI2CBus();
  Serial.println("-------------------\n");
  
  delay(500);
  
  // Wake up the display first (required for I2C1 mode)
  Serial.println("Attempting display wake sequences...");
  wakeDisplay();
  
  delay(500);
  
  // Test I2C communication with touch controller
  if (testI2CConnection()) {
    Serial.println("Touch controller detected!");
  } else {
    Serial.println("Warning: Touch controller not responding");
    Serial.println("Check connections and I2C address");
  }
  
  // Initialize touch controller (if needed)
  initTouchController();
  
  Serial.println("\nFormat: X,Y,Pressure");
  Serial.println("Ready to read touch events...\n");
}

void loop() {
  // Read touch data using GT911 protocol
  readTouchDataGT911();
  
  // If touch is valid and different from last reading
  if (currentTouch.isValid) {
    unsigned long currentTime = millis();
    
    // Debounce and check if position changed significantly
    if (currentTime - lastTouchTime > DEBOUNCE_DELAY || 
        abs(currentTouch.x - lastTouch.x) > 5 || 
        abs(currentTouch.y - lastTouch.y) > 5) {
      
      // Output mouse coordinates
      Serial.print(currentTouch.x);
      Serial.print(",");
      Serial.print(currentTouch.y);
      Serial.print(",");
      Serial.println(currentTouch.pressure);
      
      lastTouch = currentTouch;
      lastTouchTime = currentTime;
    }
  }
  
  delay(10); // Small delay to prevent overwhelming serial output
}

void scanI2CBus() {
  // Scan I2C bus for devices
  Serial.println("Scanning I2C bus for devices...");
  
  int deviceCount = 0;
  for (uint8_t address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    uint8_t error = Wire.endTransmission();
    
    if (error == 0) {
      Serial.print("Device found at 0x");
      if (address < 16) Serial.print("0");
      Serial.print(address, HEX);
      Serial.print(" (");
      Serial.print(address);
      Serial.print(")");
      
      // Identify known devices
      if (address == 0x14) {
        Serial.print(" - GT911 Touch Controller");
      } else if (address == 0x5D) {
        Serial.print(" - GT911 Touch Controller (alt)");
      } else if (address == 0x45) {
        Serial.print(" - Display Controller");
      } else if (address == 0x38) {
        Serial.print(" - FT5x06 Touch Controller");
      }
      
      Serial.println();
      deviceCount++;
    }
    else if (error == 4) {
      Serial.print("Unknown error at address 0x");
      if (address < 16) Serial.print("0");
      Serial.println(address, HEX);
    }
  }
  
  if (deviceCount == 0) {
    Serial.println("No I2C devices found!");
    Serial.println("Check wiring: SDA, SCL, VCC, GND");
  } else {
    Serial.print("Found ");
    Serial.print(deviceCount);
    Serial.println(" device(s)");
  }
}

bool testI2CConnection() {
  Wire.beginTransmission(TOUCH_I2C_ADDR);
  return (Wire.endTransmission() == 0);
}

void initTouchController() {
  // GT911 initialization sequence
  Serial.println("Initializing GT911 touch controller at 0x14...");
  
  // Read product ID to verify controller
  Wire.beginTransmission(TOUCH_I2C_ADDR);
  Wire.write(0x81);  // Product ID register high byte
  Wire.write(0x40);  // Product ID register low byte
  if (Wire.endTransmission() == 0) {
    Wire.requestFrom(TOUCH_I2C_ADDR, 4);
    if (Wire.available() >= 4) {
      char productID[5];
      productID[0] = Wire.read();
      productID[1] = Wire.read();
      productID[2] = Wire.read();
      productID[3] = Wire.read();
      productID[4] = '\0';
      Serial.print("GT911 Product ID: ");
      Serial.println(productID);
    }
  }
  
  delay(100);
  
  Serial.println("GT911 initialized");
}

void wakeDisplay() {
  // CRITICAL: For Waveshare 3.4" DSI LCD (C) in I2C1 mode
  // The display requires an I2C signal to the display controller (0x45)
  // to wake it up and start showing the DSI video signal
  
  bool success = false;
  
  Serial.println("\n=== Display Wake Sequence 1: Multi-byte Commands ===");
  // Try sending longer sequences (some controllers need 3+ bytes)
  const uint8_t seq1[][4] = {
    {0x00, 0x01, 0x00, 0x00},  // 4-byte enable sequence
    {0x01, 0x01, 0x01, 0x00},  // Another common pattern
  };
  
  for (int i = 0; i < 2; i++) {
    Wire.beginTransmission(DISPLAY_I2C_ADDR);
    for (int j = 0; j < 4; j++) {
      Wire.write(seq1[i][j]);
    }
    if (Wire.endTransmission() == 0) {
      Serial.print("✓ Multi-byte sequence ");
      Serial.print(i + 1);
      Serial.println(" sent");
      success = true;
    }
    delay(50);
  }
  
  Serial.println("\n=== Display Wake Sequence 2: Read-Modify-Write ===");
  // Try reading current value and toggling bits
  Wire.beginTransmission(DISPLAY_I2C_ADDR);
  Wire.write(0x00);  // Start from register 0
  if (Wire.endTransmission() == 0) {
    Wire.requestFrom(DISPLAY_I2C_ADDR, 4);
    if (Wire.available() >= 4) {
      Serial.print("Current registers: ");
      uint8_t regs[4];
      for (int i = 0; i < 4; i++) {
        regs[i] = Wire.read();
        Serial.print("0x");
        Serial.print(regs[i], HEX);
        Serial.print(" ");
      }
      Serial.println();
      
      // Now try writing back with modifications
      Wire.beginTransmission(DISPLAY_I2C_ADDR);
      Wire.write(0x00);
      Wire.write(regs[0] | 0x01);  // Set bit 0
      if (Wire.endTransmission() == 0) {
        Serial.println("✓ Modified register 0x00");
        success = true;
      }
    }
  }
  delay(50);
  
  Serial.println("\n=== Display Wake Sequence 3: Repeated Register Writes ===");
  // Some displays need the same register written multiple times
  for (int attempt = 0; attempt < 3; attempt++) {
    Wire.beginTransmission(DISPLAY_I2C_ADDR);
    Wire.write(0x01);
    Wire.write(0x01);
    Wire.endTransmission();
    delay(20);
  }
  Serial.println("✓ Repeated writes to 0x01");
  
  Serial.println("\n=== Display Wake Sequence 4: Extended Register Range ===");
  // Try writing to high registers (some controllers use 0x80+ for control)
  const uint8_t high_regs[][2] = {
    {0x80, 0x01},  // High register enable
    {0x81, 0x01},
    {0xFF, 0x01},  // Some use 0xFF as master enable
    {0xFE, 0x01},
  };
  
  for (int i = 0; i < 4; i++) {
    Wire.beginTransmission(DISPLAY_I2C_ADDR);
    Wire.write(high_regs[i][0]);
    Wire.write(high_regs[i][1]);
    if (Wire.endTransmission() == 0) {
      Serial.print("✓ High reg 0x");
      Serial.print(high_regs[i][0], HEX);
      Serial.println(" written");
      success = true;
    }
    delay(10);
  }
  
  Serial.println("\n=== Display Wake Sequence 5: I2C General Call ===");
  // Try I2C general call broadcast (address 0x00)
  Wire.beginTransmission(0x00);  // General call address
  Wire.write(0x06);  // Reset command
  if (Wire.endTransmission() == 0) {
    Serial.println("✓ General call reset sent");
  }
  delay(100);
  
  // Now try 0x45 again
  Wire.beginTransmission(DISPLAY_I2C_ADDR);
  Wire.write(0x01);
  Wire.write(0x01);
  if (Wire.endTransmission() == 0) {
    Serial.println("✓ Post-reset enable sent");
  }
  
  delay(100);
  
  if (success) {
    Serial.println("\n✓ Display wake sequences completed (at least one succeeded)");
    Serial.println("  If display still shows blinking green LED:");
    Serial.println("  - The display controller may need specific register sequence");
    Serial.println("  - OR it requires DSI video signal to be active first");
    Serial.println("  - OR it needs the Raspberry Pi's specific initialization");
  } else {
    Serial.println("\n✗ Warning: No response from display controller at 0x45");
  }
  
  delay(100);
  
  Serial.println("Display wake initialization complete\n");
}

void sleepDisplay() {
  // Put display controller to sleep (saves power)
  
  // Sleep display controller
  Wire.beginTransmission(DISPLAY_I2C_ADDR);
  Wire.write(0x01); // Wake/enable register  
  Wire.write(0x00); // Disable/sleep display
  Wire.endTransmission();
  
  Serial.println("Display sleep command sent");
}

void readTouchData() {
  currentTouch.isValid = false;
  
  // Request number of touch points
  Wire.beginTransmission(TOUCH_I2C_ADDR);
  Wire.write(REG_NUM_TOUCHES);
  if (Wire.endTransmission() != 0) {
    return; // Communication error
  }
  
  Wire.requestFrom(TOUCH_I2C_ADDR, 1);
  if (Wire.available() < 1) {
    return;
  }
  
  uint8_t numTouches = Wire.read() & 0x0F; // Lower 4 bits contain touch count
  
  if (numTouches > 0) {
    // Read first touch point data
    Wire.beginTransmission(TOUCH_I2C_ADDR);
    Wire.write(REG_TOUCH_DATA);
    if (Wire.endTransmission() != 0) {
      return;
    }
    
    // Request 6 bytes for first touch point
    // Byte 0-1: X coordinate (12 bits)
    // Byte 2-3: Y coordinate (12 bits)
    // Byte 4: Touch weight (pressure)
    // Byte 5: Touch area
    Wire.requestFrom(TOUCH_I2C_ADDR, 6);
    
    if (Wire.available() >= 6) {
      uint8_t data[6];
      for (int i = 0; i < 6; i++) {
        data[i] = Wire.read();
      }
      
      // Parse touch coordinates (big-endian, 12-bit values)
      uint16_t rawX = ((data[0] & 0x0F) << 8) | data[1];
      uint16_t rawY = ((data[2] & 0x0F) << 8) | data[3];
      uint8_t pressure = data[4];
      
      // Transform to screen coordinates
      currentTouch.x = map(rawX, 0, 4095, 0, SCREEN_WIDTH);
      currentTouch.y = map(rawY, 0, 4095, 0, SCREEN_HEIGHT);
      currentTouch.pressure = pressure;
      currentTouch.isValid = true;
      
      // Constrain to screen bounds
      currentTouch.x = constrain(currentTouch.x, 0, SCREEN_WIDTH - 1);
      currentTouch.y = constrain(currentTouch.y, 0, SCREEN_HEIGHT - 1);
    }
  }
}

// GT911 touch reading method
void readTouchDataGT911() {
  currentTouch.isValid = false;
  
  // GT911 specific registers
  const uint16_t GT911_STATUS_REG = 0x814E;
  const uint16_t GT911_POINT_REG = 0x814F;
  
  Wire.beginTransmission(TOUCH_I2C_ADDR);
  Wire.write(GT911_STATUS_REG >> 8);   // High byte
  Wire.write(GT911_STATUS_REG & 0xFF); // Low byte
  if (Wire.endTransmission() != 0) {
    return;
  }
  
  Wire.requestFrom(TOUCH_I2C_ADDR, 1);
  if (Wire.available() < 1) {
    return;
  }
  
  uint8_t status = Wire.read();
  uint8_t numTouches = status & 0x0F;
  
  if ((status & 0x80) && numTouches > 0) {
    // Read first touch point
    Wire.beginTransmission(TOUCH_I2C_ADDR);
    Wire.write(GT911_POINT_REG >> 8);
    Wire.write(GT911_POINT_REG & 0xFF);
    if (Wire.endTransmission() != 0) {
      return;
    }
    
    Wire.requestFrom(TOUCH_I2C_ADDR, 8);
    if (Wire.available() >= 8) {
      uint8_t data[8];
      for (int i = 0; i < 8; i++) {
        data[i] = Wire.read();
      }
      
      // GT911 format: little-endian 16-bit coordinates
      uint16_t rawX = data[1] | (data[2] << 8);
      uint16_t rawY = data[3] | (data[4] << 8);
      uint16_t size = data[5] | (data[6] << 8);
      
      currentTouch.x = constrain(rawX, 0, SCREEN_WIDTH - 1);
      currentTouch.y = constrain(rawY, 0, SCREEN_HEIGHT - 1);
      currentTouch.pressure = map(size, 0, 255, 0, 100);
      currentTouch.isValid = true;
    }
    
    // Clear status register
    Wire.beginTransmission(TOUCH_I2C_ADDR);
    Wire.write(GT911_STATUS_REG >> 8);
    Wire.write(GT911_STATUS_REG & 0xFF);
    Wire.write(0x00);
    Wire.endTransmission();
  }
}
