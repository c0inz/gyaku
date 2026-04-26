// ── Game Loop ──

const game = {
  player: new Player(),
  running: false,
  startTime: 0,
  currentZone: 1,
  lastTime: 0,

  start() {
    document.getElementById('title-screen').style.display = 'none';
    Renderer.init();
    this.reset();
    this.running = true;
    this.startTime = Date.now();
    this.lastTime = performance.now();
    this.setupInput();
    this.loop();
  },

  reset() {
    this.player.reset();
    this.currentZone = 1;
    Combat.reset();
    const zone = ZoneManager.loadZone(1);
    this.player.spawn(zone.spawnPoint.x, zone.spawnPoint.y);
  },

  restart() {
    document.getElementById('death-screen').style.display = 'none';
    this.reset();
    this.running = true;
    this.startTime = Date.now();
    this.lastTime = performance.now();
    this.loop();
  },

  setupInput() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.player.keys[key] = true;

      switch (key) {
        case 'r':
          this.player.startReload();
          break;
        case 'q':
          Building.buildWall(this.player, ZoneManager.currentZone);
          break;
        case 'e':
          Building.buildRamp(this.player, ZoneManager.currentZone);
          break;
        case ' ':
          e.preventDefault();
          this.player.dash();
          break;
        case '1':
          this.player.currentMat = 'wood';
          break;
        case '2':
          this.player.currentMat = 'brick';
          break;
        case '3':
          this.player.currentMat = 'metal';
          break;
        case 'tab':
          e.preventDefault();
          this.player.currentWeapon = (this.player.currentWeapon + 1) % this.player.weapons.length;
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.player.keys[e.key.toLowerCase()] = false;
    });

    const canvas = document.getElementById('game');
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.player.mouse.x = e.clientX - rect.left;
      this.player.mouse.y = e.clientY - rect.top;
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.player.mouse.down = true;
    });

    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.player.mouse.down = false;
    });

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      // Right click = quick build wall
      Building.buildWall(this.player, ZoneManager.currentZone);
    });
  },

  loop() {
    if (!this.running) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05); // Cap at 50ms
    this.lastTime = now;

    this.update(dt);
    this.render(dt);

    requestAnimationFrame(() => this.loop());
  },

  update(dt) {
    const zone = ZoneManager.currentZone;
    if (!zone) return;

    // Player
    this.player.update(dt, (b) => Combat.addBullet(b));

    // Building ghost
    Building.updateGhost(this.player);

    // Enemies
    for (const e of zone.activeEnemies) {
      e.update(dt, this.player, zone,
        (b) => Combat.addBullet(b),
        (p) => Combat.addParticle(p)
      );
    }

    // Combat
    Combat.update(dt, this.player, zone);

    // Zone mechanics
    const zoneResult = ZoneManager.update(dt, this.player);
    if (zoneResult === 'next_zone') {
      this.nextZone();
    }

    // Screen shake on player hit
    if (this.player.hitFlash > 0.14) {
      Renderer.shake(8);
    }

    // Death
    if (!this.player.alive) {
      this.running = false;
      this.showDeath();
    }
  },

  nextZone() {
    this.currentZone++;
    this.player.zonesCleared++;
    Combat.reset();
    const zone = ZoneManager.loadZone(this.currentZone);
    this.player.spawn(zone.spawnPoint.x, zone.spawnPoint.y);
    // Heal a bit between zones
    this.player.hp = Math.min(this.player.hp + 20, this.player.maxHp);
    this.player.shield = Math.min(this.player.shield + 10, this.player.maxShield);
    // Refill some ammo
    this.player.totalAmmo += 30;
  },

  render(dt) {
    Renderer.draw(this.player, ZoneManager.currentZone, dt);
  },

  showDeath() {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;

    document.getElementById('death-zone').textContent = `Reached Zone ${this.currentZone} (${ZoneManager.currentZone?.archetype || '?'})`;
    document.getElementById('death-kills').textContent = `Kills: ${this.player.kills}`;
    document.getElementById('death-time').textContent = `Time: ${mins}:${secs.toString().padStart(2, '0')}`;
    document.getElementById('death-screen').style.display = 'flex';
  },
};
