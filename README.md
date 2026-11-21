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

1. **Basement:** flashlight on the workbench. Key in the enclosed storage room (south-east). Unlock the door at the top of the stairs.
2. **House:** front door is deadbolted. In the master closet, the dresser drawers hold a key ring and the revolver (picked up automatically, never usable as a weapon). The keys open the garage side door.
3. **Grounds:** front gate is chained. Crowbar in the shed (north-east). Drainage grate in the retaining wall at the back of the garden.
4. **Sewer:** the occupant follows. Sprint. Being caught restarts at the tunnel mouth.
5. **End:** dead end, blackout, three gunshots, final cinematic (placeholder text).

## Layout

- `src/world/house.js`: main floor built from the reference plan (`reference/tanglewood_floorplan_reference.jpg`). Walls, doors and rooms are defined in the plan's pixel coordinates, at 1 px = 0.03 m.
- `src/world/basement.js`: basement under the house, reached by the main staircase.
- `src/world/exterior.js`: original fenced grounds, shed, retaining wall and culvert.
- `src/world/sewer.js`: one straight tunnel, about 116 m long, with no branches.
- `src/systems/`: collision (AABB walls plus floor/ramp height zones), player, interaction, audio (fully procedural Web Audio, no sound files), horror director, chase, UI.
- `src/data/story.js`: **all narrative text: objectives, clues and ending cards.** Bracketed text is placeholder.

## Debug / testing

Open `/?debug` to skip pointer lock and expose `window.__game` (`teleport`, `state`, `give`, `look`, `hold`, `press`, `topDown`).

## Deploying to GitHub Pages

Push the repo, then in **Settings → Pages** set the source to **GitHub Actions**.
`.github/workflows/deploy.yml` builds and publishes `dist/` on every push to `main`.

## Known gaps

- The occupant has no AI inside the house yet (no patrol, hearing, sight or hiding). In the house he appears only as scripted sightings. Noise events are already emitted (`W.noise`) for the AI to use.
- All story text is placeholder.
- Draw calls are high (about 1,000–1,600 per frame) because props are built from many small meshes. Merging static geometry is the next optimisation if frame rate is low.
