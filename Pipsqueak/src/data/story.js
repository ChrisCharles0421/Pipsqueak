// All narrative text lives here so it can be edited without touching game logic.
//
// CONFIRMED by the user: the occupant is Chris Charles, 36, 175 cm, muscular. Abused as a child,
// obsessed with children he saw as genuinely happy, kidnapped and murdered them, dismembered them
// in the basement and left their remains in different places.
//
// PROVISIONAL (my choices, not yet confirmed - edit freely): number of victims (6), the fictional
// town / place names, dates, every clue's wording, and the ending card wording. Victims are not
// named anywhere because no names have been decided.

export const TITLE = 'THE HOUSE IS WATCHING';

// Never shown during play. Used only by the final cinematic.
export const ANTAGONIST = {
  name: 'Chris Charles',
  age: 36,
  heightCm: 175,
  build: 'muscular',
};

export const VICTIM_COUNT = 6; // PROVISIONAL

export const OBJECTIVES = {
  wake: 'Find a way out of the basement.',
  keyHunt: 'The basement door is locked. Find the key.',
  explore: 'Explore the house. Find a way out.',
  locked: 'Every exit is locked. Find a key.',
  garage: 'Try the keys. The garage has a side door.',
  outside: 'Find a way off the property.',
  culvert: 'Find something to force the drainage grate.',
  enter: 'Get into the drainage tunnel.',
  run: 'RUN.',
};

export const ITEMS = {
  flashlight: { label: 'flashlight', desc: 'An old flashlight. The beam is weak, but it works. [F]' },
  basementKey: { label: 'basement key', desc: 'A brass key on a paper tag. Someone has written "BSMT" on it.' },
  garageKey: { label: 'key ring', desc: 'A ring of keys. One is marked with a strip of tape.' },
  revolver: { label: 'revolver', desc: 'Heavy and cold. You do not know how to use it. You take it anyway.' },
  crowbar: { label: 'crowbar', desc: 'A rusted crowbar.' },
};

// Clues, roughly ordered unease -> suspicion -> near-revelation. Each is found in the world.
export const CLUES = {
  // ---- basement ----
  tally: {
    title: 'Marks on the wall',
    body: 'Scratches in the plaster, low down, at the height of a child sitting on the floor. Groups of five. Some look much older than others.',
  },
  clipboard: {
    title: 'Clipboard on the workbench',
    body: 'A maintenance list in block capitals.\n\nBOILER - BLEED VALVES\nTUBE LIGHT - REPLACE STARTER\nDRAIN - BLEACH, WEEKLY\nSPARE KEYS -> RED TOOLBOX, STORE ROOM',
  },
  cage: {
    title: 'The cage',
    body: 'A welded cage, too small for an adult to stand in. The padlock hangs open. Inside: a thin blanket, one small shoe, and a stuffed rabbit worn bald where a child held it.',
  },
  cleaver: {
    title: 'Cleaver',
    body: 'A heavy butcher\'s cleaver on a scrubbed wooden block. The blade has been wiped, but dark crust is packed into the rivets of the handle and the grain of the block. Beside it: rolls of plastic sheeting and three empty bottles of bleach. The floor slopes towards a drain.',
  },
  corkboard: {
    title: 'Photographs',
    body: 'Polaroids, all taken from far away: playgrounds, a school field, a fairground. In each one, a single child is circled in red marker. Under every photo, a few words in the same hand: "laughing". "always smiling". "happy".\n\nPinned beside them: newspaper clippings about missing children.',
  },
  diary: {
    title: 'Note on the butcher\'s block',
    body: 'She laughed the whole time she was on the swings. Like nothing in the world could ever touch her.\n\nNobody laughed in our house. Not once. If you made a sound he made you sorry for it.\n\nI only wanted to keep it. Why does it always stop.',
  },
  // ---- house ----
  nursery: {
    title: 'Photograph in the nursery',
    body: 'A framed photograph of a child in this room. The child\'s face has been scratched away with something sharp, again and again, until the paper tore.',
  },
  boysRoom: {
    title: 'Name tags',
    body: 'A shoebox of iron-on clothing labels. Different names, different handwriting, different schools. None of them belong together.',
  },
  clipping: {
    title: 'Newspaper clipping',
    body: 'LOCAL CHILD STILL MISSING - police widen search to woodland and quarry.\n\nThe date and the child\'s name have been carefully cut out.',
  },
  caseFile: {
    title: 'Old case letter',
    body: 'Child Protective Services - case review.\n\nMinor (male), age 8. Repeated injuries reported by school staff: burns, fractures, bruising consistent with a belt.\n\nOutcome: no further action. Insufficient evidence.\n\nThe letter is soft from being folded and unfolded many times.',
  },
  ledger: {
    title: 'Ledger',
    body: 'Columns of dates and initials. Six lines. Beside each line, a place name from the county map.',
  },
  map: {
    title: 'County road map',
    body: 'A road map pinned to the wall. Six places are circled in red: playgrounds, a school field, a fairground. Six places are marked with large red crosses: a quarry, the river bank, the woods, an old well.\n\nFaint pencil lines run from every circle to a small square drawn near the edge of the woods - and from that square out to every cross.\n\nThe square is this house.',
    image: 'map',
  },
  // ---- grounds ----
  shed: {
    title: 'Drainage plan',
    body: 'An old plan of the property. A dashed line runs from the retaining wall at the back of the garden, under the woods, towards the river. Someone has circled the grate.',
  },
};

