// All narrative text lives here so it can be edited without touching game logic.
// IMPORTANT: clue texts and the ending are TEMPORARY PLACEHOLDERS. Names, dates, number of
// victims and the occupant's identity are undecided (see CLAUDE.md §14). Text in [BRACKETS]
// must be replaced once the story is finalised.

export const TITLE = 'THE HOUSE IS WATCHING';

export const OBJECTIVES = {
  wake: 'Find a way out of the basement.',
  explore: 'Explore the house. Find a way out.',
  locked: 'Every exit is locked. Find a key.',
  outside: 'Find a way off the property.',
  culvert: 'Find something to force the drainage grate.',
  enter: 'Get into the drainage tunnel.',
  run: 'RUN.',
};

export const ITEMS = {
  flashlight: { label: 'flashlight', desc: 'An old flashlight. The beam is weak.' },
  basementKey: { label: 'small brass key', desc: 'A small brass key with a paper tag. The tag is blank.' },
  garageKey: { label: 'key ring', desc: 'A ring of keys. One is marked with a strip of tape.' },
  revolver: { label: 'revolver', desc: 'Heavy and cold. You do not know how to use it. You take it anyway.' },
  crowbar: { label: 'crowbar', desc: 'A rusted crowbar.' },
};

// Readable clues, ordered roughly by the suspicion they create (unease -> near-revelation).
export const CLUES = {
  tally: {
    title: 'Marks on the wall',
    body: 'Scratches in the plaster, low down, at the height of a child sitting on the floor. Groups of five. Some are older than others.',
  },
  basementNote: {
    title: 'Note on the workbench',
    body: '[PLACEHOLDER CLUE — UNEASE]\nA shopping list in neat handwriting. Bread. Bleach. Rope. Batteries. Children\'s cough syrup.',
  },
  nursery: {
    title: 'Photograph in the nursery',
    body: '[PLACEHOLDER CLUE — SUSPICION]\nA framed photograph of a child in this room. The face has been scratched away with something sharp.',
  },
  boysRoom: {
    title: 'Name tags',
    body: '[PLACEHOLDER CLUE — STRONGER SUSPICION]\nA shoebox of iron-on clothing labels. Different names. Different handwriting. None of them match the others.',
  },
  clipping: {
    title: 'Newspaper clipping',
    body: '[PLACEHOLDER CLUE — SUSPICION]\nLOCAL CHILD STILL MISSING. The date and the child\'s name have been carefully cut out.',
  },
  ledger: {
    title: 'Ledger in the closet',
    body: '[PLACEHOLDER CLUE — NEAR-REVELATION]\nColumns of dates and initials. Beside some of them, a single word: "garden".',
  },
  shed: {
    title: 'Drainage plan',
    body: 'An old plan of the property. A dashed line runs from the retaining wall at the back of the garden, under the woods, towards the river. Someone has circled the grate.',
  },
};

// Final cinematic: shown as timed cards after the blackout and three gunshots.
export const ENDING = [
  { text: '[PLACEHOLDER] Police reached the property at dawn.', hold: 4 },
  { text: '[PLACEHOLDER] The owner of the house was [ANTAGONIST NAME], [PUBLIC IDENTITY].', hold: 5 },
  { text: '[PLACEHOLDER] Investigators connected [him/her] to the disappearance of [NUMBER] children over [NUMBER] years.', hold: 5 },
  { text: '[PLACEHOLDER] The remains of [NUMBER] children were recovered from the garden and the drainage tunnel.', hold: 5 },
  { text: '[PLACEHOLDER] [VICTIM NAMES]', hold: 5 },
  { text: '[PLACEHOLDER] One child walked out.', hold: 4 },
];
