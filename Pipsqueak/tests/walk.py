import asyncio, json, math, sys, time
from playwright.async_api import async_playwright
OUT = "/home/claude/house-is-watching/test-output/"
S=0.03
def P(x,y): return ((x-80)*S, (y-80)*S)

class T:
    def __init__(s,pg): s.pg=pg; s.log=[]
    async def st(s): return await s.pg.evaluate("__game.state()")
    async def walk(s, x, z, tol=0.35, timeout=60, sprint=False):
        t0=time.time(); last=None; stuck=0
        while time.time()-t0<timeout:
            st=await s.st()
            dx,dz=x-st['x'],z-st['z']; d=math.hypot(dx,dz)
            if d<tol:
                await s.pg.evaluate("__game.hold('KeyW',false);__game.hold('ShiftLeft',false)")
                return st
            yaw=math.atan2(-dx,-dz)
            await s.pg.evaluate(f"__game.look({yaw},0);__game.hold('KeyW',true);__game.hold('ShiftLeft',{str(sprint).lower()})")
            await s.pg.wait_for_timeout(120)
            if last and math.hypot(st['x']-last[0],st['z']-last[1])<0.005: stuck+=1
            else: stuck=0
            last=(st['x'],st['z'])
            if stuck>25:
                await s.pg.evaluate("__game.hold('KeyW',false)")
                raise Exception(f"STUCK walking to ({x:.2f},{z:.2f}) at {st}")
        await s.pg.evaluate("__game.hold('KeyW',false)")
        raise Exception(f"TIMEOUT walking to ({x:.2f},{z:.2f}) at {await s.st()}")
    async def use(s, yaw, pitch=0, expect=None):
        await s.pg.evaluate(f"__game.look({yaw},{pitch})"); await s.pg.wait_for_timeout(500)
        st=await s.st()
        if expect=='Open' and ('Close' in st['prompt'] or st['prompt']==''):
            print('  (door already open)'); return st
        if expect and expect not in st['prompt']: raise Exception(f"expected prompt '{expect}' got '{st['prompt']}' at {st}")
        await s.pg.evaluate("__game.press('KeyE')"); await s.pg.wait_for_timeout(1200)
        st=await s.st(); print("  used:", st['prompt'] or '-', '| inv', st['inv'], '| obj', st['objective']); return st
    async def aimuse(s, x, y, z, expect=None):
        st=await s.st(); eye=st['y']+1.33
        dx,dy,dz=x-st['x'],y-eye,z-st['z']; h=math.hypot(dx,dz)
        return await s.use(math.atan2(-dx,-dz), math.atan2(dy,h), expect)
    async def shot(s,name): await s.pg.screenshot(path=OUT+name+".png")

