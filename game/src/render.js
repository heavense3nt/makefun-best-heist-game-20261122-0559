// The painter: everything the thief sees, drawn on one canvas. Dark museum at
// night, warm pools of light, and danger shown in colour — red cones, gold loot,
// green cover — so the room reads at a glance even shrunk to a screenshot.
import { COLS, ROWS, TILE, WORLD_H, WORLD_W } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_BRIEF = 'brief';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const FLOOR_A = '#2d2a3c';
const FLOOR_B = '#322f42';
const CARPET = '#4a343d';
const WALL = '#5d5678';
const WALL_TOP = '#837aab';

function drawCone(ctx, x, y, angle, range, halfAngle, fill, edge) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD_W;
  canvas.height = WORLD_H;

  function drawFloor(state) {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const tile = state.tiles[row][col];
        const x = col * TILE;
        const y = row * TILE;
        if (tile === '#') {
          ctx.fillStyle = WALL;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = WALL_TOP;
          ctx.fillRect(x, y, TILE, 5);
        } else {
          ctx.fillStyle = (col + row) % 2 === 0 ? FLOOR_A : FLOOR_B;
          ctx.fillRect(x, y, TILE, TILE);
          // A carpet runner down the main hall (row 8..13) so routes read clearly.
          if (row >= 8 && row <= 13) {
            ctx.fillStyle = CARPET;
            ctx.fillRect(x, y, TILE, TILE);
          }
        }
        if (tile === 'D') {
          ctx.fillStyle = '#57452a';
          ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = '#8a6d3b';
          ctx.fillRect(x + 7, y + 7, TILE - 14, TILE - 14);
          ctx.fillStyle = '#d9b36a';
          ctx.fillRect(x + 11, y + 11, TILE - 22, TILE - 22);
        }
      }
    }
  }

  function drawLoot(state) {
    for (const item of state.loot) {
      if (item.taken) continue;
      const pulse = 0.6 + 0.4 * Math.sin(state.time * 3 + item.x);
      if (item.kind === 'painting') {
        ctx.fillStyle = '#7a5c2e';
        ctx.fillRect(item.x - 13, item.y - 10, 26, 20);
        ctx.fillStyle = '#c9a35c';
        ctx.fillRect(item.x - 10, item.y - 7, 20, 14);
        ctx.fillStyle = '#3f6d8e';
        ctx.fillRect(item.x - 7, item.y - 4, 8, 8);
        ctx.fillStyle = '#e8d27a';
        ctx.beginPath();
        ctx.arc(item.x + 5, item.y - 2, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.kind === 'gem') {
        ctx.fillStyle = `rgba(120, 220, 255, ${pulse})`;
        ctx.beginPath();
        ctx.moveTo(item.x, item.y - 10);
        ctx.lineTo(item.x + 9, item.y);
        ctx.lineTo(item.x, item.y + 10);
        ctx.lineTo(item.x - 9, item.y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#e8fbff';
        ctx.beginPath();
        ctx.moveTo(item.x, item.y - 5);
        ctx.lineTo(item.x + 4, item.y);
        ctx.lineTo(item.x, item.y + 5);
        ctx.lineTo(item.x - 4, item.y);
        ctx.closePath();
        ctx.fill();
      } else {
        // The star loot: a golden idol on a pedestal, glowing.
        const glow = ctx.createRadialGradient(item.x, item.y, 4, item.x, item.y, 46);
        glow.addColorStop(0, `rgba(255, 215, 90, ${0.55 * pulse})`);
        glow.addColorStop(1, 'rgba(255, 215, 90, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(item.x, item.y, 46, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5a4632';
        ctx.fillRect(item.x - 12, item.y + 6, 24, 8);
        ctx.fillStyle = '#ffd75a';
        ctx.beginPath();
        ctx.moveTo(item.x, item.y - 14);
        ctx.lineTo(item.x + 8, item.y + 4);
        ctx.lineTo(item.x - 8, item.y + 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff3c4';
        ctx.beginPath();
        ctx.arc(item.x, item.y - 6, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawLasers(state) {
    for (const laser of state.lasers) {
      if (!laser.on) continue;
      const blink = 0.55 + 0.45 * Math.sin(state.time * 6 + laser.phase);
      ctx.strokeStyle = `rgba(255, 60, 70, ${blink})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (laser.vertical) {
        ctx.moveTo(laser.xPx, laser.yPx);
        ctx.lineTo(laser.xPx, laser.yPx + laser.len * TILE);
      } else {
        ctx.moveTo(laser.xPx, laser.yPx);
        ctx.lineTo(laser.xPx + laser.len * TILE, laser.yPx);
      }
      ctx.stroke();
      ctx.fillStyle = '#ff3c46';
      ctx.beginPath();
      ctx.arc(laser.xPx, laser.yPx, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCameras(state) {
    for (const camera of state.cameras) {
      const disabled = state.time < camera.disabledUntil || state.time < state.empUntil;
      if (!disabled) {
        drawCone(ctx, camera.x, camera.y, camera.angle, 250, 0.5, 'rgba(255, 80, 60, 0.13)', 'rgba(255, 80, 60, 0.35)');
      }
      ctx.fillStyle = disabled ? '#3a3a44' : '#c33';
      ctx.beginPath();
      ctx.arc(camera.x, camera.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (disabled) {
        ctx.strokeStyle = '#888';
        ctx.beginPath();
        ctx.moveTo(camera.x - 5, camera.y - 5);
        ctx.lineTo(camera.x + 5, camera.y + 5);
        ctx.moveTo(camera.x + 5, camera.y - 5);
        ctx.lineTo(camera.x - 5, camera.y + 5);
        ctx.stroke();
      }
    }
    if (state.hackPanel) {
      ctx.fillStyle = '#2f7d5a';
      ctx.fillRect(state.hackPanel.x - 8, state.hackPanel.y - 8, 16, 16);
      ctx.fillStyle = '#7fe0ae';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', state.hackPanel.x, state.hackPanel.y + 0.5);
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      const chasing = guard.mode === 'chase';
      const suspicious = guard.mode === 'suspicious' || guard.suspicion > 0.25;
      const range = chasing ? 230 : 210;
      const fill = chasing
        ? 'rgba(255, 40, 40, 0.22)'
        : suspicious
          ? 'rgba(255, 170, 40, 0.16)'
          : 'rgba(255, 220, 120, 0.10)';
      const edge = chasing ? 'rgba(255, 40, 40, 0.5)' : suspicious ? 'rgba(255, 170, 40, 0.4)' : 'rgba(255, 220, 120, 0.25)';
      drawCone(ctx, guard.x, guard.y, guard.dir, range, 0.52, fill, edge);
      // Body: dark uniform with a cap, plus a suspicion ring that fills up.
      ctx.fillStyle = '#2b3a55';
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = chasing ? '#ff4040' : '#9db6d8';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#1c2636';
      ctx.beginPath();
      ctx.arc(guard.x, guard.y - 3, 6, 0, Math.PI * 2);
      ctx.fill();
      if (guard.suspicion > 0.05) {
        ctx.strokeStyle = chasing ? '#ff4040' : '#ffb020';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(guard.x, guard.y, 16, -Math.PI / 2, -Math.PI / 2 + guard.suspicion * Math.PI * 2);
        ctx.stroke();
      }
      if (chasing || guard.suspicion > 0.6) {
        ctx.fillStyle = chasing ? '#ff4040' : '#ffb020';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('!', guard.x, guard.y - 18);
      }
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    // A soft shadow of cover: sneaking thieves hug the dark.
    if (player.sneaking) {
      ctx.fillStyle = 'rgba(120, 160, 255, 0.10)';
      ctx.beginPath();
      ctx.arc(player.x, player.y, 20, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e8e4da';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Facing tick and a little mask.
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + Math.cos(player.dir) * 15, player.y + Math.sin(player.dir) * 15);
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.fillRect(player.x - 6, player.y - 4, 12, 3);
    if (state.channel) {
      const p = state.channel.progress / state.channel.needed;
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 18, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#ffd75a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 18, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawSmoke(state) {
    for (const smoke of state.smokes) {
      if (state.time > smoke.until) continue;
      const fade = Math.min(1, (smoke.until - state.time) / 1.5);
      const g = ctx.createRadialGradient(smoke.x, smoke.y, 10, smoke.x, smoke.y, 110);
      g.addColorStop(0, `rgba(200, 200, 210, ${0.5 * fade})`);
      g.addColorStop(1, 'rgba(200, 200, 210, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(smoke.x, smoke.y, 110, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawExit(state) {
    const x = state.exit.x;
    const y = state.exit.y;
    const pulse = 0.5 + 0.5 * Math.sin(state.time * 2.5);
    ctx.fillStyle = state.starTaken ? `rgba(80, 220, 120, ${0.35 + 0.3 * pulse})` : 'rgba(80, 220, 120, 0.2)';
    ctx.fillRect(x - 16, y - 16, 32, 32);
    ctx.strokeStyle = '#50dc78';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 16, y - 16, 32, 32);
    ctx.fillStyle = '#a9f5c3';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', x, y);
    if (state.starTaken) {
      ctx.fillStyle = '#eafff0';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('VAN WAITS — GO!', x, y - 26);
    }
  }

  function drawVaultDoor(state) {
    if (!state.vaultDoor || state.vaultOpen) return;
    const d = state.vaultDoor;
    ctx.fillStyle = '#8a7a3a';
    ctx.fillRect(d.x - 16, d.y - 16, 32, 32);
    ctx.fillStyle = '#c9a94a';
    ctx.fillRect(d.x - 11, d.y - 11, 22, 22);
    ctx.fillStyle = '#3a2f14';
    ctx.beginPath();
    ctx.arc(d.x, d.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VAULT', d.x, d.y - 22);
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(8, 8, 14, 0.72)';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillText(title, WORLD_W / 2, WORLD_H / 2 - 70);
    ctx.fillStyle = '#e8e4da';
    ctx.font = '17px Georgia, serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, WORLD_W / 2, WORLD_H / 2 - 18 + i * 28);
    });
  }

  function draw(state, screen, extra) {
    ctx.clearRect(0, 0, WORLD_W, WORLD_H);
    drawFloor(state);
    drawExit(state);
    drawVaultDoor(state);
    drawLoot(state);
    drawLasers(state);
    drawCameras(state);
    drawGuards(state);
    drawSmoke(state);
    drawPlayer(state);
    if (screen === SCREEN_TITLE) {
      overlay('THE GILDED VAULT', ['A midnight heist in three acts.', 'WASD move · Shift sneak · E grab & pick · Q smoke · F EMP', 'Press Space or click to plan the first heist'], '#ffd75a');
    } else if (screen === SCREEN_BRIEF) {
      overlay(extra?.levelName ?? 'Plan the heist', extra?.briefLines ?? [], '#9fd0ff');
    } else if (screen === SCREEN_PAUSED) {
      overlay('PAUSED', ['The guards wait for no one — except now.', 'Space to keep moving'], '#9fd0ff');
    } else if (screen === SCREEN_OVER) {
      const why = extra?.why ?? 'The alarm hit lockdown and the doors sealed.';
      overlay('BUSTED', [why, `Loot kept: $${(extra?.loot ?? 0).toLocaleString('en-US')}`, 'Press Space to try the heist again'], '#ff5a5a');
    } else if (screen === SCREEN_WIN) {
      overlay('CLEAN GETAWAY', [
        `${extra?.levelName ?? ''} — the van is already moving.`,
        `Loot $${(extra?.loot ?? 0).toLocaleString('en-US')} · time bonus $${(extra?.timeBonus ?? 0).toLocaleString('en-US')}`,
        `Score $${(extra?.score ?? 0).toLocaleString('en-US')}${extra?.ghost ? ' · GHOST — never seen once' : ''}`,
        'Press Space for the next heist',
      ], '#7dff9e');
    }
  }

  return { draw };
}
