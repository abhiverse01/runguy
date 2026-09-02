// ============================================================
// Environment presets — a small library of full atmospheric looks
// (sky, sun, fog, water tint, grass tint, exposure). One is picked
// at random on every load (true Math.random, not the seeded world
// RNG) so the *world layout* stays deterministic but the *mood* of
// the world is different every time you play — different light,
// different water color, different sky.
// ============================================================

export const ENVIRONMENT_PRESETS = [
  {
    name: 'Golden Hour',
    sky: { turbidity: 3.0, rayleigh: 1.4, mieCoefficient: 0.0062, mieDirectionalG: 0.86 },
    sunElevation: 15, sunAzimuth: 205,
    sunColor: 0xffd9a0, sunIntensity: 3.3,
    hemiSky: 0xffdcb0, hemiGround: 0x6b5a34, hemiIntensity: 0.55,
    fogColor: 0xf2c98f, fogNearMul: 0.85, fogFarMul: 1.0,
    exposure: 1.12,
    water: { color: 0x2f6a4f, sunColor: 0xffdca0, distortionScale: 2.6 },
    grass: { a: 0x5c7d3d, b: 0x8a9a4c, bank: 0x9c7f47, valley: 0x466b3d, highland: 0xb0a479 },
    cloudColor: 0xffe9cc, cloudOpacity: 0.8,
  },
  {
    name: 'Misty Dawn',
    sky: { turbidity: 6.5, rayleigh: 2.6, mieCoefficient: 0.0032, mieDirectionalG: 0.78 },
    sunElevation: 7, sunAzimuth: 100,
    sunColor: 0xdfe6f2, sunIntensity: 2.2,
    hemiSky: 0xd8e2f0, hemiGround: 0x51584a, hemiIntensity: 0.62,
    fogColor: 0xcbd7de, fogNearMul: 0.45, fogFarMul: 0.62,
    exposure: 0.98,
    water: { color: 0x4c6f72, sunColor: 0xe8eef2, distortionScale: 1.5 },
    grass: { a: 0x4d6b52, b: 0x6c8767, bank: 0x8a8570, valley: 0x3d5b4c, highland: 0x9aa298 },
    cloudColor: 0xeef2f4, cloudOpacity: 0.92,
  },
  {
    name: 'Crisp Noon',
    sky: { turbidity: 2.2, rayleigh: 0.9, mieCoefficient: 0.0045, mieDirectionalG: 0.8 },
    sunElevation: 58, sunAzimuth: 175,
    sunColor: 0xffffff, sunIntensity: 3.6,
    hemiSky: 0xbfe0ff, hemiGround: 0x5a6b45, hemiIntensity: 0.68,
    fogColor: 0xdcecf5, fogNearMul: 1.15, fogFarMul: 1.2,
    exposure: 1.05,
    water: { color: 0x1f6e6a, sunColor: 0xffffff, distortionScale: 2.9 },
    grass: { a: 0x4c7a45, b: 0x6f9455, bank: 0x8a7345, valley: 0x3f6a48, highland: 0x9aa07e },
    cloudColor: 0xffffff, cloudOpacity: 0.85,
  },
  {
    name: 'Overcast Slate',
    sky: { turbidity: 9.5, rayleigh: 3.4, mieCoefficient: 0.0022, mieDirectionalG: 0.7 },
    sunElevation: 38, sunAzimuth: 230,
    sunColor: 0xcfd6d6, sunIntensity: 1.9,
    hemiSky: 0xb7c2c6, hemiGround: 0x494f42, hemiIntensity: 0.7,
    fogColor: 0xa9b4b6, fogNearMul: 0.6, fogFarMul: 0.72,
    exposure: 0.92,
    water: { color: 0x3c5860, sunColor: 0xcdd6d8, distortionScale: 1.8 },
    grass: { a: 0x466050, bank: 0x736c58, b: 0x5c7a5c, valley: 0x36503f, highland: 0x848a80 },
    cloudColor: 0xc7ced0, cloudOpacity: 0.95,
  },
  {
    name: 'Autumn Amber',
    sky: { turbidity: 4.4, rayleigh: 2.0, mieCoefficient: 0.0052, mieDirectionalG: 0.84 },
    sunElevation: 24, sunAzimuth: 242,
    sunColor: 0xffc27a, sunIntensity: 3.0,
    hemiSky: 0xffd8a8, hemiGround: 0x6a4a2c, hemiIntensity: 0.58,
    fogColor: 0xe0b378, fogNearMul: 0.9, fogFarMul: 0.95,
    exposure: 1.08,
    water: { color: 0x4a6a3f, sunColor: 0xffc98a, distortionScale: 2.2 },
    grass: { a: 0x7a6a34, b: 0x9c8843, bank: 0x8f6a3c, valley: 0x5c5230, highland: 0xb89a5c },
    cloudColor: 0xffdcb0, cloudOpacity: 0.75,
  },
  {
    name: 'Twilight Violet',
    sky: { turbidity: 5.2, rayleigh: 2.9, mieCoefficient: 0.0038, mieDirectionalG: 0.82 },
    sunElevation: 4, sunAzimuth: 262,
    sunColor: 0xff9d8a, sunIntensity: 2.0,
    hemiSky: 0x8f8fd6, hemiGround: 0x352d4a, hemiIntensity: 0.72,
    fogColor: 0x8b85a8, fogNearMul: 0.55, fogFarMul: 0.68,
    exposure: 1.0,
    water: { color: 0x2c3f6a, sunColor: 0xff9d8a, distortionScale: 1.7 },
    grass: { a: 0x3d4a5c, b: 0x5a5478, bank: 0x6a5a68, valley: 0x2c3348, highland: 0x7a7292 },
    cloudColor: 0xc7a8d8, cloudOpacity: 0.88,
  },
];

/** Independent of the world's seeded RNG on purpose — this is the
 *  "different every time" knob, not the deterministic layout. */
export function pickRandomEnvironment(){
  const i = Math.floor(Math.random() * ENVIRONMENT_PRESETS.length);
  return ENVIRONMENT_PRESETS[i];
}
