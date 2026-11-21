import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg=await b.new_page(viewport={"width":480,"height":300})
        await pg.goto("http://localhost:5173/?debug"); await pg.wait_for_timeout(2000)
        await pg.evaluate("__game.begin(); __game.game.ai.cfg.graceAfterRespawn=0; __game.game.ai.graceT = 1e9; const a=__game.game.ai; const o=a.activate.bind(a); a.activate=(x,z)=>{o(x,z); a.graceT=1e9;}")
        for i in range(8):
            await pg.wait_for_timeout(700)
            print(await pg.evaluate("(()=>{const g=__game.game; return {p:g.player.pos.toArray(), ai:g.ai.pos.toArray(), st:g.ai.state}})()"))
        await b.close()
asyncio.run(main())
