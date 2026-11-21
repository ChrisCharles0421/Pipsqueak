import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg=await b.new_page(viewport={"width":320,"height":200})
        await pg.goto("http://localhost:5173/?debug"); await pg.wait_for_timeout(2500)
        r=await pg.evaluate("""(()=>{const g=__game.game,nav=g.nav; const n=nav.nearest(10.2,0,5.1); const p=n>=0?nav.nodePos(n):null;
          const path=nav.findPath(10.2,0,5.1,16.26,0,5.55); const path2=nav.findPath(10.2,0,5.1,13.26,0,5.55);
          const row=(z)=>{let s='';for(let x=8.6;x<17.2;x+=0.2){const i=nav.idx(x,z);s+=Number.isNaN(nav.h[i])?' ':nav.blocked[i]?'#':nav.door[i]>=0?'D':'.';}return s};
          const rows=[];for(let z=2.2;z<9.4;z+=0.2)rows.push(z.toFixed(1)+' '+row(z));
          return {n, p, path:!!path, path2:!!path2, rows}})()""")
        print(r['n'], r['p'], r['path'], r['path2']); print("x from 8.6\n"+"\n".join(r['rows']))
        await b.close()
asyncio.run(main())
