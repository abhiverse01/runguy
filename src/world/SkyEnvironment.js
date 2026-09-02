import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { degToRad } from '../utils/math.js';
import { Q, REDUCED_MOTION } from '../config/constants.js';

export class SkyEnvironment {
  /** @param {object} preset one entry from EnvironmentPresets.js */
  constructor(scene, renderer, rng, preset){
    this.scene = scene;
    this.rng = rng;
    this.preset = preset;

    this.sky = new Sky();
    this.sky.scale.setScalar(9000);
    scene.add(this.sky);

    this.sunDir = new THREE.Vector3();
    const phi = degToRad(90 - preset.sunElevation);
    const theta = degToRad(preset.sunAzimuth);
    this.sunDir.setFromSphericalCoords(1, phi, theta);
    const u = this.sky.material.uniforms;
    u['turbidity'].value = preset.sky.turbidity;
    u['rayleigh'].value = preset.sky.rayleigh;
    u['mieCoefficient'].value = preset.sky.mieCoefficient;
    u['mieDirectionalG'].value = preset.sky.mieDirectionalG;
    u['sunPosition'].value.copy(this.sunDir);

    this.horizonColor = new THREE.Color(preset.fogColor);
    scene.fog = new THREE.Fog(this.horizonColor.getHex(), 70 * preset.fogNearMul, Q.fogFar * preset.fogFarMul);
    renderer.setClearColor(this.horizonColor);
    renderer.toneMappingExposure = preset.exposure;

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

    this.sunLight = new THREE.DirectionalLight(preset.sunColor, preset.sunIntensity);
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
    // slightly softer shadows read more "real" than crisp low-res PCF edges
    this.sunLight.shadow.radius = 2.4;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    this.hemi = new THREE.HemisphereLight(preset.hemiSky, preset.hemiGround, preset.hemiIntensity);
    scene.add(this.hemi);

    // a very low, cool fill light from the opposite side of the sun so
    // shadowed faces never go fully flat/black — cheap, one extra light
    this.fill = new THREE.DirectionalLight(0xaecbe0, 0.35);
    this.fill.position.copy(this.sunDir).multiplyScalar(-80);
    this.fill.position.y = Math.abs(this.fill.position.y) + 30;
    scene.add(this.fill);

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
    const cloudMat = new THREE.MeshStandardMaterial({
      color: this.preset.cloudColor, roughness: 1, transparent: true,
      opacity: this.preset.cloudOpacity, fog: false,
    });
    const puffGeo = new THREE.IcosahedronGeometry(1, 1);
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
