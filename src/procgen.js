// ── Procedural Generation Engine ──
// Tile vocabulary:
//   floor       — walkable
//   wall        — destructible (axe primary, gun chips it)
//   crate       — drops more metal when chopped
//   gap         — pit; cross only with a jump
//   low_gap     — squeeze; cross only with a slide
//   crumble     — collapses after step
//   window_slot — designer hint: "the window must go here for the riddle"
//   player_wall / player_window — placed by player

const ProcGen = {
  TILE: 40,
  COLS: 24,
  ROWS: 16,

  // Every archetype now centers on movement-tech + axe + window-placement riddles
  ARCHETYPES: [
    'jump_chasm',      // Pits across the room — jump with timing
    'slide_corridor',  // Low ceilings — must slide to cross, then fight
    'window_lane',     // Snipers behind cover — build a WINDOW at the right slot
    'crumble_jumps',   // Crumble platforms over pits — jump between safe tiles
    'arena_pillars',   // Open arena, axe enemies fast or kite with gun
    'storm_squeeze',   // Storm closing, low_gaps in the way — slide for the safe core
    'maze_chop',       // Maze of destructible walls — axe your shortcut
    'ambush_riddle',   // Center has a window_slot — solve the line-of-sight before triggering
  ],

  generateZone(zoneNum) {
    const archetype = this.ARCHETYPES[(zoneNum - 1) % this.ARCHETYPES.length];
    const difficulty = Math.min(1 + (zoneNum - 1) * 0.15, 3.0);
    const seed = Date.now() + zoneNum * 7919;
    const rng = Utils.seededRandom(seed);

    const zone = {
      num: zoneNum,
      archetype,
      difficulty,
      tiles: this.blankTiles(),
      enemies: [],
      hazards: [],
      triggers: [],
      windowSlots: [],          // tiles marked as "the riddle answer goes here"
      spawnPoint: { x: 80, y: 320 },
      exitPoint: { x: 880, y: 320 },
      rules: [],
      timer: null,
      stormRadius: null,
      stormCenter: null,
    };

    this.layoutFor(archetype, zone, difficulty, rng);
    this.populateZone(zone, archetype, difficulty, rng);
    return zone;
  },

  blankTiles() {
    const tiles = [];
    for (let r = 0; r < this.ROWS; r++) {
      tiles[r] = [];
      for (let c = 0; c < this.COLS; c++) {
        if (r === 0 || r === this.ROWS - 1 || c === 0 || c === this.COLS - 1) {
          tiles[r][c] = { type: 'wall', hp: 999 };
        } else {
          tiles[r][c] = { type: 'floor', hp: 0 };
        }
      }
    }
    return tiles;
  },

  layoutFor(archetype, zone, diff, rng) {
    const tiles = zone.tiles;
    switch (archetype) {

      case 'jump_chasm': {
        // Two or three vertical pits across the room. Pits are 2 tiles wide.
        const chasmCount = 2 + Math.floor(diff * 0.5);
        const positions = [];
        for (let i = 0; i < chasmCount; i++) {
          const c = 5 + Math.floor((i + 1) * (this.COLS - 8) / (chasmCount + 1));
          positions.push(c);
        }
        for (const c of positions) {
          for (let r = 1; r < this.ROWS - 1; r++) {
            tiles[r][c] = { type: 'gap', hp: 0 };
            tiles[r][c + 1] = { type: 'gap', hp: 0 };
          }
          // A few "rest" tiles inside the chasm to enable double-jump-style chains
          const restRow = 2 + Math.floor(rng() * (this.ROWS - 4));
          tiles[restRow][c] = { type: 'crumble', hp: 0, timer: 1.2, stepped: false };
        }
        break;
      }

      case 'slide_corridor': {
        // Two or three horizontal walls with low_gap slits — slide to pass
        for (let i = 0; i < 2 + Math.floor(diff); i++) {
          const c = 5 + Math.floor((i + 1) * (this.COLS - 8) / (3 + Math.floor(diff)));
          const slitRow = 2 + Math.floor(rng() * (this.ROWS - 4));
          for (let r = 1; r < this.ROWS - 1; r++) {
            tiles[r][c] = { type: 'wall', hp: 200 };
          }
          tiles[slitRow][c] = { type: 'low_gap', hp: 0 };
        }
        break;
      }

      case 'window_lane': {
        // Long chambers separated by destructible walls.
        // Designer marks a window_slot — solve the riddle by building a window there.
        const dividerCol = Math.floor(this.COLS / 2);
        for (let r = 1; r < this.ROWS - 1; r++) {
          tiles[r][dividerCol] = { type: 'wall', hp: 200 };
        }
        // Two openings — one is the wrong height, one is the right height (sniper sight)
        const slotRow = 2 + Math.floor(rng() * (this.ROWS - 4));
        const decoyRow = (slotRow + 4 + Math.floor(rng() * 3)) % (this.ROWS - 2) + 1;
        tiles[slotRow][dividerCol] = { type: 'floor', hp: 0 };
        tiles[decoyRow][dividerCol] = { type: 'floor', hp: 0 };
        zone.windowSlots.push({ row: slotRow, col: dividerCol });
        break;
      }

      case 'crumble_jumps': {
        // Sea of pits with crumble stepping-stones
        for (let r = 2; r < this.ROWS - 2; r++) {
          for (let c = 4; c < this.COLS - 4; c++) {
            tiles[r][c] = { type: 'gap', hp: 0 };
          }
        }
        // Lay a stepping path of crumble tiles
        let cr = Math.floor(this.ROWS / 2);
        for (let cc = 4; cc < this.COLS - 4; cc++) {
          tiles[cr][cc] = { type: 'crumble', hp: 0, timer: 1.4, stepped: false };
          if (rng() < 0.45) cr += rng() < 0.5 ? 1 : -1;
          cr = Utils.clamp(cr, 2, this.ROWS - 3);
        }
        // A second branching path
        let cr2 = Math.floor(this.ROWS / 2);
        for (let cc = 5; cc < this.COLS - 4; cc += 2) {
          tiles[cr2 + (rng() < 0.5 ? 1 : -1)][cc] = { type: 'crumble', hp: 0, timer: 1.6, stepped: false };
        }
        break;
      }

      case 'arena_pillars': {
        // Scattered destructible cover
        const pillars = 5 + Math.floor(diff);
        for (let i = 0; i < pillars; i++) {
          const r = 3 + Math.floor(rng() * (this.ROWS - 6));
          const c = 4 + Math.floor(rng() * (this.COLS - 8));
          tiles[r][c] = { type: 'wall', hp: 120 };
          if (rng() < 0.3) tiles[r + 1] && (tiles[r + 1][c] = { type: 'wall', hp: 120 });
        }
        // A few crates — generous metal harvest if you axe them
        for (let i = 0; i < 2; i++) {
          const r = 3 + Math.floor(rng() * (this.ROWS - 6));
          const c = 4 + Math.floor(rng() * (this.COLS - 8));
          tiles[r][c] = { type: 'crate', hp: 60 };
        }
        break;
      }

      case 'storm_squeeze': {
        // A few low_gap walls between you and the safe core
        for (let i = 0; i < 2; i++) {
          const c = 6 + i * 6;
          const slitRow = 2 + Math.floor(rng() * (this.ROWS - 4));
          for (let r = 1; r < this.ROWS - 1; r++) {
            if (rng() < 0.7) tiles[r][c] = { type: 'wall', hp: 150 };
          }
          tiles[slitRow][c] = { type: 'low_gap', hp: 0 };
        }
        break;
      }

      case 'maze_chop': {
        // Dense maze of destructible walls — axe is faster than going around
        for (let r = 2; r < this.ROWS - 2; r += 2) {
          for (let c = 2; c < this.COLS - 2; c++) {
            if (rng() < 0.55) tiles[r][c] = { type: 'wall', hp: 80 };
          }
        }
        // A few crates hidden as reward
        for (let i = 0; i < 3; i++) {
          const r = 3 + Math.floor(rng() * (this.ROWS - 6));
          const c = 3 + Math.floor(rng() * (this.COLS - 6));
          tiles[r][c] = { type: 'crate', hp: 60 };
        }
        break;
      }

      case 'ambush_riddle': {
        // Open chamber. Marked window_slot near center.
        // Trigger triggers enemies — if you've placed a window facing them, you win the LOS war.
        const sr = Math.floor(this.ROWS / 2);
        const sc = Math.floor(this.COLS / 2);
        zone.windowSlots.push({ row: sr, col: sc });
        // A ring of pillars
        const ringPositions = [
          [sr - 3, sc], [sr + 3, sc], [sr, sc - 4], [sr, sc + 4],
          [sr - 2, sc - 3], [sr - 2, sc + 3], [sr + 2, sc - 3], [sr + 2, sc + 3],
        ];
        for (const [rr, cc] of ringPositions) {
          if (rr > 0 && rr < this.ROWS - 1 && cc > 0 && cc < this.COLS - 1) {
            tiles[rr][cc] = { type: 'wall', hp: 100 };
          }
        }
        break;
      }
    }
  },

  populateZone(zone, archetype, diff, rng) {
    const T = this.TILE;

    // Spawn / exit on opposite sides
    const spawnRow = Math.floor(this.ROWS / 2);
    zone.spawnPoint = { x: 2 * T, y: spawnRow * T + T / 2 };
    zone.tiles[spawnRow][1] = { type: 'floor', hp: 0 };
    zone.tiles[spawnRow][2] = { type: 'floor', hp: 0 };

    const exitRow = 1 + Math.floor(rng() * (this.ROWS - 3));
    const exitCol = this.COLS - 3;
    zone.exitPoint = { x: exitCol * T + T / 2, y: exitRow * T + T / 2 };
    zone.tiles[exitRow][exitCol] = { type: 'floor', hp: 0 };
    zone.tiles[exitRow][exitCol + 1] = { type: 'floor', hp: 0 };

    // Enemies — fewer, higher quality, encourage axe engagements
    const enemyCount = Math.floor(2 + diff * 1.2);
    for (let i = 0; i < enemyCount; i++) {
      let ex, ey, attempts = 0, valid = false;
      do {
        ex = (4 + Math.floor(rng() * (this.COLS - 8))) * T + T / 2;
        ey = (2 + Math.floor(rng() * (this.ROWS - 4))) * T + T / 2;
        const col = Math.floor(ex / T), row = Math.floor(ey / T);
        const t = zone.tiles[row][col].type;
        valid = t === 'floor' && Utils.dist({ x: ex, y: ey }, zone.spawnPoint) > 200;
        attempts++;
      } while (!valid && attempts < 25);
      if (!valid) continue;

      const type = this.pickEnemyType(archetype, diff, rng);
      zone.enemies.push({ x: ex, y: ey, type, ...this.enemyStats(type, diff) });
    }

    // Hazards — fewer, more meaningful
    this.placeHazards(zone, archetype, diff, rng);
    this.applyRules(zone, archetype, diff);

    if (archetype === 'storm_squeeze') {
      zone.stormCenter = { x: zone.exitPoint.x, y: zone.exitPoint.y };
      zone.stormRadius = 600;
      zone.stormShrinkRate = 18 + diff * 8;
      zone.stormMinRadius = 60;
      zone.stormDamage = 3 + diff * 2;
    }

    if (archetype === 'jump_chasm' || archetype === 'crumble_jumps' || archetype === 'slide_corridor') {
      zone.timer = Math.max(15, 32 - diff * 2);
    }
  },

  pickEnemyType(archetype, diff, rng) {
    if (archetype === 'window_lane' || archetype === 'ambush_riddle') {
      return rng() > 0.4 ? 'sniper' : 'turret';
    }
    if (archetype === 'arena_pillars') return Utils.pick(['shooter', 'rusher', diff > 1.5 ? 'turret' : 'grunt']);
    if (archetype === 'maze_chop') return Utils.pick(['grunt', 'rusher']);
    return Utils.pick(['grunt', 'shooter', 'rusher']);
  },

  enemyStats(type, diff) {
    const base = {
      grunt:   { hp: 60, speed: 80, damage: 8, fireRate: 1.2, range: 200, ai: 'patrol' },
      shooter: { hp: 50, speed: 60, damage: 12, fireRate: 0.8, range: 350, ai: 'hold' },
      rusher:  { hp: 40, speed: 160, damage: 15, fireRate: 0.6, range: 100, ai: 'rush' },
      sniper:  { hp: 35, speed: 40, damage: 35, fireRate: 2.2, range: 600, ai: 'hold' },
      turret:  { hp: 100, speed: 0, damage: 10, fireRate: 0.35, range: 300, ai: 'turret' },
    };
    const s = { ...base[type] };
    s.hp = Math.floor(s.hp * (0.8 + diff * 0.3));
    s.damage = Math.floor(s.damage * (0.8 + diff * 0.2));
    s.speed = Math.floor(s.speed * (0.9 + diff * 0.1));
    return s;
  },

  placeHazards(zone, archetype, diff, rng) {
    const T = this.TILE;
    const count = 1 + Math.floor(diff);
    for (let i = 0; i < count; i++) {
      const hx = (4 + Math.floor(rng() * (this.COLS - 8))) * T;
      const hy = (2 + Math.floor(rng() * (this.ROWS - 4))) * T;
      const types = ['spike_trap', 'fire_vent', 'laser'];
      zone.hazards.push({
        x: hx, y: hy, w: T, h: T,
        type: Utils.pick(types),
        active: true,
        cycleTime: 1.5 + rng() * 1.5,
        cycleTimer: rng() * 3,
        damage: Math.floor(12 + diff * 5),
      });
    }
  },

  applyRules(zone, archetype, diff) {
    const rules = [];
    switch (archetype) {
      case 'jump_chasm':
        rules.push('PITS — jump (SPACE) to cross');
        rules.push('Crumble tiles inside the chasm collapse — chain jumps');
        break;
      case 'slide_corridor':
        rules.push('LOW GAPS — slide (SHIFT) to squeeze through');
        rules.push('Walls are destructible — axe (LMB w/ axe) cuts a new path');
        break;
      case 'window_lane':
        rules.push('SNIPERS behind cover — build a WINDOW at the right slot to fire back');
        rules.push('Press B to toggle build mode (WALL <-> WINDOW). Q to place');
        zone.exitLocked = true;
        break;
      case 'crumble_jumps':
        rules.push('STEPPING STONES over the void — jump between crumble tiles');
        rules.push('Tiles collapse after one step — keep moving');
        break;
      case 'arena_pillars':
        rules.push('CLEAR ENEMIES to unlock the exit');
        rules.push('Axe enemies for a one-shot melee (high damage)');
        zone.exitLocked = true;
        break;
      case 'storm_squeeze':
        rules.push('STORM CLOSING — slide through the low gaps to reach the core');
        break;
      case 'maze_chop':
        rules.push('AXE YOUR SHORTCUT through destructible walls');
        rules.push('Walls drop METAL when broken — fuel your builds');
        break;
      case 'ambush_riddle':
        rules.push('LOOKS QUIET — center triggers the ambush');
        rules.push('Pre-build a WINDOW facing the spawn before stepping in');
        zone.ambushTriggered = false;
        break;
    }
    zone.rules = rules;
  },
};
