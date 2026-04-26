// ── Zone Manager ──
// Handles zone transitions, zone-specific mechanics, and rule enforcement

const ZoneManager = {
  currentZone: null,
  zoneTransition: 0,
  zoneAlertTimer: 0,

  loadZone(zoneNum) {
    const zone = ProcGen.generateZone(zoneNum);
    this.currentZone = zone;
    this.zoneTransition = 1.0;
    this.zoneAlertTimer = 3.0;

    // Spawn enemies
    zone.activeEnemies = zone.enemies.map(e => new Enemy(e));

    return zone;
  },

  update(dt, player) {
    const zone = this.currentZone;
    if (!zone) return;

    this.zoneTransition = Math.max(0, this.zoneTransition - dt);
    this.zoneAlertTimer = Math.max(0, this.zoneAlertTimer - dt);

    // Zone timer
    if (zone.timer !== null) {
      zone.timer -= dt;
      if (zone.timer <= 0) {
        player.takeDamage(999, 'time');
      }
    }

    // Crumble tiles
    this.updateCrumbleTiles(dt, player, zone);

    // Storm
    this.updateStorm(dt, player, zone);

    // Hazards
    this.updateHazards(dt, player, zone);

    // Ambush trigger
    this.checkAmbush(player, zone);

    // Check exit
    if (this.checkExit(player, zone)) {
      return 'next_zone';
    }

    return null;
  },

  updateCrumbleTiles(dt, player, zone) {
    const T = ProcGen.TILE;
    for (let r = 0; r < ProcGen.ROWS; r++) {
      for (let c = 0; c < ProcGen.COLS; c++) {
        const tile = zone.tiles[r][c];
        if (tile.type === 'crumble') {
          // Check if player is standing on it
          const px = Math.floor(player.x / T);
          const py = Math.floor(player.y / T);
          if (px === c && py === r) {
            tile.stepped = true;
          }
          if (tile.stepped) {
            tile.timer -= dt;
            if (tile.timer <= 0) {
              zone.tiles[r][c] = { type: 'void', hp: 0 };
            }
          }
        }
      }
    }
    // Check if player is on void
    const pc = Math.floor(player.x / T);
    const pr = Math.floor(player.y / T);
    if (pr >= 0 && pr < ProcGen.ROWS && pc >= 0 && pc < ProcGen.COLS) {
      if (zone.tiles[pr][pc].type === 'void') {
        player.takeDamage(5 * dt * 60, 'void');
      }
    }
  },

  updateStorm(dt, player, zone) {
    if (!zone.stormRadius) return;
    zone.stormRadius = Math.max(zone.stormMinRadius, zone.stormRadius - zone.stormShrinkRate * dt);
    const distFromCenter = Utils.dist(player, zone.stormCenter);
    if (distFromCenter > zone.stormRadius) {
      player.takeDamage(zone.stormDamage * dt * 60, 'storm');
    }
  },

  updateHazards(dt, player, zone) {
    const T = ProcGen.TILE;
    for (const h of zone.hazards) {
      h.cycleTimer += dt;
      const cyclePos = h.cycleTimer % (h.cycleTime * 2);
      h.active = cyclePos < h.cycleTime;

      if (h.active) {
        if (Utils.pointInRect(player.x, player.y, h)) {
          player.takeDamage(h.damage * dt, 'hazard');
        }
      }
    }
  },

  checkAmbush(player, zone) {
    if (zone.archetype !== 'ambush' || zone.ambushTriggered) return;
    const T = ProcGen.TILE;
    const centerX = (ProcGen.COLS / 2) * T;
    const centerY = (ProcGen.ROWS / 2) * T;
    if (Utils.dist(player, { x: centerX, y: centerY }) < 120) {
      zone.ambushTriggered = true;
      // Activate all enemies — they rush
      for (const e of zone.activeEnemies) {
        e.alertTime = 99;
        e.ai = 'rush';
        e.speed *= 1.5;
      }
    }
  },

  checkExit(player, zone) {
    if (zone.exitLocked) {
      const alive = zone.activeEnemies.filter(e => e.alive).length;
      if (alive === 0) zone.exitLocked = false;
      else return false;
    }
    return Utils.dist(player, zone.exitPoint) < 30;
  },

  isWall(x, y) {
    const zone = this.currentZone;
    if (!zone) return true;
    const T = ProcGen.TILE;
    const c = Math.floor(x / T);
    const r = Math.floor(y / T);
    if (r < 0 || r >= ProcGen.ROWS || c < 0 || c >= ProcGen.COLS) return true;
    const t = zone.tiles[r][c].type;
    return t === 'wall' || t === 'player_wall' || t === 'crate';
  },

  damageTile(x, y, amount) {
    const zone = this.currentZone;
    if (!zone) return;
    const T = ProcGen.TILE;
    const c = Math.floor(x / T);
    const r = Math.floor(y / T);
    if (r < 0 || r >= ProcGen.ROWS || c < 0 || c >= ProcGen.COLS) return;
    const tile = zone.tiles[r][c];
    if (tile.type === 'wall' || tile.type === 'player_wall' || tile.type === 'player_ramp' || tile.type === 'crate') {
      tile.hp -= amount;
      if (tile.hp <= 0) {
        const wasLoot = tile.loot;
        zone.tiles[r][c] = { type: 'floor', hp: 0 };
        if (wasLoot) {
          zone.loot.push({
            x: c * T + T / 2, y: r * T + T / 2,
            type: Utils.pick(['ammo', 'health', 'shield', 'material']),
            collected: false,
          });
        }
      }
    }
  },
};
