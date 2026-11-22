// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between
// screens: title, briefing, play, paused, caught and getaway — three heists in a
// row, each with its own plan screen.
//
// ?seed=N fixes the patrol jitter. ?level=0|1|2 jumps to a heist. ?shot=title|
// stealth|vault|getaway (with &seed=N) stages that scene instead of running the
// loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, LEVELS, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_EMP, EVENT_LASER, EVENT_LOSE, EVENT_PICKUP, EVENT_SMOKE, EVENT_SPOTTED, EVENT_WIN, resetWorld, stepWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_EMP, ACTION_PAUSE, ACTION_SMOKE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BRIEF, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const levelParam = Number.parseInt(params.get('level') ?? '0', 10);
const startLevel = Number.isInteger(levelParam) && levelParam >= 0 && levelParam < LEVELS.length ? levelParam : 0;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const hud = {
  alarmFill: document.getElementById('alarm-fill'),
  alarmText: document.getElementById('alarm-text'),
  loot: document.getElementById('loot'),
  timer: document.getElementById('timer'),
  level: document.getElementById('level-name'),
  emp: document.getElementById('emp-count'),
  smoke: document.getElementById('smoke-count'),
  objective: document.getElementById('objective'),
  hint: document.getElementById('hint'),
};
const random = createRandom(seed);
const world = createWorld(LEVELS[startLevel], random);
const renderer = createRenderer(canvas);
const audio = createAudio();

function fmtMoney(value) {
  return `$${value.toLocaleString('en-US')}`;
}
function fmtTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}
function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function updateHud(screen) {
  const alarm = world.alarm;
  hud.alarmFill.style.width = `${alarm}%`;
  hud.alarmFill.style.background = alarm > 70 ? '#ff4040' : alarm > 35 ? '#ffb020' : '#57c785';
  hud.alarmText.textContent = `ALARM ${Math.round(alarm)}%`;
  hud.loot.textContent = `LOOT ${fmtMoney(world.lootValue)}`;
  hud.timer.textContent = `DAWN IN ${fmtTime(world.timeLeft)}`;
  hud.level.textContent = world.level.name;
  hud.emp.textContent = `EMP ×${world.empCharges}`;
  hud.smoke.textContent = `SMOKE ×${world.smokeCharges}`;
  hud.objective.textContent = world.starTaken ? '★ Idol secured — reach the EXIT van' : '○ Steal the star loot';
  if (screen !== SCREEN_PLAY) {
    hud.hint.textContent = '';
    return;
  }
  if (world.channel) {
    const label = world.channel.kind === 'vault' ? 'Picking the vault…' : world.channel.kind === 'hack' ? 'Hacking the cameras…' : 'Grabbing it…';
    hud.hint.textContent = `${label} keep holding E`;
  } else if (world.starTaken) {
    hud.hint.textContent = 'Run for the green EXIT — the van is waiting';
  } else {
    hud.hint.textContent = 'WASD move · Shift sneak · E grab/pick · Q smoke · F EMP';
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  updateHud(scene.screen);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, { loot: world.lootValue, levelName: world.level.name });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let levelIndex = startLevel;
  let best = readBest();
  let campaignScore = 0;
  let accumulator = 0;
  let last = performance.now();
  let overWhy = '';

  function announce(message) {
    status.textContent = message;
  }

  function startLevel(index) {
    levelIndex = index;
    resetWorld(world, createRandom(seed + index * 7919));
    // A fresh level keeps the campaign loot total as the running score.
    world.lootValue = 0;
    accumulator = 0;
    screen = SCREEN_BRIEF;
    announce(`${world.level.name}. ${world.level.brief}`);
  }

  function beginPlay() {
    screen = SCREEN_PLAY;
    audio.resume();
    announce(`Playing ${world.level.name}. Steal the star loot, then reach the exit.`);
  }

  function endCaught(why) {
    overWhy = why;
    screen = SCREEN_OVER;
    audio.lose();
    audio.setAlarm(0);
    announce(`Busted. ${why}`);
  }

  function endWin() {
    const timeBonus = Math.round(world.timeLeft * 12);
    const ghostBonus = world.stats.timesSeen === 0 ? 25000 : 0;
    campaignScore += world.score;
    screen = SCREEN_WIN;
    audio.win();
    audio.setAlarm(0);
    if (world.score > best) {
      best = world.score;
      saveBest(best);
    }
    announce(`Getaway! Score ${world.score}. Best ${best}.`);
    world._winBreakdown = { timeBonus, ghostBonus };
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE) startLevel(levelIndex);
      else if (screen === SCREEN_BRIEF) beginPlay();
      else if (screen === SCREEN_OVER) startLevel(levelIndex);
      else if (screen === SCREEN_WIN) {
        if (levelIndex + 1 < LEVELS.length) startLevel(levelIndex + 1);
        else {
          campaignScore = 0;
          startLevel(0);
        }
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    return actions;
  }

  function step(actions) {
    const held = input.state();
    const events = stepWorld(world, {
      dx: held.dx,
      dy: held.dy,
      sneak: held.sneak,
      sprint: held.sprint,
      interact: held.interact,
      emp: !!(actions & ACTION_EMP),
      smoke: !!(actions & ACTION_SMOKE),
    });
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_SPOTTED) audio.spotted();
    if (events & EVENT_LASER) audio.laser();
    if (events & EVENT_EMP) audio.emp();
    if (events & EVENT_WIN) endWin();
    else if (events & EVENT_CAUGHT) endCaught('A guard caught you red-handed.');
    else if (events & EVENT_LOSE) endCaught(world.timeLeft <= 0 ? 'Dawn broke — the crew left without you.' : 'The alarm hit lockdown and the doors sealed.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    audio.setAlarm(screen === SCREEN_PLAY ? world.alarm / 100 : 0);
    const extra =
      screen === SCREEN_BRIEF
        ? { levelName: world.level.name, briefLines: wrapBrief(world.level) }
        : screen === SCREEN_WIN
          ? {
              levelName: world.level.name,
              loot: world.lootValue,
              timeBonus: world._winBreakdown?.timeBonus ?? 0,
              ghost: world.stats.timesSeen === 0,
              score: world.score,
            }
          : screen === SCREEN_OVER
            ? { why: overWhy, loot: world.lootValue }
            : { loot: world.lootValue, levelName: world.level.name };
    renderer.draw(world, screen, extra);
    updateHud(screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('The Gilded Vault. Press Space or click to plan the first heist.');
  requestAnimationFrame(frame);
}

// The brief screen's lines: the plan, the par and the tools, wrapped to fit.
function wrapBrief(level) {
  const words = `${level.brief} Par ${fmtMoney(level.par)} before dawn. Tools: EMP ×2, smoke ×2.`.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((`${line} ${word}`).trim().length > 72) {
      lines.push(line.trim());
      line = word;
    } else {
      line = `${line} ${word}`;
    }
  }
  if (line.trim()) lines.push(line.trim());
  lines.push('Press Space to start the heist');
  return lines;
}

if (shot) runShot(shot);
else runGame();
