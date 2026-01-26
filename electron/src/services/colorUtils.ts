/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Mix colors based on LED values
 * @param circleColors - Array of three hex color strings
 * @param ledValues - Array of three LED intensity values (0-255)
 * @returns Mixed color as hex string
 */
export function mixColors(circleColors: [string, string, string], ledValues: [number, number, number]): string {
  const rgb0 = hexToRgb(circleColors[0]);
  const rgb1 = hexToRgb(circleColors[1]);
  const rgb2 = hexToRgb(circleColors[2]);
  
  // Normalize LED values (0-255) to weights
  const total = ledValues[0] + ledValues[1] + ledValues[2];
  if (total === 0) return '#ffffff';
  
  const weight0 = ledValues[0] / total;
  const weight1 = ledValues[1] / total;
  const weight2 = ledValues[2] / total;
  
  const r = rgb0[0] * weight0 + rgb1[0] * weight1 + rgb2[0] * weight2;
  const g = rgb0[1] * weight0 + rgb1[1] * weight1 + rgb2[1] * weight2;
  const b = rgb0[2] * weight0 + rgb1[2] * weight1 + rgb2[2] * weight2;
  
  return rgbToHex(r, g, b);
}

/**
 * Mix colors based on LED values, returning RGB values instead of hex
 * @param circleColors - Array of three hex color strings
 * @param ledValues - Array of three LED intensity values (0-255)
 * @returns Mixed color as RGB tuple
 */
export function mixColorsRgb(circleColors: [string, string, string], ledValues: [number, number, number]): [number, number, number] {
  const rgb0 = hexToRgb(circleColors[0]);
  const rgb1 = hexToRgb(circleColors[1]);
  const rgb2 = hexToRgb(circleColors[2]);
  
  const total = ledValues[0] + ledValues[1] + ledValues[2];
  if (total === 0) return [0, 0, 0];
  
  const weight0 = ledValues[0] / total;
  const weight1 = ledValues[1] / total;
  const weight2 = ledValues[2] / total;
  
  const r = Math.round(rgb0[0] * weight0 + rgb1[0] * weight1 + rgb2[0] * weight2);
  const g = Math.round(rgb0[1] * weight0 + rgb1[1] * weight1 + rgb2[1] * weight2);
  const b = Math.round(rgb0[2] * weight0 + rgb1[2] * weight1 + rgb2[2] * weight2);
  
  return [r, g, b];
}
