// ── Player ──

class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = 80;
    this.y = 320;
    this.vx = 0;
    this.vy = 0;
    this.radius = 12;
    this.speed = 200;
    this.hp = 100;
    this.maxHp = 100;
    this.shield = 50;
    this.maxShield = 100;
    this.angle = 0;
    this.alive = true;

    // Weapons
    this.weapons = [
      { name: 'AR', damage: 18, fireRate: 0.15, speed: 600, spread: 0.06, magSize: 30, ammo: 30, reloadTime: 1.8 },
      { name: 'Shotgun', damage: 10, fireRate: 0.7, speed: 500, spread: 0.25, magSize: 6, ammo: 6, reloadTime: 2.5, pellets: 5 },
      { name: 'SMG', damage: 10, fireRate: 0.08, speed: 550, spread: 0.12, magSize: 35, ammo: 35, reloadTime: 1.5 },
    ];
    this.currentWeapon = 0;
    this.fireCooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.totalAmmo = 180;

    // Building
    this.materials = { wood: 50, brick: 30, metal: 10 };
    this.currentMat = 'wood';
    this.buildCooldown = 0;

    // Movement
    this.dashCooldown = 0;
    this.dashTimer = 0;
    this.dashing = false;
    this.dashAngle = 0;

    // Stats
    this.kills = 0;
    this.damageDealt = 0;
    this.zonesCleared = 0;

    // Input
    this.keys = {};
    this.mouse = { x: 0, y: 0, down: false };
    this.hitFlash = 0;
  }

  spawn(x, y) {
    this.x = x;
    this.y = y;
  }

  weapon() {
    return this.weapons[this.currentWeapon];
  }

  update(dt, addBullet) {
    if (!this.alive) return;

    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.buildCooldown = Math.max(0, this.buildCooldown - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);

    // Reload
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        const w = this.weapon();
        const needed = w.magSize - w.ammo;
        const available = Math.min(needed, this.totalAmmo);
        w.ammo += available;
        this.totalAmmo -= available;
      }
    }

    // Aim
    this.angle = Utils.angle(this, this.mouse);

    // Dash
    if (this.dashing) {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) this.dashing = false;
      const dashSpeed = 600;
      this.vx = Math.cos(this.dashAngle) * dashSpeed;
      this.vy = Math.sin(this.dashAngle) * dashSpeed;
    } else {
      // Movement
      let mx = 0, my = 0;
      if (this.keys['w'] || this.keys['arrowup']) my -= 1;
      if (this.keys['s'] || this.keys['arrowdown']) my += 1;
      if (this.keys['a'] || this.keys['arrowleft']) mx -= 1;
      if (this.keys['d'] || this.keys['arrowright']) mx += 1;

      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my);
        mx /= len;
        my /= len;
      }

      this.vx = mx * this.speed;
      this.vy = my * this.speed;
    }

    // Apply velocity with collision
    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;

    if (!this.collidesAt(nx, ny)) {
      this.x = nx;
      this.y = ny;
    } else if (!this.collidesAt(nx, this.y)) {
      this.x = nx;
    } else if (!this.collidesAt(this.x, ny)) {
      this.y = ny;
    }

    // Clamp to world
    const T = ProcGen.TILE;
    this.x = Utils.clamp(this.x, T + this.radius, ProcGen.COLS * T - T - this.radius);
    this.y = Utils.clamp(this.y, T + this.radius, ProcGen.ROWS * T - T - this.radius);

    // Shoot
    if (this.mouse.down && !this.reloading) {
      this.shoot(addBullet);
    }
  },

  collidesAt(x, y) {
    return ZoneManager.isWall(x - this.radius, y - this.radius) ||
           ZoneManager.isWall(x + this.radius, y - this.radius) ||
           ZoneManager.isWall(x - this.radius, y + this.radius) ||
           ZoneManager.isWall(x + this.radius, y + this.radius);
  },

  shoot(addBullet) {
    if (this.fireCooldown > 0) return;
    const w = this.weapon();
    if (w.ammo <= 0) {
      this.startReload();
      return;
    }

    w.ammo--;
    this.fireCooldown = w.fireRate;

    const pellets = w.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const spread = Utils.rand(-w.spread, w.spread);
      addBullet(new Bullet(
        this.x + Math.cos(this.angle) * 18,
        this.y + Math.sin(this.angle) * 18,
        this.angle + spread, w.speed, w.damage, 'player', '#ffcc00'
      ));
    }
  },

  startReload() {
    if (this.reloading || this.totalAmmo <= 0) return;
    this.reloading = true;
    this.reloadTimer = this.weapon().reloadTime;
  },

  dash() {
    if (this.dashCooldown > 0 || this.dashing) return;
    let mx = 0, my = 0;
    if (this.keys['w']) my -= 1;
    if (this.keys['s']) my += 1;
    if (this.keys['a']) mx -= 1;
    if (this.keys['d']) mx += 1;
    if (mx === 0 && my === 0) {
      this.dashAngle = this.angle;
    } else {
      this.dashAngle = Math.atan2(my, mx);
    }
    this.dashing = true;
    this.dashTimer = 0.15;
    this.dashCooldown = 1.5;
  },

  takeDamage(amount, source) {
    if (!this.alive) return;
    this.hitFlash = 0.15;

    if (this.shield > 0) {
      const shieldDmg = Math.min(this.shield, amount);
      this.shield -= shieldDmg;
      amount -= shieldDmg;
    }
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
  },

  collectLoot(loot) {
    switch (loot.type) {
      case 'ammo':
        this.totalAmmo = Math.min(this.totalAmmo + 30, 300);
        break;
      case 'health':
        this.hp = Math.min(this.hp + 25, this.maxHp);
        break;
      case 'shield':
        this.shield = Math.min(this.shield + 25, this.maxShield);
        break;
      case 'material':
        this.materials.wood += 20;
        this.materials.brick += 10;
        this.materials.metal += 5;
        break;
      case 'weapon_up':
        const w = this.weapon();
        w.damage = Math.floor(w.damage * 1.15);
        break;
    }
  },
}
