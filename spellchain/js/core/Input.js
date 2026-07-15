import { KEY_TO_ELEMENT } from '../config.js';

/**
 * Translates raw DOM events into semantic game intents published on the
 * event bus ("input:element", "input:cast", ...). Game code never touches
 * DOM events directly; it either subscribes to intents or polls `pointer`
 * for continuous state (movement, channelling).
 */
export class Input {
  pointer = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    left: false,
    right: false,
  };

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('./EventBus.js').EventBus} bus
   */
  constructor(canvas, bus) {
    this.#bindPointer(canvas);
    this.#bindKeyboard(bus);
    this.bus = bus;
  }

  #bindPointer(canvas) {
    window.addEventListener('mousemove', (e) => {
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (e.button === 0) this.pointer.left = true;
      if (e.button === 2) {
        this.pointer.right = true;
        this.bus.emit('input:cast', { mode: e.shiftKey ? 'self' : 'aim' });
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.pointer.left = false;
      if (e.button === 2) this.pointer.right = false;
    });
  }

  #bindKeyboard(bus) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const element = KEY_TO_ELEMENT[e.code];
      if (element) {
        bus.emit('input:element', { element });
        return;
      }
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          bus.emit('input:dash');
          break;
        case 'KeyC':
          bus.emit('input:cast', { mode: 'area' });
          break;
        case 'Backspace':
          bus.emit('input:undo');
          break;
        case 'Escape':
          bus.emit('input:clear');
          break;
        case 'KeyT':
          bus.emit('input:spawn-dummy');
          break;
        case 'KeyM':
          bus.emit('input:mute');
          break;
        case 'KeyH':
          bus.emit('input:toggle-help');
          break;
        case 'KeyP':
          bus.emit('input:class-select');
          break;
        case 'Digit1':
          bus.emit('input:choose', { index: 0 });
          break;
        case 'Digit2':
          bus.emit('input:choose', { index: 1 });
          break;
      }
    });
  }
}
