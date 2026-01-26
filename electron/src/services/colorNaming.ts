/**
 * Color naming service using color-names and nearest-color packages
 */

import colorNames from 'color-names';
import nearestColor from 'nearest-color';

// Create a color palette from the color-names package
// color-names exports an object with hex values as keys and color names as values
// We need to flip it to { colorName: hex } for nearest-color
const colorPalette: Record<string, string> = {};
Object.entries(colorNames).forEach(([hex, name]) => {
  colorPalette[name as string] = hex;
});

// Create nearest color matcher with the full palette
const nearest = nearestColor.from(colorPalette);

/**
 * Generate a color name from RGB values
 */
export function getColorName(r: number, g: number, b: number): string {
  // If the color is extremely dark, treat it as midnight/black
  if (Math.max(r, g, b) < 20) return 'Midnight';
  
  // Convert RGB to hex format
  const toHex = (n: number) => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  
  // Find the nearest color from the palette
  const match = nearest(hex);
  
  return match ? match.name : 'Mystery';
}

/**
 * Generate a slug from a color name
 * @param name The color name to convert into a slug
 * @returns A URL-friendly slug string
 */
export function generateColorSlug(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
}

/**
 * Generate a name for the color(s).
 * Accepts up to two colors (e.g. Lamp and Projector) and combines their names.
 */
export function generateColorFavoriteName(
  color1: [number, number, number], 
  color2?: [number, number, number]
): string {
  const getName = (rgb: [number, number, number]) => {
    // If the color is extremely dark, treat it as off/midnight
    if (Math.max(...rgb) < 20) return 'Midnight';
    return getColorName(...rgb);
  };

  const name1 = getName(color1);

  // If only one color provided
  if (!color2) {
    return name1;
  }

  const name2 = getName(color2);

  // Handle cases where one or both are "off"
  if (name1 === 'Midnight' && name2 === 'Midnight') return 'Midnight';
  if (name1 === 'Midnight') return name2;
  if (name2 === 'Midnight') return name1;

  // If both generate the same name, return it once
  if (name1 === name2) {
    return name1;
  }

  // Combine unique names
  return `${name1} ${name2}`;
}
