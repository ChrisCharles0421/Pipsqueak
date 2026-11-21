# The House Is Watching (working title)

First-person psychological survival horror for desktop browsers, built with Three.js and Vite.
A kidnapped child wakes in a basement, explores the house, escapes into the grounds and is chased
down a straight, pitch-dark sewer tunnel.

See `CLAUDE.md` for the full design context.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the production build
```

The build uses a relative base path (`./`), so `dist/` works from any GitHub Pages sub-path.

## Controls

| Input | Action |
|---|---|
| W A S D | Move |
| Mouse | Look |
| Shift | Sprint (louder) |
| C | Crouch toggle (quieter). Not Ctrl, because Ctrl+W closes the browser tab |
| E | Interact / read / close document |
| F | Flashlight (once found) |
| J or Tab | Journal (items and clues) |
| Q or right mouse (hold) | Look behind you without changing direction (sewer chase) |
| Esc | Pause |

## Route (current progression)

1. **Basement:** at first it's lit by one fluorescent tube. The flashlight is on the table under the tube. A few seconds after you take it, the tube flickers and dies. The stair door is locked. The clipboard on the workbench says spare keys are in the red toolbox in the store room. Use that key on the door.
2. **House:** the occupant arrives about 6 s after you leave the basement and starts hunting (see AI below). The front door is deadbolted. The master closet dresser holds the key ring and the revolver. The garage side door leads outside. The map is pinned on the garage wall.
3. **Grounds:** the front gate is chained. The crowbar is in the shed. The drainage grate is behind the garden.
4. **Sewer:** the occupant follows you in (the same character, now under scripted control). Sprint. If he catches you, you restart at the tunnel mouth.
5. **End:** blackout, three gunshots, then the final cinematic, which names Chris Charles and shows his map.

## The occupant

- **Profile:** `src/data/story.js` → `ANTAGONIST` (Chris Charles, 36, 175 cm, muscular). His name appears only in the final cinematic.
- **Model:** `src/world/figure.js`. 1.75 m, broad build, work jacket, cap and beard. No facial features are modelled, and the cap brim keeps the face in shadow.
- **AI:** `src/systems/antagonist.js`. States: PATROL, INVESTIGATE, SEARCH, PURSUE, LOST and SCRIPTED.
  - **Vision:** range, field of view, raycast line of sight. Walls, closed doors and furniture block it. The flashlight and movement make you easier to see; crouching makes you harder to see.
  - **Hearing:** event-driven noise from footsteps, doors, rattles, drawers, wardrobes and glass. Walls muffle it. He hears roughly where a sound came from, not the exact spot.
  - **Memory:** last seen position and velocity, plus recent sounds. Search time runs out.
  - **Hiding places:** 4 wardrobes or cupboards (`[E] Hide`). If he saw you get in, he opens that one. Otherwise he may check nearby hiding places while searching.
- **Navigation:** `src/systems/nav.js`. A 0.2 m grid built automatically from the collision world, with two layers (ground floor + grounds, and basement) joined at the stairs. Uses A* with path smoothing. Doors are dynamic: he opens closed doors, cannot pass locked ones, and re-plans if blocked.
- **Tuning:** every number is in `src/data/antagonist.js`.

## Layout

- `src/world/house.js`: main floor built from the reference plan (`reference/tanglewood_floorplan_reference.jpg`). Walls, doors and rooms are defined in the plan's pixel coordinates, at 1 px = 0.03 m.
- `src/world/basement.js`: basement under the house, reached by the main staircase.
- `src/world/exterior.js`: original fenced grounds, shed, retaining wall and culvert.
- `src/world/sewer.js`: one straight tunnel, about 116 m long, with no branches.
- `src/systems/`: collision (AABB walls plus floor/ramp height zones), player, interaction, audio (fully procedural Web Audio, no sound files), horror director, chase, UI.
- `src/data/story.js`: **all narrative text: objectives, clues and ending cards.** Bracketed text is placeholder.

## Debug / testing

Open `/?debug` to skip pointer lock and expose `window.__game` (`teleport`, `state`, `give`, `look`, `hold`, `press`, `simulate`, `topDown`).

Automated tests (Playwright + Chrome, with the dev server running on :5173) live in `tests/`:
`doors.py` (every door: closed blocks walk/sprint from both sides, open passes, closing stops on the child, interaction targets the leaf), `ai.py` (patrol, sight, walls, hearing, crouching, catch, doors, lost/search, hiding, connectivity, outdoor pursuit, basement), `walk.py` (end-to-end progression), `flash_wall.py`, `basement_light.py`.

## Deploying to GitHub Pages

Push the repo, then in **Settings → Pages** set the source to **GitHub Actions**.
`.github/workflows/deploy.yml` builds and publishes `dist/` on every push to `main`.

## Known gaps

- Story details marked PROVISIONAL in `src/data/story.js` (victim count, fictional place names, clue wording) are not confirmed.
- No voice or sound files: all audio is procedural.
- Draw calls are high (about 1,000–1,600 per frame) because props are built from many small meshes. Merging static geometry is the next optimisation if frame rate is low.
