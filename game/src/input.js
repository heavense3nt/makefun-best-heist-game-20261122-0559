// Input: keyboard (WASD/arrows, Shift, E, Q, F, Space, P) and mouse clicks on the
// canvas (a planning ping the thief drops on the floor). One frame's worth of
// actions is taken with takeActions(); held keys are read every frame.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_EMP = 4;
export const ACTION_SMOKE = 8;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let ping = null;

  function keyOf(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  window.addEventListener('keydown', (event) => {
    const key = keyOf(event);
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(key);
    if (key === ' ' || key === 'Enter') actions |= ACTION_CONFIRM;
    if (key === 'p' || key === 'Escape') actions |= ACTION_PAUSE;
    if (key === 'f') actions |= ACTION_EMP;
    if (key === 'q') actions |= ACTION_SMOKE;
  });
  window.addEventListener('keyup', (event) => keys.delete(keyOf(event)));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    ping = { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY, at: performance.now() };
    actions |= ACTION_CONFIRM;
  });

  function direction() {
    let dx = 0;
    let dy = 0;
    if (keys.has('a') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('d') || keys.has('ArrowRight')) dx += 1;
    if (keys.has('w') || keys.has('ArrowUp')) dy -= 1;
    if (keys.has('s') || keys.has('ArrowDown')) dy += 1;
    return { dx, dy };
  }

  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  function takePing() {
    const taken = ping;
    ping = null;
    return taken;
  }

  function state() {
    return {
      ...direction(),
      sneak: keys.has('Shift'),
      sprint: false,
      interact: keys.has('e'),
      emp: false,
      smoke: false,
    };
  }

  return { state, takeActions, takePing, direction };
}
