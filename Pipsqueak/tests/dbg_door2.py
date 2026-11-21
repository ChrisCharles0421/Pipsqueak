import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg=await b.new_page(viewport={"width":320,"height":200})
        await pg.goto("http://localhost:5173/?debug"); await pg.wait_for_timeout(2500)
        await pg.evaluate("__game.begin(); window.__renderOverride=()=>{}; __game.game.ai.activate(0,0); __game.teleport(5.6,-3,-3.2,0)")
        r = await pg.evaluate("""(()=>{const G=__game,g=G.game, ai=g.ai, px=(x)=>(x-80)*0.03, pz=(y)=>(y-80)*0.03; const d=g.W.doorsByName.boys;
          ai.pos.set(px(260),0,pz(600)); ai.pathTo(new G.THREE.Vector3(px(150),0,pz(750))); const out=[];
          G.simulate(10,1/30,(t)=>{ if(Math.round(t*30)%10==0) out.push([+t.toFixed(1), +ai.pos.x.toFixed(2), +ai.pos.z.toFixed(2), ai.wp, +d.openness().toFixed(2), +ai.speed.toFixed(2), ai.state, ai.path.length]); });
          return {out, log: ai.log.slice(-5)} })()""")
        for o in r['out']: print(o)
        print(r['log'])
        await b.close()
asyncio.run(main())