async def main(stage):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--autoplay-policy=no-user-gesture-required"])
        pg = await b.new_page(viewport={"width":480,"height":300})
        errs=[]
        pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
        pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
        await pg.goto("http://localhost:5173/?debug"); await pg.wait_for_timeout(2000)
        await pg.evaluate("__game.begin(); __game.game.ai.cfg.graceAfterRespawn=0; __game.game.ai.graceT = 1e9; const a=__game.game.ai; const o=a.activate.bind(a); a.activate=(x,z)=>{o(x,z); a.graceT=1e9;}; 0"); await pg.wait_for_timeout(1500)
        t=T(pg); W=lambda *a,**k: t.walk(*a,**k)
        N,S_,E,Wst=0,math.pi,-math.pi/2,math.pi/2
        try:
            if stage in ('all','basement'):
                print("BASEMENT")
                await W(7.5,-1.0); await W(8.2,-0.45); await t.use(E,-0.49,'flashlight')
                await t.shot("05a_flashlight")
                # try the exit first: it must be locked
                await W(11.4,1.2); await W(11.4,2.3); await W(11.4,6.6)
                st = await t.use(S_,0,'Open'); assert st['objective']=='keyHunt', st
                # read the clipboard hint on the workbench
                await W(11.4,1.2); await W(8.5,1.3); await W(6.6,0.2); await W(6.0,-1.2); await t.use(Wst,-0.42,'Read'); await pg.evaluate("__game.press('KeyE')"); await pg.wait_for_timeout(300)
                # store room, red toolbox
                await W(7.0,0.5); await W(12.9,1.0); await W(12.9,5.45)
                await t.use(E,0,'Open'); await W(14.4,5.45); await W(14.55,5.7)
                await t.aimuse(14.95,-2.85,6.7,'toolbox'); await t.shot("05_storage")
                await t.aimuse(14.95,-2.75,6.7,'key')
                await W(12.9,5.45); await W(12.9,1.2); await W(11.4,1.2); await W(11.4,2.3)
                st=await W(11.4,6.6); print("  top of stairs", st)
                await t.use(S_,0,'Open'); await pg.wait_for_timeout(2000)
                await W(11.4,7.1); await W(11.4,8.6); st=await t.st(); print("  in house:", st['zone'], st['room'], st['objective'])
                await t.shot("06_house_arrive")
            else:
                await pg.evaluate("__game.give('flashlight');__game.give('basementKey')")
                await pg.evaluate(f"__game.teleport({P(460,350)[0]},0,{P(460,350)[1]},0)")
            await pg.evaluate("__game.game.ai.state==='DORMANT' && __game.game.ai.activate((520-80)*0.03,(560-80)*0.03); __game.game.ai.graceT=1e9")
            if stage in ('all','house'):
                print("HOUSE")
                await W(*P(300,345)); await W(*P(225,410))
                await t.use(N,0,'Open'); await W(*P(225,345)); await W(*P(225,235)); await W(*P(229,232))
                await t.use(N,0,'Open'); await W(*P(229,178))
                await t.use(Wst,-0.9,'Search'); await pg.evaluate("__game.press('KeyE')"); await pg.wait_for_timeout(400)
                await t.shot("07_closet")
                await W(*P(225,240)); await W(*P(225,345)); await W(*P(225,420))
                # visit nursery and boys room for director + clues
                await W(*P(220,475)); await t.use(Wst,0,'Open'); await W(*P(222,475)); await W(*P(150,472)); await t.shot("08_nursery")
                await W(*P(225,470)); await W(*P(232,660)); await t.use(S_,0,'Open'); await W(*P(232,720)); await t.shot("09_boys")
                await W(*P(232,660)); await W(*P(292,640))
                await t.use(S_,0,'Open')  # front door: locked
                await W(*P(290,410)); await W(*P(457,360))
                await t.use(S_,0,'Open'); await W(*P(457,440)); await W(*P(445,470))
                await t.use(S_,0,'Open'); await W(*P(445,560)); await W(*P(600,560)); await W(*P(600,718))
                await t.shot("10_garage")
                await W(16.3,13.74); await t.use(E,0.15,'map'); await t.shot("10b_map"); await pg.evaluate("__game.press('KeyE')"); await pg.wait_for_timeout(400)
                await W(*P(600,718))
                await t.use(E,0,'Open'); await W(*P(690,718)); st=await t.st(); print("  outside:", st)
            else:
                await pg.evaluate("__game.give('garageKey');__game.give('revolver')")
                await pg.evaluate("__game.teleport(19.5,0,19.2,0)")
            if stage in ('all','exterior','chase'):
                print("EXTERIOR")
                if stage!='chase':
                    await W(19.5,30); await W(13,32.6); await t.use(S_,0,'Gate'); await t.shot("11_gate")
                    await W(20,25); await W(21,0); await W(21,-12.9); await W(24.3,-12.9); await W(25.2,-12.65)
                    await t.use(E,-0.48,'crowbar'); await t.shot("12_shed")
                    await W(21.3,-12.9); await W(19,-17); await W(4,-18.8); await t.use(N,0,'grate'); await pg.wait_for_timeout(1500)
                    await t.shot("13_grate_open")
                else:
                    await pg.evaluate("__game.give('crowbar'); __game.teleport(4,0,-18.8,0)"); await pg.wait_for_timeout(500)
                    await t.use(N,0,'grate'); await pg.wait_for_timeout(1500)
                print("SEWER")
                await W(4,-24.5); await W(4,-27.8); st=await t.st(); print("  chase:", st['chase'], 'gap', st['gap'], st['zone'])
                # sprint, occasionally look back
                t0=time.time(); shots=0; gaps=[]
                await pg.evaluate("__game.look(0,0);__game.hold('KeyW',true);__game.hold('ShiftLeft',true)")
                while True:
                    st=await t.st(); gaps.append(st['gap'])
                    if st['chase'] in ('confront','caught') or st['state']!='play': break
                    if st['z']<-80 and shots==0:
                        await pg.evaluate("__game.hold('KeyQ',true)"); await pg.wait_for_timeout(900); await t.shot("14_lookback"); await pg.evaluate("__game.hold('KeyQ',false)"); shots=1
                    if st['z']<-40 and shots==1: await t.shot("15_ahead"); shots=2
                    await pg.wait_for_timeout(250)
                    if time.time()-t0>400: raise Exception("chase timeout")
                await pg.evaluate("__game.hold('KeyW',false);__game.hold('ShiftLeft',false)")
                print("  chase ended:", st['chase'], 'z', st['z'], 'min gap', min(gaps), 'gap samples', gaps[::8])
                if st['chase']=='confront':
                    await pg.wait_for_timeout(2500); await t.shot("16_confront")
                    for i in range(80):
                        s2=await pg.evaluate("({state:__game.game.state, shots:__game.game.shotsFired||0, fade:getComputedStyle(document.getElementById('fade')).opacity})")
                        if s2['shots']>=3: break
                        await pg.wait_for_timeout(500)
                    print("  ending:", s2)
                    await pg.wait_for_timeout(9000); await t.shot("17_ending")
                    print("  ending text:", await pg.evaluate("document.getElementById('ending-text').textContent"))
        except Exception as e:
            print("FAIL:", e); await t.shot("fail")
        print("errors:", errs[:10])
        await b.close()
asyncio.run(main(sys.argv[1] if len(sys.argv)>1 else 'all'))
