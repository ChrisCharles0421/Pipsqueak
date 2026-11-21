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

// Where he appears when he comes home (reference-plan pixels): the garage, far from the basement stairs.
export const SPAWN_PX = [600, 700];

// Patrol points (reference-plan pixels). Deliberately spread over the whole house; none at the basement
// exit and none on top of progression items (the closet drawer).
export const PATROL_PX = [
  ['Living Room', 330, 220], ['Living Room', 300, 345], ['Dining Room', 600, 210], ['Kitchen', 560, 470],
  ['Garage', 450, 700], ['Garage', 610, 560], ['Foyer', 260, 450], ['Foyer', 280, 640],
  ['Master Bedroom', 200, 255], ['Nursery', 150, 400], ["Boys' Bedroom", 160, 740], ['Utility Room', 440, 450],
  ['Main Bathroom', 140, 630], ['Dining Room', 630, 330],
];

// Areas he must not camp. He may pass through or investigate them, but he does not patrol, pause or
// search there, and after checking one he leaves it alone for `cooldown` seconds unless he has just seen
// the child. 'layer' -1 = basement (anything below y -1).
export const EXCLUSION = [
  { name: 'basement exit', px: [425, 300, 495, 392], cooldown: 60 },
  { name: 'basement', layer: -1, cooldown: 90 },
];
export const RECENT_ROOM_COOLDOWN = 45; // seconds before a patrol revisits the same room

// Loose floorboards (reference-plan pixels). Stepping on one creaks (woodcreak_audio.mp3) and makes a
// noise the occupant can hear. Crouching softens it. They look slightly worn so players can learn them.
export const CREAKY_BOARDS_PX = [
  ['Stair Hall', 438, 340, 482, 380],
  ['Foyer', 222, 520, 300, 560],
  ['Foyer', 225, 640, 300, 670],
  ['Living Room', 300, 330, 372, 370],
  ['Dining Room', 520, 335, 600, 372],
  ['Master Bedroom', 205, 335, 250, 372],
  ['Nursery', 120, 440, 175, 480],
];
export const CREAK = {
  noiseRadius: { walk: 8.5, sprint: 11, crouch: 3.5 },
  crouchChance: 0.5,     // chance a crouched step still makes the board creak
  cooldown: 1.0,         // seconds before the same board creaks again
};
