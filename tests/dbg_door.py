import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg=await b.new_page(viewport={"width":320,"height":200})
        await pg.goto("http://localhost:5173/?debug"); await pg.wait_for_timeout(2500)
        await pg.evaluate("__game.begin(); window.__renderOverride=()=>{}; __game.game.ai.activate(0,0)")
        r = await pg.evaluate("""(()=>{const g=__game.game, ai=g.ai, px=(x)=>(x-80)*0.03, pz=(y)=>(y-80)*0.03;
          ai.pos.set(px(260),0,pz(600)); const ok = ai.pathTo(new __game.THREE.Vector3(px(150),0,pz(750)));
          return {ok, wps: ai.path.map(w=>[+w.x.toFixed(2), +w.z.toFixed(2), w.door]), boysDoor: g.W.doors.indexOf(g.W.doorsByName.boys)} })()""")
        print(json.dumps(r))
        await b.close()
asyncio.run(main())
