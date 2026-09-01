import * as THREE from 'three';
import { MAP_HALF, ORB_TOTAL } from '../config/constants.js';

export class Orbs {
  constructor(scene, terrain, rng){
    this.group = new THREE.Group();
    this.list = [];
    const mat = new THREE.MeshStandardMaterial({ color: 0x9fe0c8, emissive: 0x4fd6a8, emissiveIntensity: 1.1, roughness: 0.3 });
    const geo = new THREE.OctahedronGeometry(0.22, 0);

    for (let i = 0; i < ORB_TOTAL; i++){
      let x, z, tries = 0;
      do {
        x = (rng() * 2 - 1) * MAP_HALF * 0.85;
        z = (rng() * 2 - 1) * MAP_HALF * 0.85;
        tries++;
      } while ((!terrain.isClearSpot(x, z, 2) || Math.hypot(x, z) < 26) && tries < 40);
      const h = terrain.terrainHeight(x, z);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, h + 1.0, z);
      mesh.castShadow = true;
      const light = new THREE.PointLight(0x4fd6a8, 0.9, 4);
      mesh.add(light);
      this.group.add(mesh);
      this.list.push({ mesh, x, z, baseY: h + 1.0, collected: false });
    }
    scene.add(this.group);
  }

  get collectedCount(){ return this.list.filter(o => o.collected).length; }

  /** @returns {{count:number}|null} non-null if any orb was collected this call */
  update(dt, player){
    let collectedThisFrame = 0;
    for (const o of this.list){
      if (o.collected) continue;
      o.mesh.rotation.y += dt * 2;
      o.mesh.position.y = o.baseY + Math.sin(performance.now() * 0.003 + o.x) * 0.1;
      const d = Math.hypot(player.x - o.x, player.z - o.z);
      if (d < 1.15){
        o.collected = true;
        o.mesh.visible = false;
        collectedThisFrame++;
      }
    }
    return collectedThisFrame;
  }
}

export class QuestMarkers {
  constructor(scene, quests, terrain){
    this.group = new THREE.Group();
    const beaconMat = new THREE.MeshStandardMaterial({ color: 0xc9814f, emissive: 0xc9814f, emissiveIntensity: 1.4, roughness: 0.4 });
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xc9814f, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });

    quests.forEach(q => {
      if (!q.marker) return;
      const h = terrain.terrainHeight(q.marker.x, q.marker.z);
      const g = new THREE.Group(); g.position.set(q.marker.x, h, q.marker.z);
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), beaconMat);
      orb.position.y = 1.4; g.add(orb);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 8, 1, true), beamMat);
      beam.position.y = 3.9; g.add(beam);
      const light = new THREE.PointLight(0xc9814f, 1.1, 8);
      light.position.y = 1.4; g.add(light);
      g.userData = { orb, questRef: q, x: q.marker.x, z: q.marker.z };
      this.group.add(g);
      q.beacon = g;
    });
    scene.add(this.group);
  }

  update(dt){
    this.group.children.forEach(g => {
      g.userData.orb.rotation.y += dt * 1.6;
      g.userData.orb.position.y = 1.4 + Math.sin(performance.now() * 0.0025 + g.userData.x) * 0.12;
      g.visible = !g.userData.questRef.done;
    });
  }
}
