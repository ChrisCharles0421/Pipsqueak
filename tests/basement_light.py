import asyncio, json
from playwright.async_api import async_playwright
OUT="/home/claude/house-is-watching/test-output/"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg=await b.new_page(viewport={"width":960,"height":600})
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:5173/?debug"); await pg.wait_for_timeout(2500)
        print("nav build ms:", await pg.evaluate("__game.game.navBuildMs.toFixed(0)"))
        await pg.evaluate("__game.begin()"); await pg.wait_for_timeout(5000)
        await pg.evaluate("__game.look(-0.9, -0.15)"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=OUT+"20_basement_lit.png")
        await pg.evaluate("__game.teleport(8.2,-3,0.8,-2.6)"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=OUT+"21_basement_lit2.png")
        # take the flashlight and wait for the tube to fail
        await pg.evaluate("__game.teleport(9.6,-3,0.9,0); __game.look(0.288,-0.36)"); await pg.wait_for_timeout(800)
        print(await pg.evaluate("__game.state().prompt"))
        await pg.evaluate("__game.press('KeyE')"); await pg.wait_for_timeout(600)
        print("inv", await pg.evaluate("__game.state().inv"))
        await pg.evaluate("__game.simulate(9)")
        for i in range(2):
            st=await pg.evaluate("({t:__game.game.tube&&__game.game.tube.phase, I:__game.game.W.basementTube.light.intensity, broken:!!__game.game.flags.tubeBroken})")
            if st['broken']: break
            await pg.wait_for_timeout(1000)
        print("tube", st)
        await pg.evaluate("__game.teleport(8.2,-3,0.8,-2.6); __game.look(-2.6,-0.15)"); await pg.wait_for_timeout(2500)
        await pg.screenshot(path=OUT+"22_basement_dark_flash.png")
        await pg.evaluate("__game.press('KeyF')"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=OUT+"23_basement_dark_noflash.png")
        print("errors", errs)
        await b.close()
asyncio.run(main())
