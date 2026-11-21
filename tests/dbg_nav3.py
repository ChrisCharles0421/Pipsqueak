import asyncio, json, sys
from playwright.async_api import async_playwright
X0,X1,Z0,Z1=[float(v) for v in sys.argv[1:5]]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg=await b.new_page(viewport={"width":320,"height":200})
        await pg.goto("http://localhost:5173/?debug"); await pg.wait_for_timeout(2500)
        r = await pg.evaluate(f"""(()=>{{const nav=__game.game.nav; const rows=[];
          for(let z={Z0}; z<{Z1}; z+=0.2){{let s=''; for(let x={X0};x<{X1};x+=0.2){{const n=nav.idx(x,z); s+=n<0||Number.isNaN(nav.h[n])?' ':nav.blocked[n]?'#':nav.door[n]>=0?'D':'.';}} rows.push(z.toFixed(1).padStart(5)+' '+s);}}
          return rows}})()""")
        print("x from",X0); print("\n".join(r))
        await b.close()
asyncio.run(main())
