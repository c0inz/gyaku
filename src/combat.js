// ── Combat ──
// Bullets + axe-swing resolution. No loot drops. Particles minimized to 1-2 sparks
// on impact for feedback only.

const Combat = {
  bullets: [],
  particles: [],

  reset() {
    this.bullets = [];
    this.particles = [];
  },

  addBullet(b) { this.bullets.push(b); },
  addParticle(p) { this.particles.push(p); },

  spark(x, y, color) {
    this.particles.push(new Particle(x, y, Utils.rand(-40, 40), Utils.rand(-40, 40), color, 0.15, 2));
  },

  update(dt, player, zone) {
    // Bullets
    for (const b of this.bullets) {
      if (!b.alive) continue;
      b.update(dt);

      // Walls block bullets — windows and low_gaps do not
      if (ZoneManager.isWall(b.x, b.y)) {
        b.alive = false;
        ZoneManager.damageTile(b.x, b.y, b.damage);
        this.spark(b.x, b.y, '#888');
        continue;
      }

      if (b.owner === 'player') {
        for (const e of zone.activeEnemies) {
          if (!e.alive) continue;
          if (Utils.dist(b, e) < e.radius + b.radius) {
            b.alive = false;
            e.takeDamage(b.damage);
            player.damageDealt += b.damage;
            this.spark(b.x, b.y, '#ff6644');
            if (!e.alive) player.kills++;
            break;
          }
        }
      }

      if (b.owner === 'enemy' && !player.airborne) {
        if (Utils.dist(b, player) < player.hitboxRadius() + b.radius) {
          b.alive = false;
          player.takeDamage(b.damage, 'bullet');
          this.spark(b.x, b.y, '#00ff88');
        }
      }

      const W = ProcGen.COLS * ProcGen.TILE;
      const H = ProcGen.ROWS * ProcGen.TILE;
      if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) b.alive = false;
    }

    // Axe melee
    const axed = player.axeHits ? player.axeHits(zone.activeEnemies) : [];
    for (const e of axed) {
      e.takeDamage(player.axe.damage);
      player.damageDealt += player.axe.damage;
      this.spark(e.x, e.y, '#ffffff');
      if (!e.alive) player.kills++;
    }

    // Particles
    for (const p of this.particles) p.update(dt);

    this.bullets = this.bullets.filter(b => b.alive);
    this.particles = this.particles.filter(p => p.alive);
  },
};
