import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene, maxParticles = 320){
    this.max = maxParticles;
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(maxParticles * 3);
    this.colors = new Float32Array(maxParticles * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({ size: 0.11, vertexColors: true, transparent: true, opacity: 1, depthWrite: false });
    this.points = new THREE.Points(geo, mat);
    this.geo = geo;
    scene.add(this.points);

    this.pool = [];
    for (let i = 0; i < maxParticles; i++){
      this.pool.push({ active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, r: 1, g: 1, b: 1, gravity: -4.5 });
    }
  }

  spawn(x, y, z, opts = {}){
    const p = this.pool.find(p => !p.active);
    if (!p) return;
    p.active = true; p.x = x; p.y = y; p.z = z;
    p.vx = opts.vx ?? (Math.random() - 0.5) * 1.4;
    p.vy = opts.vy ?? Math.random() * 2.2 + 0.6;
    p.vz = opts.vz ?? (Math.random() - 0.5) * 1.4;
    p.life = 0; p.maxLife = opts.maxLife ?? 0.6;
    p.r = opts.r ?? 0.8; p.g = opts.g ?? 0.85; p.b = opts.b ?? 0.9;
    p.gravity = opts.gravity ?? -4.5;
  }

  burst(x, y, z, count, opts){ for (let i = 0; i < count; i++) this.spawn(x, y, z, opts); }

  /** Ring of outward-flying particles — used for the slam shockwave. */
  ring(x, y, z, count, radius, opts = {}){
    for (let i = 0; i < count; i++){
      const a = (i / count) * Math.PI * 2;
      this.spawn(x + Math.cos(a) * radius * 0.2, y, z + Math.sin(a) * radius * 0.2, {
        ...opts,
        vx: Math.cos(a) * (opts.speed ?? 3.5),
        vz: Math.sin(a) * (opts.speed ?? 3.5),
        vy: opts.vy ?? 0.8,
      });
    }
  }

  update(dt){
    const pos = this.positions, col = this.colors;
    for (let i = 0; i < this.max; i++){
      const p = this.pool[i];
      const o = i * 3;
      if (!p.active){ pos[o+1] = -999; continue; }
      p.life += dt;
      if (p.life >= p.maxLife){ p.active = false; pos[o+1] = -999; continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const fade = 1 - p.life / p.maxLife;
      pos[o] = p.x; pos[o+1] = p.y; pos[o+2] = p.z;
      col[o] = p.r * fade + (1-fade); col[o+1] = p.g * fade + (1-fade); col[o+2] = p.b * fade + (1-fade);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}
