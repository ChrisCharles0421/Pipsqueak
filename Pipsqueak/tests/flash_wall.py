# Flashlight must not light the far side of a wall: render the far side with the beam on and off.
import asyncio
from playwright.async_api import async_playwright
OUT="/home/claude/house-is-watching/test-output/"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg=await b.new_page(viewport={"width":400,"height":300})
        await pg.goto("http://localhost:5173/?debug"); await pg.wait_for_timeout(2500)
        await pg.evaluate("__game.begin(); __game.give('flashlight'); 0"); await pg.wait_for_timeout(500)
        # child in the master bedroom 1 m from the wall shared with the living room, beam on the wall
        await pg.evaluate("""(()=>{const G=__game,g=G.game,px=(x)=>(x-80)*0.03,pz=(y)=>(y-80)*0.03;
          g.W.lights.forEach(l=>{l.userData.base=0;l.intensity=0}); g.hemi.intensity=0; g.updateLook=()=>{g.hemi.intensity=0};
          G.teleport(px(225),0,pz(300),-Math.PI/2); G.look(-Math.PI/2,0);
          const cam=new G.THREE.PerspectiveCamera(70,4/3,0.05,50); cam.position.set(px(300),1.3,pz(300)); cam.lookAt(px(258),1.3,pz(300));
          window.__renderOverride=()=>g.renderer.render(g.scene,cam);
          window.__lum=()=>{const c=document.querySelector('canvas'); const gl=c.getContext('webgl2'); const px_=new Uint8Array(4*400*300); gl.readPixels(0,0,400,300,gl.RGBA,gl.UNSIGNED_BYTE,px_); let s=0; for(let i=0;i<px_.length;i+=4) s+=px_[i]+px_[i+1]+px_[i+2]; return s/(400*300*3);};})()""")
        await pg.wait_for_timeout(1500)
        on = await pg.evaluate("__lum()"); await pg.screenshot(path=OUT+"40_farside_beam_on.png")
        await pg.evaluate("__game.game.player.setFlash(false)"); await pg.wait_for_timeout(1500)
        off = await pg.evaluate("__lum()"); await pg.screenshot(path=OUT+"41_farside_beam_off.png")
        # control: same camera, but the child stands on the camera's side of the wall
        await pg.evaluate("(()=>{const px=(x)=>(x-80)*0.03,pz=(y)=>(y-80)*0.03; __game.teleport(px(295),0,pz(300),-Math.PI/2); __game.look(Math.PI/2,0); __game.game.player.setFlash(true);})()"); await pg.wait_for_timeout(1500)
        ctrl = await pg.evaluate("__lum()")
        print({"farSideBeamOn": round(on,3), "farSideBeamOff": round(off,3), "controlSameSide": round(ctrl,3)})
        await b.close()
asyncio.run(main())
