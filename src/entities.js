// ── Entity Management ──
// Handles bullets, particles, drops, and enemy AI state machines

class Bullet {
  constructor(x, y, angle, speed, damage, owner, color = '#ffcc00') {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.owner = owner; // 'player' or 'enemy'
    this.color = color;
    this.alive = true;
    this.life = 2.0;
    this.radius = 3;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }
}

class Particle {
  constructor(x, y, vx, vy, color, life = 0.5, size = 3) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.alive = true;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.95;
    this.vy *= 0.95;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }

  alpha() {
    return Math.max(0, this.life / this.maxLife);
  }
}

class Enemy {
  constructor(data) {
    this.x = data.x;
    this.y = data.y;
    this.type = data.type;
    this.hp = data.hp;
    this.maxHp = data.hp;
    this.speed = data.speed;
    this.damage = data.damage;
    this.fireRate = data.fireRate;
    this.range = data.range;
    this.ai = data.ai;
    this.alive = true;
    this.fireCooldown = Math.random() * this.fireRate;
    this.radius = 14;
    this.angle = 0;
    this.alertTime = 0;
    this.patrolTarget = null;
    this.hitFlash = 0;
    this.buildCooldown = 0;

    // Mirror AI state
    this.mirrorOffset = { x: 0, y: 0 };
  }

  update(dt, player, zone, addBullet, addParticle) {
    if (!this.alive) return;

    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    const distToPlayer = Utils.dist(this, player);
    const angleToPlayer = Utils.angle(this, player);
    this.angle = angleToPlayer;

    const canSee = distToPlayer < this.range && this.hasLineOfSight(player, zone);

    switch (this.ai) {
      case 'patrol':
        this.aiPatrol(dt, player, zone, canSee, distToPlayer, angleToPlayer, addBullet);
        break;
      case 'hold':
        this.aiHold(dt, player, canSee, distToPlayer, angleToPlayer, addBullet);
        break;
      case 'rush':
        this.aiRush(dt, player, zone, canSee, distToPlayer, angleToPlayer, addBullet);
        break;
      case 'turret':
        this.aiTurret(dt, player, canSee, angleToPlayer, addBullet);
        break;
    }
  }

  hasLineOfSight(target, zone) {
    // Bullets pass through windows — so should sight checks
    const T = ProcGen.TILE;
    const steps = Math.ceil(Utils.dist(this, target) / (T / 2));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const cx = Utils.lerp(this.x, target.x, t);
      const cy = Utils.lerp(this.y, target.y, t);
      const col = Math.floor(cx / T);
      const row = Math.floor(cy / T);
      if (row >= 0 && row < ProcGen.ROWS && col >= 0 && col < ProcGen.COLS) {
        const tile = zone.tiles[row][col];
        if (tile.type === 'wall' || tile.type === 'player_wall' || tile.type === 'crate') {
          return false;
        }
      }
    }
    return true;
  }

  moveToward(target, dt, zone, speed = null) {
    const s = speed || this.speed;
    const a = Utils.angle(this, target);
    const nx = this.x + Math.cos(a) * s * dt;
    const ny = this.y + Math.sin(a) * s * dt;
    if (this.canMoveTo(nx, ny, zone)) {
      this.x = nx;
      this.y = ny;
    } else if (this.canMoveTo(nx, this.y, zone)) {
      this.x = nx;
    } else if (this.canMoveTo(this.x, ny, zone)) {
      this.y = ny;
    }
  }

  canMoveTo(x, y, zone) {
    const T = ProcGen.TILE;
    const r = this.radius;
    const checks = [
      { x: x - r, y: y - r }, { x: x + r, y: y - r },
      { x: x - r, y: y + r }, { x: x + r, y: y + r },
    ];
    for (const p of checks) {
      const col = Math.floor(p.x / T);
      const row = Math.floor(p.y / T);
      if (row < 0 || row >= ProcGen.ROWS || col < 0 || col >= ProcGen.COLS) return false;
      const tile = zone.tiles[row][col];
      if (tile.type === 'wall' || tile.type === 'player_wall' || tile.type === 'player_window' ||
          tile.type === 'crate' || tile.type === 'gap' || tile.type === 'void' || tile.type === 'low_gap') return false;
    }
    return true;
  }

  shoot(angle, addBullet) {
    if (this.fireCooldown > 0) return;
    this.fireCooldown = this.fireRate;
    const spread = Utils.rand(-0.1, 0.1);
    addBullet(new Bullet(
      this.x + Math.cos(angle) * 16,
      this.y + Math.sin(angle) * 16,
      angle + spread, 400, this.damage, 'enemy', '#ff4444'
    ));
  }

  aiPatrol(dt, player, zone, canSee, dist, angle, addBullet) {
    if (canSee) {
      this.alertTime = 2;
      if (dist > 120) this.moveToward(player, dt, zone);
      this.shoot(angle, addBullet);
    } else if (this.alertTime > 0) {
      this.alertTime -= dt;
      this.moveToward(player, dt, zone);
    } else {
      // Random patrol
      if (!this.patrolTarget || Utils.dist(this, this.patrolTarget) < 20) {
        this.patrolTarget = {
          x: this.x + Utils.rand(-100, 100),
          y: this.y + Utils.rand(-100, 100),
        };
      }
      this.moveToward(this.patrolTarget, dt, zone, this.speed * 0.5);
    }
  }

  aiHold(dt, player, canSee, dist, angle, addBullet) {
    if (canSee) {
      this.shoot(angle, addBullet);
    }
  }

  aiRush(dt, player, zone, canSee, dist, angle, addBullet) {
    if (dist < 50) {
      this.shoot(angle, addBullet);
    } else {
      this.moveToward(player, dt, zone, this.speed);
    }
  }

  aiTurret(dt, player, canSee, angle, addBullet) {
    if (canSee) {
      this.shoot(angle, addBullet);
    }
  }

  aiBuilder(dt, player, zone, canSee, dist, angle, addBullet) {
    this.buildCooldown = Math.max(0, this.buildCooldown - dt);
    if (canSee) {
      if (dist > 150) {
        this.moveToward(player, dt, zone);
      }
      this.shoot(angle, addBullet);
      // Build cover
      if (this.buildCooldown <= 0) {
        const T = ProcGen.TILE;
        const bc = Math.floor(this.x / T);
        const br = Math.floor(this.y / T);
        const perpAngle = angle + Math.PI / 2;
        const wallC = bc + Math.round(Math.cos(perpAngle));
        const wallR = br + Math.round(Math.sin(perpAngle));
        if (wallR > 0 && wallR < ProcGen.ROWS - 1 && wallC > 0 && wallC < ProcGen.COLS - 1) {
          if (zone.tiles[wallR][wallC].type === 'floor') {
            zone.tiles[wallR][wallC] = { type: 'wall', hp: 80 };
            this.buildCooldown = 3;
          }
        }
      }
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.hitFlash = 0.1;
    if (this.hp <= 0) {
      this.alive = false;
    }
  }
}
