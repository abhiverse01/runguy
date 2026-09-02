import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { RIVER_HALF } from '../config/constants.js';

function makeFoamTexture(){
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 64);
  for (let i = 0; i < 900; i++){
    const x = Math.random() * 256, y = Math.random() * 64;
    const r = Math.random() * 3 + 0.4;
    const yBias = 1 - Math.abs(y - 32) / 32; // stronger foam near the bank edge
    g.fillStyle = `rgba(255,255,255,${(Math.random() * 0.5 + 0.15) * yBias})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export class River {
  /** @param {import('./RiverPath.js').RiverPath} river
   *  @param {THREE.Vector3} sunDir
   *  @param {object} preset water color options from EnvironmentPresets.js */
  constructor(river, sunDir, preset){
    this.group = new THREE.Group();
    this._buildShape(river);
    const wp = preset.water;

    this.water = new Water(this.geo, {
      textureWidth: 1024, textureHeight: 1024,
      waterNormals: new THREE.TextureLoader().load(
        'https://unpkg.com/three@0.160.0/examples/textures/waternormals.jpg',
        t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
      ),
      sunDirection: sunDir.clone(),
      sunColor: wp.sunColor,
      waterColor: wp.color,
      distortionScale: wp.distortionScale,
      alpha: 0.94,
      fog: true,
    });
    this.water.material.uniforms['size'].value = 2.4;
    this.water.position.y = 0;
    this.group.add(this.water);

    const bedGeo = this.geo.clone();
    const pos = bedGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, -1.6);
    const bedColor = new THREE.Color(wp.color).multiplyScalar(0.55);
    const bedMesh = new THREE.Mesh(bedGeo, new THREE.MeshStandardMaterial({ color: bedColor, roughness: 1 }));
    bedMesh.receiveShadow = true;
    this.group.add(bedMesh);

    this._buildFoam(river);
  }

  _buildShape(river){
    const shape = new THREE.Shape();
    const left = [], right = [];
    const pts = river.polyline;
    for (let i = 0; i < pts.length; i++){
      const p = pts[i];
      const pPrev = pts[Math.max(0, i - 1)];
      const pNext = pts[Math.min(pts.length - 1, i + 1)];
      const tangent = new THREE.Vector2(pNext.x - pPrev.x, pNext.z - pPrev.z).normalize();
      const perp = new THREE.Vector2(-tangent.y, tangent.x);
      left.push(new THREE.Vector2(p.x + perp.x * RIVER_HALF, p.z + perp.y * RIVER_HALF));
      right.push(new THREE.Vector2(p.x - perp.x * RIVER_HALF, p.z - perp.y * RIVER_HALF));
      this._left = left; this._right = right;
    }
    // Shape lives in local XY; after rotateX(-PI/2) local Y maps to world -Z,
    // so we negate stored Z here to keep this aligned with Terrain/Bridges.
    shape.moveTo(left[0].x, -left[0].y);
    left.forEach(p => shape.lineTo(p.x, -p.y));
    for (let i = right.length - 1; i >= 0; i--) shape.lineTo(right[i].x, -right[i].y);
    shape.closePath();

    this.geo = new THREE.ShapeGeometry(shape, 1);
    this.geo.rotateX(-Math.PI / 2);
  }

  /** A thin scrolling foam ribbon hugging each bank — reads as the water
   *  actually lapping against the shore instead of a flat color meeting
   *  a flat color, which is the single biggest tell of a "fake" river. */
  _buildFoam(river){
    const foamTex = makeFoamTexture();
    foamTex.repeat.set(river.polyline.length * 0.35, 1);
    const foamMat = new THREE.MeshBasicMaterial({
      map: foamTex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.foamTex = foamTex;

    const build = (side) => {
      const pts = side === -1 ? this._left : this._right;
      const inner = [], outer = [];
      for (let i = 0; i < pts.length; i++){
        const p = pts[i];
        const pPrev = pts[Math.max(0, i - 1)];
        const pNext = pts[Math.min(pts.length - 1, i + 1)];
        const tangent = new THREE.Vector2(pNext.x - pPrev.x, pNext.y - pPrev.y).normalize();
        const perp = new THREE.Vector2(-tangent.y, tangent.x).multiplyScalar(side);
        inner.push(new THREE.Vector2(p.x - perp.x * 0.4, p.y - perp.y * 0.4));
        outer.push(new THREE.Vector2(p.x + perp.x * 1.1, p.y + perp.y * 1.1));
      }
      const positions = [], uvs = [], indices = [];
      for (let i = 0; i < inner.length; i++){
        positions.push(inner[i].x, 0.03, -inner[i].y);
        positions.push(outer[i].x, 0.03, -outer[i].y);
        uvs.push(i / inner.length * 6, 0);
        uvs.push(i / inner.length * 6, 1);
      }
      for (let i = 0; i < inner.length - 1; i++){
        const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
        indices.push(a, b, c, b, d, c);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      const mesh = new THREE.Mesh(geo, foamMat);
      this.group.add(mesh);
    };
    build(-1); build(1);
  }

  update(dt){
    this.water.material.uniforms['time'].value += dt * 0.5;
    if (this.foamTex) this.foamTex.offset.x += dt * 0.05;
  }
}
