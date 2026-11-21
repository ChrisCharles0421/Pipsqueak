// Input manager with a configurable key map.
export const KEYMAP = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  crouch: ['KeyC'], // not Ctrl: Ctrl+W would close the browser tab
  interact: ['KeyE'],
  flashlight: ['KeyF'],
  journal: ['KeyJ', 'Tab'],
  lookBack: ['KeyQ'],
};

export class Input {
  constructor(canvas) {
    this.down = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.rmb = false;
    this.locked = false;
    this.sensitivity = 0.0022;
    this.canvas = canvas;
    addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });
    addEventListener('mousedown', (e) => { if (e.button === 2) this.rmb = true; });
    addEventListener('mouseup', (e) => { if (e.button === 2) this.rmb = false; });
    addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.down.clear();
      this.onLockChange?.(this.locked);
    });
  }
  lock() { this.canvas.requestPointerLock?.(); }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  is(action) { return KEYMAP[action].some((k) => this.down.has(k)); }
  was(action) { return KEYMAP[action].some((k) => this.pressed.has(k)); }
  endFrame() { this.pressed.clear(); this.mouseDX = 0; this.mouseDY = 0; }
}
