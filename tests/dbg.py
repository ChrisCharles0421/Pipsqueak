import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg=await b.new_page(viewport={"width":480,"height":300})
        await pg.goto("http://localhost:5173/?debug"); await pg.wait_for_timeout(2000)
        await pg.evaluate("__game.begin(); __game.give('flashlight'); __game.game.W.grate.open=true; __game.teleport(4,-3.5,-60,0)")
        await pg.wait_for_timeout(1000)
        await pg.evaluate("""(()=>{const c=__game.game.chase; c.state='run'; c.t=5; c.fig.visible=true; c.pos.set(4.2,-3.5,-57); c.speed=4.8; c.moveToward=()=>{}; __game.hold('KeyQ',true);})()""")
        await pg.wait_for_timeout(1500)
        print(await pg.evaluate("""(()=>{const g=__game.game, f=g.chase.fig; const b=new __game.THREE.Box3().setFromObject(f);
          return {vis:f.visible, parent: !!f.parent, pos:f.position.toArray(), box:[b.min.toArray(),b.max.toArray()], cam:g.camera.position.toArray(), rot:g.camera.rotation.y, flash:g.player.flash.intensity, chase:g.chase.state, look:g.player.lookBack}})()"""))
        await b.close()
asyncio.run(main())
