import * as THREE from 'three';
import { mulberry32 } from './utils/math.js';
import { Q } from './config/constants.js';

import { RiverPath } from './world/RiverPath.js';
import { Terrain } from './world/Terrain.js';
import { River } from './world/River.js';
import { Bridges } from './world/Bridges.js';
import { Vegetation } from './world/Vegetation.js';
import { SkyEnvironment } from './world/SkyEnvironment.js';

import { Player } from './entities/Player.js';
import { Orbs, QuestMarkers } from './entities/Collectibles.js';

import { InputManager } from './systems/InputManager.js';
import { AudioManager } from './systems/AudioManager.js';
import { ParticleSystem } from './systems/ParticleSystem.js';
import { CameraController } from './systems/CameraController.js';
import { QuestSystem } from './systems/QuestSystem.js';

import { HUD } from './ui/HUD.js';
import { Overlays } from './ui/Overlays.js';

const RNG_SEED = 1337;
const rng = mulberry32(RNG_SEED);

// ---------------------------------------------------------------
// Renderer / scene / camera
// ---------------------------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Q.pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 900);

// ---------------------------------------------------------------
// World
// ---------------------------------------------------------------
const riverPath = new RiverPath();
const terrain = new Terrain(riverPath, rng);
scene.add(terrain.group);

const skyEnv = new SkyEnvironment(scene, renderer, rng);

const river = new River(riverPath, skyEnv.sunDir);
scene.add(river.group);

const bridges = new Bridges(riverPath, rng);
scene.add(bridges.group);

const vegetation = new Vegetation(terrain, riverPath, rng);
scene.add(vegetation.group);
// Player collision reads a single obstacle list off the terrain —
// vegetation is what populates it.
terrain.obstacles = vegetation.obstacles;

// ---------------------------------------------------------------
// Systems
// ---------------------------------------------------------------
const audio = new AudioManager();
const particles = new ParticleSystem(scene);
const input = new InputManager(canvas);

const player = new Player(scene, terrain, riverPath, audio, particles);

const questSystem = new QuestSystem(riverPath);
const questMarkers = new QuestMarkers(scene, questSystem.quests, terrain);
const orbs = new Orbs(scene, terrain, rng);

const cameraController = new CameraController(camera, terrain, input, player);

// ---------------------------------------------------------------
// Input -> ability wiring
// ---------------------------------------------------------------
input.on('jump', () => player.requestJump());
input.on('dash', () => player.requestDash());
input.on('slam', () => player.requestSlam());

// ---------------------------------------------------------------
// HUD / Overlays
// ---------------------------------------------------------------
const hud = new HUD(questSystem.quests, riverPath, orbs);

questSystem.onQuestComplete = (quest) => {
  hud.questToast('Quest Complete — ' + quest.name, audio);
  hud.refreshQuestLog();
};
questSystem.onFinale = () => {
  hud.finale(player.distanceWalked, audio);
};

const overlays = new Overlays({
  renderer, scene, input, audio, hud,
  onQualityChange: (quality) => {
    renderer.setPixelRatio(Q.pixelRatio);
    scene.fog.far = Q.fogFar;
  },
});
overlays.onPauseSummaryRequest = () => {
  overlays.fillPauseSummary({
    quests: questSystem.doneCount,
    questTotal: questSystem.quests.length,
    orbs: orbs.collectedCount,
    orbTotal: orbs.list.length,
    distance: player.distanceWalked,
    time: hud.formatTime(hud.elapsedTime),
  });
};

overlays.runBootSequence();

// ---------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------
const clock = new THREE.Clock();
let frameCount = 0;

function animate(){
  requestAnimationFrame(animate);
  let dt = clock.getDelta();
  dt = Math.min(dt, 0.05);
  frameCount++;

  skyEnv.update(dt);
  vegetation.update(dt);
  river.update(dt);
  hud.updateToasts(dt);

  if (overlays.state === 'playing'){
    const inp = input.readMovement();
    player.update(dt, input, cameraController.yaw);

    const orbsCollected = orbs.update(dt, player);
    if (orbsCollected > 0){
      audio.orb();
      particles.burst(player.x, player.y + 0.6, player.z, 6 * orbsCollected, { maxLife: 0.55, r: 0.6, g: 0.95, b: 0.8, gravity: -2, vy: 2 });
      const q6 = questSystem.registerOrbProgress(orbsCollected);
      if (q6 && !q6.done) hud.toast('Orb collected', `${q6.progress} / ${q6.target}`);
      hud.refreshQuestLog();
    }
    questMarkers.update(dt);
    questSystem.update(player);

    skyEnv.followShadowTo(player.x, player.z);

    const shake = player.consumeCamShake();
    if (shake > 0) cameraController.addImpactShake(shake);

    particles.update(dt);
    hud.updateStats(dt, player);
    hud.updateCompass(player);
    if (frameCount % 2 === 0) hud.drawMinimap(player);

    cameraController.update(dt, inp.moving);
  } else {
    particles.update(dt);
    cameraController.update(dt, false);
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

skyEnv.followShadowTo(player.x, player.z);
animate();
