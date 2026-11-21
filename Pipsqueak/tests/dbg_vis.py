import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg=await b.new_page(viewport={"width":320,"height":200})
        await pg.goto("http://localhost:5173/?debug"); await pg.wait_for_timeout(2500)
        await pg.evaluate("__game.begin(); window.__renderOverride=()=>{}; __game.game.ai.activate(0,0); 0")
        r=await pg.evaluate("""(()=>{const G=__game,g=G.game,ai=g.ai,pl=g.player,px=(x)=>(x-80)*0.03,pz=(y)=>(y-80)*0.03;
          ai.pos.set(px(560),0,pz(792)); ai.yaw=Math.PI/2+0.6; G.teleport(px(630),0,pz(718),0); pl.flashOn=true; G.simulate(0.05);
          const eye=ai.eye().clone(); const dir=new G.THREE.Vector3(pl.pos.x-eye.x, pl.pos.y+1.3-eye.y, pl.pos.z-eye.z); const d=dir.length(); dir.normalize();
          const blk=g.W.col.rayBlockDistance(eye,dir,d);
          const hit=g.W.col.boxes.filter(b=>{const r=new G.THREE.Ray(eye,dir); const bb=new G.THREE.Box3(b.min,b.max); const p=r.intersectBox(bb,new G.THREE.Vector3()); return b.enabled&&p&&p.distanceTo(eye)<d && !bb.containsPoint(eye)}).map(b=>[b.tag,b.min.toArray().map(v=>+v.toFixed(2)),b.max.toArray().map(v=>+v.toFixed(2))]);
          return {aiPos:ai.pos.toArray(), see:ai.canSeeChild(), d, blk, hit, grace:ai.graceT, hiding:!!g.hiding}})()""")
        print(json.dumps(r, indent=0))
        await b.close()
asyncio.run(main())
