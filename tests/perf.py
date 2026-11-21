import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg=await b.new_page(viewport={"width":400,"height":250})
        await pg.goto("http://localhost:5173/?debug"); await pg.wait_for_timeout(2500)
        await pg.evaluate("__game.begin(); __game.give('flashlight')")
        for name,tp in [("basement","5.6,-3,-3.2,-2.3"),("house living","8,0,8,0"),("exterior","10,0,-10,3.14"),("sewer","4,-3.5,-50,0")]:
            await pg.evaluate(f"__game.teleport({tp})"); await pg.wait_for_timeout(1500)
            print(name, await pg.evaluate("(()=>{const i=__game.game.renderer.info; let L=0; __game.game.scene.traverse(o=>{if(o.isLight)L++}); return {calls:i.render.calls, tris:i.render.triangles, lights:L, programs:i.programs.length}})()"))
        await b.close()
asyncio.run(main())
