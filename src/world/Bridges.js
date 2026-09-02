import * as THREE from 'three';

function makeWoodTextures(rng){
  const SZ = 512;
  const diffuse = document.createElement('canvas'); diffuse.width = diffuse.height = SZ;
  const g = diffuse.getContext('2d');
  g.fillStyle = '#7a5330'; g.fillRect(0, 0, SZ, SZ);
  const plankH = SZ / 8;
  for (let i = 0; i < 8; i++){
    const y = i * plankH;
    g.fillStyle = i % 2 === 0 ? 'rgba(90,60,34,0.35)' : 'rgba(120,84,48,0.28)';
    g.fillRect(0, y, SZ, plankH);
    g.strokeStyle = 'rgba(40,24,12,0.55)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, y); g.lineTo(SZ, y); g.stroke();
    for (let gx = 0; gx < SZ; gx += 3){
      const ny = y + plankH / 2 + Math.sin(gx * 0.2 + i) * (plankH / 3);
      g.fillStyle = 'rgba(50,30,14,0.07)';
      g.fillRect(gx, ny, 2, 8);
    }
    // worn/weathered patches and a couple of visible nail heads per plank
    for (let n = 0; n < 3; n++){
      const nx = 20 + rng() * (SZ - 40);
      g.fillStyle = 'rgba(20,14,8,0.55)';
      g.beginPath(); g.arc(nx, y + plankH / 2, 2.2, 0, Math.PI * 2); g.fill();
    }
    for (let s = 0; s < 6; s++){
      const sx = rng() * SZ, sw = 6 + rng() * 30;
      g.fillStyle = `rgba(${140+rng()*40|0},${110+rng()*30|0},${70+rng()*20|0},0.12)`;
      g.fillRect(sx, y + 1, sw, plankH - 2);
    }
  }
  const diffuseTex = new THREE.CanvasTexture(diffuse);
  diffuseTex.wrapS = diffuseTex.wrapT = THREE.RepeatWrapping;
  diffuseTex.colorSpace = THREE.SRGBColorSpace;

  // matching roughness map — nail heads and grain lines read slightly
  // glossier/duller than the flat plank body
  const rough = document.createElement('canvas'); rough.width = rough.height = SZ;
  const gr = rough.getContext('2d');
  gr.fillStyle = '#c8c8c8'; gr.fillRect(0, 0, SZ, SZ);
  gr.drawImage(diffuse, 0, 0);
  gr.globalCompositeOperation = 'saturation';
  gr.fillStyle = '#808080'; gr.fillRect(0, 0, SZ, SZ);
  const roughTex = new THREE.CanvasTexture(rough);
  roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping;

  return { diffuseTex, roughTex };
}

