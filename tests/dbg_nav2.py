import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg=await b.new_page(viewport={"width":320,"height":200})
        await pg.goto("http://localhost:5173/?debug"); await pg.wait_for_timeout(2500)
        r = await pg.evaluate("""(()=>{const g=__game.game, nav=g.nav, px=(x)=>(x-80)*0.03, pz=(y)=>(y-80)*0.03; g.W.doorsByName.basement.locked=false;
          const q=(a,b)=>!!nav.findPath(a[0],a[1],a[2],b[0],b[1],b[2]);
          const rows=[]; for(let z=-5.9; z<2.2; z+=0.3){let s=''; for(let x=4.7;x<16.4;x+=0.2){const n=nav.N+nav.idx(x,z); s+=Number.isNaN(nav.h[n])?' ':nav.blocked[n]?'#':'.';} rows.push(z.toFixed(1).padStart(5)+' '+s);}
          return {a:q([11.4,-3,1.0],[6,-3,-3]), b:q([px(300),0,pz(250)],[11.4,-3,1.0]), c:q([px(300),0,pz(250)],[6,-3,-3]), rows}})()""")
        print(r['a'], r['b'], r['c']); print("\n".join(r['rows']))
        await b.close()
asyncio.run(main())