// The occupant's map (canvas coordinates 1200 x 860). PROVISIONAL places.
export const MAP = {
  house: [690, 430],
  towns: [['Harlow', 210, 180], ['Easton Mills', 900, 150], ['Larkin', 980, 640], ['Cobb Creek', 260, 690]],
  features: [['Quarry', 470, 110], ['Black Pine Woods', 600, 500], ['Old Mill Well', 860, 780], ['River Lane', 120, 470]],
  woods: [[620, 470, 220], [520, 560, 160], [800, 520, 140]],
  river: [[40, 520], [180, 470], [330, 500], [470, 430], [560, 380], [700, 330], [850, 360], [1000, 300], [1180, 330]],
  roads: [
    [[40, 200], [210, 180], [420, 230], [690, 260], [900, 150], [1180, 140]],
    [[210, 180], [240, 420], [260, 690], [300, 840]],
    [[690, 260], [690, 430], [820, 600], [980, 640], [1180, 700]],
    [[260, 690], [520, 700], [820, 600]],
    [[470, 110], [420, 230]],
  ],
  taken: [
    { x: 225, y: 245, note: 'swings - sat. 3/04' },
    { x: 960, y: 230, note: 'school field. laughing' },
    { x: 1000, y: 610, note: 'fair. 9/09' },
    { x: 290, y: 660, note: 'always smiling' },
    { x: 160, y: 330, note: 'with her dad. 5/11' },
    { x: 860, y: 110, note: 'park. happy' },
  ],
  found: [
    { x: 470, y: 135, note: 'deep' },
    { x: 330, y: 515 },
    { x: 590, y: 540, note: 'by the 3 pines' },
    { x: 520, y: 600 },
    { x: 860, y: 760, note: 'well' },
    { x: 1080, y: 320 },
  ],
};

// Final cinematic: timed cards after the blackout and three gunshots. image:'map' shows the map.
export const ENDING = [
  { text: 'Police reached the house at dawn, after a passing driver saw a child walking along the river road.', hold: 5 },
  { text: 'The owner of the house was Chris Charles, 36.', hold: 4 },
  { text: 'As a boy, he was beaten in that house for years. The authorities were told. Nothing was done.', hold: 5 },
  { text: 'As a man, he watched other children - the ones who seemed happy - and he took them.', hold: 5 },
  { text: `Investigators connected him to the disappearance of ${VICTIM_COUNT} children from four towns.`, hold: 5 },
  { text: 'Every red mark on his map led them to the remains of a child.', hold: 6, image: 'map' },
  { text: 'One child walked out.', hold: 4 },
];
