// The world: one heist's state, its rules and its step function. It knows nothing
// about the canvas or the keyboard — main.js feeds it input, render.js paints it.
import { ALARM, COLS, DETECT, PLAYER, ROWS, STEP, TILE, TOOLS } from './config.js';

export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1;
export const EVENT_SPOTTED = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_WIN = 8;
export const EVENT_LOSE = 16;
export const EVENT_LASER = 32;
export const EVENT_EMP = 64;
export const EVENT_SMOKE = 128;

/** Line of sight between two points: true when no solid tile crosses the segment. */
export function hasLineOfSight(state, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / (TILE / 4)));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const col = Math.floor((ax + dx * t) / TILE);
    const row = Math.floor((ay + dy * t) / TILE);
    if (isSolid(state, col, row)) return false;
  }
  return true;
}

/** Circle-vs-tile collision: move axis by axis so the thief slides along walls. */
function moveCircle(state, body, dx, dy) {
  const r = body.radius;
  let x = body.x + dx;
  if (dx !== 0) {
    const top = Math.floor((body.y - r) / TILE);
    const bottom = Math.floor((body.y + r - 0.01) / TILE);
    const edge = dx > 0 ? Math.floor((x + r) / TILE) : Math.floor((x - r) / TILE);
    for (let row = top; row <= bottom; row += 1) {
      if (isSolid(state, edge, row)) {
        x = dx > 0 ? edge * TILE - r - 0.01 : (edge + 1) * TILE + r + 0.01;
        break;
      }
    }
  }
  body.x = x;
  let y = body.y + dy;
  if (dy !== 0) {
    const left = Math.floor((body.x - r) / TILE);
    const right = Math.floor((body.x + r - 0.01) / TILE);
    const edge = dy > 0 ? Math.floor((y + r) / TILE) : Math.floor((y - r) / TILE);
    for (let col = left; col <= right; col += 1) {
      if (isSolid(state, col, edge)) {
        y = dy > 0 ? edge * TILE - r - 0.01 : (edge + 1) * TILE + r + 0.01;
        break;
      }
    }
  }
  body.y = y;
}

/** True when the tile at (col, row) blocks movement — shared with the pilot. */
export function isSolid(state, col, row) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return true;
  const tile = state.tiles[row][col];
  if (tile === '#' || tile === 'D') return true;
  if (tile === 'V') return !state.vaultOpen;
  return false;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Parse a level map into tiles, loot, guards, cameras, lasers and spawn points. */
