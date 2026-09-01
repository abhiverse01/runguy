// ============================================================
// Central tunables. Nothing gameplay-numeric should be a magic
// number anywhere else in the codebase — change it here.
// ============================================================

export const isTouch = matchMedia('(hover:none) and (pointer:coarse)').matches;

export const QUALITY_STATE = { current: isTouch ? 'low' : 'high' };

export const Q = {
  get shadow(){ return QUALITY_STATE.current === 'high' ? 2048 : 1024; },
  get grass(){ return QUALITY_STATE.current === 'high' ? 2600 : 900; },
  get props(){ return QUALITY_STATE.current === 'high' ? 1 : 0.6; },
  get pixelRatio(){ return Math.min(window.devicePixelRatio || 1, QUALITY_STATE.current === 'high' ? 2 : 1.5); },
  get fogFar(){ return QUALITY_STATE.current === 'high' ? 320 : 220; },
};

export const MAP_HALF = 170;
export const RIVER_HALF = 8;
export const BANK_FADE = 9;
export const BRIDGE_Y = 0.5;

export const PHYSICS = {
  GRAVITY: -22,
  JUMP_SPEED: 6.6,
  WALK_SPEED: 4.4,
  SPRINT_SPEED: 8.6,
  ACCEL_GROUND: 20,
  DECEL_GROUND: 26,
  ACCEL_AIR: 6,
  TURN_LERP: 9,
  SLOPE_WALKABLE: 0.62, // cosine of max walkable slope angle (~52deg)
  SLOPE_SLIDE: 0.78,    // cosine below which sliding kicks in fully
  COYOTE_TIME: 0.12,
  JUMP_BUFFER: 0.12,
};

export const STAMINA = {
  MAX: 100,
  SPRINT_DRAIN: 26,
  REGEN: 16,
  MIN_TO_SPRINT: 8,
};

// ---- abilities (new: previously referenced in SFX/changelog but
// never actually wired into the physics — now real) ----
export const ABILITIES = {
  DOUBLE_JUMP: {
    SPEED: 5.6,
    COST: 18,
  },
  DASH: {
    SPEED: 16.5,
    DURATION: 0.16,
    COOLDOWN: 0.85,
    COST: 22,
    MIN_STAMINA: 22,
  },
  SLAM: {
    FALL_SPEED: -24,
    MIN_AIR_TIME: 0.12,
    COOLDOWN: 0.6,
    COST: 16,
    SHOCKWAVE_RADIUS: 3.2,
  },
};

export const ORB_TOTAL = 8;

export const HILL_CENTER = { x: 92, z: -112 };
export const KNOLL_CENTER = { x: -122, z: 58 };
export const VALLEY_CENTER = { x: 40, z: -40 };

export const REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
