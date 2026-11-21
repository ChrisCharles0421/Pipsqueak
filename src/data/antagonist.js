// Tunable parameters for the occupant's AI. Units: metres, seconds, radians.
export const AI = {
  // movement
  walkSpeed: 1.35,          // patrol
  briskSpeed: 2.1,          // investigating / searching
  pursuitSpeed: 4.15,       // child sprint is 4.7: a sprinting child can gain ground, but sprinting is loud
  turnRate: 5.0,
  radius: 0.3,
  height: 1.75,
  catchDistance: 0.85,

  // vision
  perceptionInterval: 0.15, // perception tick (not per frame)
  visionRange: 11,          // in the dark
  visionRangeFlashlight: 17,// when the child's flashlight is on
  fov: (115 * Math.PI) / 180,
  closeSenseRange: 1.6,     // notices someone right next to him even outside the FOV
  detectRate: 1.5,          // awareness gained per second at point-blank, scaled by distance
  crouchVisibility: 0.55,
  awarenessDecay: 0.35,     // per second when the child is not seen
  suspicionThreshold: 0.35, // partial sighting -> investigate
  confirmThreshold: 1.0,    // full sighting -> pursue

  // hearing (noise radius comes from the event; walls muffle it)
  hearingMultiplier: 1.0,
  muffledFactor: 0.55,      // radius multiplier when there is no line of sight
  otherFloorFactor: 0.45,
  soundError: 1.4,          // he hears roughly where, not exactly where

  // memory / search
  pursuitMemory: 2.5,       // keeps chasing the remembered/extrapolated position this long after losing sight
  lostLookTime: 2.5,
  investigateLookTime: 3.0,
  searchDuration: 28,
  searchRadius: 9,
  hidingCheckChance: 0.5,   // chance to open a nearby hiding place while searching
  maxHidingChecks: 2,
  sawHideWindow: 1.5,       // if he saw you less than this long before you hid, he knows where you are

  // patrol
  patrolPause: [2, 6],
  repathInterval: 0.45,

  // fairness
  graceAfterRespawn: 6,     // seconds the AI ignores the child after a respawn
  minRespawnDistance: 14,
};

// Patrol points in reference-plan pixel coordinates (see world/house.js) + a few outside.
export const PATROL_PX = [
  ['Living Room', 330, 220], ['Dining Room', 600, 210], ['Kitchen', 560, 470], ['Garage', 450, 700],
  ['Garage', 610, 560], ['Foyer', 260, 450], ['Foyer', 280, 640], ['Master Bedroom', 200, 260],
  ['Nursery', 150, 400], ["Boys' Bedroom", 160, 740], ['Utility Room', 440, 450], ['Stair Hall', 460, 355],
  ['Main Bathroom', 140, 630], ['Master Closet', 228, 170],
];
