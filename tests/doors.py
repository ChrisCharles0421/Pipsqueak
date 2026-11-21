# Door + collision verification. Runs the real game loop (simulate) in the browser.
import asyncio, json
from playwright.async_api import async_playwright
JS = r"""
(() => {
  const G = __game, game = G.game, W = game.W, pl = game.player;
  const res = [];
  const sideOf = (d, x, z) => d.axis === 'x' ? Math.sign(z - d.at) : Math.sign(x - d.at);
  const along = (d, off, n) => d.axis === 'x' ? { x: (d.from + d.to) / 2 + off, z: d.at + n } : { x: d.at + n, z: (d.from + d.to) / 2 + off };
  const face = (x, z) => G.look(Math.atan2(-(x - pl.pos.x), -(z - pl.pos.z)), 0);
  const resetDoor = (d, open) => { d.open = open; d.angle = d.target = open ? d.openAngle : d.base; d.animating = false; d.pivot.rotation.y = d.angle; d.update(0); d.setOpen(open, { silent: true, by: 'test' }); G.simulate(0.8); };
  const walk = (sec, sprint) => { G.hold('KeyW', true); G.hold('ShiftLeft', sprint); G.simulate(sec, 1/30, () => { face(window.__tx, window.__tz); }); G.hold('KeyW', false); G.hold('ShiftLeft', false); };
  for (const d of W.doors) {
    const y = d.y0, r = { door: d.name || '?', locked: d.locked };
    const wasLocked = d.locked;
    // 1) closed: walk and sprint into it from both sides
    resetDoor(d, false);
    let ok = true;
    for (const n of [1.2, -1.2]) for (const sprint of [false, true]) {
      const p = along(d, 0, n); G.teleport(p.x, y, p.z, 0);
      const t = along(d, 0, -n); window.__tx = t.x; window.__tz = t.z;
      const s0 = sideOf(d, pl.pos.x, pl.pos.z);
      walk(1.6, sprint);
      if (sideOf(d, pl.pos.x, pl.pos.z) !== s0) ok = false;
    }
    r.closedBlocks = ok;
    if (!wasLocked) {
      // 2) open it and walk through, both directions
      resetDoor(d, true);
      let through = true;
      const off = d.name === 'storage' ? 0.85 : 1.6;
      for (const n of [off, -off]) {
        const p = along(d, 0, n); G.teleport(p.x, y, p.z, 0);
        const t = along(d, 0, -n * 1.2); window.__tx = t.x; window.__tz = t.z;
        const s0 = sideOf(d, pl.pos.x, pl.pos.z);
        walk(2.5, false);
        if (sideOf(d, pl.pos.x, pl.pos.z) === s0) through = false;
      }
      r.openPasses = through;
      // 3) close it while the child stands in the doorway: must not pass through the child
      resetDoor(d, true);
      const c = along(d, 0, 0); G.teleport(c.x, y, c.z, 0);
      d.setOpen(false, { silent: true, by: 'test' }); G.simulate(2.0);
      const inside = W.col.circleHitsSeg(d.seg, pl.pos.x, pl.pos.z, 0.26, pl.pos.y, 1.45);
      r.closeOnChildStops = !inside && d.openness() > 0.15;
      // 4) step away, the door can then be closed and blocks again
      const away = along(d, 0, 1.4); G.teleport(away.x, y, away.z, 0);
      d.setOpen(false, { silent: true, by: 'test' }); G.simulate(1.2);
      r.closesAfter = d.openness() < 0.02;
      // 5) interaction raycast targets this door from 1.2 m
      G.teleport(away.x, y, away.z, 0); const cc = along(d, 0, 0); face(cc.x, cc.z); G.simulate(0.1);
      const it = W.interact.update(game.camera, W.col);
      r.interactTargets = !!it && it.obj === d.leaf;
    }
    res.push(r);
  }
  return res;
})()
"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg=await b.new_page(viewport={"width":320,"height":200})
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:5173/?debug"); await pg.wait_for_timeout(2500)
        await pg.evaluate("__game.begin()"); await pg.wait_for_timeout(500)
        await pg.evaluate("window.__renderOverride=()=>{}")
        res=await pg.evaluate(JS)
        fails=0
        for r in res:
            bad=[k for k,v in r.items() if v is False and k!='locked']
            fails+=len(bad)
            print(('FAIL ' if bad else 'ok   ')+json.dumps(r))
        print("total failing checks:", fails, "errors:", errs)
        await b.close()
asyncio.run(main())
