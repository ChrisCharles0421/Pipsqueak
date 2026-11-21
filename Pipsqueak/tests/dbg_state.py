import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg=await b.new_page(viewport={"width":320,"height":200})
        await pg.goto("http://localhost:5173/?debug"); await pg.wait_for_timeout(2500)
        await pg.evaluate("__game.begin(); __game.game.ai.cfg.graceAfterRespawn=0; __game.game.ai.graceT = 1e9;")
        await pg.wait_for_timeout(1500)
        print(await pg.evaluate("(()=>{const g=__game.game; return {p:g.player.pos.toArray(), ai:g.ai.pos.toArray(), aw:g.ai.awareness, cp:g.chase.pos.toArray()}})()"))
        await b.close()
asyncio.run(main())
