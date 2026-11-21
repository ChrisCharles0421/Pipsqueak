import asyncio, base64
from playwright.async_api import async_playwright
OUT="/home/claude/house-is-watching/test-output/"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg=await b.new_page(viewport={"width":960,"height":600})
        await pg.goto("http://localhost:5173/?debug"); await pg.wait_for_timeout(2500)
        await pg.evaluate("__game.begin(); document.getElementById('toast').style.display='none'"); await pg.wait_for_timeout(3500)
        async def shot(name, js, wait=1500):
            await pg.evaluate(js); await pg.wait_for_timeout(wait); await pg.screenshot(path=OUT+name+".png")
        await shot("30_cage", "__game.teleport(10.9,-3,-2.6,0); __game.look(0,-0.2)")
        await shot("31_butcher", "__game.give('flashlight'); __game.teleport(13.9,-3,-1.1,-Math.PI/2); __game.look(-Math.PI/2,-0.45)")
        await shot("32_corkboard", "__game.teleport(6.55,-3,-4.3,0); __game.look(0,0.15)")
        # occupant in the house: foyer, lit by the foyer lamp, seen from 5 m and 2 m
        await pg.evaluate("(()=>{const g=__game.game, a=g.ai, px=(x)=>(x-80)*0.03, pz=(y)=>(y-80)*0.03; a.activate(px(262),pz(560)); a.graceT=1e9; a.yaw=Math.PI; a.pause=1e9; a.update=(dt)=>{a.fig.position.copy(a.pos); a.fig.rotation.y=a.yaw;}; })()")
        await shot("33_occupant_5m", "(()=>{const px=(x)=>(x-80)*0.03, pz=(y)=>(y-80)*0.03; __game.teleport(px(262),0,pz(395),Math.PI); __game.look(Math.PI,0.05);})()")
        await shot("34_occupant_2m", "(()=>{const px=(x)=>(x-80)*0.03, pz=(y)=>(y-80)*0.03; __game.teleport(px(262),0,pz(490),Math.PI); __game.look(Math.PI,0.25);})()")
        await shot("35_occupant_flash_1m5", "(()=>{const px=(x)=>(x-80)*0.03, pz=(y)=>(y-80)*0.03; __game.teleport(px(262),0,pz(510),Math.PI); __game.look(Math.PI,0.35);})()")
        data = await pg.evaluate("(async()=>{const m=await import('/src/world/evidence.js'); return m.drawMap().toDataURL('image/png');})()")
        open(OUT+"36_map_full.png","wb").write(base64.b64decode(data.split(',')[1]))
        await b.close()
asyncio.run(main())
