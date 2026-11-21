import asyncio
from playwright.async_api import async_playwright
OUT="/home/claude/house-is-watching/test-output/"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg=await b.new_page(viewport={"width":960,"height":600})
        await pg.goto("http://localhost:5173/?debug"); await pg.wait_for_timeout(2500)
        await pg.evaluate("__game.begin(); document.getElementById('toast').style.display='none'; 0"); await pg.wait_for_timeout(3000)
        async def shot(name, js, wait=1500):
            await pg.evaluate(js); await pg.wait_for_timeout(wait); await pg.screenshot(path=OUT+name+".png")
        # flashlight in hand, basement (tube still on), then in the dark house
        await shot("50_hand_basement", "__game.give('flashlight'); __game.teleport(7.2,-3,-1.5,0.4); __game.look(0.4,-0.1); 0")
        await shot("51_hand_house_dark", "(()=>{const px=(x)=>(x-80)*0.03,pz=(y)=>(y-80)*0.03; __game.game.flags.tubeBroken=true; __game.teleport(px(230),0,pz(420),0); __game.look(0,-0.05);})()")
        await shot("52_hand_away", "__game.press('KeyF'); 0", 1200)
        # under the dining table, occupant walking past
        await pg.evaluate("__game.press('KeyF'); 0"); await pg.wait_for_timeout(800)
        await pg.evaluate("""(()=>{const g=__game.game, sp=g.hidingSpots.find(s=>s.name==='dining table'); __game.teleport(sp.exits[0].x,0,sp.exits[0].z,Math.PI/2); g.hide(sp);
          const a=g.ai, px=(x)=>(x-80)*0.03,pz=(y)=>(y-80)*0.03; a.activate(px(640),pz(200)); a.graceT=1e9; a.pathTo(new __game.THREE.Vector3(px(640),0,pz(360))); })()""")
        await pg.wait_for_timeout(6000)
        await shot("53_under_table", "0", 10)
        await pg.evaluate("(()=>{const g=__game.game; g.hiding.phase='hidden'; g.unhide();})()"); await pg.wait_for_timeout(5000)
        print(await pg.evaluate("JSON.stringify(__game.state())"))
        # jumpscare frames
        await pg.evaluate("""(()=>{const g=__game.game, a=g.ai, px=(x)=>(x-80)*0.03,pz=(y)=>(y-80)*0.03; a.graceT=0; __game.teleport(px(262),0,pz(450),Math.PI); __game.look(Math.PI,0);
          a.pos.set(px(262),0,pz(500)); a.memory.lastSeen=g.player.pos.clone(); a.memory.lastSeenT=g.time; a.awareness=1.2; a.setState('PURSUE','shot');})()""")
        print(await pg.evaluate("JSON.stringify(__game.state())"))
        for i,ms in enumerate([700, 900, 900, 2500]):
            await pg.wait_for_timeout(ms); await pg.screenshot(path=OUT+f"54_jumpscare_{i}.png")
            print(await pg.evaluate("(()=>{const g=__game.game,c=g.camera,f=g.ai.fig; return JSON.stringify({state:g.state, jumpT:g.jump&&+g.jump.t.toFixed(2), cam:c.position.toArray().map(v=>+v.toFixed(2)), rot:[+c.rotation.x.toFixed(2),+c.rotation.y.toFixed(2)], fig:f.position.toArray().map(v=>+v.toFixed(2)), figVis:f.visible, figYaw:+f.rotation.y.toFixed(2)})})()"))
        await pg.wait_for_timeout(6000); await pg.screenshot(path=OUT+"55_gameover.png")
        await b.close()
asyncio.run(main())
