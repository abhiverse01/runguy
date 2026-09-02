import * as THREE from 'three';
import { fbm, valueNoise, smoothstep, lerp, clamp } from '../utils/math.js';
import { Q, MAP_HALF, RIVER_HALF, BANK_FADE, BRIDGE_Y, HILL_CENTER, KNOLL_CENTER, VALLEY_CENTER } from '../config/constants.js';

function makeDirtTexture(rng){
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#8a6b46'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++){
    const x = rng() * 256, y = rng() * 256, r = rng() * 2.4 + 0.4;
    g.fillStyle = `rgba(${60 + rng()*40|0},${40+rng()*30|0},${20+rng()*20|0},${0.15 + rng()*0.2})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Grass diffuse + a matching bump/normal map derived from the same
 *  blade pattern, so grass actually catches light per-blade instead of
 *  reading as a flat painted color under the sun. */
function makeGrassTextures(rng){
  const SZ = 1024;
  const diffuse = document.createElement('canvas'); diffuse.width = diffuse.height = SZ;
  const height = document.createElement('canvas'); height.width = height.height = SZ;
  const gd = diffuse.getContext('2d'), gh = height.getContext('2d');
  gd.fillStyle = '#4c7a45'; gd.fillRect(0, 0, SZ, SZ);
  gh.fillStyle = '#808080'; gh.fillRect(0, 0, SZ, SZ);
  const blades = 9000;
  for (let i = 0; i < blades; i++){
    const x = rng() * SZ, y = rng() * SZ;
    const shade = rng();
    gd.fillStyle = shade < 0.5 ? 'rgba(70,110,58,0.5)' : (shade < 0.85 ? 'rgba(110,150,80,0.35)' : 'rgba(180,190,120,0.22)');
    const w = rng() * 4.4 + 1, h = rng() * 11 + 3;
    gd.save(); gd.translate(x, y); gd.rotate((rng() - 0.5) * 0.8);
    gd.fillRect(-w/2, -h, w, h); gd.restore();

    const bright = 128 + Math.round((rng() - 0.5) * 70);
    gh.fillStyle = `rgba(${bright},${bright},${bright},0.5)`;
    gh.save(); gh.translate(x, y); gh.rotate((rng() - 0.5) * 0.8);
    gh.fillRect(-w/2, -h, w, h); gh.restore();
  }
  // convert the greyscale height canvas into a tangent-space normal map
  // (cheap Sobel pass) so the grass has real micro-shading under the sun
  const hd = gh.getImageData(0, 0, SZ, SZ).data;
  const nOut = gd.getImageData(0, 0, SZ, SZ); // reuse for allocation shape only
  const normalCanvas = document.createElement('canvas'); normalCanvas.width = normalCanvas.height = SZ;
  const gn = normalCanvas.getContext('2d');
  const nImg = gn.createImageData(SZ, SZ);
  const at = (x, y) => hd[((y & (SZ - 1)) * SZ + (x & (SZ - 1))) * 4] / 255;
  const strength = 2.2;
  for (let y = 0; y < SZ; y++){
    for (let x = 0; x < SZ; x++){
      const l = at(x - 1, y), r = at(x + 1, y), u = at(x, y - 1), d = at(x, y + 1);
      let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      const idx = (y * SZ + x) * 4;
      nImg.data[idx] = (nx * 0.5 + 0.5) * 255;
      nImg.data[idx + 1] = (ny * 0.5 + 0.5) * 255;
      nImg.data[idx + 2] = (nz * 0.5 + 0.5) * 255;
      nImg.data[idx + 3] = 255;
    }
  }
  gn.putImageData(nImg, 0, 0);

  const diffuseTex = new THREE.CanvasTexture(diffuse);
  diffuseTex.wrapS = diffuseTex.wrapT = THREE.RepeatWrapping;
  diffuseTex.colorSpace = THREE.SRGBColorSpace;
  diffuseTex.repeat.set(48, 48);
  diffuseTex.anisotropy = 4;

  const normalTex = new THREE.CanvasTexture(normalCanvas);
  normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
  normalTex.repeat.set(48, 48);
  normalTex.anisotropy = 4;

  return { diffuseTex, normalTex };
}

function makeRockTexture(rng){
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#6d6a63'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2200; i++){
    const x = rng() * 256, y = rng() * 256, r = rng() * 2.2 + 0.3;
    const v = 90 + Math.round(rng() * 70);
    g.fillStyle = `rgba(${v},${v - 4},${v - 8},${0.12 + rng() * 0.2})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(30, 30);
  return tex;
}

export class Terrain {
  /** @param {import('./RiverPath.js').RiverPath} river
   *  @param {Function} rng
   *  @param {object} preset environment preset (for grass/bank tint) */
  constructor(river, rng, preset){
    this.river = river;
    this.rng = rng;
    this.preset = preset;
    this.group = new THREE.Group();
    this._slopeEps = 0.35;
    this._buildMesh();
    this._buildBridgeheadPatches();
  }

  /** Rolling hills + two named landmarks + a shallow valley for variety.
   *  The valley is new: previously the field between spawn and the hill
   *  was featureless, so there was nothing to read as a "low point". */
  baseHeight(x, z){
    let h = fbm(x * 0.014, z * 0.014) * 5.4;
    h += fbm(x * 0.05, z * 0.05) * 1.15;

    const dh = Math.hypot(x - HILL_CENTER.x, z - HILL_CENTER.z);
    h += Math.max(0, 1 - dh / 58) ** 2 * 17;

    const dk = Math.hypot(x - KNOLL_CENTER.x, z - KNOLL_CENTER.z);
    h += Math.max(0, 1 - dk / 32) ** 2 * 6.5;

    const dv = Math.hypot(x - VALLEY_CENTER.x, z - VALLEY_CENTER.z);
    h -= Math.max(0, 1 - dv / 40) ** 2 * 3.2;

    return h;
  }

