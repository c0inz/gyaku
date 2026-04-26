// ── Renderer ──
// Draws everything to the canvas

const Renderer = {
  canvas: null,
  ctx: null,
  screenShake: 0,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
  },

  shake(amount) {
    this.screenShake = Math.max(this.screenShake, amount);
  },

  draw(player, zone, dt) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const T = ProcGen.TILE;

    // Screen shake
    this.screenShake *= 0.9;
    const sx = (Math.random() - 0.5) * this.screenShake;
    const sy = (Math.random() - 0.5) * this.screenShake;

    ctx.save();
    ctx.translate(sx, sy);

    // Clear
    ctx.fillStyle = '#0d0d14';
    ctx.fillRect(0, 0, W, H);

    if (!zone) { ctx.restore(); return; }

    // Tiles
    this.drawTiles(ctx, zone, T);

    // Storm
    if (zone.stormRadius) {
      this.drawStorm(ctx, zone);
    }

    // Hazards
    this.drawHazards(ctx, zone);

    // Loot
    this.drawLoot(ctx, zone);

    // Exit
    this.drawExit(ctx, zone);

    // Build ghost
    if (Building.ghostTile) {
      const g = Building.ghostTile;
      ctx.fillStyle = 'rgba(0, 255, 136, 0.15)';
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
      ctx.fillRect(g.x, g.y, T, T);
      ctx.strokeRect(g.x, g.y, T, T);
    }

    // Enemies
    this.drawEnemies(ctx, zone);

    // Bullets
    this.drawBullets(ctx);

    // Player
    if (player.alive) {
      this.drawPlayer(ctx, player);
    }

    // Particles
    this.drawParticles(ctx);

    // Zone transition overlay
    if (ZoneManager.zoneTransition > 0) {
      ctx.fillStyle = `rgba(10, 10, 15, ${ZoneManager.zoneTransition})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();

    // HUD
    this.drawHUD(player, zone);
  },

  drawTiles(ctx, zone, T) {
    for (let r = 0; r < ProcGen.ROWS; r++) {
      for (let c = 0; c < ProcGen.COLS; c++) {
        const tile = zone.tiles[r][c];
        const x = c * T;
        const y = r * T;

        switch (tile.type) {
          case 'floor':
            ctx.fillStyle = '#14141e';
            ctx.fillRect(x, y, T, T);
            // Subtle grid
            ctx.strokeStyle = '#1a1a28';
            ctx.strokeRect(x, y, T, T);
            break;

          case 'wall':
            ctx.fillStyle = tile.hp > 150 ? '#2a2a3e' : tile.hp > 80 ? '#252538' : '#202030';
            ctx.fillRect(x, y, T, T);
            ctx.strokeStyle = '#333350';
            ctx.strokeRect(x, y, T, T);
            // Damage cracks
            if (tile.hp < 100) {
              ctx.strokeStyle = `rgba(255, 80, 80, ${(100 - tile.hp) / 200})`;
              ctx.beginPath();
              ctx.moveTo(x + 5, y + 5);
              ctx.lineTo(x + T - 5, y + T - 5);
              ctx.stroke();
            }
            break;

          case 'player_wall':
            const wColor = tile.material === 'wood' ? '#3a2810' :
                           tile.material === 'brick' ? '#4a2015' : '#2a3040';
            ctx.fillStyle = wColor;
            ctx.fillRect(x, y, T, T);
            ctx.strokeStyle = tile.material === 'wood' ? '#5a4020' :
                              tile.material === 'brick' ? '#6a3025' : '#4a5060';
            ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
            // HP indicator
            const hpRatio = tile.hp / Building.matHp[tile.material].wall;
            ctx.fillStyle = `rgba(0, 255, 136, ${hpRatio * 0.3})`;
            ctx.fillRect(x + 2, y + T - 4, (T - 4) * hpRatio, 2);
            break;

          case 'player_ramp':
            ctx.fillStyle = '#1a2020';
            ctx.fillRect(x, y, T, T);
            ctx.strokeStyle = '#00ff8844';
            ctx.beginPath();
            ctx.moveTo(x, y + T);
            ctx.lineTo(x + T, y);
            ctx.stroke();
            break;

          case 'crumble':
            const cAlpha = tile.stepped ? Math.max(0.1, tile.timer / 2) : 0.6;
            ctx.fillStyle = `rgba(60, 50, 20, ${cAlpha})`;
            ctx.fillRect(x, y, T, T);
            ctx.strokeStyle = `rgba(100, 80, 30, ${cAlpha})`;
            ctx.strokeRect(x, y, T, T);
            if (tile.stepped) {
              // Warning shake
              const jitter = (1 - tile.timer / 2) * 3;
              ctx.strokeStyle = '#ff6600';
              ctx.strokeRect(x + Math.random() * jitter, y + Math.random() * jitter, T, T);
            }
            break;

          case 'void':
            ctx.fillStyle = '#050508';
            ctx.fillRect(x, y, T, T);
            break;

          case 'crate':
            ctx.fillStyle = '#3a3020';
            ctx.fillRect(x + 4, y + 4, T - 8, T - 8);
            ctx.strokeStyle = '#6a5030';
            ctx.strokeRect(x + 4, y + 4, T - 8, T - 8);
            // Cross
            ctx.strokeStyle = '#8a7040';
            ctx.beginPath();
            ctx.moveTo(x + 4, y + 4);
            ctx.lineTo(x + T - 4, y + T - 4);
            ctx.moveTo(x + T - 4, y + 4);
            ctx.lineTo(x + 4, y + T - 4);
            ctx.stroke();
            break;
        }
      }
    }
  },

  drawStorm(ctx, zone) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.save();
    ctx.fillStyle = 'rgba(100, 0, 180, 0.3)';
    ctx.fillRect(0, 0, W, H);
    // Clear safe zone
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(zone.stormCenter.x, zone.stormCenter.y, zone.stormRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Storm edge
    ctx.strokeStyle = '#8800ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.arc(zone.stormCenter.x, zone.stormCenter.y, zone.stormRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
  },

  drawHazards(ctx, zone) {
    for (const h of zone.hazards) {
      if (!h.active) {
        ctx.fillStyle = 'rgba(60, 30, 0, 0.3)';
        ctx.fillRect(h.x, h.y, h.w, h.h);
        continue;
      }

      switch (h.type) {
        case 'spike_trap':
          ctx.fillStyle = '#553300';
          ctx.fillRect(h.x, h.y, h.w, h.h);
          ctx.strokeStyle = '#ff4400';
          // Spikes
          for (let i = 0; i < 3; i++) {
            const sx = h.x + 8 + i * 12;
            ctx.beginPath();
            ctx.moveTo(sx, h.y + h.h - 4);
            ctx.lineTo(sx + 6, h.y + 6);
            ctx.lineTo(sx + 12, h.y + h.h - 4);
            ctx.stroke();
          }
          break;

        case 'fire_vent':
          ctx.fillStyle = 'rgba(255, 80, 0, 0.4)';
          ctx.fillRect(h.x, h.y, h.w, h.h);
          // Flame particles
          for (let i = 0; i < 3; i++) {
            const fx = h.x + Math.random() * h.w;
            const fy = h.y + Math.random() * h.h * 0.5;
            ctx.fillStyle = Utils.pick(['#ff4400', '#ff8800', '#ffcc00']);
            ctx.fillRect(fx, fy, 4, 8);
          }
          break;

        case 'laser':
          ctx.strokeStyle = '#ff0044';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(h.x, h.y + h.h / 2);
          ctx.lineTo(h.x + h.w, h.y + h.h / 2);
          ctx.stroke();
          ctx.lineWidth = 1;
          // Glow
          ctx.strokeStyle = 'rgba(255, 0, 68, 0.2)';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.moveTo(h.x, h.y + h.h / 2);
          ctx.lineTo(h.x + h.w, h.y + h.h / 2);
          ctx.stroke();
          ctx.lineWidth = 1;
          break;

        case 'mine':
          ctx.fillStyle = '#440000';
          ctx.beginPath();
          ctx.arc(h.x + h.w / 2, h.y + h.h / 2, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ff0000';
          ctx.stroke();
          break;

        case 'moving_wall':
          ctx.fillStyle = '#3a3a50';
          ctx.fillRect(h.x, h.y, h.w, h.h);
          break;
      }
    }
  },

  drawLoot(ctx, zone) {
    for (const l of zone.loot) {
      if (l.collected) continue;
      const bob = Math.sin(Date.now() / 200) * 3;

      let color;
      switch (l.type) {
        case 'ammo': color = '#ffcc00'; break;
        case 'health': color = '#00ff44'; break;
        case 'shield': color = '#0088ff'; break;
        case 'material': color = '#8B6914'; break;
        case 'weapon_up': color = '#ff00ff'; break;
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(l.x, l.y + bob, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = color + '44';
      ctx.beginPath();
      ctx.arc(l.x, l.y + bob, 14, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  drawExit(ctx, zone) {
    const ep = zone.exitPoint;
    const T = ProcGen.TILE;
    const pulse = 0.5 + Math.sin(Date.now() / 300) * 0.3;

    if (zone.exitLocked) {
      ctx.strokeStyle = `rgba(255, 50, 50, ${pulse})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(ep.x - T / 2, ep.y - T / 2, T, T);
      ctx.lineWidth = 1;
      // Lock icon
      ctx.fillStyle = '#ff3333';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('X', ep.x, ep.y + 5);
    } else {
      ctx.fillStyle = `rgba(0, 255, 136, ${pulse * 0.3})`;
      ctx.fillRect(ep.x - T / 2, ep.y - T / 2, T, T);
      ctx.strokeStyle = `rgba(0, 255, 136, ${pulse})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(ep.x - T / 2, ep.y - T / 2, T, T);
      ctx.lineWidth = 1;
      // Arrow
      ctx.fillStyle = '#00ff88';
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('>', ep.x, ep.y + 7);
    }
  },

  drawEnemies(ctx, zone) {
    for (const e of zone.activeEnemies) {
      if (!e.alive) continue;

      const flash = e.hitFlash > 0;

      // Body
      ctx.fillStyle = flash ? '#ffffff' :
        e.type === 'turret' ? '#884444' :
        e.type === 'sniper' ? '#448844' :
        e.type === 'rusher' ? '#886644' :
        e.type === 'builder' ? '#445588' :
        '#884466';

      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();

      // Direction indicator
      ctx.strokeStyle = '#ff444488';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(e.angle) * 20, e.y + Math.sin(e.angle) * 20);
      ctx.stroke();
      ctx.lineWidth = 1;

      // HP bar
      const hpW = 24;
      const hpRatio = e.hp / e.maxHp;
      ctx.fillStyle = '#330000';
      ctx.fillRect(e.x - hpW / 2, e.y - e.radius - 8, hpW, 3);
      ctx.fillStyle = hpRatio > 0.5 ? '#ff4444' : '#ff8800';
      ctx.fillRect(e.x - hpW / 2, e.y - e.radius - 8, hpW * hpRatio, 3);

      // Type indicator for turrets
      if (e.type === 'turret') {
        ctx.strokeStyle = '#ff444444';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.range, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  },

  drawBullets(ctx) {
    for (const b of Combat.bullets) {
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      // Trail
      ctx.strokeStyle = b.color + '44';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.stroke();
    }
  },

  drawPlayer(ctx, player) {
    const flash = player.hitFlash > 0;
    const dashing = player.dashing;

    // Dash trail
    if (dashing) {
      ctx.fillStyle = 'rgba(0, 255, 136, 0.2)';
      ctx.beginPath();
      ctx.arc(player.x - player.vx * 0.02, player.y - player.vy * 0.02, player.radius + 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Body
    ctx.fillStyle = flash ? '#ff4444' : dashing ? '#00ffaa' : '#00ff88';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner circle
    ctx.fillStyle = flash ? '#ff8888' : '#004422';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Weapon direction
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(
      player.x + Math.cos(player.angle) * (player.radius + 10),
      player.y + Math.sin(player.angle) * (player.radius + 10)
    );
    ctx.stroke();
    ctx.lineWidth = 1;

    // Shield indicator
    if (player.shield > 0) {
      ctx.strokeStyle = `rgba(0, 136, 255, ${0.3 + (player.shield / player.maxShield) * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  },

  drawParticles(ctx) {
    for (const p of Combat.particles) {
      if (!p.alive) continue;
      ctx.globalAlpha = p.alpha();
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  },

  drawHUD(player, zone) {
    // HP
    const hpEl = document.getElementById('hp-bar');
    const hpBar = '|'.repeat(Math.ceil(player.hp / 5));
    const hpEmpty = '.'.repeat(Math.ceil((player.maxHp - player.hp) / 5));
    hpEl.innerHTML = `HP  <span style="color:${player.hp < 30 ? '#ff3333' : '#00ff44'}">${hpBar}</span><span style="color:#333">${hpEmpty}</span> ${Math.ceil(player.hp)}`;

    // Shield
    const shEl = document.getElementById('shield-bar');
    const shBar = '|'.repeat(Math.ceil(player.shield / 5));
    const shEmpty = '.'.repeat(Math.ceil((player.maxShield - player.shield) / 5));
    shEl.innerHTML = `SH  <span style="color:#0088ff">${shBar}</span><span style="color:#333">${shEmpty}</span> ${Math.ceil(player.shield)}`;

    // Ammo
    const w = player.weapon();
    const ammoEl = document.getElementById('ammo-count');
    ammoEl.innerHTML = `${w.name} ${player.reloading ? '<span style="color:#ffcc00">RELOADING</span>' : `${w.ammo}/${player.totalAmmo}`}`;

    // Zone
    const zoneEl = document.getElementById('zone-num');
    zoneEl.innerHTML = `ZONE ${zone.num} — ${zone.archetype.toUpperCase()}${zone.timer !== null ? ` [${Math.ceil(zone.timer)}s]` : ''}`;

    // Kills
    const killEl = document.getElementById('kill-count');
    killEl.innerHTML = `KILLS: ${player.kills}`;

    // Materials
    document.getElementById('mat-wood').textContent = `WOOD: ${player.materials.wood}`;
    document.getElementById('mat-brick').textContent = `BRICK: ${player.materials.brick}`;
    document.getElementById('mat-metal').textContent = `METAL: ${player.materials.metal}`;
    document.getElementById('mat-wood').className = `mat-item${player.currentMat === 'wood' ? ' active' : ''}`;
    document.getElementById('mat-brick').className = `mat-item${player.currentMat === 'brick' ? ' active' : ''}`;
    document.getElementById('mat-metal').className = `mat-item${player.currentMat === 'metal' ? ' active' : ''}`;

    // Zone alert
    const alertEl = document.getElementById('zone-alert');
    if (ZoneManager.zoneAlertTimer > 0) {
      alertEl.style.opacity = Math.min(1, ZoneManager.zoneAlertTimer);
      alertEl.innerHTML = `ZONE ${zone.num}<br><span style="font-size:16px;color:#888">${zone.rules.join('<br>')}</span>`;
    } else {
      alertEl.style.opacity = 0;
    }
  },
};
