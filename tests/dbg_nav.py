import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg=await b.new_page(viewport={"width":320,"height":200})
        await pg.goto("http://localhost:5173/?debug"); await pg.wait_for_timeout(2500)
        r = await pg.evaluate("""(()=>{const g=__game.game, nav=g.nav, px=(x)=>(x-80)*0.03, pz=(y)=>(y-80)*0.03; g.W.doorsByName.basement.locked=false;
          const q=(a,b)=>!!nav.findPath(a[0],a[1],a[2],b[0],b[1],b[2]);
          const row=(z,L)=>{let s='';for(let x=10.3;x<12.5;x+=0.2){const i=nav.idx(x,z), n=L*nav.N+i; s+= Number.isNaN(nav.h[n])?' ':nav.blocked[n]?'#':nav.door[n]>=0?'D':(nav.h[n]<-0.2?'s':'.');} return s;};
          const rows=[]; for(let z=8.6; z>1.5; z-=0.2) rows.push(z.toFixed(1)+' L0 '+row(z,0)+'  L1 '+row(z,1));
          return {hallToStairTop:q([11.4,0,8.6],[11.4,-0.5,6.5]), stairTopToBottom:q([11.4,-0.5,6.5],[11.4,-3,2.3]), bottomToBasement:q([11.4,-3,2.3],[11.4,-3,1.0]), rows}})()""")
        for k,v in r.items():
            if k!='rows': print(k,v)
        print("\n".join(r['rows']))
        await b.close()
asyncio.run(main())
