import * as THREE from 'three';
import { Q, MAP_HALF, REDUCED_MOTION } from '../config/constants.js';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

export class Vegetation {
  /**
   * @param {import('./Terrain.js').Terrain} terrain
   * @param {import('./RiverPath.js').RiverPath} river
   * @param {Function} rng
   */
  constructor(terrain, river, rng){
    this.terrain = terrain;
    this.river = river;
    this.rng = rng;
    this.group = new THREE.Group();
    /** @type {{x:number,z:number,radius:number}[]} simple circular obstacles for player collision */
    this.obstacles = [];
    this.grassUniforms = { uTime: { value: 0 } };

    this._buildTrees();
    this._buildRocks();
    this._buildGrass();
    this._buildBushesAndFlowers();
    this._buildFallenLogs();
    this._buildMushrooms();
    this._buildReeds();
  }

  _isClear(x, z, margin){ return this.terrain.isClearSpot(x, z, margin); }

  _buildTrees(){
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 2.2, 6);
    const roundCanopyGeo = new THREE.IcosahedronGeometry(1.5, 0);
    const pineCanopyGeo = new THREE.ConeGeometry(1.3, 3.0, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4326, roughness: 0.95 });
    const roundLeafMat = new THREE.MeshStandardMaterial({ color: 0x4d7a3f, roughness: 0.9, flatShading: true });
    const pineLeafMat = new THREE.MeshStandardMaterial({ color: 0x3c6a4a, roughness: 0.9, flatShading: true });

    const N_ROUND = Math.round(84 * Q.props), N_PINE = Math.round(56 * Q.props);
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, N_ROUND + N_PINE);
    const roundInst = new THREE.InstancedMesh(roundCanopyGeo, roundLeafMat, N_ROUND);
    const pineInst = new THREE.InstancedMesh(pineCanopyGeo, pineLeafMat, N_PINE);
    trunkInst.castShadow = roundInst.castShadow = pineInst.castShadow = true;
    trunkInst.receiveShadow = roundInst.receiveShadow = pineInst.receiveShadow = true;

    let trunkIdx = 0, roundIdx = 0, pineIdx = 0;
    const placeTree = (isPine) => {
      let x, z, tries = 0;
      do { x = (this.rng() * 2 - 1) * MAP_HALF * 0.94; z = (this.rng() * 2 - 1) * MAP_HALF * 0.94; tries++; }
      while (!this._isClear(x, z, 4) && tries < 30);
      if (tries >= 30) return;
      const h = this.terrain.terrainHeight(x, z);
      const scale = 0.75 + this.rng() * 0.6;
      const rotY = this.rng() * Math.PI * 2;
      _q.setFromEuler(new THREE.Euler(0, rotY, 0));

      _p.set(x, h + 1.1 * scale, z); _s.setScalar(scale);
      _m.compose(_p, _q, _s);
      trunkInst.setMatrixAt(trunkIdx++, _m);

      if (isPine){
        _p.set(x, h + 2.7 * scale, z);
        _m.compose(_p, _q, _s);
        pineInst.setMatrixAt(pineIdx++, _m);
      } else {
        _p.set(x, h + 2.4 * scale, z);
        _m.compose(_p, _q, _s);
        roundInst.setMatrixAt(roundIdx++, _m);
      }
      this.obstacles.push({ x, z, radius: 0.55 * scale });
    };
    for (let i = 0; i < N_ROUND; i++) placeTree(false);
    for (let i = 0; i < N_PINE; i++) placeTree(true);
    trunkInst.count = trunkIdx; roundInst.count = roundIdx; pineInst.count = pineIdx;
    trunkInst.instanceMatrix.needsUpdate = true;
    roundInst.instanceMatrix.needsUpdate = true;
    pineInst.instanceMatrix.needsUpdate = true;
    this.group.add(trunkInst, roundInst, pineInst);
  }

  _buildRocks(){
    const rockGeo = new THREE.DodecahedronGeometry(0.55, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x83857c, roughness: 1, flatShading: true });
    const N_ROCK = Math.round(70 * Q.props);
    const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, N_ROCK);
    rockInst.castShadow = true; rockInst.receiveShadow = true;
    let rockIdx = 0;
    for (let i = 0; i < N_ROCK; i++){
      let x, z, tries = 0;
      do { x = (this.rng() * 2 - 1) * MAP_HALF * 0.95; z = (this.rng() * 2 - 1) * MAP_HALF * 0.95; tries++; }
      while (!this._isClear(x, z, 2) && tries < 30);
      if (tries >= 30) continue;
      const h = this.terrain.terrainHeight(x, z);
      const scale = 0.5 + this.rng() * 1.1;
      _p.set(x, h + 0.2 * scale, z);
      _q.setFromEuler(new THREE.Euler(this.rng() * 0.4, this.rng() * Math.PI * 2, this.rng() * 0.4));
      _s.setScalar(scale);
      _m.compose(_p, _q, _s);
      rockInst.setMatrixAt(rockIdx++, _m);
      this.obstacles.push({ x, z, radius: 0.5 * scale });
    }
    rockInst.count = rockIdx;
    rockInst.instanceMatrix.needsUpdate = true;
    this.group.add(rockInst);
  }

  _buildGrass(){
    const w = 0.09, h = 0.55;
    const geo = new THREE.BufferGeometry();
    const positions = [], uvs = [], indices = [];
    const addPlane = (rot) => {
      const base = positions.length / 3;
      const cx = Math.cos(rot) * w / 2, cz = Math.sin(rot) * w / 2;
      positions.push(-cx, 0, -cz,  cx, 0, cz,  cx, h, cz,  -cx, h, -cz);
      uvs.push(0,0, 1,0, 1,1, 0,1);
      indices.push(base,base+1,base+2, base,base+2,base+3, base+2,base+1,base, base+3,base+2,base);
    };
    addPlane(0); addPlane(Math.PI / 2.4);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const grassMat = new THREE.MeshStandardMaterial({ color: 0x5f9450, roughness: 1, side: THREE.DoubleSide });
    const uniforms = this.grassUniforms;
    grassMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nuniform float uTime;\nattribute float aPhase;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\nfloat sway = sin(uTime * 1.7 + aPhase) * 0.16 * smoothstep(0.0, 1.0, position.y / 0.55);\ntransformed.x += sway;\ntransformed.z += sway * 0.4;`);
    };

    const N_GRASS = Q.grass;
    const inst = new THREE.InstancedMesh(geo, grassMat, N_GRASS);
    inst.castShadow = false; inst.receiveShadow = false;
    const aPhase = new Float32Array(N_GRASS);
    let gi = 0;
    for (let i = 0; i < N_GRASS; i++){
      let x, z, tries = 0;
      do { x = (this.rng() * 2 - 1) * MAP_HALF * 0.97; z = (this.rng() * 2 - 1) * MAP_HALF * 0.97; tries++; }
      while (!this._isClear(x, z, 1) && tries < 12);
      if (tries >= 12) continue;
      const gh = this.terrain.terrainHeight(x, z);
      const scale = 0.7 + this.rng() * 0.9;
      _p.set(x, gh, z);
      _q.setFromEuler(new THREE.Euler(0, this.rng() * Math.PI * 2, 0));
      _s.set(scale, scale * (0.8 + this.rng() * 0.5), scale);
      _m.compose(_p, _q, _s);
      inst.setMatrixAt(gi, _m);
      aPhase[gi] = this.rng() * Math.PI * 2;
      gi++;
    }
    inst.count = gi;
    inst.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase, 1));
    inst.instanceMatrix.needsUpdate = true;
    this.group.add(inst);
    this.grassInst = inst;
  }

  /** New prop: low leafy bushes with small flower clusters scattered near
   *  the treeline, giving the field visual layers between grass and trees. */
  _buildBushesAndFlowers(){
    const bushGeo = new THREE.IcosahedronGeometry(0.5, 0);
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x466b3a, roughness: 0.95, flatShading: true });
    const N_BUSH = Math.round(60 * Q.props);
    const bushInst = new THREE.InstancedMesh(bushGeo, bushMat, N_BUSH);
    bushInst.castShadow = true; bushInst.receiveShadow = true;
    let bi = 0;
    for (let i = 0; i < N_BUSH; i++){
      let x, z, tries = 0;
      do { x = (this.rng() * 2 - 1) * MAP_HALF * 0.9; z = (this.rng() * 2 - 1) * MAP_HALF * 0.9; tries++; }
      while (!this._isClear(x, z, 2) && tries < 20);
      if (tries >= 20) continue;
      const h = this.terrain.terrainHeight(x, z);
      const scale = 0.5 + this.rng() * 0.5;
      _p.set(x, h + 0.28 * scale, z);
      _q.setFromEuler(new THREE.Euler(0, this.rng() * Math.PI * 2, 0));
      _s.set(scale, scale * 0.7, scale);
      _m.compose(_p, _q, _s);
      bushInst.setMatrixAt(bi++, _m);
      this.obstacles.push({ x, z, radius: 0.4 * scale });
    }
    bushInst.count = bi;
    bushInst.instanceMatrix.needsUpdate = true;
    this.group.add(bushInst);

    const petalColors = [0xdc8fa0, 0xe0c869, 0xcfe6ff, 0xf2f0e6];
    const flowerGeo = new THREE.SphereGeometry(0.06, 6, 6);
    petalColors.forEach(color => {
      const N_F = Math.round(90 * Q.props);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: color, emissiveIntensity: 0.08 });
      const inst = new THREE.InstancedMesh(flowerGeo, mat, N_F);
      let fi = 0;
      for (let i = 0; i < N_F; i++){
        let x, z, tries = 0;
        do { x = (this.rng() * 2 - 1) * MAP_HALF * 0.92; z = (this.rng() * 2 - 1) * MAP_HALF * 0.92; tries++; }
        while (!this._isClear(x, z, 0.5) && tries < 10);
        if (tries >= 10) continue;
        const h = this.terrain.terrainHeight(x, z);
        _p.set(x, h + 0.14, z);
        _q.identity();
        _s.setScalar(0.8 + this.rng() * 0.6);
        _m.compose(_p, _q, _s);
        inst.setMatrixAt(fi++, _m);
      }
      inst.count = fi;
      inst.instanceMatrix.needsUpdate = true;
      this.group.add(inst);
    });
  }

  /** New prop: fallen logs — low horizontal obstacles that read as
   *  step-over terrain detail rather than blocking collision volume. */
  _buildFallenLogs(){
    const logGeo = new THREE.CylinderGeometry(0.22, 0.26, 3.2, 8);
    const logMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.95 });
    const N_LOG = Math.round(14 * Q.props);
    for (let i = 0; i < N_LOG; i++){
      let x, z, tries = 0;
      do { x = (this.rng() * 2 - 1) * MAP_HALF * 0.85; z = (this.rng() * 2 - 1) * MAP_HALF * 0.85; tries++; }
      while (!this._isClear(x, z, 3) && tries < 20);
      if (tries >= 20) continue;
      const h = this.terrain.terrainHeight(x, z);
      const log = new THREE.Mesh(logGeo, logMat);
      log.position.set(x, h + 0.22, z);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = this.rng() * Math.PI;
      log.castShadow = true; log.receiveShadow = true;
      log.scale.setScalar(0.8 + this.rng() * 0.5);
      this.group.add(log);
      this.obstacles.push({ x, z, radius: 0.4 });
    }
  }

  /** New prop: small mushroom clusters tucked at the base of trees. */
  _buildMushrooms(){
    const capGeo = new THREE.SphereGeometry(0.08, 8, 6, 0, Math.PI * 2, 0, Math.PI / 1.8);
    const stemGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.12, 6);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xc95a4f, roughness: 0.6 });
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.8 });
    const N_CLUSTERS = Math.round(40 * Q.props);
    for (let i = 0; i < N_CLUSTERS; i++){
      let x, z, tries = 0;
      do { x = (this.rng() * 2 - 1) * MAP_HALF * 0.85; z = (this.rng() * 2 - 1) * MAP_HALF * 0.85; tries++; }
      while (!this._isClear(x, z, 1) && tries < 15);
      if (tries >= 15) continue;
      const h = this.terrain.terrainHeight(x, z);
      const group = new THREE.Group();
      const count = 2 + Math.floor(this.rng() * 3);
      for (let j = 0; j < count; j++){
        const scale = 0.5 + this.rng() * 0.8;
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.set((this.rng() - 0.5) * 0.18, 0.06 * scale, (this.rng() - 0.5) * 0.18);
        stem.scale.setScalar(scale);
        stem.castShadow = true;
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.set(0, 0.06 * scale, 0);
        cap.scale.setScalar(scale);
        cap.castShadow = true;
        stem.add(cap);
        group.add(stem);
      }
      group.position.set(x, h, z);
      this.group.add(group);
    }
  }

  /** New prop: reed clusters along the immediate riverbank, filling
   *  the transition zone between water and grass. */
  _buildReeds(){
    const reedGeo = new THREE.CylinderGeometry(0.015, 0.025, 1.1, 5);
    const reedMat = new THREE.MeshStandardMaterial({ color: 0x7a9c4a, roughness: 0.9 });
    const N_REED = Math.round(220 * Q.props);
    const inst = new THREE.InstancedMesh(reedGeo, reedMat, N_REED);
    inst.castShadow = false;
    let ri = 0, tries = 0, guard = 0;
    while (ri < N_REED && guard < N_REED * 8){
      guard++;
      const t = this.rng();
      const idx = Math.floor(t * (this.river.polyline.length - 1));
      const p = this.river.polyline[idx];
      const angle = this.rng() * Math.PI * 2;
      const dist = 8.5 + this.rng() * 3.5; // just outside RIVER_HALF (8), in the bank fade
      const x = p.x + Math.cos(angle) * dist;
      const z = p.z + Math.sin(angle) * dist;
      if (this.river.isOnBridge(x, z)) continue;
      const h = this.terrain.terrainHeight(x, z);
      _p.set(x, h + 0.5, z);
      _q.setFromEuler(new THREE.Euler((this.rng()-0.5)*0.2, this.rng() * Math.PI * 2, (this.rng()-0.5)*0.2));
      _s.setScalar(0.7 + this.rng() * 0.6);
      _m.compose(_p, _q, _s);
      inst.setMatrixAt(ri++, _m);
    }
    inst.count = ri;
    inst.instanceMatrix.needsUpdate = true;
    this.group.add(inst);
  }

  update(dt){
    if (!REDUCED_MOTION) this.grassUniforms.uTime.value += dt;
  }
}
