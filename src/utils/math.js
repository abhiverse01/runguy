import * as THREE from 'three';

export const { lerp, clamp, degToRad } = THREE.MathUtils;

export function smoothstep(edge0, edge1, x){
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function distPointSegment(px, pz, x1, z1, x2, z2){
  const dx = x2 - x1, dz = z2 - z1;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((px - x1) * dx + (pz - z1) * dz) / len2 : 0;
  t = clamp(t, 0, 1);
  const cx = x1 + t * dx, cz = z1 + t * dz;
  return Math.hypot(px - cx, pz - cz);
}

/** Deterministic seeded RNG (mulberry32) — same layout every load. */
export function mulberry32(seed){
  return function(){
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashN(x, z){
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export function valueNoise(x, z){
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hashN(xi, zi), b = hashN(xi + 1, zi), c = hashN(xi, zi + 1), d = hashN(xi + 1, zi + 1);
  return (lerp(lerp(a, b, u), lerp(c, d, u), v)) * 2 - 1;
}

export function fbm(x, z){
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < 4; i++){
    sum += amp * valueNoise(x * freq, z * freq);
    norm += amp; amp *= 0.5; freq *= 2.15;
  }
  return sum / norm;
}

/** Critically-damped spring smoothing (Game Programming Gems style).
 *  Smoother and more consistent across variable framerate than a
 *  plain lerp(x, target, rate*dt), which original RUNGUY used
 *  everywhere and which stutters under frame-time spikes. */
export function springDamp(current, target, velocityRef, smoothTime, dt, maxSpeed = Infinity){
  smoothTime = Math.max(0.0001, smoothTime);
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = current - target;
  const originalTo = target;
  const maxChange = maxSpeed * smoothTime;
  change = clamp(change, -maxChange, maxChange);
  const t = target = current - change;
  const temp = (velocityRef.v + omega * change) * dt;
  velocityRef.v = (velocityRef.v - omega * temp) * exp;
  let output = t + (change + temp) * exp;
  if ((originalTo - current > 0) === (output > originalTo)){
    output = originalTo;
    velocityRef.v = (output - originalTo) / dt;
  }
  return output;
}
