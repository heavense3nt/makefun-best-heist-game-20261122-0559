// The screenshot scenes behind ?shot=title|stealth|vault|getaway. Each one plays the
// real rules forward from a fresh world, steered by a waypoint pilot that walks the
// thief tile to tile along a breadth-first path — never straight through a wall —
// and holds E where a pick is needed, so the frame is what a short game really
// looks like, and the same seed always gives the same frame.
import { STEP, TILE } from './config.js';
import { isSolid, stepWorld } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

/** Breadth-first path over floor tiles: a list of tile centres from `from` to `to`. */
function findPath(state, fromCol, fromRow, toCol, toRow) {
  const key = (c, r) => `${c},${r}`;
  const prev = new Map();
  const queue = [[fromCol, fromRow]];
  prev.set(key(fromCol, fromRow), null);
  while (queue.length > 0) {
    const [c, r] = queue.shift();
    if (c === toCol && r === toRow) break;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (prev.has(key(nc, nr)) || isSolid(state, nc, nr)) continue;
      prev.set(key(nc, nr), [c, r]);
      queue.push([nc, nr]);
    }
  }
  if (!prev.has(key(toCol, toRow))) return null;
  const path = [];
  let cur = [toCol, toRow];
  while (cur) {
    path.unshift(cur);
    cur = prev.get(key(cur[0], cur[1]));
  }
  return path.slice(1).map(([c, r]) => ({ x: (c + 0.5) * TILE, y: (r + 0.5) * TILE }));
}

/**
 * One scripted move: walk to a tile along a path, then optionally hold interact
 * until `done`. While a guard chases and the thief is not mid-channel, the pilot
 * paths back to the start room to break the trail, then resumes the script.
 */
function scriptStep(state, script, budget) {
  let used = 0;
  let at = 0;
  let path = null;
  let pathTarget = '';
  let fleeGoal = 'start'; // the thief alternates safe rooms while chased, never waits
  while (used < budget && at < script.length) {
    const move = script[at];
    const input = { dx: 0, dy: 0, sneak: !!move.sneak, sprint: false, interact: false, emp: false, smoke: false };
    const chaser = state.guards.find((g) => g.mode === 'chase');
    const tx = (move.col + 0.5) * TILE;
    const ty = (move.row + 0.5) * TILE;
    const dist = Math.hypot(tx - state.player.x, ty - state.player.y);
    const channeling = move.act && dist <= TILE * 1.4;

    if (channeling) {
      // Finish the pick even while chased: a 0.45 s grab beats a closing guard.
      input.interact = true;
      if (move.act(state)) {
        at += 1;
        path = null;
        continue;
      }
    } else {
      // A chased thief drops smoke to break the line of sight, then paths to a
      // safe room — standing still in a dead end is how it gets caught.
      if (chaser && state.smokeCharges > 0) {
        const covered = state.smokes.some(
          (s) => state.time < s.until && Math.hypot(s.x - state.player.x, s.y - state.player.y) < 110,
        );
        if (!covered) input.smoke = true;
      }
      const fleeing = !!chaser;
      let safe = fleeGoal === 'start' ? state.playerStart : state.exit;
      if (fleeing && Math.hypot(safe.x - state.player.x, safe.y - state.player.y) < TILE * 2) {
        fleeGoal = fleeGoal === 'start' ? 'exit' : 'start';
        safe = fleeGoal === 'start' ? state.playerStart : state.exit;
      }
      const goal = fleeing
        ? { col: Math.floor(safe.x / TILE), row: Math.floor(safe.y / TILE), sprint: true }
        : { col: move.col, row: move.row, sprint: false };
      const goalKey = `${goal.col},${goal.row},${fleeing ? 'flee' : 'go'}`;
      if (!path || pathTarget !== goalKey || path.length === 0) {
        path = findPath(state, Math.floor(state.player.x / TILE), Math.floor(state.player.y / TILE), goal.col, goal.row);
        pathTarget = goalKey;
      }
      if (path && path.length > 0) {
        const node = path[0];
        const nx = node.x - state.player.x;
        const ny = node.y - state.player.y;
        const nd = Math.hypot(nx, ny);
        if (nd < 8) {
          path.shift();
        } else {
          input.dx = nx / nd;
          input.dy = ny / nd;
          input.sprint = goal.sprint;
          input.sneak = !goal.sprint && !!move.sneak;
        }
      } else if (!fleeing) {
        // No path (or already there): done with this waypoint.
        at += 1;
        path = null;
        continue;
      }
    }
    stepWorld(state, input);
    used += 1;
    if (state.over) return used;
  }
  return used;
}

const vaultIsOpen = (state) => state.vaultOpen;
const starIsTaken = (state) => state.starTaken;
const paintingTaken = (state) => state.loot.some((item) => item.kind === 'painting' && item.taken);

/** Walk from the start, through the hall, to the vault door and pick it open. */
function reachVault(state) {
  scriptStep(
    state,
    [
      { col: 3, row: 8 },
      { col: 11, row: 9, act: paintingTaken },
      { col: 17, row: 10 },
      { col: 24, row: 8 },
      { col: 29, row: 8, act: vaultIsOpen },
    ],
    60 * 90,
  );
}

/**
 * Set `state` to the named scene (title, stealth, vault or getaway; any other name
 * is title) and return the screen to draw over it.
 */
export function stageShot(name, state) {
  if (name === 'stealth') {
    // Creep down the hall, lift a painting, then slip behind the display case
    // to watch the guard sweep past — suspicion half full, alarm climbing.
    scriptStep(
      state,
      [
        { col: 3, row: 8 },
        { col: 6, row: 10, sneak: true },
        { col: 11, row: 9, sneak: true, act: paintingTaken },
        { col: 12, row: 11, sneak: true },
      ],
      60 * 60,
    );
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY };
  }
  if (name === 'vault') {
    reachVault(state);
    if (!state.over) {
      scriptStep(
        state,
        [
          { col: 31, row: 5 },
          { col: 32, row: 3 },
          { col: 33, row: 2, act: starIsTaken },
        ],
        60 * 60,
      );
    }
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY };
  }
  if (name === 'getaway') {
    reachVault(state);
    if (!state.over) {
      scriptStep(
        state,
        [
          { col: 31, row: 5 },
          { col: 32, row: 3 },
          { col: 33, row: 2, act: starIsTaken },
          { col: 30, row: 8 },
          { col: 24, row: 10 },
          { col: 17, row: 12 },
          { col: 10, row: 15 },
        ],
        60 * 120,
      );
    }
    // Sprint the last stretch toward the van while the alarm is hot.
    for (let i = 0; i < 60; i += 1) {
      const dx = state.exit.x - state.player.x;
      const dy = state.exit.y - state.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 60) break;
      stepWorld(state, { dx: dx / dist, dy: dy / dist, sneak: false, sprint: true, interact: false, emp: false, smoke: false });
      if (state.over) break;
    }
    return { screen: state.over ? SCREEN_OVER : state.won ? SCREEN_WIN : SCREEN_PLAY };
  }
  // Title: let the guards patrol and the cameras sweep for a few seconds, then
  // paint the title over the living room.
  for (let i = 0; i < 60 * 5; i += 1) {
    stepWorld(state, { dx: 0, dy: 0, sneak: false, sprint: false, interact: false, emp: false, smoke: false });
  }
  return { screen: SCREEN_TITLE };
}
