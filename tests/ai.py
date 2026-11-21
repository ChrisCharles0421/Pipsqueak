# Occupant AI behaviour tests, driven through the real game loop (simulate) in the browser.
import asyncio, json
from playwright.async_api import async_playwright
SETUP = r"""
window.T = (() => {
  const G = __game, game = G.game, W = game.W, ai = game.ai, pl = game.player;
  const S = 0.03, px = (x) => (x - 80) * S, pz = (y) => (y - 80) * S;
  const reset = () => {
    G.teleport(5.6, -3, -3.2, 0); ai.pos.set(px(600), 0, pz(700));
    G.give('flashlight'); game.jump = null; ai.capture = false; game.state = 'play'; game.hiding = null; game.ui.show('death', false); game.ui.show('hidingOverlay', false);
    pl.frozen = false; pl.flashOn = false; pl.crouching = false; ['KeyW','ShiftLeft','KeyC'].forEach(k => G.hold(k, false));
    ai.state = null; ai.setState('PATROL', 'test'); ai.awareness = 0; ai.graceT = 0; ai.memory.lastSeen = null; ai.memory.lastSeenT = -1e9; ai.fig.visible = true;
    for (const d of W.doors) { if (!d.locked) { d.setOpen(false, { silent: true, by: 'test' }); } }
    G.simulate(1.0);
  };
  const put = (x, z, yaw = 0) => { ai.pos.set(x, 0, z); ai.yaw = yaw; ai.path = []; ai.goal = null; };
  const insideBox = () => W.col.boxes.some(b => b.enabled && ai.pos.x > b.min.x + 0.05 && ai.pos.x < b.max.x - 0.05 && ai.pos.z > b.min.z + 0.05 && ai.pos.z < b.max.z - 0.05 && b.max.y > ai.pos.y + 0.3 && b.min.y < ai.pos.y + 1.7);
  const states = () => { const seen = new Set(); return { add: (s) => seen.add(s), list: () => [...seen] }; };
  return { G, game, W, ai, pl, px, pz, reset, put, insideBox, states };
})();
"""
TESTS = {
"patrol_120s": r"""(() => { const {G,game,ai,pl,reset,put,insideBox,px,pz} = T;
  G.teleport(5.6,-3,-3.2,0); reset(); put(px(520), pz(560));
  let prev = ai.pos.clone(), jumps = 0, inside = 0, dist = 0; const rooms = new Set(); const st = new Set();
  const t0 = performance.now();
  G.simulate(120, 1/30, () => { const d = ai.pos.distanceTo(prev); if (d > 0.5) jumps++; dist += d; prev.copy(ai.pos); if (insideBox()) inside++; st.add(ai.state);
    for (const [n,r] of Object.entries(game.constructor ? {} : {})) {} });
  const ms = performance.now() - t0;
  return { distanceWalked: +dist.toFixed(1), jumps, framesInsideObstacle: inside, states: [...st], visitedLog: ai.log.slice(-4), msPer1000Frames: +(ms / 3600 * 1000).toFixed(1) };
})()""",
"sees_child_in_room": r"""(() => { const {G,ai,pl,reset,put,px,pz} = T;
  reset(); put(px(300), pz(200), 0); G.teleport(px(300), 0, pz(330), 0); pl.flashOn = true; // 4 m in front, same room
  let t = G.simulate(4, 1/30, () => ai.state === 'PURSUE');
  return { state: ai.state, secondsToPursue: +t.toFixed(2) };
})()""",
"no_sight_through_wall": r"""(() => { const {G,ai,pl,reset,put,px,pz} = T;
  reset(); put(px(300), pz(300), Math.PI / 2); ai.pause = 100; G.teleport(px(150), 0, pz(300), 0); pl.flashOn = true; // he stands in the living room facing the wall; the child is behind it
  let maxAware = 0; G.simulate(6, 1/30, () => { maxAware = Math.max(maxAware, ai.awareness); });
  return { state: ai.state, maxAwareness: maxAware };
})()""",
"hears_sprinting_next_room": r"""(() => { const {G,ai,pl,reset,put,px,pz} = T;
  reset(); put(px(600), pz(200), Math.PI); ai.pause = 100; // dining room, facing north (away from the kitchen)
  G.teleport(px(612), 0, pz(480), 0); // kitchen, runs north towards the dining room behind him
  G.hold('KeyW', true); G.hold('ShiftLeft', true);
  let heard = G.simulate(3, 1/30, () => ai.state === 'INVESTIGATE');
  G.hold('KeyW', false); G.hold('ShiftLeft', false);
  const g = ai.goal ? [ +ai.goal.x.toFixed(1), +ai.goal.z.toFixed(1)] : null;
  return { state: ai.state, heardAfter: +heard.toFixed(2), goal: g, child: [+pl.pos.x.toFixed(1), +pl.pos.z.toFixed(1)], lastLog: ai.log.slice(-1) };
})()""",
"crouch_walk_quiet": r"""(() => { const {G,ai,pl,reset,put,px,pz} = T;
  reset(); put(px(330), pz(220), 0);
  G.teleport(px(560), 0, pz(470), Math.PI/2); pl.crouching = true;
  G.hold('KeyW', true); let t = G.simulate(4, 1/30, () => ai.state !== 'PATROL'); G.hold('KeyW', false);
  return { state: ai.state };
})()""",
"pursue_and_catch": r"""(() => { const {G,game,ai,pl,reset,put,px,pz} = T;
  reset(); put(px(300), pz(200), 0); G.teleport(px(300), 0, pz(340), 0); pl.flashOn = true;
  let t = G.simulate(15, 1/30, () => game.state !== 'play');
  return { gameState: game.state, secondsToCatch: +t.toFixed(2), text: document.getElementById('death-text').textContent };
})()""",
"door_opened_by_ai": r"""(() => { const {G,W,ai,pl,reset,put,px,pz} = T;
  G.teleport(5.6,-3,-3.2,0); reset();
  const d = W.doorsByName.boysRoom || W.doorsByName.boys; d.setOpen(false, {silent:true, by:'test'}); G.simulate(1);
  put(px(260), pz(600), Math.PI); ai.pathTo(new (T.G.THREE.Vector3)(px(150), 0, pz(750)));
  ai.state = 'PATROL'; ai.pause = 0;
  const startSide = Math.sign(ai.pos.z - d.at);
  let opened = false; G.simulate(15, 1/30, () => { if (d.openness() > 0.7) opened = true; return Math.sign(ai.pos.z - d.at) !== startSide && ai.pos.z > d.at + 0.6; });
  return { doorOpenedByAI: opened, crossed: Math.sign(ai.pos.z - d.at) !== startSide, ai: [ +ai.pos.x.toFixed(2), +ai.pos.z.toFixed(2)] };
})()""",
"lost_search_return": r"""(() => { const {G,ai,pl,reset,put,px,pz} = T;
  reset(); put(px(300), pz(200), 0); G.teleport(px(300), 0, pz(330), 0); pl.flashOn = true;
  G.simulate(1.5, 1/30, () => ai.state === 'PURSUE');
  G.teleport(5.6, -3, -3.2, 0); pl.flashOn = false; // the child "escapes" out of sight (basement corner)
  const seq = []; let last = '';
  G.simulate(70, 1/30, () => { if (ai.state !== last) { seq.push(ai.state); last = ai.state; } });
  return { sequence: seq };
})()""",
"hide_seen_vs_unseen": r"""(() => { const {G,game,ai,pl,reset,put,px,pz} = T;
  const spot = game.hidingSpots.find(s => s.name === 'nursery wardrobe');
  // A) he is chasing and watches the child get in -> he opens that wardrobe
  reset(); put(px(160), pz(470), Math.PI); G.teleport(spot.front.x, 0, spot.front.z, 0); pl.flashOn = true;
  G.simulate(1.5, 1/30, () => ai.state === 'PURSUE');
  game.hide(spot);
  let tA = G.simulate(20, 1/30, () => game.state !== 'play');
  if (game.hiding) { game.hiding.phase = 'hidden'; game.unhide(); G.simulate(1); }
  const A = { gameState: game.state, caughtWhileHidden: game.state !== 'play' };
  // B) the child hides unseen, he only heard a noise nearby -> outcome depends on chance; report it
  reset(); put(px(250), pz(470), Math.PI); game.hide(spot); ai.hear(new (G.THREE.Vector3)(spot.front.x, 0, spot.front.z), 12, 'test');
  const seq = []; let last = '';
  G.simulate(45, 1/30, () => { if (ai.state !== last) { seq.push(ai.state); last = ai.state; } return game.state !== 'play'; });
  const B = { gameState: game.state, caughtWhileHidden: game.state !== 'play', sequence: seq };
  if (game.hiding) { game.hiding.phase = 'hidden'; game.unhide(); G.simulate(1); }
  return { seenHiding: A, unseenHiding: B };
})()""",
"patrol_connectivity": r"""(() => { const {game,ai} = T; const nav = game.nav; const pts = ai.patrolPoints; const bad = [];
  const bd = game.W.doorsByName.basement, was = bd.locked; bd.locked = false;
  for (const a of pts) for (const b of pts) if (a !== b && !nav.findPath(a.x, 0, a.z, b.x, 0, b.z)) bad.push(a.room + ' -> ' + b.room);
  const toBasement = !!nav.findPath(pts[0].x, 0, pts[0].z, 6.0, -3, -3.0);
  bd.locked = was;
  return { pairs: pts.length * (pts.length - 1), unreachable: bad.slice(0, 8), unreachableCount: bad.length, houseToBasementWhenUnlocked: toBasement };
})()""",
"pursue_outside": r"""(() => { const {G,game,W,ai,pl,reset,put,px,pz} = T;
  const d = W.doorsByName.garageSide; const was = d.locked; d.locked = false; reset(); d.setOpen(true, {silent:true, by:'test'}); G.simulate(1);
  put(px(560), pz(792), Math.PI/2 + 0.6); G.teleport(px(630), 0, pz(718), -Math.PI/2);
  ai.memory.lastSeen = pl.pos.clone(); ai.memory.lastSeenT = game.time; ai.awareness = 1.2; ai.setState('PURSUE', 'test'); // he has just spotted the child
  const s0 = ai.state;
  // the child runs out of the side door and away across the yard
  G.hold('KeyW', true); G.hold('ShiftLeft', true); G.look(-Math.PI/2, 0);
  let maxX = 0; G.simulate(5, 1/30, () => { maxX = Math.max(maxX, ai.pos.x); return game.state !== 'play'; });
  G.hold('KeyW', false); G.hold('ShiftLeft', false);
  d.locked = was;
  return { startState: s0, aiFurthestX: +maxX.toFixed(2), houseWallX: 17.31, aiFollowedOutside: maxX > 17.6, gameState: game.state };
})()""",
"door_shut_in_his_face": r"""(() => { const {G,game,W,ai,pl,reset,put,px,pz} = T;
  const d = W.doorsByName.utilityTop; reset(); d.setOpen(true, {silent:true, by:'test'}); G.simulate(1);
  put(px(380), pz(350), Math.PI / 2); G.teleport(px(457), 0, pz(470), 0); // he is in the living room, child in the utility room
  ai.pause = 100;
  d.setOpen(false, {silent:true, by:'player'}); G.simulate(0.8);                 // the child has shut the door
  G.teleport(px(445), 0, pz(620), 0);                                              // ...and slipped into the garage
  ai.memory.lastSeen = new G.THREE.Vector3(px(457), 0, pz(470)); ai.memory.lastSeenT = game.time; ai.memory.vel.set(0,0,0); ai.awareness = 1.2; ai.setState('PURSUE', 'test');
  const st = ai.state;
  let closed = false, reopened = false;
  const t = G.simulate(10, 1/30, () => { if (d.openness() < 0.05) closed = true; if (closed && d.openness() > 0.75) reopened = true; return reopened && ai.pos.z > d.at + 0.5; });
  return { pursuingBefore: st, doorClosed: closed, doorReopenedByAI: reopened, aiThrough: ai.pos.z > d.at + 0.5, seconds: +t.toFixed(2), aiState: ai.state };
})()""",
"follows_into_basement": r"""(() => { const {G,game,W,ai,pl,reset,put,px,pz} = T;
  const d = W.doorsByName.basement; const was = d.locked; d.locked = false; reset(); d.setOpen(true, {silent:true, by:'test'}); G.simulate(1);
  put(px(460), pz(370), Math.PI); G.teleport(11.4, -2.4, 3.2, 0); // child is on the stairs going down, he is in the hall behind
  ai.memory.lastSeen = pl.pos.clone(); ai.memory.lastSeenT = game.time; ai.awareness = 1; ai.setState('PURSUE', 'test');
  G.teleport(9.0, -3, -2.0, 0);
  let minY = 0; G.simulate(15, 1/30, () => { minY = Math.min(minY, ai.pos.y); return game.state !== 'play'; });
  d.locked = was;
  return { aiLowestY: +minY.toFixed(2), reachedBasement: minY < -2.9, gameState: game.state, log: ai.log.slice(-3) };
})()""",
"path_house_to_basement": r"""(() => { const {G,game,ai,px,pz} = T;
  const nav = game.nav; const W = game.W; const bd = W.doorsByName.basement; const wasLocked = bd.locked; bd.locked = false;
  const p = nav.findPath(px(300), 0, pz(250), 6.0, -3, -3.0);
  bd.locked = wasLocked;
  const p2 = nav.findPath(px(300), 0, pz(250), 6.0, -3, -3.0);
  return { pathWhenUnlocked: !!p, steps: p ? p.length : 0, pathWhenLocked: !!p2 };
})()""",
}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg=await b.new_page(viewport={"width":320,"height":200})
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:5173/?debug"); await pg.wait_for_timeout(2500)
        await pg.evaluate("__game.begin(); window.__renderOverride=()=>{}; __game.game.ai.activate(0,0)"); await pg.wait_for_timeout(300)
        await pg.evaluate(SETUP)
        import sys
        names = sys.argv[1:] or list(TESTS)
        for n in names:
            try: r = await pg.evaluate(TESTS[n])
            except Exception as e: r = f"EXCEPTION {e}"
            print(f"{n}: {json.dumps(r)}")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
