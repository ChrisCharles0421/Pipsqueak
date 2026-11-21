# Tests for: audio samples, hand-held flashlight, cupboard/table hiding, jumpscare, anti spawn-camping.
import asyncio, json, sys
from playwright.async_api import async_playwright
OUT="/home/claude/house-is-watching/test-output/"
SETUP = r"""
window.T = (() => {
  const G = __game, game = G.game, W = game.W, ai = game.ai, pl = game.player, A = game.audio;
  const px = (x) => (x - 80) * 0.03, pz = (y) => (y - 80) * 0.03;
  const V = (x, y, z) => new G.THREE.Vector3(x, y, z);
  const reset = () => {
    if (game.state !== 'play') game.retry();
    G.teleport(5.6, -3, -3.2, 0); ai.pos.set(px(600), 0, pz(700));
    game.hiding = null; game.ui.show('hidingOverlay', false); pl.frozen = false; pl.crouching = false;
    ['KeyW','ShiftLeft','KeyC'].forEach(k => G.hold(k, false));
    ai.state = null; ai.setState('PATROL', 'test'); ai.awareness = 0; ai.graceT = 0; ai.capture = false;
    ai.memory.lastSeen = null; ai.memory.lastSeenT = -1e9; ai.fig.visible = true; ai.zones.forEach(z => z.until = -1e9);
    for (const d of W.doors) if (!d.locked) d.setOpen(false, { silent: true, by: 'test' });
    G.simulate(1.0);
  };
  const put = (x, z, yaw = 0) => { ai.pos.set(x, 0, z); ai.yaw = yaw; ai.path = []; ai.goal = null; };
  return { G, game, W, ai, pl, A, px, pz, V, reset, put };
})(); 0
"""
TESTS = {
"audio_samples": r"""(async () => { const {A} = T; await A.loaded;
  const s = A.samples; const out = { loaded: Object.keys(s) };
  out.footstepSlices = s.footsteps?.slices?.length; out.gunshotStartSec = s.gunshot && +s.gunshot.start.toFixed(2);
  // overlap limit + cleanup
  let started = 0; for (let i = 0; i < 6; i++) if (A.playSample('woodcreak', { key: 'tcreak', maxInstances: 2, dur: 0.2 })) started++;
  out.creakStartedOf6 = started;
  await new Promise(r => setTimeout(r, 600));
  out.liveAfterEnd = A.active.tcreak.size;
  return out; })()""",
"creak_alerts_ai": r"""(() => { const {G,game,ai,pl,reset,put,px,pz} = T; reset();
  const b = game.boards.find(q => q.room === 'Dining Room');
  put(px(330), pz(220), Math.PI / 2); ai.pause = 100;     // living room, facing away
  // child walks slowly across the dining-room loose board (not sprinting)
  G.teleport(b.x1 + 0.4, 0, (b.z0 + b.z1) / 2, Math.PI / 2); G.look(Math.PI / 2, 0);
  let creaked = 0; game.on('creak', () => creaked++);
  G.hold('KeyW', true); const t = G.simulate(4, 1/30, () => ai.state === 'INVESTIGATE'); G.hold('KeyW', false);
  const walkResult = { creaks: creaked, aiState: ai.state, after: +t.toFixed(2), goal: ai.goal && [+ai.goal.x.toFixed(1), +ai.goal.z.toFixed(1)], board: [+(b.x0).toFixed(1), +(b.z0).toFixed(1)] };
  // the same walk without the loose board (normal walking at that distance is not heard)
  reset(); put(px(330), pz(220), Math.PI / 2); ai.pause = 100;
  G.teleport(px(640), 0, pz(250), Math.PI); G.look(0, 0);
  G.hold('KeyW', true); G.simulate(3); G.hold('KeyW', false);
  return { overBoard: walkResult, plainFloorState: ai.state };
})()""",
"flashlight_hand": r"""(() => { const {G,game,pl,reset} = T; reset();
  const st = () => ({ equipped: pl.equipped, beam: pl.flashOn, model: game.viewModel.rig.visible, intensity: +pl.flash.intensity.toFixed(1) });
  const before = st();
  pl.hasFlash = true; pl.setFlash(true); G.simulate(0.6); const equipped = st();
  // beam and model are in the same place (camera space): lens position == light position
  const lens = game.viewModel.flashlight.localToWorld(new G.THREE.Vector3(0, 0, -0.125));
  const sync = +lens.distanceTo(pl.flash.position).toFixed(4);
  G.press('KeyF'); G.simulate(0.6); const away = st();
  G.press('KeyF'); G.simulate(0.6); const back = st();
  return { before, equipped, lensToLightDistance: sync, afterF: away, afterFAgain: back };
})()""",
"hiding_spots": r"""(() => { const {game} = T;
  return { spots: game.hidingSpots.map(s => `${s.type}: ${s.name} (${s.exits.length} exits)`), rejectedTables: game.rejectedTables }; })()""",
"cupboard_safe": r"""(() => { const {G,game,ai,pl,reset,put,px,pz} = T; reset();
  const spot = game.hidingSpots.find(s => s.name === 'nursery wardrobe');
  put(px(240), pz(470), Math.PI); G.teleport(spot.front.x, 0, spot.front.z, 0); pl.hasFlash = true; pl.setFlash(true);
  ai.memory.lastSeen = pl.pos.clone(); ai.memory.lastSeenT = game.time; ai.awareness = 1.2; ai.setState('PURSUE', 'test'); // he is chasing and has just seen the child
  const sawFirst = ai.state;
  game.hide(spot);
  let checked = null; game.on('spotChecked', (e) => { checked = e; });
  let minD = 99; G.simulate(25, 1/30, () => { minD = Math.min(minD, ai.pos.distanceTo(spot.pos)); return game.state !== 'play'; });
  const res = { pursuingWhenHid: sawFirst, gameState: game.state, caught: game.state !== 'play', heCheckedIt: !!checked, childInsideWhenChecked: checked?.childInside, closestApproach: +minD.toFixed(2), aiNow: ai.state };
  game.unhide(); G.simulate(1.0);
  res.afterExit = { hiding: !!game.hiding, frozen: pl.frozen, pos: [+pl.pos.x.toFixed(2), +pl.pos.z.toFixed(2)] };
  return res;
})()""",
"table_safe": r"""(() => { const {G,game,W,ai,pl,reset,put,px,pz} = T; reset();
  const spot = game.hidingSpots.find(s => s.name === 'dining table');
  const e = spot.exits[0];
  put(px(380), pz(330), -Math.PI/2); G.teleport(e.x, 0, e.z, 0); pl.hasFlash = true; pl.setFlash(true);
  ai.memory.lastSeen = pl.pos.clone(); ai.memory.lastSeenT = game.time; ai.awareness = 1.2; ai.setState('PURSUE', 'test');
  const sawFirst = ai.state;
  game.hide(spot); G.simulate(0.8);
  const camY = +game.camera.position.y.toFixed(2);
  let minD = 99, aiInsideTable = 0;
  const box = spot.group.userData.col;
  G.simulate(25, 1/30, () => { minD = Math.min(minD, ai.pos.distanceTo(spot.pos));
    if (ai.pos.x > box.min.x && ai.pos.x < box.max.x && ai.pos.z > box.min.z && ai.pos.z < box.max.z) aiInsideTable++;
    return game.state !== 'play'; });
  const res = { pursuingWhenHid: sawFirst, cameraHeightHidden: camY, caught: game.state !== 'play', closestApproach: +minD.toFixed(2), framesAiInsideTable: aiInsideTable, aiNow: ai.state };
  game.unhide(); G.simulate(1.0);
  const inside = W.col.boxes.some(b => b.enabled && b.max.y > pl.pos.y + 0.3 && b.min.y < pl.pos.y + 1.4 && pl.pos.x > b.min.x && pl.pos.x < b.max.x && pl.pos.z > b.min.z && pl.pos.z < b.max.z);
  res.afterExit = { hiding: !!game.hiding, frozen: pl.frozen, insideAnyObstacle: inside, camY: +game.camera.position.y.toFixed(2) };
  return res;
})()""",
"dbg_table": r"""(() => { const {G,game,W,ai,pl,reset,put,px,pz} = T; reset();
  const spot = game.hidingSpots.find(s => s.name === 'dining table'); const e = spot.exits[0];
  put(px(420), pz(250), -Math.PI/2); G.teleport(e.x, 0, e.z, 0);
  ai.memory.lastSeen = pl.pos.clone(); ai.memory.lastSeenT = game.time; ai.awareness = 1.2; ai.setState('PURSUE', 'test');
  game.hide(spot); const tr=[]; G.simulate(8, 1/30, (t)=>{ if (Math.round(t*30)%15==0) tr.push([+t.toFixed(1), ai.state, !!ai.checking, +ai.pos.x.toFixed(2), +ai.pos.z.toFixed(2), ai.path.length]); });
  return { exits: spot.exits.map(p=>[+p.x.toFixed(2), +p.z.toFixed(2)]), center: [+spot.pos.x.toFixed(2), +spot.pos.z.toFixed(2)], tr, log: ai.log.slice(-5) };
})()""",
"exit_hiding_near_him": r"""(() => { const {G,game,ai,pl,reset,put,px,pz} = T; reset();
  const spot = game.hidingSpots.find(s => s.name === 'kitchen table');
  G.teleport(spot.exits[0].x, 0, spot.exits[0].z, 0); game.hide(spot); G.simulate(1.0);
  put(spot.exits[0].x + 1.2, spot.exits[0].z, -Math.PI/2); ai.pause = 100; // standing right next to the table, looking at it
  G.simulate(4);
  const whileHidden = { state: game.state, ai: ai.state };
  game.unhide(); const tr = []; const t = G.simulate(10, 1/30, (tt) => { if (Math.round(tt*30) % 30 == 0) tr.push([+tt.toFixed(0), ai.state, +ai.pos.distanceTo(pl.pos).toFixed(2)]); return game.state !== 'play'; });
  return { whileHidden, afterLeaving: { gameState: game.state, aiState: ai.state, secondsUntilCaught: +t.toFixed(2), trace: tr } };
})()""",
"jumpscare_and_retry": r"""(() => { const {G,game,ai,pl,reset,put,px,pz} = T; reset();
  game.setCheckpoint(px(460), 0, pz(345), Math.PI);
  put(px(300), pz(200), 0); G.teleport(px(300), 0, pz(330), 0); pl.hasFlash = true; pl.setFlash(true);
  const t = G.simulate(10, 1/30, () => game.state !== 'play');
  const s1 = { state: game.state, jump: !!game.jump, aiCapture: ai.capture };
  const fig = ai.fig.position.clone(), cam = game.camera.position.clone();
  game.caught('again'); // a second trigger during the same capture must be ignored
  G.simulate(0.3);
  const mid = { distHeadToCam: +fig.distanceTo(cam).toFixed(2), figToCamNow: +ai.fig.position.distanceTo(game.camera.position).toFixed(2), text: document.getElementById('death-text').textContent };
  G.simulate(1.6);
  const end = { state: game.state, deathScreen: !document.getElementById('death').classList.contains('hidden') };
  document.getElementById('retry').click(); G.simulate(0.5);
  const after = { state: game.state, jump: !!game.jump, aiState: ai.state, aiCapture: ai.capture, deathScreen: !document.getElementById('death').classList.contains('hidden'),
    aiDistFromChild: +ai.pos.distanceTo(pl.pos).toFixed(1), child: [+pl.pos.x.toFixed(1), +pl.pos.z.toFixed(1)] };
  return { secondsToCatch: +t.toFixed(2), atCatch: s1, during: mid, end, afterRetry: after };
})()""",
"spawn_camping": r"""(() => { const {G,game,ai,pl,reset,put,px,pz,V} = T; const res = {};
  const exit = V(px(460), 0, pz(345));
  const run = (label, setup, seconds, every) => {
    reset(); setup(); let near = 0, zone = 0, n = 0, inBasement = 0; let k = 0, stay = 0, maxStay = 0, pausedNear = 0;
    G.simulate(seconds, 1/30, (t) => { n++; const d = ai.pos.distanceTo(exit); if (d < 2) near++; if (ai.zoneAt(ai.pos)) zone++; if (ai.pos.y < -1) inBasement++;
      if (d < 3) { stay += 1/30; maxStay = Math.max(maxStay, stay); if (ai.speed < 0.1) pausedNear += 1/30; } else stay = 0;
      if (every && (k++ % every.frames) === 0) every.fn(t); return game.state !== 'play'; });
    res[label] = { pctWithin2mOfBasementExit: +(100 * near / n).toFixed(1), longestStayWithin3mSec: +maxStay.toFixed(1), secondsStandingStillWithin3m: +pausedNear.toFixed(1), pctInExclusionZones: +(100 * zone / n).toFixed(1), pctInBasement: +(100 * inBasement / n).toFixed(1), caught: game.state !== 'play', log: ai.log.filter(l => /cooldown|INVESTIGATE|SEARCH/.test(l)).slice(-4) };
  };
  // 1) child stays in the basement making noise every 6 s for 4 minutes
  run('childStaysInBasementNoisy', () => { ai.activate(px(600), pz(700)); G.teleport(6, -3, -3, 0); }, 240,
      { frames: 180, fn: () => game.noise(V(6, -3, -3), 9, 'test') });
  // 2) child hides quietly under the basement table for 4 minutes
  run('childSilentInBasement', () => { ai.activate(px(600), pz(700)); G.teleport(6, -3, -3, 0); }, 240, null);
  // 3) noise right at the basement exit every 8 s (child upstairs, hidden in the boys' wardrobe)
  run('noiseAtBasementExit', () => { ai.activate(px(600), pz(700)); const sp = game.hidingSpots.find(s => s.name === "boys' wardrobe"); G.teleport(sp.front.x, 0, sp.front.z, 0); game.hide(sp); G.simulate(1); }, 240,
      { frames: 240, fn: () => ai.hear(V(px(460), 0, pz(350)), 10, 'test') });
  game.hiding && (game.hiding.phase = 'hidden') && game.unhide(); G.simulate(1);
  // patrol coverage
  reset(); ai.activate(px(600), pz(700)); G.teleport(6, -3, -3, 0);
  const rooms = {}; G.simulate(300, 1/30, () => { const p = ai.patrolTarget; if (p) rooms[p.room] = (rooms[p.room] || 0) + 1; });
  res.patrolRoomsVisited = Object.keys(rooms).length; res.patrolRoomsTotal = new Set(ai.patrolPoints.map(p => p.room)).size;
  return res;
})()""",
"search_wrong_place_then_patrol": r"""(() => { const {G,game,ai,pl,reset,put,px,pz,V} = T; reset();
  ai.activate(px(330), pz(220)); G.teleport(px(150), 0, pz(750), 0); // child quietly in the boys' room
  ai.hear(V(px(600), 0, pz(470)), 30, 'test'); // a noise in the kitchen (wrong place)
  const seq = []; let last = ''; G.simulate(60, 1/30, () => { if (ai.state !== last) { seq.push(ai.state); last = ai.state; } });
  return { sequence: seq, endState: ai.state, gameState: game.state };
})()""",
}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--autoplay-policy=no-user-gesture-required"])
        pg=await b.new_page(viewport={"width":320,"height":200})
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type in ("error","warning") and "GL Driver" not in m.text and "PCF" not in m.text else None)
        await pg.goto("http://localhost:5173/?debug"); await pg.wait_for_timeout(2500)
        await pg.evaluate("__game.begin(); window.__renderOverride=()=>{}; 0"); await pg.wait_for_timeout(500)
        await pg.evaluate(SETUP)
        for n in (sys.argv[1:] or list(TESTS)):
            try: r = await pg.evaluate(TESTS[n])
            except Exception as e: r = f"EXCEPTION {str(e)[:300]}"
            print(f"{n}: {json.dumps(r)}")
        print("errors:", errs[:8])
        await b.close()
asyncio.run(main())
