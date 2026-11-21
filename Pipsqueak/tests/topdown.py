import asyncio
from playwright.async_api import async_playwright
OUT = "/home/claude/house-is-watching/test-output/"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg = await b.new_page(viewport={"width":900,"height":1000})
        await pg.goto("http://localhost:5173/?debug"); await pg.wait_for_timeout(2500)
        await pg.evaluate("document.getElementById('title').classList.add('hidden'); document.getElementById('hud').style.display='none'; document.getElementById('vignette').style.display='none'")
        for name, args in [("02_topdown_house", "8.65,10.9,23,4.5"), ("03_topdown_basement", "10.5,1,16,-0.1"), ("04_topdown_grounds", "10,7,62,30")]:
            await pg.evaluate(f"window.__renderOverride=()=>__game.topDown({args})")
            await pg.wait_for_timeout(1500)
            await pg.screenshot(path=OUT+name+".png")
        await b.close()
asyncio.run(main())
