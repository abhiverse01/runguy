import * as THREE from 'three';
import { lerp, clamp, smoothstep } from '../utils/math.js';
import { PHYSICS, STAMINA, ABILITIES } from '../config/constants.js';

/** A two-segment limb (hip/shoulder pivot -> knee/elbow pivot -> end
 *  cap) instead of one rigid capsule per limb. This is the single
 *  biggest lever on "looks human" for a run cycle: a limb that only
 *  swings from one root joint reads as a pendulum, not a leg. */
function makeJointedLimb({ upperLen, lowerLen, radius, mat, x, y, endGeo, endMat, endOffsetY }){
  const root = new THREE.Group(); root.position.set(x, y, 0);

  const upperGeo = new THREE.CapsuleGeometry(radius, upperLen, 4, 8);
  const upper = new THREE.Mesh(upperGeo, mat);
  upper.position.y = -upperLen / 2 - radius;
  upper.castShadow = true;
  root.add(upper);

  const joint = new THREE.Group();
  joint.position.y = -upperLen - radius * 2;
  root.add(joint);

  const lowerGeo = new THREE.CapsuleGeometry(radius * 0.86, lowerLen, 4, 8);
  const lower = new THREE.Mesh(lowerGeo, mat);
  lower.position.y = -lowerLen / 2 - radius * 0.86;
  lower.castShadow = true;
  joint.add(lower);

  let end = null;
  if (endGeo){
    end = new THREE.Mesh(endGeo, endMat);
    end.position.y = -lowerLen - radius * 1.7 + (endOffsetY || 0);
    end.castShadow = true;
    joint.add(end);
  }

  return { root, joint, end };
}

export class Player {
  constructor(scene, terrain, riverPath, audio, particles){
    this.terrain = terrain;
    this.river = riverPath;
    this.audio = audio;
    this.particles = particles;

    // ---- kinematic state ----
    this.x = 0; this.y = 0; this.z = -6;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.facing = 0;
    this.grounded = true;
    this.sprinting = false;
    this.wading = false;
    this.stamina = STAMINA.MAX;
    this.runCycle = 0;
    this.hasMoveInput = false;

    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.airTime = 0;
    this.jumpsUsedInAir = 0;

    // ---- abilities ----
    this.dashing = false;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.dashDir = new THREE.Vector3(0, 0, 1);

    this.slamActive = false;
    this.slamCooldownTimer = 0;

    this.distanceWalked = 0;
    this.footstepTimer = 0;
    this.trailSplashTimer = 0;
    this.camShakeRequest = 0;

    this._buildModel(scene);
    this.y = this.terrain.groundHeightAt(this.x, this.z);
    this.group.position.set(this.x, this.y, this.z);

    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._moveDir = new THREE.Vector3();
    this._normal = new THREE.Vector3();
  }

