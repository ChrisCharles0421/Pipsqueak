import asyncio, json, sys
from playwright.async_api import async_playwright
URL = "http://localhost:5173/?debug"
OUT = "/home/claude/house-is-watching/test-output/"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--autoplay-policy=no-user-gesture-required"])
        pg = await b.new_page(viewport={"width":960,"height":600})
        errs=[]
        pg.on("console", lambda m: errs.append(f"{m.type}: {m.text}") if m.type in ("error","warning") else None)
        pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
        await pg.goto(URL)
        await pg.wait_for_timeout(2500)
        await pg.evaluate("__game.begin()")
        await pg.wait_for_timeout(4000)
        print(json.dumps(await pg.evaluate("__game.state()")))
        await pg.screenshot(path=OUT+"01_spawn.png")
        fps = await pg.evaluate("""new Promise(r=>{let n=0;const t=performance.now();function f(){n++; if(performance.now()-t<2000) requestAnimationFrame(f); else r(n/2);} requestAnimationFrame(f);})""")
        print("fps(headless swiftshader)", fps)
        print("\n".join(errs[:30]))
        await b.close()
asyncio.run(main())
