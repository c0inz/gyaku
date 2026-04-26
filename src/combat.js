// ── Combat System ──
// Bullet collision, damage calculation, hit effects

const Combat = {
  bullets: [],
  particles: [],

  reset() {
    this.bullets = [];
    this.particles = [];
  },

  addBullet(bullet) {
    this.bullets.push(bullet);
  },

  addParticle(p) {
    this.particles.push(p);
  },

  spawnHitParticles(x, y, color, count = 5) {
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(
        x, y,
        Utils.rand(-120, 120),
        Utils.rand(-120, 120),
        color,
        Utils.rand(0.2, 0.5),
        Utils.rand(2, 5)
      ));
    }
  },

  spawnDeathParticles(x, y) {
    for (let i = 0; i < 20; i++) {
      const a = Utils.rand(0, Math.PI * 2);
      const s = Utils.rand(50, 200);
      this.particles.push(new Particle(
        x, y,
        Math.cos(a) * s, Math.sin(a) * s,
        Utils.pick(['#ff4444', '#ff8844', '#ffcc00']),
        Utils.rand(0.3, 0.8),
        Utils.rand(3, 8)
      ));
    }
  },

  update(dt, player, zone) {
    // Update bullets
    for (const b of this.bullets) {
      if (!b.alive) continue;
      b.update(dt);

      // World collision
      if (ZoneManager.isWall(b.x, b.y)) {
        b.alive = false;
        ZoneManager.damageTile(b.x, b.y, b.damage);
        this.spawnHitParticles(b.x, b.y, '#888888');
        continue;
      }

      // Player bullet → enemy
      if (b.owner === 'player') {
        for (const e of zone.activeEnemies) {
          if (!e.alive) continue;
          if (Utils.dist(b, e) < e.radius + b.radius) {
            b.alive = false;
            e.takeDamage(b.damage);
            player.damageDealt += b.damage;
            this.spawnHitParticles(b.x, b.y, '#ff4444');
            if (!e.alive) {
              player.kills++;
              this.spawnDeathParticles(e.x, e.y);
              // Drop materials
              this.dropLoot(e.x, e.y, zone);
            }
            break;
          }
        }
      }

      // Enemy bullet → player
      if (b.owner === 'enemy') {
        if (Utils.dist(b, player) < player.radius + b.radius) {
          b.alive = false;
          player.takeDamage(b.damage, 'bullet');
          this.spawnHitParticles(player.x, player.y, '#00ff88');
        }
      }

      // Out of bounds
      if (b.x < 0 || b.x > ProcGen.COLS * ProcGen.TILE ||
          b.y < 0 || b.y > ProcGen.ROWS * ProcGen.TILE) {
        b.alive = false;
      }
    }

    // Update particles
    for (const p of this.particles) {
      p.update(dt);
    }

    // Cleanup
    this.bullets = this.bullets.filter(b => b.alive);
    this.particles = this.particles.filter(p => p.alive);

    // Loot pickup
    for (const l of zone.loot) {
      if (l.collected) continue;
      if (Utils.dist(player, l) < 25) {
        l.collected = true;
        player.collectLoot(l);
        this.spawnHitParticles(l.x, l.y, '#00ff88', 8);
      }
    }
  },

  dropLoot(x, y, zone) {
    if (Math.random() < 0.4) {
      zone.loot.push({
        x: x + Utils.rand(-15, 15),
        y: y + Utils.rand(-15, 15),
        type: Utils.pick(['ammo', 'health', 'material']),
        collected: false,
      });
    }
  },
};
