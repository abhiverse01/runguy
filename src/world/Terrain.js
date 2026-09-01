import * as THREE from 'three';
import { fbm, valueNoise, smoothstep, lerp, clamp } from '../utils/math.js';
import { MAP_HALF, RIVER_HALF, BANK_FADE, BRIDGE_Y, HILL_CENTER, KNOLL_CENTER, VALLEY_CENTER } from '../config/constants.js';

function makeDirtTexture(rng){
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#8a6b46'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++){
    const x = rng() * 128, y = rng() * 128, r = rng() * 1.6 + 0.3;
    g.fillStyle = `rgba(${60 + rng()*40|0},${40+rng()*30|0},${20+rng()*20|0},${0.15 + rng()*0.2})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGrassPatchTexture(rng){
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#4c7a45'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++){
    const x = rng() * 512, y = rng() * 512;
    const shade = rng();
    g.fillStyle = shade < 0.5 ? 'rgba(70,110,58,0.5)' : (shade < 0.85 ? 'rgba(110,150,80,0.35)' : 'rgba(180,190,120,0.22)');
    const w = rng() * 2.4 + 0.6, h = rng() * 6 + 2;
    g.save(); g.translate(x, y); g.rotate((rng() - 0.5) * 0.8);
    g.fillRect(-w/2, -h, w, h); g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(48, 48);
  return tex;
}

export class Terrain {
  /** @param {import('./RiverPath.js').RiverPath} river */
  constructor(river, rng){
    this.river = river;
    this.rng = rng;
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
    const grassTex = makeGrassPatchTexture(this.rng);
    const TERRAIN_SEG = 180;
    const geo = new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2, TERRAIN_SEG, TERRAIN_SEG);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const colGrassA = new THREE.Color(0x4c7a45);
    const colGrassB = new THREE.Color(0x6f9455);
    const colBank = new THREE.Color(0x8a7345);
    const colValley = new THREE.Color(0x3f6a48);
    for (let i = 0; i < pos.count; i++){
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.terrainHeight(x, z);
      pos.setY(i, h);
      const d = this.river.distToRiver(x, z);
      let col;
      if (d < RIVER_HALF - 1) col = new THREE.Color(0x37543a);
      else if (d < RIVER_HALF + BANK_FADE) col = colBank.clone().lerp(colGrassA, smoothstep(RIVER_HALF - 1, RIVER_HALF + BANK_FADE, d));
      else col = colGrassA.clone().lerp(colGrassB, valueNoise(x * 0.05, z * 0.05) * 0.5 + 0.5);
      if (h > 9) col = col.clone().lerp(new THREE.Color(0x9aa07e), smoothstep(9, 17, h));
      const dv = Math.hypot(x - VALLEY_CENTER.x, z - VALLEY_CENTER.z);
      if (dv < 40) col = col.clone().lerp(colValley, Math.max(0, 1 - dv / 40) * 0.35);
      colors[i*3] = col.r; colors[i*3+1] = col.g; colors[i*3+2] = col.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: grassTex });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
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
