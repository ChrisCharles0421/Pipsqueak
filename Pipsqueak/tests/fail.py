import asyncio, sys
from playwright.async_api import async_playwright
URL=sys.argv[1] if len(sys.argv)>1 else "http://localhost:5173/?debug"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg=await b.new_page(viewport={"width":400,"height":250})
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(2500)
        await pg.evaluate("__game.begin(); __game.give('flashlight'); __game.game.W.grate.open=true; __game.teleport(4,-3.5,-26.6,0)")
        await pg.wait_for_timeout(500)
        await pg.evaluate("__game.look(0,0); __game.hold('KeyW',true)")  # walk only: too slow, should get caught
        for i in range(120):
            s=await pg.evaluate("__game.state()")
            if s['state']=='dead': break
            await pg.wait_for_timeout(500)
        print("after walking:", s['state'], s['chase'], 'z', s['z'])
        await pg.evaluate("__game.hold('KeyW',false); document.getElementById('retry').click()")
        await pg.wait_for_timeout(1500)
        s=await pg.evaluate("__game.state()")
        print("after retry:", s['state'], s['chase'], 'z', s['z'], 'obj', s['objective'])
        await pg.evaluate("__game.look(0,0); __game.hold('KeyW',true)"); await pg.wait_for_timeout(3000)
        s=await pg.evaluate("__game.state()"); print("chase re-armed:", s['chase'], 'gap', s['gap'])
        print("errors:", errs)
        await b.close()
asyncio.run(main())