function makeStoneTexture(){
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#7c7a72'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++){
    const x = Math.random() * 256, y = Math.random() * 256, r = Math.random() * 2 + 0.3;
    const v = 70 + Math.round(Math.random() * 60);
    g.fillStyle = `rgba(${v},${v-2},${v-6},${0.1 + Math.random()*0.18})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // mossy stain near the base
  const grad = g.createLinearGradient(0, 180, 0, 256);
  grad.addColorStop(0, 'rgba(70,90,50,0)');
  grad.addColorStop(1, 'rgba(60,84,44,0.4)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Bridges {
  /** @param {import('./RiverPath.js').RiverPath} river */
  constructor(river, rng){
    this.group = new THREE.Group();
    const { diffuseTex, roughTex } = makeWoodTextures(rng);
    const stoneTex = makeStoneTexture();
    const woodMat = new THREE.MeshStandardMaterial({ map: diffuseTex, roughnessMap: roughTex, roughness: 0.9, metalness: 0.04 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x5b3d22, roughness: 0.82 });
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xb89a68, roughness: 1 });
    const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.95 });

    river.bridges.forEach(b => {
      const g = new THREE.Group();
      g.position.set(b.x, 0.5, b.z);
      g.rotation.y = b.angle;

      // deck built from individual planks (not one slab) — each with a
      // tiny random height/tilt so the surface reads as boards laid by
      // hand rather than a single extruded box
      const plankCount = Math.max(10, Math.round(b.deckLength / 0.42));
      const plankLen = b.deckLength / plankCount;
      const plankGeo = new THREE.BoxGeometry(b.deckWidth, 0.22, plankLen * 0.96);
      for (let i = 0; i < plankCount; i++){
        const plank = new THREE.Mesh(plankGeo, woodMat);
        const t = (i / (plankCount - 1)) - 0.5;
        plank.position.set(0, (rng() - 0.5) * 0.02, t * b.deckLength);
        plank.rotation.y = (rng() - 0.5) * 0.01;
        plank.castShadow = true; plank.receiveShadow = true;
        g.add(plank);
      }

      // diagonal cross-bracing under the deck — the detail that most
      // reads as "structurally real" from a low third-person angle
      const braceGeo = new THREE.BoxGeometry(0.07, 0.07, Math.hypot(b.deckLength / 4, 0.9) * 1.02);
      const braceCount = Math.max(2, Math.round(b.deckLength / 8));
      for (let i = 0; i < braceCount; i++){
        const t = (i / (braceCount - 1) - 0.5) * (b.deckLength - 4);
        [-1, 1].forEach(dir => {
          const brace = new THREE.Mesh(braceGeo, railMat);
          brace.position.set(0, -0.32, t);
          brace.rotation.x = Math.atan2(0.9, b.deckLength / 4) * dir;
          brace.castShadow = true;
          g.add(brace);
        });
      }

      const postCount = Math.round(b.deckLength / 4.2);
      const postGeo = new THREE.CylinderGeometry(0.07, 0.08, 1.0, 7);
      const railGeo = new THREE.CylinderGeometry(0.05, 0.05, b.deckLength, 6);
      const ropeGeo = new THREE.TorusGeometry(0.05, 0.018, 5, 8);
      [-1, 1].forEach(side => {
        const railX = side * (b.deckWidth / 2);
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.rotation.z = Math.PI / 2;
        rail.position.set(railX, 0.72, 0);
        rail.castShadow = true;
        g.add(rail);
        // lower rope rail for a hand-built look
        const rope = new THREE.Mesh(railGeo, ropeMat);
        rope.rotation.z = Math.PI / 2;
        rope.scale.z = 1;
        rope.position.set(railX, 0.5, 0);
        rope.castShadow = true;
        g.add(rope);
        for (let i = 0; i <= postCount; i++){
          const t = i / postCount - 0.5;
          const post = new THREE.Mesh(postGeo, railMat);
          post.position.set(railX, 0.5, t * b.deckLength * 0.96);
          post.castShadow = true;
          g.add(post);
          // little rope-wrap ring where the rope crosses each post
          const wrap = new THREE.Mesh(ropeGeo, ropeMat);
          wrap.position.set(railX, 0.5, t * b.deckLength * 0.96);
          wrap.rotation.y = Math.PI / 2;
          g.add(wrap);
        }
      });

      // stone piers instead of thin bare cylinders — tapered, mossy at
      // the waterline, actually looks like it's bearing the load
      const pierGeo = new THREE.CylinderGeometry(0.34, 0.5, 2.6, 8);
      [-1, 1].forEach(side => {
        [-1, 1].forEach(end => {
          const pier = new THREE.Mesh(pierGeo, stoneMat);
          pier.position.set(side * (b.deckWidth / 2 - 0.15), -1.2, end * (b.deckLength / 2 - 1.4));
          pier.castShadow = true; pier.receiveShadow = true;
          g.add(pier);
        });
      });

      // lantern posts at each end — doubles as a night-readable landmark
      const lanternGeo = new THREE.SphereGeometry(0.1, 10, 10);
      const lanternMat = new THREE.MeshStandardMaterial({ color: 0xe0b869, emissive: 0xe0b869, emissiveIntensity: 1.1 });
      const lanternCageGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.16, 6, 1, true);
      const lanternCageMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.6, side: THREE.DoubleSide });
      [-1, 1].forEach(end => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.3, 7), railMat);
        post.position.set(b.deckWidth / 2 + 0.15, 1.1, end * (b.deckLength / 2 - 0.6));
        post.castShadow = true;
        g.add(post);
        const lantern = new THREE.Mesh(lanternGeo, lanternMat);
        lantern.position.set(b.deckWidth / 2 + 0.15, 1.8, end * (b.deckLength / 2 - 0.6));
        g.add(lantern);
        const cage = new THREE.Mesh(lanternCageGeo, lanternCageMat);
        cage.position.copy(lantern.position);
        g.add(cage);
        const glow = new THREE.PointLight(0xffb862, 0.9, 6, 2);
        glow.position.copy(lantern.position);
        g.add(glow);
      });

      this.group.add(g);
    });
  }
}
