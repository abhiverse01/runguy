import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { RIVER_HALF } from '../config/constants.js';

export class River {
  /** @param {import('./RiverPath.js').RiverPath} river */
  constructor(river, sunDir){
    this.group = new THREE.Group();
    this._buildShape(river);

    this.water = new Water(this.geo, {
      textureWidth: 512, textureHeight: 512,
      waterNormals: new THREE.TextureLoader().load(
        'https://unpkg.com/three@0.160.0/examples/textures/waternormals.jpg',
        t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
      ),
      sunDirection: sunDir.clone(),
      sunColor: 0xfff3da,
      waterColor: 0x2c6e63,
      distortionScale: 2.2,
      fog: true,
    });
    this.water.position.y = 0;
    this.group.add(this.water);

    const bedGeo = this.geo.clone();
    const pos = bedGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, -1.6);
    const bedMesh = new THREE.Mesh(bedGeo, new THREE.MeshStandardMaterial({ color: 0x1c3a30, roughness: 1 }));
    bedMesh.receiveShadow = true;
    this.group.add(bedMesh);
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

  update(dt){
    this.water.material.uniforms['time'].value += dt * 0.5;
  }
}