  terrainHeight(x, z){
    let h = this.baseHeight(x, z);
    const d = this.river.distToRiver(x, z);
    if (d < RIVER_HALF){
      h = -1.5;
    } else if (d < RIVER_HALF + BANK_FADE){
      const t = smoothstep(RIVER_HALF, RIVER_HALF + BANK_FADE, d);
      h = lerp(-1.5, h, t);
    }
    for (const b of this.river.bridges){
      const db = Math.hypot(x - b.x, z - b.z);
      if (d > RIVER_HALF && db < 15){
        const t = smoothstep(4, 15, db);
        h = lerp(BRIDGE_Y - 0.2, h, t);
      }
    }
    const ds = Math.hypot(x, z);
    if (ds < 14) h *= smoothstep(6, 14, ds); // flatten spawn
    return h;
  }

  groundHeightAt(x, z){
    const b = this.river.isOnBridge(x, z);
    if (b) return BRIDGE_Y + 0.1;
    return this.terrainHeight(x, z);
  }

  inRiverWater(x, z){
    if (this.river.isOnBridge(x, z)) return false;
    return this.river.distToRiver(x, z) < RIVER_HALF;
  }

  /** Finite-difference ground normal — cheap (4 extra height samples),
   *  used only for the player and camera per-frame, never per-vertex. */
  groundNormalAt(x, z, out = new THREE.Vector3()){
    const eps = this._slopeEps;
    const hL = this.groundHeightAt(x - eps, z);
    const hR = this.groundHeightAt(x + eps, z);
    const hD = this.groundHeightAt(x, z - eps);
    const hU = this.groundHeightAt(x, z + eps);
    out.set(hL - hR, 2 * eps, hD - hU);
    return out.normalize();
  }

  isClearSpot(x, z, margin = 3){
    if (Math.hypot(x, z) < 20) return false;
    const d = this.river.distToRiver(x, z);
    if (d < RIVER_HALF + BANK_FADE + margin) return false;
    if (this.river.nearestBridgeDist(x, z) < 17) return false;
    return true;
  }

  _buildMesh(){
    const { diffuseTex, normalTex } = makeGrassTextures(this.rng);
    const rockTex = makeRockTexture(this.rng);
    const g = this.preset.grass;
    const TERRAIN_SEG = Q.props >= 1 ? 220 : 140;
    const geo = new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2, TERRAIN_SEG, TERRAIN_SEG);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const colGrassA = new THREE.Color(g.a);
    const colGrassB = new THREE.Color(g.b);
    const colBank = new THREE.Color(g.bank);
    const colValley = new THREE.Color(g.valley);
    const colHighland = new THREE.Color(g.highland);
    const colRock = new THREE.Color(0x8a8579);

    // finite-difference slope (reuses the same height field the mesh
    // is built from) so steep faces read as bare rock, not grass painted
    // on a cliff — this was the single flattest-looking part of the map
    const slopeAt = (x, z) => {
      const eps = 0.6;
      const hl = this.terrainHeight(x - eps, z), hr = this.terrainHeight(x + eps, z);
      const hd = this.terrainHeight(x, z - eps), hu = this.terrainHeight(x, z + eps);
      const nx = hl - hr, nz = hd - hu;
      const ny = 2 * eps;
      return 1 - ny / Math.hypot(nx, ny, nz); // 0 = flat, ~1 = vertical
    };

    for (let i = 0; i < pos.count; i++){
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.terrainHeight(x, z);
      pos.setY(i, h);
      const d = this.river.distToRiver(x, z);
      let col;
      if (d < RIVER_HALF - 1) col = new THREE.Color(0x37543a);
      else if (d < RIVER_HALF + BANK_FADE) col = colBank.clone().lerp(colGrassA, smoothstep(RIVER_HALF - 1, RIVER_HALF + BANK_FADE, d));
      else col = colGrassA.clone().lerp(colGrassB, valueNoise(x * 0.05, z * 0.05) * 0.5 + 0.5);
      if (h > 9) col = col.clone().lerp(colHighland, smoothstep(9, 17, h));
      const dv = Math.hypot(x - VALLEY_CENTER.x, z - VALLEY_CENTER.z);
      if (dv < 40) col = col.clone().lerp(colValley, Math.max(0, 1 - dv / 40) * 0.35);
      const slope = slopeAt(x, z);
      if (slope > 0.3 && h > 2) col = col.clone().lerp(colRock, smoothstep(0.3, 0.62, slope));
      colors[i*3] = col.r; colors[i*3+1] = col.g; colors[i*3+2] = col.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 1, metalness: 0,
      map: diffuseTex, normalMap: normalTex, normalScale: new THREE.Vector2(0.55, 0.55),
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
    this._rockTex = rockTex;
  }

  _buildBridgeheadPatches(){
    const dirtTex = makeDirtTexture(this.rng);
    this.river.bridges.forEach(b => {
      const tangent = new THREE.Vector3(Math.cos(b.angle), 0, -Math.sin(b.angle));
      [-1, 1].forEach(side => {
        const cx = b.x + tangent.x * side * (b.deckLength / 2 + 6);
        const cz = b.z + tangent.z * side * (b.deckLength / 2 + 6);
        const g = new THREE.CircleGeometry(9, 24);
        g.rotateX(-Math.PI / 2);
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++){
          const wx = cx + pos.getX(i), wz = cz + pos.getZ(i);
          pos.setY(i, this.groundHeightAt(wx, wz) + 0.03);
        }
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 1, transparent: true, opacity: 0.88 }));
        m.position.set(cx, 0, cz);
        m.receiveShadow = true;
        this.group.add(m);
      });
    });
  }
}
