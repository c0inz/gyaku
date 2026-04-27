// ── Zone Manager ──
// Resolves tile passability with knowledge of player state (sliding, airborne).
// Slides pass low_gap. Jumps cross gap (pit). Bullets pass low_gap and player_window.

const ZoneManager = {
  currentZone: null,
  zoneTransition: 0,
  zoneAlertTimer: 0,

  loadZone(zoneNum) {
    const zone = ProcGen.generateZone(zoneNum);
    this.currentZone = zone;
    this.zoneTransition = 1.0;
    this.zoneAlertTimer = 3.5;
    zone.activeEnemies = zone.enemies.map(e => new Enemy(e));
    return zone;
  },

  update(dt, player) {
    const zone = this.currentZone;
    if (!zone) return;

    this.zoneTransition = Math.max(0, this.zoneTransition - dt);
    this.zoneAlertTimer = Math.max(0, this.zoneAlertTimer - dt);

    if (zone.timer !== null && zone.timer !== undefined) {
      zone.timer -= dt;
      if (zone.timer <= 0) player.takeDamage(999, 'time');
    }

    this.updateCrumbleTiles(dt, player, zone);
    this.updateStorm(dt, player, zone);
    this.updateHazards(dt, player, zone);
    this.checkAmbush(player, zone);

    if (this.checkExit(player, zone)) return 'next_zone';
    return null;
  },

  updateCrumbleTiles(dt, player, zone) {
    const T = ProcGen.TILE;
    for (let r = 0; r < ProcGen.ROWS; r++) {
      for (let c = 0; c < ProcGen.COLS; c++) {
        const tile = zone.tiles[r][c];
        if (tile.type === 'crumble') {
          const px = Math.floor(player.x / T);
          const py = Math.floor(player.y / T);
          // Player only steps on it if grounded
          if (px === c && py === r && !player.airborne) tile.stepped = true;
          if (tile.stepped) {
            tile.timer -= dt;
            if (tile.timer <= 0) zone.tiles[r][c] = { type: 'gap', hp: 0 };
          }
        }
      }
    }
    // Standing on a gap = falling, unless airborne
    const pc = Math.floor(player.x / T);
    const pr = Math.floor(player.y / T);
    if (pr >= 0 && pr < ProcGen.ROWS && pc >= 0 && pc < ProcGen.COLS) {
      const t = zone.tiles[pr][pc].type;
      if ((t === 'gap' || t === 'void') && !player.airborne) {
        player.takeDamage(8 * dt * 60, 'void');
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
    for (const h of zone.hazards) {
      h.cycleTimer += dt;
      const cyclePos = h.cycleTimer % (h.cycleTime * 2);
      h.active = cyclePos < h.cycleTime;
      if (h.active && Utils.pointInRect(player.x, player.y, h)) {
        player.takeDamage(h.damage * dt, 'hazard');
      }
    }
  },

  checkAmbush(player, zone) {
    if (zone.archetype !== 'ambush' || zone.ambushTriggered) return;
    const T = ProcGen.TILE;
    const cx = (ProcGen.COLS / 2) * T;
    const cy = (ProcGen.ROWS / 2) * T;
    if (Utils.dist(player, { x: cx, y: cy }) < 120) {
      zone.ambushTriggered = true;
      for (const e of zone.activeEnemies) {
        e.alertTime = 99;
        e.ai = 'rush';
        e.speed *= 1.5;
      }
    }
  },

  checkExit(player, zone) {
    if (zone.exitLocked) {
      if (zone.activeEnemies.filter(e => e.alive).length === 0) zone.exitLocked = false;
      else return false;
    }
    return Utils.dist(player, zone.exitPoint) < 30;
  },

  // Solid for the player (movement). Slides squeeze through low_gap.
  // Airborne crosses gaps (pit) and ignores low ceilings.
  solidAt(x, y, opts = {}) {
    const zone = this.currentZone;
    if (!zone) return true;
    const T = ProcGen.TILE;
    const c = Math.floor(x / T);
    const r = Math.floor(y / T);
    if (r < 0 || r >= ProcGen.ROWS || c < 0 || c >= ProcGen.COLS) return true;
    const t = zone.tiles[r][c].type;
    if (t === 'wall' || t === 'player_wall' || t === 'crate' || t === 'player_window') return true;
    if (t === 'low_gap') return !opts.passLow;     // only pass if sliding/airborne
    if (t === 'gap') return !opts.airborne;        // only pass if airborne
    return false;
  },

  // For bullets and enemies (their own collision shape).
  // Bullets pass through windows and low_gaps. Enemies are blocked by walls/windows.
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

  // Returns metal harvested (0 if none).
  damageTile(x, y, amount) {
    const zone = this.currentZone;
    if (!zone) return 0;
    const T = ProcGen.TILE;
    const c = Math.floor(x / T);
    const r = Math.floor(y / T);
    if (r < 0 || r >= ProcGen.ROWS || c < 0 || c >= ProcGen.COLS) return 0;
    const tile = zone.tiles[r][c];
    let harvested = 0;
    if (tile.type === 'wall' || tile.type === 'player_wall' ||
        tile.type === 'player_window' || tile.type === 'crate') {
      tile.hp -= amount;
      if (tile.hp <= 0) {
        // Axe-broken walls grant metal — harvest is the resource economy
        harvested = tile.type === 'wall' ? 6 :
                    tile.type === 'crate' ? 12 :
                    tile.type === 'player_wall' ? 4 : 3;
        zone.tiles[r][c] = { type: 'floor', hp: 0 };
      }
    }
    return harvested;
  },
};
