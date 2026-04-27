// ── Player ──
// Movement-tech driven: axe is always equipped, jump clears gaps,
// slide passes through low gaps and is the only way through certain riddles.

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
    this.speed = 220;
    this.hp = 100;
    this.maxHp = 100;
    this.angle = 0;
    this.alive = true;

    // Axe + one ranged weapon
    this.axe = {
      name: 'AXE',
      damage: 25,            // vs enemies
      tileDamage: 100,       // huge vs walls — primary harvest tool
      swingTime: 0.35,
      range: 38,
      arc: Math.PI * 0.6,
    };
    this.gun = {
      name: 'AR',
      damage: 18,
      fireRate: 0.15,
      speed: 700,
      spread: 0.05,
      magSize: 30,
      ammo: 30,
      reloadTime: 1.8,
    };
    this.usingAxe = true;       // toggle with Tab
    this.swingTimer = 0;
    this.swingActive = false;
    this.swingHits = new Set(); // entities already hit this swing
    this.fireCooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.totalAmmo = 90;

    // Building — metal only. Two variants: solid, window.
    this.metal = 30;
    this.buildMode = 'wall';    // 'wall' or 'window'
    this.buildCooldown = 0;

    // Jump (z-axis sim for top-down)
    this.z = 0;
    this.vz = 0;
    this.airborne = false;
    this.jumpCooldown = 0;
    this.coyote = 0;            // small grace window after stepping off

    // Slide
    this.sliding = false;
    this.slideTimer = 0;
    this.slideCooldown = 0;
    this.slideDir = { x: 1, y: 0 };

    // Stats
    this.kills = 0;
    this.damageDealt = 0;
    this.zonesCleared = 0;

    this.keys = {};
    this.mouse = { x: 0, y: 0, down: false };
    this.hitFlash = 0;
  }

  spawn(x, y) {
    this.x = x;
    this.y = y;
    this.z = 0;
    this.vz = 0;
    this.airborne = false;
    this.sliding = false;
  }

  hitboxRadius() {
    return this.sliding ? 7 : this.radius;
  }

  update(dt, addBullet) {
    if (!this.alive) return;

    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.buildCooldown = Math.max(0, this.buildCooldown - dt);
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
    this.slideCooldown = Math.max(0, this.slideCooldown - dt);

    // Reload
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        const needed = this.gun.magSize - this.gun.ammo;
        const give = Math.min(needed, this.totalAmmo);
        this.gun.ammo += give;
        this.totalAmmo -= give;
      }
    }

    // Aim
    this.angle = Utils.angle(this, this.mouse);

    // Vertical (jump arc)
    if (this.airborne) {
      this.vz -= 22 * dt;          // gravity (units of "height" per s²)
      this.z += this.vz * dt;
      if (this.z <= 0) {
        this.z = 0;
        this.vz = 0;
        this.airborne = false;
      }
    }

    // Slide
    if (this.sliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) this.sliding = false;
    }

    // Axe swing window
    if (this.swingActive) {
      this.swingTimer -= dt;
      if (this.swingTimer <= 0) {
        this.swingActive = false;
        this.swingHits.clear();
      }
    }

    // Movement input
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

    let speed = this.speed;
    if (this.sliding) {
      // Slide: locked direction, fast, can't change much
      mx = this.slideDir.x;
      my = this.slideDir.y;
      speed = 460;
    } else if (this.airborne) {
      speed = this.speed * 0.85;   // slight air control loss
    }

    this.vx = mx * speed;
    this.vy = my * speed;

    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;

    if (!this.collidesAt(nx, ny)) {
      this.x = nx; this.y = ny;
    } else if (!this.collidesAt(nx, this.y)) {
      this.x = nx;
    } else if (!this.collidesAt(this.x, ny)) {
      this.y = ny;
    } else if (this.sliding) {
      // Slide canceled by hitting a wall
      this.sliding = false;
    }

    const T = ProcGen.TILE;
    this.x = Utils.clamp(this.x, T + this.radius, ProcGen.COLS * T - T - this.radius);
    this.y = Utils.clamp(this.y, T + this.radius, ProcGen.ROWS * T - T - this.radius);

    // Action
    if (this.mouse.down) {
      if (this.usingAxe) {
        this.swing();
      } else if (!this.reloading && !this.sliding) {
        this.shoot(addBullet);
      }
    }
  }

  collidesAt(x, y) {
    const r = this.hitboxRadius();
    // Airborne: walk over voids and low_gaps freely (you're in the air)
    const passLow = this.sliding || this.airborne;
    return ZoneManager.solidAt(x - r, y - r, { passLow, airborne: this.airborne }) ||
           ZoneManager.solidAt(x + r, y - r, { passLow, airborne: this.airborne }) ||
           ZoneManager.solidAt(x - r, y + r, { passLow, airborne: this.airborne }) ||
           ZoneManager.solidAt(x + r, y + r, { passLow, airborne: this.airborne });
  }

  shoot(addBullet) {
    if (this.fireCooldown > 0) return;
    if (this.gun.ammo <= 0) { this.startReload(); return; }
    this.gun.ammo--;
    this.fireCooldown = this.gun.fireRate;
    const spread = Utils.rand(-this.gun.spread, this.gun.spread);
    addBullet(new Bullet(
      this.x + Math.cos(this.angle) * 18,
      this.y + Math.sin(this.angle) * 18,
      this.angle + spread, this.gun.speed, this.gun.damage, 'player', '#ffcc00'
    ));
  }

  swing() {
    if (this.swingActive || this.fireCooldown > 0) return;
    this.swingActive = true;
    this.swingTimer = this.axe.swingTime;
    this.fireCooldown = this.axe.swingTime;
    this.swingHits.clear();

    // Hit tiles in a cone immediately — axe is the harvest/break tool
    const T = ProcGen.TILE;
    const reach = this.axe.range;
    for (let i = 0; i < 3; i++) {
      const a = this.angle + (i - 1) * 0.25;
      const tx = this.x + Math.cos(a) * reach;
      const ty = this.y + Math.sin(a) * reach;
      const harvested = ZoneManager.damageTile(tx, ty, this.axe.tileDamage);
      if (harvested) this.metal = Math.min(this.metal + harvested, 200);
    }
  }

  startReload() {
    if (this.reloading || this.totalAmmo <= 0 || this.gun.ammo === this.gun.magSize) return;
    this.reloading = true;
    this.reloadTimer = this.gun.reloadTime;
  }

  toggleWeapon() {
    this.usingAxe = !this.usingAxe;
  }

  jump() {
    if (this.airborne || this.jumpCooldown > 0) return;
    this.airborne = true;
    this.vz = 9;
    this.jumpCooldown = 0.25;
  }

  slide() {
    if (this.sliding || this.slideCooldown > 0 || this.airborne) return;
    let mx = 0, my = 0;
    if (this.keys['w']) my -= 1;
    if (this.keys['s']) my += 1;
    if (this.keys['a']) mx -= 1;
    if (this.keys['d']) mx += 1;
    if (mx === 0 && my === 0) {
      // Need momentum to slide — slide goes where you're aiming if no input
      mx = Math.cos(this.angle);
      my = Math.sin(this.angle);
    } else {
      const len = Math.hypot(mx, my);
      mx /= len; my /= len;
    }
    this.slideDir = { x: mx, y: my };
    this.sliding = true;
    this.slideTimer = 0.45;
    this.slideCooldown = 1.0;
  }

  takeDamage(amount, source) {
    if (!this.alive) return;
    // Airborne dodges ground hazards (spike, fire, void, crumble)
    const groundOnly = ['hazard', 'void'];
    if (this.airborne && groundOnly.includes(source)) return;
    this.hitFlash = 0.15;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
  }

  // Axe melee hit detection — called by combat each frame while swing is active
  axeHits(enemies) {
    if (!this.swingActive) return [];
    const hits = [];
    for (const e of enemies) {
      if (!e.alive || this.swingHits.has(e)) continue;
      const d = Utils.dist(this, e);
      if (d > this.axe.range + e.radius) continue;
      const a = Utils.angle(this, e);
      let diff = Math.abs(a - this.angle);
      while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
      if (diff <= this.axe.arc / 2) {
        this.swingHits.add(e);
        hits.push(e);
      }
    }
    return hits;
  }
}
