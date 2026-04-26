// ── Procedural Generation Engine ──
// Generates zone layouts, hazard placements, enemy spawns, and loot tables.
// Every run is unique. Zones get progressively harder.

const ProcGen = {
  TILE: 40,
  COLS: 24,
  ROWS: 16,

  // Zone archetypes — each has different generation rules
  ARCHETYPES: [
    'gauntlet',    // Linear corridor with timed hazards
    'arena',       // Open space, wave-based enemies
    'maze',        // Tight walls, turrets, limited visibility
    'crumble',     // Floor tiles decay — keep moving or fall
    'sniper_alley',// Long sightlines, must build cover to cross
    'storm_rush',  // Closing storm circle, reach the safe zone
    'mirror',      // Symmetrical room, enemies mirror your moves
    'ambush',      // Looks safe, then everything activates at once
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
      tiles: this.generateTiles(archetype, difficulty, rng),
      enemies: [],
      hazards: [],
      loot: [],
      triggers: [],
      spawnPoint: { x: 80, y: 320 },
      exitPoint: { x: 880, y: 320 },
      rules: [],
      timer: null,
      stormRadius: null,
      stormCenter: null,
      crumbleTiles: [],
    };

    this.populateZone(zone, archetype, difficulty, rng);
    return zone;
  },

  generateTiles(archetype, difficulty, rng) {
    const tiles = [];
    for (let r = 0; r < this.ROWS; r++) {
      tiles[r] = [];
      for (let c = 0; c < this.COLS; c++) {
        // Border walls
        if (r === 0 || r === this.ROWS - 1 || c === 0 || c === this.COLS - 1) {
          tiles[r][c] = { type: 'wall', hp: 999 };
        } else {
          tiles[r][c] = { type: 'floor', hp: 0 };
        }
      }
    }

    switch (archetype) {
      case 'gauntlet':
        this.genGauntlet(tiles, difficulty, rng);
        break;
      case 'arena':
        this.genArena(tiles, difficulty, rng);
        break;
      case 'maze':
        this.genMaze(tiles, difficulty, rng);
        break;
      case 'crumble':
        this.genCrumble(tiles, difficulty, rng);
        break;
      case 'sniper_alley':
        this.genSniperAlley(tiles, difficulty, rng);
        break;
      case 'storm_rush':
        this.genStormRush(tiles, difficulty, rng);
        break;
      case 'mirror':
        this.genMirror(tiles, difficulty, rng);
        break;
      case 'ambush':
        this.genAmbush(tiles, difficulty, rng);
        break;
    }

    return tiles;
  },

  genGauntlet(tiles, diff, rng) {
    // Vertical wall segments with gaps — you zigzag through
    for (let i = 0; i < 4 + Math.floor(diff); i++) {
      const col = 4 + Math.floor(rng() * 16);
      const gapRow = 1 + Math.floor(rng() * (this.ROWS - 4));
      const gapSize = Math.max(2, 4 - Math.floor(diff * 0.5));
      for (let r = 1; r < this.ROWS - 1; r++) {
        if (r < gapRow || r >= gapRow + gapSize) {
          tiles[r][col] = { type: 'wall', hp: 200 };
        }
      }
    }
  },

  genArena(tiles, diff, rng) {
    // Scattered cover pillars
    const pillars = 4 + Math.floor(rng() * 4);
    for (let i = 0; i < pillars; i++) {
      const r = 3 + Math.floor(rng() * (this.ROWS - 6));
      const c = 3 + Math.floor(rng() * (this.COLS - 6));
      const size = rng() > 0.5 ? 2 : 1;
      for (let dr = 0; dr < size; dr++) {
        for (let dc = 0; dc < size; dc++) {
          if (r + dr < this.ROWS - 1 && c + dc < this.COLS - 1) {
            tiles[r + dr][c + dc] = { type: 'wall', hp: 150 };
          }
        }
      }
    }
  },

  genMaze(tiles, diff, rng) {
    // Simple maze using randomized walls
    for (let r = 2; r < this.ROWS - 2; r += 2) {
      for (let c = 2; c < this.COLS - 2; c += 2) {
        if (rng() < 0.4 + diff * 0.05) {
          tiles[r][c] = { type: 'wall', hp: 120 };
          // Extend wall in random direction
          const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
          const d = dirs[Math.floor(rng() * 4)];
          const nr = r + d[0];
          const nc = c + d[1];
          if (nr > 0 && nr < this.ROWS - 1 && nc > 0 && nc < this.COLS - 1) {
            tiles[nr][nc] = { type: 'wall', hp: 120 };
          }
        }
      }
    }
  },

  genCrumble(tiles, diff, rng) {
    // Mark most floor tiles as crumble
    for (let r = 1; r < this.ROWS - 1; r++) {
      for (let c = 1; c < this.COLS - 1; c++) {
        if (tiles[r][c].type === 'floor' && rng() < 0.7) {
          tiles[r][c] = { type: 'crumble', hp: 0, timer: 1.5 + rng() * 1.5 - diff * 0.3, stepped: false };
        }
      }
    }
  },

  genSniperAlley(tiles, diff, rng) {
    // Long horizontal corridors with peek holes
    for (let r = 4; r < this.ROWS - 4; r += 4) {
      for (let c = 1; c < this.COLS - 1; c++) {
        if (rng() > 0.15) {
          tiles[r][c] = { type: 'wall', hp: 180 };
        }
      }
    }
  },

  genStormRush(tiles, diff, rng) {
    // Open field with scattered debris
    for (let i = 0; i < 6; i++) {
      const r = 2 + Math.floor(rng() * (this.ROWS - 4));
      const c = 2 + Math.floor(rng() * (this.COLS - 4));
      tiles[r][c] = { type: 'wall', hp: 100 };
    }
  },

  genMirror(tiles, diff, rng) {
    // Symmetrical layout
    for (let r = 1; r < this.ROWS - 1; r++) {
      for (let c = 1; c < Math.floor(this.COLS / 2); c++) {
        if (rng() < 0.12 + diff * 0.02) {
          tiles[r][c] = { type: 'wall', hp: 150 };
          tiles[r][this.COLS - 1 - c] = { type: 'wall', hp: 150 };
        }
      }
    }
  },

  genAmbush(tiles, diff, rng) {
    // Looks empty, just a few crates
    for (let i = 0; i < 3; i++) {
      const r = 3 + Math.floor(rng() * (this.ROWS - 6));
      const c = 3 + Math.floor(rng() * (this.COLS - 6));
      tiles[r][c] = { type: 'crate', hp: 80, loot: true };
    }
  },

  populateZone(zone, archetype, diff, rng) {
    const T = this.TILE;

    // Place exit
    const exitCol = this.COLS - 3;
    const exitRow = 1 + Math.floor(rng() * (this.ROWS - 3));
    zone.exitPoint = { x: exitCol * T + T / 2, y: exitRow * T + T / 2 };
    // Clear exit area
    zone.tiles[exitRow][exitCol] = { type: 'floor', hp: 0 };
    zone.tiles[exitRow][exitCol + 1] = { type: 'floor', hp: 0 };

    // Place spawn
    const spawnRow = 1 + Math.floor(rng() * (this.ROWS - 3));
    zone.spawnPoint = { x: 2 * T, y: spawnRow * T + T / 2 };
    zone.tiles[spawnRow][1] = { type: 'floor', hp: 0 };
    zone.tiles[spawnRow][2] = { type: 'floor', hp: 0 };

    // Enemies
    const enemyCount = Math.floor(2 + diff * 1.5 + rng() * 2);
    for (let i = 0; i < enemyCount; i++) {
      let ex, ey, attempts = 0;
      do {
        ex = (3 + Math.floor(rng() * (this.COLS - 6))) * T + T / 2;
        ey = (2 + Math.floor(rng() * (this.ROWS - 4))) * T + T / 2;
        attempts++;
      } while (Utils.dist({ x: ex, y: ey }, zone.spawnPoint) < 150 && attempts < 20);

      const type = this.pickEnemyType(archetype, diff, rng);
      zone.enemies.push({ x: ex, y: ey, type, ...this.enemyStats(type, diff) });
    }

    // Hazards
    this.placeHazards(zone, archetype, diff, rng);

    // Loot
    const lootCount = Math.floor(2 + rng() * 3);
    for (let i = 0; i < lootCount; i++) {
      const lx = (3 + Math.floor(rng() * (this.COLS - 6))) * T + T / 2;
      const ly = (2 + Math.floor(rng() * (this.ROWS - 4))) * T + T / 2;
      zone.loot.push({
        x: lx, y: ly,
        type: Utils.pick(['ammo', 'health', 'shield', 'material', 'weapon_up']),
        collected: false,
      });
    }

    // Zone-specific rules
    this.applyRules(zone, archetype, diff);

    // Storm for storm_rush
    if (archetype === 'storm_rush') {
      zone.stormCenter = { x: zone.exitPoint.x, y: zone.exitPoint.y };
      zone.stormRadius = 600;
      zone.stormShrinkRate = 15 + diff * 8;
      zone.stormMinRadius = 60;
      zone.stormDamage = 3 + diff * 2;
    }

    // Timer for timed zones
    if (archetype === 'gauntlet' || archetype === 'crumble') {
      zone.timer = Math.max(10, 25 - diff * 2);
    }
  },

  pickEnemyType(archetype, diff, rng) {
    const types = ['grunt', 'shooter', 'rusher'];
    if (diff > 1.5) types.push('turret');
    if (diff > 2.0) types.push('builder');
    if (archetype === 'sniper_alley') return rng() > 0.4 ? 'sniper' : 'shooter';
    if (archetype === 'arena') return Utils.pick(types);
    if (archetype === 'ambush') return 'rusher';
    return types[Math.floor(rng() * types.length)];
  },

  enemyStats(type, diff) {
    const base = {
      grunt:   { hp: 60, speed: 80, damage: 8, fireRate: 1.2, range: 200, ai: 'patrol' },
      shooter: { hp: 50, speed: 60, damage: 12, fireRate: 0.8, range: 350, ai: 'hold' },
      rusher:  { hp: 40, speed: 160, damage: 15, fireRate: 0.5, range: 100, ai: 'rush' },
      sniper:  { hp: 35, speed: 40, damage: 30, fireRate: 2.0, range: 500, ai: 'hold' },
      turret:  { hp: 100, speed: 0, damage: 10, fireRate: 0.3, range: 300, ai: 'turret' },
      builder: { hp: 70, speed: 90, damage: 10, fireRate: 1.0, range: 250, ai: 'builder' },
    };
    const s = { ...base[type] };
    s.hp = Math.floor(s.hp * (0.8 + diff * 0.3));
    s.damage = Math.floor(s.damage * (0.8 + diff * 0.2));
    s.speed = Math.floor(s.speed * (0.9 + diff * 0.1));
    return s;
  },

  placeHazards(zone, archetype, diff, rng) {
    const T = this.TILE;
    const count = Math.floor(2 + diff * 1.5);

    for (let i = 0; i < count; i++) {
      const hx = (3 + Math.floor(rng() * (this.COLS - 6))) * T;
      const hy = (2 + Math.floor(rng() * (this.ROWS - 4))) * T;

      const hazardTypes = ['spike_trap', 'fire_vent', 'laser'];
      if (archetype === 'gauntlet') hazardTypes.push('moving_wall');
      if (diff > 1.5) hazardTypes.push('mine');

      zone.hazards.push({
        x: hx, y: hy, w: T, h: T,
        type: hazardTypes[Math.floor(rng() * hazardTypes.length)],
        active: true,
        cycleTime: 1.5 + rng() * 2,
        cycleTimer: rng() * 3,
        damage: Math.floor(10 + diff * 5),
      });
    }
  },

  applyRules(zone, archetype, diff) {
    const rules = [];
    switch (archetype) {
      case 'gauntlet':
        rules.push('TIMED — reach the exit before time runs out');
        rules.push('Walls block your path — find the gaps or build over');
        break;
      case 'arena':
        rules.push('CLEAR ALL ENEMIES to unlock the exit');
        zone.exitLocked = true;
        break;
      case 'maze':
        rules.push('TIGHT QUARTERS — turrets cover the corridors');
        rules.push('Walls are destructible — blast your own path');
        break;
      case 'crumble':
        rules.push('FLOOR DECAYS — tiles crumble after you step on them');
        rules.push('Build bridges or keep moving');
        break;
      case 'sniper_alley':
        rules.push('LONG SIGHTLINES — build cover or get picked off');
        rules.push('Snipers deal massive damage');
        break;
      case 'storm_rush':
        rules.push('STORM CLOSING — get to the safe zone');
        rules.push('Storm deals increasing damage over time');
        break;
      case 'mirror':
        rules.push('MIRRORED — enemies copy your movements');
        rules.push('Symmetrical layout — flank carefully');
        break;
      case 'ambush':
        rules.push('LOOKS SAFE — it is not');
        rules.push('Enemies activate when you reach the center');
        zone.ambushTriggered = false;
        break;
    }
    zone.rules = rules;
  },
};
