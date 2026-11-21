// First-person hand + flashlight rig. There is no player body in this project, so the rig is attached to
// the camera and rendered in a second pass after the world (depth cleared), which means it can never
// clip into walls. The real SpotLight beam is placed at the lens of this model every frame, so what the
// player sees in the hand and where the light comes from always match.
import * as THREE from 'three';

const REST = new THREE.Vector3(0.2, -0.2, -0.36);   // camera-space hand position when equipped
const LOWERED = new THREE.Vector3(0.24, -0.55, -0.3); // off-screen when put away

export class ViewModel {
  constructor(player) {
    this.player = player;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 5);
    this.hemi = new THREE.HemisphereLight(0xb0b8c8, 0x3a3028, 0.6);
    this.scene.add(this.hemi);
    this.key = new THREE.PointLight(0xfff1d6, 0, 0.8, 1.5); // spill from the beam onto the hand
    this.scene.add(this.key);

    this.rig = new THREE.Group();          // moves (equip, bob, sway)
    this.scene.add(this.rig);
    const sleeve = new THREE.MeshLambertMaterial({ color: 0x3b4252 }); // child's hoodie sleeve
    const skin = new THREE.MeshLambertMaterial({ color: 0xc29a80 });
    const body = new THREE.MeshStandardMaterial({ color: 0x2b2d30, metalness: 0.6, roughness: 0.45 });
    const grip = new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.9 });
    this.lensMat = new THREE.MeshBasicMaterial({ color: 0x2a2a28 });

    // flashlight: long axis along -Z (pointing forward)
    const fl = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.17, 16), body); tube.rotation.x = Math.PI / 2; fl.add(tube);
    const sleeveGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.0185, 0.0185, 0.07, 16), grip); sleeveGrip.rotation.x = Math.PI / 2; sleeveGrip.position.z = 0.03; fl.add(sleeveGrip);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.019, 0.045, 16), body); head.rotation.x = Math.PI / 2; head.position.z = -0.1; fl.add(head);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.024, 16), this.lensMat); lens.position.z = -0.123; lens.rotation.y = Math.PI; fl.add(lens); // faces forward (-Z)
    const button = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.006, 0.014), new THREE.MeshLambertMaterial({ color: 0x6b1a14 })); button.position.set(0, 0.019, -0.02); fl.add(button);
    this.lensLocal = new THREE.Vector3(0, 0, -0.125);
    this.flashlight = fl;

    // child's hand wrapped round the grip, forearm running back and down out of view
    const hand = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.065), skin); palm.position.set(0.012, -0.012, 0.03); hand.add(palm);
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.016, 0.022), skin); f.position.set(-0.016, 0, 0.008 + i * 0.015); hand.add(f); } // fingers curled round the grip
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.03), skin); thumb.position.set(0.004, 0.02, -0.004); thumb.rotation.y = 0.4; hand.add(thumb);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.32, 12), sleeve);
    arm.rotation.x = Math.PI / 2 - 0.35; arm.position.set(0.03, -0.065, 0.19); hand.add(arm);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12), sleeve); cuff.rotation.x = Math.PI / 2 - 0.35; cuff.position.set(0.026, -0.03, 0.06); hand.add(cuff);

    this.rig.add(fl, hand);
    // aim the light so it converges on the screen centre ~6 m ahead
    this.rig.rotation.set(0.035, 0.03, 0);
    this.rig.position.copy(LOWERED);
    this.rig.visible = false;
    this.rig.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });

    this.equip = 0;       // 0 = put away, 1 = in hand
    this.swayX = 0; this.swayY = 0;
    this.tmp = new THREE.Vector3();
  }

  resize() { this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix(); }

  update(dt, input, worldHemi) {
    const pl = this.player;
    const want = pl.hasFlash && pl.equipped && !pl.hideFlash ? 1 : 0;
    this.equip += Math.sign(want - this.equip) * Math.min(Math.abs(want - this.equip), dt * 4.5);
    const e = this.equip * this.equip * (3 - 2 * this.equip);
    this.rig.visible = this.equip > 0.001;
    // the beam is only on when the light is up in the hand
    pl.beamReady = this.equip > 0.85;

    // sway: lag behind mouse movement; bob with walking
    const mx = input ? input.mouseDX : 0, my = input ? input.mouseDY : 0;
    this.swayX += (-mx * 0.00025 - this.swayX) * Math.min(1, dt * 8);
    this.swayY += (my * 0.00025 - this.swayY) * Math.min(1, dt * 8);
    const sp = Math.min(1, Math.hypot(pl.vel.x, pl.vel.z) / 3);
    const bobX = Math.cos(pl.bob * 0.5) * 0.006 * sp, bobY = Math.abs(Math.sin(pl.bob * 0.5)) * 0.008 * sp;
    this.rig.position.lerpVectors(LOWERED, REST, e);
    this.rig.position.x += this.swayX + bobX;
    this.rig.position.y += this.swayY - bobY - (pl.crouching ? 0.01 : 0);
    this.rig.rotation.set(0.035 - (1 - e) * 0.9, 0.03, 0);

    const on = pl.flashOn;
    this.lensMat.color.setHex(on ? 0xfff6dc : 0x2a2a28);
    this.key.intensity = on ? 0.18 : 0;
    this.rig.updateMatrixWorld(true);
    this.key.position.copy(this.flashlight.localToWorld(this.tmp.set(0, 0.03, -0.16)));
    this.hemi.intensity = 0.12 + worldHemi * 1.2;

    // put the real beam at this lens, pointing where the model points (camera space)
    const lensPos = this.flashlight.localToWorld(this.tmp.copy(this.lensLocal));
    pl.flash.position.copy(lensPos);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.rig.getWorldQuaternion(new THREE.Quaternion()));
    pl.flash.target.position.copy(lensPos).addScaledVector(fwd, 6);
  }

  render(renderer) {
    if (!this.rig.visible) return;
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.cam);
    renderer.autoClear = ac;
  }
}
