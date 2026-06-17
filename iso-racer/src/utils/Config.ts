/**
 * Central tunables for the game. Tweaking arcade feel happens here so designers
 * never have to dig through systems.
 */
export const Config = {
  car: {
    maxSpeed: 26,
    boostMaxSpeed: 42,
    acceleration: 24,
    brakeForce: 38,
    reverseSpeed: 10,
    /** Radians/sec turn rate at full steering. */
    turnRate: 2.6,
    /** Lateral grip — higher = less drift. */
    grip: 6.5,
    drag: 1.6,
    /** Visual lean/roll when cornering (radians). */
    bodyRoll: 0.12,
  },
  boost: {
    duration: 2.0,
    accelMultiplier: 1.8,
  },
  race: {
    totalLaps: 3,
    countdownSeconds: 3,
  },
  ai: {
    /** How far ahead on the path the AI aims. */
    lookAhead: 14,
    speedJitter: 0.12,
  },
  camera: {
    /** Isometric-ish angles. */
    alpha: -Math.PI / 4,
    beta: Math.PI / 3.4,
    radius: 34,
    heightOffset: 2,
    /** Follow smoothing (0..1 per frame-ish). */
    lerp: 0.08,
  },
} as const;
