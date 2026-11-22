// Shared constants and the three heists of The Gilded Vault. Every number that tunes
// how the game feels lives here, so a balance pass touches one file.
export const STEP = 1 / 60;
export const TILE = 32;
export const COLS = 40;
export const ROWS = 22;
export const WORLD_W = COLS * TILE;
export const WORLD_H = ROWS * TILE;
export const BEST_KEY = 'gilded-vault-best';

// Player tuning.
export const PLAYER = {
  radius: 11,
  walkSpeed: 132,
  sneakSpeed: 74,
  sprintSpeed: 178,
  // Carrying loot slows the thief: each $1,000 of loot costs a little pace.
  lootSlowPerThousand: 2.2,
  maxLootSlow: 34,
  grabTime: 0.45, // seconds holding E on a small loot
  vaultTime: 3.0, // seconds picking the vault door / star loot
  hackTime: 2.0, // seconds holding E on a camera panel
};

// Detection tuning: how fast a guard's suspicion fills while you are in the cone.
export const DETECT = {
  coneRange: 210,
  coneHalfAngle: 0.52, // ~60 degrees total
  sneakRange: 150, // a sneaking thief is spotted from closer
  fillPerSecond: 0.55, // in-cone, close and lit — about two seconds to a chase
  fillFar: 0.25, // in-cone but far away
  decayPerSecond: 0.5,
  chaseFill: 1, // suspicion at which a guard gives chase
  loseSeconds: 3.5, // unseen this long and the guard gives up the chase
  catchRadius: 20, // a chasing guard this close catches the thief
};

export const ALARM = {
  cameraPerSecond: 10, // alarm gained while a live camera sees the thief
  laserHit: 18, // alarm gained by crossing a live laser beam
  chasePerSecond: 5, // alarm gained while any guard is chasing
  spottedBump: 6, // one-off bump the moment a guard starts a chase
  decayPerSecond: 3.0, // alarm bleeding off while nobody sees the thief
  lockdown: 100,
};

export const TOOLS = {
  empCharges: 2, // start of each heist
  smokeCharges: 2,
  empRadius: 260,
  empDisableSeconds: 9,
  smokeRadius: 110,
  smokeSeconds: 6,
  cameraDisableSeconds: 16, // after a panel hack
};

// Map legend: '#' wall, '.' floor, 'D' display case, 'P' painting, 'g' gem pedestal,
// 'S' star loot (the big prize), 'E' getaway exit, 'T' thief start, 'C' camera mount,
// 'H' hack panel, '1'..'5' guard spawns, 'V' vault door (lockpick, 3 s, the only way
// into the star-loot room). Every row is exactly 40 tiles wide.
export const LEVELS = [
  {
    id: 'museum',
    name: 'Heist I — The Marrow Museum',
    brief:
      'The Golden Idol sleeps in the vault, top right, behind a locked vault door. Slip past five guards and two cameras, lift the Idol and any paintings on the way, then walk out the south door to the van.',
    par: 150000,
    timeLimit: 300,
    map: [
      '########################################',
      '#T.....#........#...........#..........#',
      '#......#........#...........#....S.....#',
      '#..P...D....P...#....D..D...#..........#',
      '#......D........#...........#..........#',
      '#......#....1...#.....2.....#....3.....#',
      '#..g...#........#...........#..........#',
      '###.####...######.....#######V##########',
      '#......................................#',
      '#..D......P........D...........P....g..#',
      '#..D..............................D....#',
      '#.........4.....................C......#',
      '#..P...........D......D.............P..#',
      '#......................................#',
      '######.##########.##########.###########',
      '#......#........#.....H....#...........#',
      '#..g...#...P....#..........#....P......#',
      '#......#........#.....C....#...........#',
      '#......D....5...#..........#....g......#',
      '#......#........#..........#...........#',
      '#......#...E....#..........#...........#',
      '########################################',
    ],
    lasers: [
      { x: 31, y: 2, vertical: true, len: 3, phase: 0 },
      { x: 34, y: 2, vertical: true, len: 3, phase: 0.5 },
    ],
    lootValues: { painting: 8000, gem: 15000, star: 60000 },
  },
  {
    id: 'bank',
    name: 'Heist II — Halcyon Bank Vault',
    brief:
      'The Halcyon diamond sits behind a laser corridor and five guards. The vault door needs a steady 3-second pick while the cameras sweep — bring the EMP.',
    par: 220000,
    timeLimit: 300,
    map: [
      '########################################',
      '#T....#.........#...........#..........#',
      '#.....#.........#...........#....S.....#',
      '#..P..D....P....#....D..D...#..........#',
      '#.....D.........#...........#..........#',
      '#.....#....1....#.....2.....#....3.....#',
      '#..g..#.........#...........#..........#',
      '###.#####..#######......########V#######',
      '#......................................#',
      '#..D......P.......D............P....g..#',
      '#..D...............................D...#',
      '#.........4......................C.....#',
      '#..P...........D......D..............P.#',
      '#......................................#',
      '######.##########.##########.###########',
      '#......#........#.....H....#...........#',
      '#..g...#...P....#..........#....P......#',
      '#......#........#.....C....#...........#',
      '#......D....5...#..........#....g......#',
      '#......#........#..........#...........#',
      '#......#...E....#..........#...........#',
      '########################################',
    ],
    lasers: [
      { x: 31, y: 2, vertical: true, len: 3, phase: 0 },
      { x: 34, y: 2, vertical: true, len: 3, phase: 0.5 },
      { x: 20, y: 9, vertical: false, len: 4, phase: 0.25 },
      { x: 24, y: 9, vertical: false, len: 4, phase: 0.75 },
    ],
    lootValues: { painting: 12000, gem: 22000, star: 90000 },
  },
  {
    id: 'casino',
    name: 'Heist III — The Gilded Casino',
    brief:
      'Five guards, two cameras, a double laser wall and the Crown Jewels. The par is $300,000 — only a clean ghost run gets there before dawn.',
    par: 300000,
    timeLimit: 330,
    map: [
      '########################################',
      '#T....#.........#...........#..........#',
      '#.....#.........#...........#....S.....#',
      '#..P..D....P....#....D..D...#..........#',
      '#.....D.........#...........#..........#',
      '#.....#....1....#.....2.....#....3.....#',
      '#..g..#.........#...........#..........#',
      '###.#####..#######......########V#######',
      '#......................................#',
      '#..D......P.......D............P....g..#',
      '#..D...............................D...#',
      '#.........4......................C.....#',
      '#..P...........D......D..............P.#',
      '#......................................#',
      '######.##########.##########.###########',
      '#......#........#.....H....#...........#',
      '#..g...#...P....#..........#....P......#',
      '#......#........#.....C....#...........#',
      '#......D....5...#..........#....g......#',
      '#......#........#..........#...........#',
      '#......#...E....#..........#...........#',
      '########################################',
    ],
    lasers: [
      { x: 31, y: 2, vertical: true, len: 3, phase: 0 },
      { x: 34, y: 2, vertical: true, len: 3, phase: 0.5 },
      { x: 19, y: 9, vertical: false, len: 5, phase: 0.25 },
      { x: 24, y: 9, vertical: false, len: 5, phase: 0.75 },
      { x: 10, y: 16, vertical: true, len: 3, phase: 0.1 },
    ],
    lootValues: { painting: 15000, gem: 30000, star: 120000 },
  },
];
