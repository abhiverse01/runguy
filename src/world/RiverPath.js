import * as THREE from 'three';
import { distPointSegment } from '../utils/math.js';
import { RIVER_HALF } from '../config/constants.js';

/**
 * RiverPath is the single authority for "where is the river and its
 * bridges" — Terrain, River (water mesh), Bridges, and Vegetation all
 * read from one instance of this class instead of each re-deriving
 * the layout, which is how the old single-file build guaranteed every
 * subsystem agreed on where the water actually was.
 */
export class RiverPath {
  constructor(){
    this.controlPoints = [
      new THREE.Vector3(-150, 0, -150),
      new THREE.Vector3(-95, 0, -95),
      new THREE.Vector3(-52, 0, -22),
      new THREE.Vector3(-8, 0, 42),
      new THREE.Vector3(42, 0, 92),
      new THREE.Vector3(102, 0, 122),
      new THREE.Vector3(155, 0, 150),
    ];
    this.curve = new THREE.CatmullRomCurve3(this.controlPoints, false, 'catmullrom', 0.4);
    this.polyline = this.curve.getSpacedPoints(160);

    const BRIDGE_TS = [0.2, 0.5, 0.8];
    this.bridges = BRIDGE_TS.map((t, i) => {
      const p = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const perp = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const angle = Math.atan2(perp.x, perp.z);
      return {
        id: i, x: p.x, z: p.z, angle,
        deckLength: (RIVER_HALF + 9) * 2 + 6,
        deckWidth: 3.4,
      };
    });
  }

  distToRiver(x, z){
    let min = Infinity;
    const pts = this.polyline;
    for (let i = 0; i < pts.length - 1; i++){
      const p1 = pts[i], p2 = pts[i + 1];
      const d = distPointSegment(x, z, p1.x, p1.z, p2.x, p2.z);
      if (d < min) min = d;
    }
    return min;
  }

  isOnBridge(x, z){
    for (const b of this.bridges){
      const dx = x - b.x, dz = z - b.z;
      const cos = Math.cos(-b.angle), sin = Math.sin(-b.angle);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      if (Math.abs(lx) < b.deckWidth / 2 + 0.4 && Math.abs(lz) < b.deckLength / 2 + 0.4) return b;
    }
    return null;
  }

  nearestBridgeDist(x, z){
    let min = Infinity;
    for (const b of this.bridges) min = Math.min(min, Math.hypot(x - b.x, z - b.z));
    return min;
  }
}
