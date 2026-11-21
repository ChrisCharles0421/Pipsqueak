import asyncio
from playwright.async_api import async_playwright
OUT="/home/claude/house-is-watching/test-output/"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg=await b.new_page(viewport={"width":960,"height":600})
        await pg.goto("http://localhost:5173/?debug"); await pg.wait_for_timeout(2000)
        await pg.evaluate("__game.begin(); __game.give('flashlight'); __game.game.W.grate.open=true; __game.teleport(4,-3.5,-60,0)")
        await pg.wait_for_timeout(1500)
        for gap in (3,6,10):
            await pg.evaluate(f"""(()=>{{const g=__game.game; const c=g.chase; c.state='run'; c.t=5; c.fig.visible=true; c.pos.set(4.2,-3.5,-60+{gap}); c.speed=4.8;
              c.moveToward=()=>{{}}; __game.hold('KeyQ',true);}})()""")
            await pg.wait_for_timeout(2500)
            await pg.screenshot(path=OUT+f"18_lookback_{gap}m.png")
        await b.close()
asyncio.run(main())
