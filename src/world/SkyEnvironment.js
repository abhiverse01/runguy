import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { degToRad } from '../utils/math.js';
import { Q, REDUCED_MOTION } from '../config/constants.js';

export class SkyEnvironment {
  constructor(scene, renderer, rng){
    this.scene = scene;
    this.rng = rng;

    this.sky = new Sky();
    this.sky.scale.setScalar(9000);
    scene.add(this.sky);

    const sunElevation = 34, sunAzimuth = 200;
    this.sunDir = new THREE.Vector3();
    const phi = degToRad(90 - sunElevation);
    const theta = degToRad(sunAzimuth);
    this.sunDir.setFromSphericalCoords(1, phi, theta);
    const u = this.sky.material.uniforms;
    u['turbidity'].value = 4.2;
    u['rayleigh'].value = 1.7;
    u['mieCoefficient'].value = 0.0048;
    u['mieDirectionalG'].value = 0.82;
    u['sunPosition'].value.copy(this.sunDir);

    this.horizonColor = new THREE.Color(0xcfe6df);
    scene.fog = new THREE.Fog(this.horizonColor.getHex(), 70, Q.fogFar);
    renderer.setClearColor(this.horizonColor);

    // baked image-based lighting from the sky dome
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envSky = this.sky.clone();
    envScene.add(envSky);
    const envRT = pmrem.fromScene(envScene, 0.02);
    scene.environment = envRT.texture;
    pmrem.dispose();
    envSky.geometry.dispose();
    envSky.material.dispose();

    this.sunLight = new THREE.DirectionalLight(0xfff3da, 3.1);
    this.sunLight.position.copy(this.sunDir).multiplyScalar(140);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(Q.shadow, Q.shadow);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 200;
    this.sunLight.shadow.camera.left = -46;
    this.sunLight.shadow.camera.right = 46;
    this.sunLight.shadow.camera.top = 46;
    this.sunLight.shadow.camera.bottom = -46;
    this.sunLight.shadow.bias = -0.0015;
    this.sunLight.shadow.normalBias = 0.02;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    this.hemi = new THREE.HemisphereLight(0xcfe6ff, 0x5a6b45, 0.65);
    scene.add(this.hemi);

    this._buildClouds();
  }

  /** The shadow frustum follows the player every frame instead of
   *  staying pinned at world origin — on a 340-unit-wide map a fixed
   *  ~84-unit shadow box meant anything past ~40 units from spawn
   *  silently lost its shadow entirely. */
  followShadowTo(px, pz){
    this.sunLight.position.set(px, 0, pz).addScaledVector(this.sunDir, 140);
    this.sunLight.target.position.set(px, 0, pz);
    this.sunLight.target.updateMatrixWorld();
  }

  _buildClouds(){
    this.cloudGroup = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.85, fog: false });
    const puffGeo = new THREE.IcosahedronGeometry(1, 0);
    this.clouds = [];
    for (let i = 0; i < 14; i++){
      const cloud = new THREE.Group();
      const puffs = 4 + Math.floor(this.rng() * 4);
      for (let j = 0; j < puffs; j++){
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set((this.rng() - 0.5) * 8, (this.rng() - 0.5) * 1.4, (this.rng() - 0.5) * 4);
        puff.scale.setScalar(2.2 + this.rng() * 2.6);
        cloud.add(puff);
      }
      const ang = this.rng() * Math.PI * 2, rad = 90 + this.rng() * 220;
      cloud.position.set(Math.cos(ang) * rad, 62 + this.rng() * 30, Math.sin(ang) * rad);
      cloud.userData.speed = 0.4 + this.rng() * 0.6;
      cloud.userData.dir = new THREE.Vector3(this.rng() - 0.5, 0, this.rng() - 0.5).normalize();
      this.cloudGroup.add(cloud);
      this.clouds.push(cloud);
    }
    this.scene.add(this.cloudGroup);
  }

  update(dt){
    if (REDUCED_MOTION) return;
    this.clouds.forEach(c => {
      c.position.addScaledVector(c.userData.dir, c.userData.speed * dt);
      if (c.position.length() > 340) c.position.multiplyScalar(0.3);
    });
  }
}