  _buildModel(scene){
    const skinMat = new THREE.MeshPhysicalMaterial({ color: 0xe0a878, roughness: 0.75, clearcoat: 0.06, clearcoatRoughness: 0.6 });
    const shirtMat = new THREE.MeshPhysicalMaterial({ color: 0x3e6b46, roughness: 0.65, sheen: 0.6, sheenColor: new THREE.Color(0x9fc9a6) });
    const jacketMat = new THREE.MeshPhysicalMaterial({ color: 0x2f5238, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0x7aa87f) });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x28352a, roughness: 0.85 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x33241a, roughness: 0.55, metalness: 0.05 });
    const soleMat = new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.9 });
    const scarfMat = new THREE.MeshPhysicalMaterial({ color: 0xc9814f, roughness: 0.5, sheen: 0.7, sheenColor: new THREE.Color(0xe0a878) });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x241a11, roughness: 0.65 });
    const packMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.75 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.3 });
    const browMat = hairMat;

    this.group = new THREE.Group();

    this.spine = new THREE.Group();
    this.spine.position.y = 0.74;
    this.group.add(this.spine);

    this.torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.46, 6, 12), jacketMat);
    this.torso.position.y = 0.34; this.torso.castShadow = true;
    this.spine.add(this.torso);

    // jacket collar — small detail that reads immediately as "clothed",
    // not just a capsule with a color
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.035, 6, 12, Math.PI * 1.3), jacketMat);
    collar.position.set(0, 0.58, -0.02);
    collar.rotation.set(Math.PI / 2.3, 0, Math.PI * 0.35);
    collar.castShadow = true;
    this.spine.add(collar);

    // half-zip strip down the front of the jacket
    const zip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.02), new THREE.MeshStandardMaterial({ color: 0x8a8a86, metalness: 0.6, roughness: 0.35 }));
    zip.position.set(0, 0.4, 0.25);
    this.spine.add(zip);

    const hip = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.12, 4, 10), pantsMat);
    hip.position.y = 0; hip.castShadow = true;
    this.spine.add(hip);

    // backpack with a top flap + a strap detail
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.35, 0.15), packMat);
    pack.position.set(0, 0.32, -0.23);
    pack.castShadow = true;
    this.spine.add(pack);
    const packFlap = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.1, 0.17), packMat);
    packFlap.position.set(0, 0.47, -0.23);
    packFlap.rotation.x = -0.15;
    packFlap.castShadow = true;
    this.spine.add(packFlap);

    this.head = new THREE.Group();
    this.head.position.y = 0.86;
    this.spine.add(this.head);
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.215, 20, 16), skinMat);
    headMesh.scale.set(1, 1.08, 0.94);
    headMesh.castShadow = true;
    this.head.add(headMesh);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.222, 16, 14, 0, Math.PI * 2, 0, Math.PI / 1.7), hairMat);
    hair.position.y = 0.05; hair.castShadow = true;
    this.head.add(hair);

    // simple readable face: two eyes + brows, enough to make the head
    // stop reading as a blank ball at third-person distance
    const eyeGeo = new THREE.SphereGeometry(0.022, 8, 8);
    [-1, 1].forEach(side => {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(side * 0.075, 0.02, 0.185);
      this.head.add(eye);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.016, 0.02), browMat);
      brow.position.set(side * 0.075, 0.065, 0.19);
      brow.rotation.z = side * 0.12;
      this.head.add(brow);
    });

    this.scarf = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.05, 8, 16), scarfMat);
    this.scarf.position.y = 0.6; this.scarf.rotation.x = Math.PI / 2.2; this.scarf.castShadow = true;
    this.spine.add(this.scarf);
    // trailing scarf tail for a bit of cloth motion when running/dashing
    this.scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.02), scarfMat);
    this.scarfTail.position.set(0.08, 0.48, -0.16);
    this.scarfTail.castShadow = true;
    this.spine.add(this.scarfTail);

    const shoeGeo = new THREE.BoxGeometry(0.135, 0.075, 0.21);
    const soleGeo = new THREE.BoxGeometry(0.14, 0.03, 0.22);

    this.legL = makeJointedLimb({
      upperLen: 0.32, lowerLen: 0.3, radius: 0.085, mat: pantsMat, x: -0.13, y: -0.06,
      endGeo: shoeGeo, endMat: shoeMat, endOffsetY: 0.02,
    });
    this.legR = makeJointedLimb({
      upperLen: 0.32, lowerLen: 0.3, radius: 0.085, mat: pantsMat, x: 0.13, y: -0.06,
      endGeo: shoeGeo, endMat: shoeMat, endOffsetY: 0.02,
    });
    [this.legL, this.legR].forEach(leg => {
      const sole = new THREE.Mesh(soleGeo, soleMat);
      sole.position.y = leg.end.position.y - 0.045;
      sole.castShadow = true;
      leg.joint.add(sole);
    });

    this.armL = makeJointedLimb({ upperLen: 0.28, lowerLen: 0.26, radius: 0.065, mat: jacketMat, x: -0.3, y: 0.56 });
    this.armR = makeJointedLimb({ upperLen: 0.28, lowerLen: 0.26, radius: 0.065, mat: jacketMat, x: 0.3, y: 0.56 });
    // hands
    const handGeo = new THREE.SphereGeometry(0.06, 10, 8);
    [this.armL, this.armR].forEach(arm => {
      const hand = new THREE.Mesh(handGeo, skinMat);
      hand.position.y = -0.26 - 0.065;
      hand.castShadow = true;
      arm.joint.add(hand);
    });

    this.spine.add(this.legL.root, this.legR.root, this.armL.root, this.armR.root);
    this.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.group);

    this.pointLight = new THREE.PointLight(0xfff0d0, 0.4, 5);
    this.pointLight.position.set(0, 1.4, 0);
    scene.add(this.pointLight);

    const shadowBlobMat = new THREE.MeshBasicMaterial({ color: 0x0a1108, transparent: true, opacity: 0.28, depthWrite: false });
    this.shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), shadowBlobMat);
    this.shadowBlob.rotation.x = -Math.PI / 2;
    scene.add(this.shadowBlob);
  }

  // ---------------- ability triggers (called from input events) ----------------

  requestJump(){
    if (this.grounded || this.coyoteTimer > 0){
      this.jumpBufferTimer = PHYSICS.JUMP_BUFFER;
    } else if (this.jumpsUsedInAir < 1 && this.stamina >= ABILITIES.DOUBLE_JUMP.COST){
      this._doDoubleJump();
    }
  }

  _doDoubleJump(){
    this.vy = ABILITIES.DOUBLE_JUMP.SPEED;
    this.jumpsUsedInAir = 1;
    this.stamina = Math.max(0, this.stamina - ABILITIES.DOUBLE_JUMP.COST);
    this.audio.doubleJump();
    this.particles.burst(this.x, this.y + 0.4, this.z, 10, { vy: -0.6, maxLife: 0.4, r: 0.7, g: 0.9, b: 1, gravity: 1.5 });
  }

  requestDash(){
    if (this.dashCooldownTimer > 0 || this.dashing) return;
    if (this.stamina < ABILITIES.DASH.MIN_STAMINA) return;
    if (this.hasMoveInput) this.dashDir.copy(this._moveDir);
    else this.dashDir.set(Math.sin(this.facing), 0, Math.cos(this.facing));
    this.dashing = true;
    this.dashTimer = ABILITIES.DASH.DURATION;
    this.dashCooldownTimer = ABILITIES.DASH.COOLDOWN;
    this.stamina = Math.max(0, this.stamina - ABILITIES.DASH.COST);
    this.audio.dash();
    this.particles.burst(this.x, this.y + 0.5, this.z, 8, {
      vx: -this.dashDir.x * 2, vz: -this.dashDir.z * 2, vy: 0.3, maxLife: 0.35, r: 0.9, g: 0.95, b: 0.85, gravity: -1,
    });
  }

  requestSlam(){
    if (this.grounded || this.slamActive || this.slamCooldownTimer > 0) return;
    if (this.airTime < ABILITIES.SLAM.MIN_AIR_TIME) return;
    if (this.stamina < ABILITIES.SLAM.COST) return;
    this.slamActive = true;
    this.vy = ABILITIES.SLAM.FALL_SPEED;
    this.stamina = Math.max(0, this.stamina - ABILITIES.SLAM.COST);
    this.audio.slamCharge();
  }

  // ---------------- per-frame update ----------------

  update(dt, input, cameraYaw){
    const inp = input.readMovement();

    this._fwd.set(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
    // camera-right = forward x up for this basis. (The previous build had
    // this mirrored, which made A/D and the facing direction strafe
    // toward the opposite side of the screen from the key pressed.)
    this._right.set(-Math.cos(cameraYaw), 0, Math.sin(cameraYaw));
    this._moveDir.set(0, 0, 0).addScaledVector(this._fwd, inp.z).addScaledVector(this._right, inp.x);
    const hasInput = this._moveDir.lengthSq() > 0.0001;
    if (hasInput) this._moveDir.normalize();
    this.hasMoveInput = hasInput;

    const canSprint = this.stamina > STAMINA.MIN_TO_SPRINT;
    this.sprinting = hasInput && inp.sprint && canSprint && !this.wading;
    if (this.sprinting) this.stamina = Math.max(0, this.stamina - STAMINA.SPRINT_DRAIN * dt);
    else this.stamina = Math.min(STAMINA.MAX, this.stamina + STAMINA.REGEN * dt);

    this._updateAbilityTimers(dt);

    if (this.dashing){
      this.vx = this.dashDir.x * ABILITIES.DASH.SPEED;
      this.vz = this.dashDir.z * ABILITIES.DASH.SPEED;
    } else {
      const normal = this.terrain.groundNormalAt(this.x, this.z, this._normal);
      const slopeCos = clamp(normal.y, 0, 1);
      const slopeFactor = smoothstep(PHYSICS.SLOPE_SLIDE - 0.18, PHYSICS.SLOPE_WALKABLE, slopeCos);

      let targetSpeed = hasInput ? (this.sprinting ? PHYSICS.SPRINT_SPEED : PHYSICS.WALK_SPEED) : 0;
      if (this.wading) targetSpeed *= 0.4;
      if (this.grounded) targetSpeed *= lerp(0.35, 1, slopeFactor);

      const targetVX = this._moveDir.x * targetSpeed, targetVZ = this._moveDir.z * targetSpeed;
      const rate = this.grounded ? (hasInput ? PHYSICS.ACCEL_GROUND : PHYSICS.DECEL_GROUND) : PHYSICS.ACCEL_AIR;
      this.vx = lerp(this.vx, targetVX, Math.min(1, rate * dt));
      this.vz = lerp(this.vz, targetVZ, Math.min(1, rate * dt));

      if (this.grounded && slopeCos < PHYSICS.SLOPE_SLIDE){
        const slideStrength = (1 - smoothstep(PHYSICS.SLOPE_WALKABLE, PHYSICS.SLOPE_SLIDE, slopeCos)) * 3.2;
        this.vx += normal.x * slideStrength * dt * 10;
        this.vz += normal.z * slideStrength * dt * 10;
      }
    }

    const prevX = this.x, prevZ = this.z;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    this._resolveObstacleCollisions();

    this.x = clamp(this.x, -170 + 4, 170 - 4);
    this.z = clamp(this.z, -170 + 4, 170 - 4);

    this.distanceWalked += Math.hypot(this.x - prevX, this.z - prevZ);

    if (hasInput && !this.dashing){
      let target = Math.atan2(this._moveDir.x, this._moveDir.z);
      let diff = target - this.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facing += diff * Math.min(1, PHYSICS.TURN_LERP * dt);
    } else if (this.dashing){
      this.facing = Math.atan2(this.dashDir.x, this.dashDir.z);
    }
    this.group.rotation.y = this.facing;

    this._updateVertical(dt, inp);
    this._updateAnimation(dt);

    this.group.position.set(this.x, this.y, this.z);
    this.pointLight.position.set(this.x, this.y + 1.5, this.z);
  }

  _updateAbilityTimers(dt){
    if (this.dashTimer > 0){
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) this.dashing = false;
    }
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;
    if (this.slamCooldownTimer > 0) this.slamCooldownTimer -= dt;
  }

  _resolveObstacleCollisions(){
    // two relaxation passes so overlapping obstacles (e.g. a tree next
    // to a rock) resolve cleanly instead of jittering against each other
    for (let pass = 0; pass < 2; pass++){
      for (const ob of this.terrain.obstacles || []){
        const dx = this.x - ob.x, dz = this.z - ob.z;
        const minDist = ob.radius + 0.32;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDist * minDist && distSq > 0.0001){
          const dist = Math.sqrt(distSq);
          const push = (minDist - dist);
          this.x += (dx / dist) * push;
          this.z += (dz / dist) * push;
        }
      }
    }
  }

  _updateVertical(dt, inp){
    const ground = this.terrain.groundHeightAt(this.x, this.z);
    const onBridge = !!this.river.isOnBridge(this.x, this.z);
    this.wading = !onBridge && this.terrain.inRiverWater(this.x, this.z);

    if (this.grounded) this.coyoteTimer = PHYSICS.COYOTE_TIME;
    else { this.coyoteTimer = Math.max(0, this.coyoteTimer - dt); this.airTime += dt; }

    // NOTE: requestJump() is edge-triggered from the InputManager 'jump'
    // event (main.js), not polled here from inp.jumpPressed — a
    // continuous per-frame check would let holding Space auto-chain
    // into the double jump the instant you leave the ground.
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0){
      this.vy = PHYSICS.JUMP_SPEED;
      this.grounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.audio.jump();
      this.particles.burst(this.x, this.y + 0.1, this.z, 5, { vy: 0.6, maxLife: 0.35, r: 0.9, g: 0.9, b: 0.85, gravity: -6 });
    }

    if (!this.dashing) this.vy += PHYSICS.GRAVITY * dt;
    this.y += this.vy * dt;

    if (this.y <= ground){
      if (!this.grounded){
        const impactSpeed = Math.abs(this.vy);
        if (this.slamActive){
          this.audio.slamImpact();
          this.particles.ring(this.x, ground + 0.05, this.z, 18, ABILITIES.SLAM.SHOCKWAVE_RADIUS, {
            maxLife: 0.5, r: 0.85, g: 0.8, b: 0.6, gravity: -1, speed: 6, vy: 0.5,
          });
          this.particles.burst(this.x, ground + 0.05, this.z, 10, { vy: 1.4, maxLife: 0.5, r: 0.78, g: 0.7, b: 0.52, gravity: -4 });
          this.camShakeRequest = 0.34;
          this.slamActive = false;
          this.slamCooldownTimer = ABILITIES.SLAM.COOLDOWN;
        } else if (impactSpeed > 2.5){
          this.audio.land(impactSpeed / 6.6);
          const dustCount = Math.round(clamp(impactSpeed, 3, 10));
          this.particles.burst(this.x, ground + 0.05, this.z, dustCount, { vy: 0.9, maxLife: 0.5, r: 0.78, g: 0.7, b: 0.52, gravity: -4 });
          this.camShakeRequest = clamp((impactSpeed - 4) * 0.02, 0, 0.18);
        }
        this.jumpsUsedInAir = 0;
        this.airTime = 0;
      }
      this.y = ground; this.vy = 0; this.grounded = true;
    } else {
      this.grounded = false;
    }

    const dropH = clamp(this.y - ground, 0, 3);
    this.shadowBlob.position.set(this.x, ground + 0.02, this.z);
    this.shadowBlob.material.opacity = 0.28 * (1 - dropH / 3);
    this.shadowBlob.scale.setScalar(clamp(1 - dropH * 0.12, 0.4, 1));

    if (this.wading){
      this.trailSplashTimer -= dt;
      const moved = Math.hypot(this.vx, this.vz) > 0.3;
      if (this.trailSplashTimer <= 0 && moved){
        this.particles.burst(this.x, 0.05, this.z, 3, { vy: 1.1, maxLife: 0.5, r: 0.8, g: 0.92, b: 0.95, gravity: -5 });
        this.trailSplashTimer = 0.18;
        if (Math.random() < 0.4) this.audio.splash();
      }
    }

    if (Math.hypot(this.vx, this.vz) > 0.5 && this.grounded && !this.wading){
      this.footstepTimer -= dt * (this.sprinting ? 1.6 : 1);
      if (this.footstepTimer <= 0){
        this.footstepTimer = 0.32;
        this.audio.footstep();
        this.particles.burst(this.x, ground + 0.05, this.z, 2, { vy: 0.4, maxLife: 0.4, r: 0.75, g: 0.68, b: 0.5, gravity: -3 });
      }
    }
  }

  _updateAnimation(dt){
    const speedRatio = clamp(Math.hypot(this.vx, this.vz) / PHYSICS.SPRINT_SPEED, 0, 1);
    if (this.grounded && speedRatio > 0.02){
      this.runCycle += dt * (5 + speedRatio * 5);
      const swing = Math.sin(this.runCycle) * (0.5 + speedRatio * 0.4);
      this.legL.root.rotation.x = swing; this.legR.root.rotation.x = -swing;
      // knee bends while that leg is swinging forward (positive half of
      // its own cycle) — approximate but reads as a real gait, not a
      // straight-leg pendulum
      this.legL.joint.rotation.x = -Math.max(0, Math.sin(this.runCycle)) * (0.8 + speedRatio * 0.5);
      this.legR.joint.rotation.x = -Math.max(0, -Math.sin(this.runCycle)) * (0.8 + speedRatio * 0.5);
      this.armL.root.rotation.x = -swing * 0.85; this.armR.root.rotation.x = swing * 0.85;
      this.armL.joint.rotation.x = -Math.max(0, -Math.sin(this.runCycle)) * 0.5;
      this.armR.joint.rotation.x = -Math.max(0, Math.sin(this.runCycle)) * 0.5;
      this.torso.rotation.z = Math.sin(this.runCycle) * 0.03;
      this.spine.position.y = 0.74 + Math.abs(Math.sin(this.runCycle * 2)) * 0.03 * speedRatio;
    } else if (!this.grounded){
      const airPose = this.slamActive ? 1 : 0.5;
      this.legL.root.rotation.x = lerp(this.legL.root.rotation.x, 0.35 * airPose, 0.15);
      this.legR.root.rotation.x = lerp(this.legR.root.rotation.x, -0.5 * airPose, 0.15);
      this.legL.joint.rotation.x = lerp(this.legL.joint.rotation.x, -0.7 * airPose, 0.15);
      this.legR.joint.rotation.x = lerp(this.legR.joint.rotation.x, -0.9 * airPose, 0.15);
      this.armL.root.rotation.x = lerp(this.armL.root.rotation.x, this.slamActive ? -1.1 : -0.3, 0.15);
      this.armR.root.rotation.x = lerp(this.armR.root.rotation.x, this.slamActive ? -1.1 : 0.5, 0.15);
      this.spine.position.y = lerp(this.spine.position.y, 0.74, 0.1);
    } else {
      this.legL.root.rotation.x = lerp(this.legL.root.rotation.x, 0, 0.1); this.legR.root.rotation.x = lerp(this.legR.root.rotation.x, 0, 0.1);
      this.legL.joint.rotation.x = lerp(this.legL.joint.rotation.x, 0, 0.1); this.legR.joint.rotation.x = lerp(this.legR.joint.rotation.x, 0, 0.1);
      this.armL.root.rotation.x = lerp(this.armL.root.rotation.x, 0, 0.1); this.armR.root.rotation.x = lerp(this.armR.root.rotation.x, 0, 0.1);
      this.armL.joint.rotation.x = lerp(this.armL.joint.rotation.x, -0.12, 0.1); this.armR.joint.rotation.x = lerp(this.armR.joint.rotation.x, -0.12, 0.1);
      this.torso.rotation.z = lerp(this.torso.rotation.z, 0, 0.1);
      this.spine.position.y = lerp(this.spine.position.y, 0.74, 0.1);
      this.runCycle = 0;
      // idle breathing
      const breathe = 1 + Math.sin(performance.now() * 0.0016) * 0.012;
      this.torso.scale.set(1, breathe, 1);
    }
    this.scarf.rotation.z = Math.sin(performance.now() * 0.003) * 0.08 + (this.dashing ? 0.4 : 0);
    this.scarfTail.rotation.x = Math.sin(performance.now() * 0.004) * 0.15 + clamp(Math.hypot(this.vx, this.vz) * 0.05, 0, 0.5) + (this.dashing ? 0.9 : 0);
    if (this.dashing) this.spine.rotation.x = lerp(this.spine.rotation.x, 0.35, 0.3);
    else this.spine.rotation.x = lerp(this.spine.rotation.x, 0, 0.2);
  }

  /** Consume and clear any camera-shake request raised this frame (e.g. landings, slams). */
  consumeCamShake(){ const v = this.camShakeRequest; this.camShakeRequest = 0; return v; }
}
