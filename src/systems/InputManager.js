import { isTouch } from '../config/constants.js';

/**
 * Owns every raw input source and exposes a clean, testable surface:
 *  - readMovement() -> {x,z,sprint,jumpPressed,moving}
 *  - lookDelta()     -> accumulated {yaw,pitch} deltas since last read (drag/touch/pointer-lock)
 *  - on(event, cb)   -> 'pause' | 'dash' | 'slam' | 'lookStart' | 'lookEnd'
 *
 * This replaces the old approach of scattering key/touch listeners
 * directly through the physics and camera code.
 */
export class InputManager {
  constructor(canvas){
    this.canvas = canvas;
    this.keys = new Set();
    this.listeners = { pause: [], dash: [], slam: [], jump: [] };
    this._yawDelta = 0;
    this._pitchDelta = 0;
    this.dragging = false;
    this.pointerLocked = false;
    this._lastDragX = 0; this._lastDragY = 0;

    this.touchInput = { x: 0, z: 0 };
    this._joyId = null; this._joyStartX = 0; this._joyStartY = 0;
    this._lookId = null; this._lookLastX = 0; this._lookLastY = 0;
    this._sprintTouch = false;
    this._jumpTouchPressed = false;
    this._dashTouchPressed = false;
    this._slamTouchPressed = false;

    this._bindKeyboard();
    this._bindMouse();
    if (isTouch) this._bindTouch();
  }

  on(event, cb){ (this.listeners[event] ??= []).push(cb); }
  _emit(event){ (this.listeners[event] || []).forEach(cb => cb()); }

  _bindKeyboard(){
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Escape') this._emit('pause');
      if (e.code === 'KeyQ') this._emit('dash');
      if (e.code === 'KeyE') this._emit('slam');
      if (e.code === 'Space') this._emit('jump');
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  _bindMouse(){
    const canvas = this.canvas;
    canvas.addEventListener('mousedown', (e) => {
      if (this.pointerLocked) return;
      this.dragging = true; this._lastDragX = e.clientX; this._lastDragY = e.clientY;
    });
    window.addEventListener('mouseup', () => this.dragging = false);
    window.addEventListener('mousemove', (e) => {
      if (this.pointerLocked){
        this._yawDelta -= e.movementX * 0.0028;
        this._pitchDelta -= e.movementY * 0.0022;
        return;
      }
      if (!this.dragging) return;
      const dx = e.clientX - this._lastDragX, dy = e.clientY - this._lastDragY;
      this._lastDragX = e.clientX; this._lastDragY = e.clientY;
      this._yawDelta -= dx * 0.0055;
      this._pitchDelta -= dy * 0.0035;
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      this.dragging = false;
    });
  }

  requestPointerLock(){
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    else this.canvas.requestPointerLock();
  }

  _bindTouch(){
    document.getElementById('touch-controls').classList.add('active');
    document.getElementById('mobile-legend').style.display = 'flex';
    const joyBase = document.getElementById('joy-base');
    const joyNub = document.getElementById('joy-nub');

    window.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches){
        // A touch starting on a control button must never also register
        // as a look-drag — both live on the right half of the screen,
        // so without this guard tapping SPRINT/JUMP/DASH/SLAM yanked the camera.
        if (t.target.closest && t.target.closest('.touch-btn')) continue;
        if (t.clientX < window.innerWidth * 0.5 && this._joyId === null){
          this._joyId = t.identifier;
          const r = joyBase.getBoundingClientRect();
          this._joyStartX = r.left + r.width / 2; this._joyStartY = r.top + r.height / 2;
        } else if (t.clientX >= window.innerWidth * 0.5 && this._lookId === null){
          this._lookId = t.identifier; this._lookLastX = t.clientX; this._lookLastY = t.clientY;
        }
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches){
        if (t.identifier === this._joyId){
          let dx = t.clientX - this._joyStartX, dy = t.clientY - this._joyStartY;
          const max = 46; const len = Math.hypot(dx, dy);
          if (len > max){ dx = dx / len * max; dy = dy / len * max; }
          joyNub.style.transform = `translate(${dx}px, ${dy}px)`;
          this.touchInput.x = dx / max; this.touchInput.z = -dy / max;
        } else if (t.identifier === this._lookId){
          const dx = t.clientX - this._lookLastX, dy = t.clientY - this._lookLastY;
          this._lookLastX = t.clientX; this._lookLastY = t.clientY;
          this._yawDelta -= dx * 0.006;
          this._pitchDelta -= dy * 0.004;
        }
      }
    }, { passive: true });

    const releaseTouch = (e) => {
      for (const t of e.changedTouches){
        if (t.identifier === this._joyId){
          this._joyId = null; this.touchInput.x = 0; this.touchInput.z = 0;
          joyNub.style.transform = 'translate(0,0)';
        }
        if (t.identifier === this._lookId) this._lookId = null;
      }
    };
    window.addEventListener('touchend', releaseTouch, { passive: true });
    window.addEventListener('touchcancel', releaseTouch, { passive: true });

    this._bindTouchButton('btn-sprint-touch', on => this._sprintTouch = on);
    this._bindTouchButton('btn-jump-touch', on => { if (on){ this._jumpTouchPressed = true; this._emit('jump'); } });
    this._bindTouchButton('btn-dash-touch', on => { if (on) this._emit('dash'); });
    this._bindTouchButton('btn-slam-touch', on => { if (on) this._emit('slam'); });
  }

  _bindTouchButton(id, onChange){
    const el = document.getElementById(id);
    if (!el) return;
    const press = (e) => { e.preventDefault(); el.classList.add('pressed'); onChange(true); };
    const release = () => { el.classList.remove('pressed'); onChange(false); };
    el.addEventListener('touchstart', press, { passive: false });
    el.addEventListener('touchend', release, { passive: false });
    el.addEventListener('touchcancel', release); // stuck-button guard
  }

  /** Movement + jump/sprint intent for this frame. */
  readMovement(){
    let x = 0, z = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (isTouch){ x += this.touchInput.x; z += this.touchInput.z; }
    const len = Math.hypot(x, z);
    if (len > 1){ x /= len; z /= len; }
    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || (isTouch && this._sprintTouch);
    const jumpPressed = this.keys.has('Space') || (isTouch && this._jumpTouchPressed);
    this._jumpTouchPressed = false;
    return { x, z, sprint, jumpPressed, moving: len > 0.05 };
  }

  /** Consume accumulated look deltas since the last call. */
  consumeLookDelta(){
    const d = { yaw: this._yawDelta, pitch: this._pitchDelta };
    this._yawDelta = 0; this._pitchDelta = 0;
    return d;
  }

  get isManuallyLooking(){ return this.dragging || this.pointerLocked || (isTouch && this._lookId !== null); }
}