export function createWorld(level, random) {
  const tiles = [];
  const loot = [];
  const guards = [];
  const cameras = [];
  let playerStart = { x: TILE * 1.5, y: TILE * 1.5 };
  let exit = { x: TILE * 1.5, y: TILE * 1.5 };
  let hackPanel = null;
  let vaultDoor = null;

  for (let row = 0; row < ROWS; row += 1) {
    tiles.push([]);
    for (let col = 0; col < COLS; col += 1) {
      const ch = level.map[row][col];
      tiles[row].push(ch);
      const cx = (col + 0.5) * TILE;
      const cy = (row + 0.5) * TILE;
      if (ch === 'T') playerStart = { x: cx, y: cy };
      else if (ch === 'E') exit = { x: cx, y: cy };
      else if (ch === 'P') loot.push({ kind: 'painting', x: cx, y: cy, taken: false, value: level.lootValues.painting });
      else if (ch === 'g') loot.push({ kind: 'gem', x: cx, y: cy, taken: false, value: level.lootValues.gem });
      else if (ch === 'S') loot.push({ kind: 'star', x: cx, y: cy, taken: false, value: level.lootValues.star });
      else if (ch === 'H') hackPanel = { x: cx, y: cy };
      else if (ch === 'V') vaultDoor = { x: cx, y: cy, col, row };
      else if (ch >= '1' && ch <= '9') {
        guards.push({
          id: Number(ch),
          x: cx,
          y: cy,
          dir: random.range(0, Math.PI * 2),
          speed: 52 + random.range(-6, 6),
          waypoints: [],
          wpIndex: 0,
          wait: 0,
          suspicion: 0,
          mode: 'patrol', // patrol | suspicious | chase | return
          lastSeenX: cx,
          lastSeenY: cy,
          unseenFor: 0,
          homeX: cx,
          homeY: cy,
        });
      } else if (ch === 'C') {
        cameras.push({
          x: cx,
          y: cy,
          baseAngle: random.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]),
          angle: 0,
          sweep: random.range(0.9, 1.3),
          phase: random.range(0, Math.PI * 2),
          disabledUntil: 0,
        });
      }
    }
  }

  // Patrol routes: each guard walks a loop around its own neighbourhood. The
  // waypoints are the centres of floor tiles in a small rectangle around home,
  // found by a flood fill so routes never cross a wall.
  for (const guard of guards) {
    const seen = new Set();
    const queue = [[Math.floor(guard.homeX / TILE), Math.floor(guard.homeY / TILE)]];
    const floorTiles = [];
    while (queue.length > 0 && floorTiles.length < 60) {
      const [c, r] = queue.shift();
      const key = `${c},${r}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (c < 1 || r < 1 || c >= COLS - 1 || r >= ROWS - 1) continue;
      const t = tiles[r][c];
      if (t === '#' || t === 'D' || t === 'V') continue;
      floorTiles.push([c, r]);
      queue.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
    }
    // Pick four spread-out tiles as the loop: nearest, farthest, and two in between.
    floorTiles.sort(
      (a, b) =>
        Math.hypot(a[0] - guard.homeX / TILE, a[1] - guard.homeY / TILE) -
        Math.hypot(b[0] - guard.homeX / TILE, b[1] - guard.homeY / TILE),
    );
    const picks = [0, Math.floor(floorTiles.length * 0.33), Math.floor(floorTiles.length * 0.66), floorTiles.length - 1]
      .map((i) => floorTiles[Math.max(0, Math.min(floorTiles.length - 1, i))])
      .filter((p, i, arr) => arr.findIndex((q) => q[0] === p[0] && q[1] === p[1]) === i);
    guard.waypoints = picks.map(([c, r]) => ({ x: (c + 0.5) * TILE, y: (r + 0.5) * TILE }));
    if (guard.waypoints.length === 0) guard.waypoints = [{ x: guard.homeX, y: guard.homeY }];
  }

  const lasers = level.lasers.map((def) => ({
    ...def,
    xPx: (def.x + 0.5) * TILE,
    yPx: (def.y + 0.5) * TILE,
    on: true,
    trippedAt: -10,
  }));

  const state = {
    level,
    tiles,
    loot,
    guards,
    cameras,
    lasers,
    playerStart,
    exit,
    hackPanel,
    vaultDoor,
    player: {
      x: playerStart.x,
      y: playerStart.y,
      radius: PLAYER.radius,
      dir: 0,
      sneaking: false,
      sprinting: false,
      moving: false,
    },
    time: 0,
    timeLeft: level.timeLimit,
    alarm: 0,
    score: 0,
    lootValue: 0,
    starTaken: false,
    vaultOpen: false,
    channel: null, // { kind: 'loot'|'vault'|'hack', target, progress, needed }
    empCharges: TOOLS.empCharges,
    smokeCharges: TOOLS.smokeCharges,
    smokes: [], // { x, y, until }
    empUntil: 0,
    caught: false,
    won: false,
    over: false,
    stats: { spotted: 0, lasersTripped: 0, camerasHacked: 0, timesSeen: 0 },
  };
  return state;
}

/** Reset a world to its opening state (same level, same seed behaviour). */
export function resetWorld(state, random) {
  const fresh = createWorld(state.level, random);
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, fresh);
}

/** Distance from a point to the nearest smoke cloud centre, or Infinity. */
function smokeCoverAt(state, x, y) {
  let best = Infinity;
  for (const smoke of state.smokes) {
    if (state.time > smoke.until) continue;
    best = Math.min(best, Math.hypot(x - smoke.x, y - smoke.y));
  }
  return best;
}

/** Can this watcher see the thief right now? Cones, range, light and smoke. */
export function canSeeThief(state, wx, wy, facing, range) {
  const player = state.player;
  const dx = player.x - wx;
  const dy = player.y - wy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return { seen: false, dist };
  const toPlayer = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(toPlayer, facing)) > DETECT.coneHalfAngle) return { seen: false, dist };
  if (!hasLineOfSight(state, wx, wy, player.x, player.y)) return { seen: false, dist };
  if (smokeCoverAt(state, player.x, player.y) < TOOLS.smokeRadius) return { seen: false, dist };
  return { seen: true, dist };
}

/** One fixed step of the simulation. Input: { dx, dy, sneak, sprint, interact, emp, smoke }. */
export function stepWorld(state, input) {
  if (state.over) return EVENT_NONE;
  let events = EVENT_NONE;
  state.time += STEP;
  state.timeLeft -= STEP;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    state.alarm = ALARM.lockdown;
    state.over = true;
    state.caught = true;
    return EVENT_LOSE;
  }

  const player = state.player;
  const lootSlow = Math.min(PLAYER.maxLootSlow, (state.lootValue / 1000) * PLAYER.lootSlowPerThousand);
  const speed = input.sneak
    ? PLAYER.sneakSpeed
    : input.sprint
      ? PLAYER.sprintSpeed - lootSlow
      : PLAYER.walkSpeed - lootSlow;
  const len = Math.hypot(input.dx, input.dy);
  player.sneaking = input.sneak;
  player.sprinting = input.sprint && len > 0;
  player.moving = len > 0;
  if (len > 0) {
    const nx = (input.dx / len) * speed * STEP;
    const ny = (input.dy / len) * speed * STEP;
    moveCircle(state, player, nx, ny);
    player.dir = Math.atan2(input.dy, input.dx);
  }

  // --- Interactions: hold E near something to channel it. ---
  const interactTarget = findInteractTarget(state);
  if (input.interact && interactTarget) {
    if (!state.channel || state.channel.kind !== interactTarget.kind || state.channel.target !== interactTarget.target) {
      state.channel = { kind: interactTarget.kind, target: interactTarget.target, progress: 0, needed: interactTarget.needed };
    }
    state.channel.progress += STEP;
    if (state.channel.progress >= state.channel.needed) {
      events |= finishChannel(state, state.channel);
      state.channel = null;
    }
  } else {
    state.channel = null;
  }

  // --- Tools: EMP burst and smoke bomb (instant, on key press). ---
  if (input.emp && state.empCharges > 0 && state.time > state.empUntil) {
    state.empCharges -= 1;
    state.empUntil = state.time + TOOLS.empDisableSeconds;
    for (const camera of state.cameras) {
      if (Math.hypot(camera.x - player.x, camera.y - player.y) < TOOLS.empRadius) {
        camera.disabledUntil = Math.max(camera.disabledUntil, state.time + TOOLS.empDisableSeconds);
      }
    }
    events |= EVENT_EMP;
  }
  if (input.smoke && state.smokeCharges > 0) {
    state.smokeCharges -= 1;
    state.smokes.push({ x: player.x, y: player.y, until: state.time + TOOLS.smokeSeconds });
    events |= EVENT_SMOKE;
  }

  // --- Cameras sweep and watch. ---
  let cameraSees = false;
  for (const camera of state.cameras) {
    camera.angle = camera.baseAngle + Math.sin(state.time * 0.55 + camera.phase) * camera.sweep;
    if (state.time < camera.disabledUntil || state.time < state.empUntil) continue;
    const seen = canSeeThief(state, camera.x, camera.y, camera.angle, DETECT.coneRange + 40);
    if (seen.seen) cameraSees = true;
  }
  if (cameraSees) state.alarm = Math.min(ALARM.lockdown, state.alarm + ALARM.cameraPerSecond * STEP);

  // --- Lasers blink on and off; crossing a live beam trips the alarm. ---
  for (const laser of state.lasers) {
    laser.on = Math.sin(state.time * 1.4 + laser.phase * Math.PI * 2) > -0.2;
    if (!laser.on) continue;
    if (state.time - laser.trippedAt < 1.2) continue;
    if (crossesLaser(state, laser)) {
      laser.trippedAt = state.time;
      state.alarm = Math.min(ALARM.lockdown, state.alarm + ALARM.laserHit);
      state.stats.lasersTripped += 1;
      events |= EVENT_LASER;
    }
  }

  // --- Guards: patrol, grow suspicious, chase, give up, catch. ---
  let anyChase = false;
  let anySees = false;
  for (const guard of state.guards) {
    updateGuard(state, guard, input);
    if (guard.mode === 'chase') anyChase = true;
    if (guard.suspicion > 0.05) anySees = true;
    if (guard.mode === 'chase' && Math.hypot(guard.x - player.x, guard.y - player.y) < DETECT.catchRadius) {
      state.over = true;
      state.caught = true;
      return EVENT_CAUGHT;
    }
  }
  if (anyChase) state.alarm = Math.min(ALARM.lockdown, state.alarm + ALARM.chasePerSecond * STEP);
  if (!anySees && !cameraSees) state.alarm = Math.max(0, state.alarm - ALARM.decayPerSecond * STEP);

  // --- Win: reach the exit with the star loot. Lose: alarm hits lockdown. ---
  if (state.starTaken && Math.hypot(player.x - state.exit.x, player.y - state.exit.y) < TILE * 0.9) {
    state.over = true;
    state.won = true;
    const timeBonus = Math.round(state.timeLeft * 12);
    const ghostBonus = state.stats.timesSeen === 0 ? 25000 : 0;
    state.score = state.lootValue + timeBonus + ghostBonus;
    return events | EVENT_WIN;
  }
  if (state.alarm >= ALARM.lockdown) {
    state.over = true;
    state.caught = true;
    return events | EVENT_LOSE;
  }
  return events;
}

function crossesLaser(state, laser) {
  const player = state.player;
  const r = player.radius;
  if (laser.vertical) {
    const top = laser.yPx;
    const bottom = laser.yPx + laser.len * TILE;
    return Math.abs(player.x - laser.xPx) < r + 3 && player.y > top - r && player.y < bottom + r;
  }
  const left = laser.xPx;
  const right = laser.xPx + laser.len * TILE;
  return Math.abs(player.y - laser.yPx) < r + 3 && player.x > left - r && player.x < right + r;
}

/** What can the thief channel right now (nearest, in reach)? */
export function findInteractTarget(state) {
  const player = state.player;
  const reach = TILE * 1.6;
  // Loot on the floor.
  for (const item of state.loot) {
    if (item.taken) continue;
    if (Math.hypot(item.x - player.x, item.y - player.y) < reach) {
      return { kind: 'loot', target: item, needed: item.kind === 'star' ? PLAYER.vaultTime : PLAYER.grabTime };
    }
  }
  // The vault door, the only way into the star room.
  if (!state.vaultOpen && state.vaultDoor) {
    if (Math.hypot(state.vaultDoor.x - player.x, state.vaultDoor.y - player.y) < reach + TILE * 0.5) {
      return { kind: 'vault', target: state.vaultDoor, needed: PLAYER.vaultTime };
    }
  }
  // The camera hack panel.
  if (state.hackPanel) {
    if (Math.hypot(state.hackPanel.x - player.x, state.hackPanel.y - player.y) < reach) {
      return { kind: 'hack', target: state.hackPanel, needed: PLAYER.hackTime };
    }
  }
  return null;
}

function finishChannel(state, channel) {
  if (channel.kind === 'loot') {
    const item = channel.target;
    item.taken = true;
    state.lootValue += item.value;
    if (item.kind === 'star') state.starTaken = true;
    return EVENT_PICKUP;
  }
  if (channel.kind === 'vault') {
    state.vaultOpen = true;
    return EVENT_PICKUP;
  }
  if (channel.kind === 'hack') {
    for (const camera of state.cameras) camera.disabledUntil = Math.max(camera.disabledUntil, state.time + TOOLS.cameraDisableSeconds);
    state.stats.camerasHacked += 1;
    return EVENT_PICKUP;
  }
  return EVENT_NONE;
}

/** Guard brain: patrol waypoints, turn suspicious, chase the last seen spot. */
function updateGuard(state, guard, _input) {
  const player = state.player;
  const range = player.sneaking ? DETECT.sneakRange : DETECT.coneRange;
  const seen = canSeeThief(state, guard.x, guard.y, guard.dir, range);

  if (seen.seen) {
    const closeness = 1 - seen.dist / range;
    const rate = DETECT.fillPerSecond * (0.4 + closeness) + (seen.dist > range * 0.6 ? DETECT.fillFar : 0);
    guard.suspicion = Math.min(DETECT.chaseFill, guard.suspicion + rate * STEP);
    guard.lastSeenX = player.x;
    guard.lastSeenY = player.y;
    guard.unseenFor = 0;
    if (guard.suspicion >= DETECT.chaseFill && guard.mode !== 'chase') {
      guard.mode = 'chase';
      state.alarm = Math.min(ALARM.lockdown, state.alarm + ALARM.spottedBump);
      state.stats.spotted += 1;
      state.stats.timesSeen += 1;
    } else if (guard.suspicion > 0.25 && guard.mode === 'patrol') {
      guard.mode = 'suspicious';
    }
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - DETECT.decayPerSecond * STEP);
    guard.unseenFor += STEP;
    if (guard.mode === 'chase' && guard.unseenFor > DETECT.loseSeconds) {
      guard.mode = 'return';
    } else if (guard.mode === 'suspicious' && guard.suspicion <= 0.05) {
      guard.mode = 'patrol';
    }
  }

  const chaseSpeed = guard.speed * 1.5;
  if (guard.mode === 'chase') {
    moveToward(state, guard, guard.lastSeenX, guard.lastSeenY, chaseSpeed);
    if (Math.hypot(guard.x - guard.lastSeenX, guard.y - guard.lastSeenY) < 12 && !seen.seen) {
      guard.mode = 'suspicious';
    }
  } else if (guard.mode === 'return') {
    moveToward(state, guard, guard.homeX, guard.homeY, guard.speed);
    if (Math.hypot(guard.x - guard.homeX, guard.y - guard.homeY) < 10) guard.mode = 'patrol';
  } else if (guard.mode === 'suspicious') {
    // Stand, look around: sweep the cone toward the last seen spot.
    const want = Math.atan2(guard.lastSeenY - guard.y, guard.lastSeenX - guard.x);
    guard.dir += angleDiff(want, guard.dir) * Math.min(1, STEP * 3);
    guard.wait += STEP;
    if (guard.wait > 2.5) {
      guard.wait = 0;
      guard.mode = 'patrol';
    }
  } else {
    // Patrol: walk the loop, pausing at each waypoint to look around.
    if (guard.wait > 0) {
      guard.wait -= STEP;
      guard.dir += STEP * 0.8;
      return;
    }
    const target = guard.waypoints[guard.wpIndex];
    const arrived = moveToward(state, guard, target.x, target.y, guard.speed);
    if (arrived) {
      guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
      guard.wait = 0.9;
    }
  }
}

/** Walk a guard body toward a point; returns true when it arrives. */
function moveToward(state, guard, tx, ty, speed) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 8) return true;
  const step = Math.min(dist, speed * STEP);
  const body = { x: guard.x, y: guard.y, radius: 11 };
  moveCircle(state, body, (dx / dist) * step, (dy / dist) * step);
  guard.x = body.x;
  guard.y = body.y;
  guard.dir = Math.atan2(dy, dx);
  return dist - step < 8;
}
