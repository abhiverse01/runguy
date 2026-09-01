import { clamp, lerp, springDamp } from '../utils/math.js';

const BASE_FOV = 58;

export class CameraController {
  constructor(camera, terrain, input, player){
    this.camera = camera;
    this.terrain = terrain;
    this.input = input;
    this.player = player;

    this.yaw = Math.PI;
    this.pitch = 0.42;
    this.dist = 7.2;          // player-chosen distance (mouse wheel)
    this.distEffective = 7.2; // actual distance after terrain-occlusion pullback
    this.autoAlign = true;

    this._velX = { v: 0 }; this._velY = { v: 0 }; this._velZ = { v: 0 };
    this.shake = 0;

    camera.position.set(player.x, player.y + 3.3, player.z + this.dist);
    camera.lookAt(player.x, player.y + 1.2, player.z);

    this._bindWheel();
  }

  _bindWheel(){
    this.input.canvas.addEventListener('wheel', (e) => {
      this.dist = clamp(this.dist + e.deltaY * 0.01, 4, 13);
    }, { passive: true });
  }

  addImpactShake(amount){ this.shake = Math.max(this.shake, amount); }

  update(dt, hasMoveInput){
    const look = this.input.consumeLookDelta();
    if (look.yaw !== 0 || look.pitch !== 0){
      this.yaw += look.yaw;
      this.pitch = clamp(this.pitch + look.pitch, 0.12, 0.95);
      this.autoAlign = false;
    }

    const player = this.player;

    // auto-align camera behind the player while moving, unless the
    // player is actively steering the camera themselves
    if (this.autoAlign && hasMoveInput && !this.input.isManuallyLooking){
      let diff = player.facing - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, 2.4 * dt);
    }
    if (this.input.isManuallyLooking) this.autoAlign = false;

    // terrain-occlusion raymarch: sample points between the player and
    // the desired camera position; if terrain rises above the sightline
    // anywhere along it, pull the camera in so it never clips through a hillside
    const desiredX = player.x - Math.sin(this.yaw) * this.dist;
    const desiredZ = player.z - Math.cos(this.yaw) * this.dist;
    const lookHeight = player.y + 1.25;
    const desiredY = player.y + 1.3 + Math.sin(this.pitch) * this.dist * 0.9;

    let safeDist = this.dist;
    const SAMPLES = 6;
    for (let i = 1; i <= SAMPLES; i++){
      const t = i / SAMPLES;
      const sx = lerp(player.x, desiredX, t);
      const sz = lerp(player.z, desiredZ, t);
      const sy = lerp(lookHeight, desiredY, t);
      const groundAtSample = this.terrain.groundHeightAt(sx, sz) + 0.35;
      if (groundAtSample > sy){
        safeDist = Math.min(safeDist, this.dist * t * 0.92);
        break;
      }
    }
    this.distEffective = lerp(this.distEffective, Math.max(safeDist, 2.2), Math.min(1, 10 * dt));

    const targetX = player.x - Math.sin(this.yaw) * this.distEffective;
    const targetZ = player.z - Math.cos(this.yaw) * this.distEffective;
    const targetY = player.y + 1.3 + Math.sin(this.pitch) * this.distEffective * 0.9;
    const desiredCamY = Math.max(targetY, this.terrain.groundHeightAt(targetX, targetZ) + 1.0);

    const cam = this.camera;
    // spring-damped smoothing: steadier than a fixed-rate lerp under
    // frame-time spikes, and self-corrects overshoot instead of chasing it
    cam.position.x = springDamp(cam.position.x, targetX, this._velX, 0.16, dt);
    cam.position.z = springDamp(cam.position.z, targetZ, this._velZ, 0.16, dt);
    cam.position.y = springDamp(cam.position.y, desiredCamY, this._velY, 0.2, dt);

    if (this.shake > 0.0005){
      cam.position.x += (Math.random() - 0.5) * this.shake;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.6;
      this.shake *= 0.85;
    } else this.shake = 0;

    cam.lookAt(player.x, lookHeight, player.z);

    const speedRatio = clamp(Math.hypot(player.vx, player.vz) / 8.6, 0, 1);
    const targetFov = BASE_FOV + (player.sprinting ? speedRatio * 5 : 0) + (player.dashing ? 8 : 0);
    cam.fov = lerp(cam.fov, targetFov, Math.min(1, 4 * dt));
    cam.updateProjectionMatrix();
  }
}
