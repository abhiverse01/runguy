import * as THREE from 'three';

function makeWoodTexture(rng){
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#7a5330'; g.fillRect(0, 0, 256, 256);
  const plankH = 256 / 8;
  for (let i = 0; i < 8; i++){
    const y = i * plankH;
    g.fillStyle = i % 2 === 0 ? 'rgba(90,60,34,0.35)' : 'rgba(120,84,48,0.28)';
    g.fillRect(0, y, 256, plankH);
    g.strokeStyle = 'rgba(40,24,12,0.5)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke();
    for (let gx = 0; gx < 256; gx += 3){
      const ny = y + plankH / 2 + Math.sin(gx * 0.2 + i) * (plankH / 3);
      g.fillStyle = 'rgba(50,30,14,0.06)';
      g.fillRect(gx, ny, 2, 6);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Bridges {
  /** @param {import('./RiverPath.js').RiverPath} river */
  constructor(river, rng){
    this.group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ map: makeWoodTexture(rng), roughness: 0.85, metalness: 0.05 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x5b3d22, roughness: 0.8 });

    river.bridges.forEach(b => {
      const g = new THREE.Group();
      g.position.set(b.x, 0.5, b.z);
      g.rotation.y = b.angle;

      const deck = new THREE.Mesh(new THREE.BoxGeometry(b.deckWidth, 0.28, b.deckLength), woodMat);
      deck.castShadow = true; deck.receiveShadow = true;
      g.add(deck);

      const postCount = Math.round(b.deckLength / 4.2);
      const postGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.0, 6);
      const railGeo = new THREE.BoxGeometry(0.09, 0.09, b.deckLength);
      [-1, 1].forEach(side => {
        const railX = side * (b.deckWidth / 2);
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set(railX, 0.72, 0);
        rail.castShadow = true;
        g.add(rail);
        for (let i = 0; i <= postCount; i++){
          const t = i / postCount - 0.5;
          const post = new THREE.Mesh(postGeo, railMat);
          post.position.set(railX, 0.5, t * b.deckLength * 0.96);
          post.castShadow = true;
          g.add(post);
        }
      });

      const pylonGeo = new THREE.CylinderGeometry(0.22, 0.26, 2.4, 8);
      [-1, 1].forEach(side => {
        [-1, 1].forEach(end => {
          const pylon = new THREE.Mesh(pylonGeo, railMat);
          pylon.position.set(side * (b.deckWidth / 2 - 0.2), -1.1, end * (b.deckLength / 2 - 1.4));
          pylon.castShadow = true;
          g.add(pylon);
        });
      });

      // small lantern posts at each end — new prop, doubles as a
      // night-readable landmark if a day/night cycle is added later
      const lanternGeo = new THREE.SphereGeometry(0.09, 8, 8);
      const lanternMat = new THREE.MeshStandardMaterial({ color: 0xe0b869, emissive: 0xe0b869, emissiveIntensity: 0.8 });
      [-1, 1].forEach(end => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.3, 6), railMat);
        post.position.set(b.deckWidth / 2 + 0.15, 1.1, end * (b.deckLength / 2 - 0.6));
        post.castShadow = true;
        g.add(post);
        const lantern = new THREE.Mesh(lanternGeo, lanternMat);
        lantern.position.set(b.deckWidth / 2 + 0.15, 1.8, end * (b.deckLength / 2 - 0.6));
        g.add(lantern);
      });

      this.group.add(g);
    });
  }
}
