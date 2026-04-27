// ── Renderer ──

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

    this.screenShake *= 0.9;
    const sx = (Math.random() - 0.5) * this.screenShake;
    const sy = (Math.random() - 0.5) * this.screenShake;

    ctx.save();
    ctx.translate(sx, sy);

    ctx.fillStyle = '#0d0d14';
    ctx.fillRect(0, 0, W, H);

    if (!zone) { ctx.restore(); return; }

    this.drawTiles(ctx, zone, T);
    this.drawWindowSlots(ctx, zone, T);
    if (zone.stormRadius) this.drawStorm(ctx, zone);
    this.drawHazards(ctx, zone);
    this.drawExit(ctx, zone);

    if (Building.ghostTile) this.drawBuildGhost(ctx, player, T);

    this.drawEnemies(ctx, zone);
    this.drawBullets(ctx);
    if (player.alive) this.drawPlayer(ctx, player);
    this.drawParticles(ctx);

    if (ZoneManager.zoneTransition > 0) {
      ctx.fillStyle = `rgba(10, 10, 15, ${ZoneManager.zoneTransition})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
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
            ctx.strokeStyle = '#1a1a28';
            ctx.strokeRect(x, y, T, T);
            break;

          case 'wall':
            ctx.fillStyle = tile.hp > 150 ? '#2a2a3e' : tile.hp > 80 ? '#252538' : '#1f1f30';
            ctx.fillRect(x, y, T, T);
            ctx.strokeStyle = '#33334d';
            ctx.strokeRect(x, y, T, T);
            // hp damage cracks
            if (tile.hp < 100 && tile.hp > 0) {
              ctx.strokeStyle = `rgba(255, 80, 80, ${(100 - tile.hp) / 200})`;
              ctx.beginPath();
              ctx.moveTo(x + 5, y + 5);
              ctx.lineTo(x + T - 5, y + T - 5);
              ctx.stroke();
            }
            break;

          case 'player_wall':
            ctx.fillStyle = '#2a3040';
            ctx.fillRect(x, y, T, T);
            ctx.strokeStyle = '#4a5060';
            ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
            // metal sheen
            ctx.strokeStyle = '#5a6070';
            ctx.beginPath();
            ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + 8, y + 4);
            ctx.moveTo(x + T - 8, y + T - 4); ctx.lineTo(x + T - 4, y + T - 4);
            ctx.stroke();
            break;

          case 'player_window':
            // Solid frame with a horizontal slit through the middle
            ctx.fillStyle = '#2a3040';
            ctx.fillRect(x, y, T, T);
            // Cut slit
            ctx.fillStyle = '#0a0a14';
            ctx.fillRect(x + 4, y + T / 2 - 4, T - 8, 8);
            // Frame highlight
            ctx.strokeStyle = '#6a7080';
            ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
            // Sight crosshair indicator
            ctx.strokeStyle = '#00ff8866';
            ctx.beginPath();
            ctx.moveTo(x + T / 2, y + T / 2 - 6);
            ctx.lineTo(x + T / 2, y + T / 2 + 6);
            ctx.stroke();
            break;

          case 'crate':
            ctx.fillStyle = '#3a3020';
            ctx.fillRect(x + 4, y + 4, T - 8, T - 8);
            ctx.strokeStyle = '#8a7040';
            ctx.strokeRect(x + 4, y + 4, T - 8, T - 8);
            ctx.beginPath();
            ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + T - 4, y + T - 4);
            ctx.moveTo(x + T - 4, y + 4); ctx.lineTo(x + 4, y + T - 4);
            ctx.stroke();
            break;

          case 'crumble': {
            const a = tile.stepped ? Math.max(0.1, tile.timer / 1.5) : 0.65;
            ctx.fillStyle = `rgba(80, 60, 25, ${a})`;
            ctx.fillRect(x, y, T, T);
            ctx.strokeStyle = `rgba(140, 100, 40, ${a})`;
            ctx.strokeRect(x, y, T, T);
            if (tile.stepped) {
              const j = (1 - tile.timer / 1.5) * 3;
              ctx.strokeStyle = '#ff6600';
              ctx.strokeRect(x + Math.random() * j, y + Math.random() * j, T, T);
            }
            break;
          }

          case 'gap':
            ctx.fillStyle = '#03030a';
            ctx.fillRect(x, y, T, T);
            // subtle inner shadow ring to read as "depth"
            ctx.strokeStyle = '#000';
            ctx.strokeRect(x + 2, y + 2, T - 4, T - 4);
            ctx.fillStyle = '#0a0a14';
            ctx.fillRect(x, y, T, 2);
            break;

          case 'low_gap':
            // floor with a low ceiling band drawn over the top — visually communicates "slide here"
            ctx.fillStyle = '#14141e';
            ctx.fillRect(x, y, T, T);
            ctx.strokeStyle = '#1a1a28';
            ctx.strokeRect(x, y, T, T);
            // Low overhang bands (top + bottom)
            ctx.fillStyle = '#2a2a3e';
            ctx.fillRect(x, y, T, 8);
            ctx.fillRect(x, y + T - 8, T, 8);
            // Slide hint stripes
            ctx.strokeStyle = '#00ff8866';
            for (let i = 0; i < 4; i++) {
              const sx = x + 4 + i * 9;
              ctx.beginPath();
              ctx.moveTo(sx, y + 10);
              ctx.lineTo(sx + 4, y + T - 10);
              ctx.stroke();
            }
            break;

          case 'void':
            ctx.fillStyle = '#050508';
            ctx.fillRect(x, y, T, T);
            break;
        }
      }
    }
  },

  drawWindowSlots(ctx, zone, T) {
    for (const slot of zone.windowSlots || []) {
      // Only show hint if the slot is still empty (not yet solved)
      const tile = zone.tiles[slot.row][slot.col];
      if (tile.type !== 'floor') continue;
      const x = slot.col * T;
      const y = slot.row * T;
      const pulse = 0.4 + Math.sin(Date.now() / 250) * 0.3;
      ctx.strokeStyle = `rgba(255, 200, 0, ${pulse})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x + 2, y + 2, T - 4, T - 4);
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      // "B" glyph
      ctx.fillStyle = `rgba(255, 200, 0, ${pulse})`;
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('WINDOW', x + T / 2, y + T / 2 + 4);
    }
  },

  drawStorm(ctx, zone) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.save();
    ctx.fillStyle = 'rgba(100, 0, 180, 0.3)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(zone.stormCenter.x, zone.stormCenter.y, zone.stormRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
        ctx.fillStyle = 'rgba(60, 30, 0, 0.25)';
        ctx.fillRect(h.x, h.y, h.w, h.h);
        continue;
      }
      switch (h.type) {
        case 'spike_trap':
          ctx.fillStyle = '#553300';
          ctx.fillRect(h.x, h.y, h.w, h.h);
          ctx.strokeStyle = '#ff4400';
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
          ctx.fillStyle = '#ff8800';
          ctx.fillRect(h.x + 8, h.y + 8, 6, 12);
          ctx.fillRect(h.x + 22, h.y + 14, 6, 10);
          break;
        case 'laser':
          ctx.strokeStyle = 'rgba(255, 0, 68, 0.25)';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.moveTo(h.x, h.y + h.h / 2);
          ctx.lineTo(h.x + h.w, h.y + h.h / 2);
          ctx.stroke();
          ctx.strokeStyle = '#ff0044';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(h.x, h.y + h.h / 2);
          ctx.lineTo(h.x + h.w, h.y + h.h / 2);
          ctx.stroke();
          ctx.lineWidth = 1;
          break;
      }
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
      ctx.fillStyle = '#00ff88';
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('>', ep.x, ep.y + 7);
    }
  },

  drawBuildGhost(ctx, player, T) {
    const g = Building.ghostTile;
    const isWindow = player.buildMode === 'window';
    const cost = Building.COSTS[player.buildMode];
    const canAfford = player.metal >= cost;
    const color = canAfford ? (isWindow ? 'rgba(255, 200, 0, ' : 'rgba(0, 255, 136, ')
                            : 'rgba(255, 80, 80, ';
    ctx.fillStyle = color + '0.15)';
    ctx.strokeStyle = color + '0.7)';
    ctx.fillRect(g.x, g.y, T, T);
    ctx.strokeRect(g.x, g.y, T, T);
    if (isWindow) {
      // Show the slit
      ctx.fillStyle = color + '0.5)';
      ctx.fillRect(g.x + 4, g.y + T / 2 - 4, T - 8, 8);
    }
  },

  drawEnemies(ctx, zone) {
    for (const e of zone.activeEnemies) {
      if (!e.alive) continue;
      const flash = e.hitFlash > 0;
      ctx.fillStyle = flash ? '#ffffff' :
        e.type === 'turret' ? '#884444' :
        e.type === 'sniper' ? '#448844' :
        e.type === 'rusher' ? '#886644' :
        '#884466';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff444488';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(e.angle) * 20, e.y + Math.sin(e.angle) * 20);
      ctx.stroke();
      ctx.lineWidth = 1;
      const hpW = 24;
      const hpRatio = e.hp / e.maxHp;
      ctx.fillStyle = '#330000';
      ctx.fillRect(e.x - hpW / 2, e.y - e.radius - 8, hpW, 3);
      ctx.fillStyle = hpRatio > 0.5 ? '#ff4444' : '#ff8800';
      ctx.fillRect(e.x - hpW / 2, e.y - e.radius - 8, hpW * hpRatio, 3);
      if (e.type === 'turret') {
        ctx.strokeStyle = '#ff444433';
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
      ctx.strokeStyle = b.color + '44';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.stroke();
    }
  },

  drawPlayer(ctx, player) {
    const flash = player.hitFlash > 0;
    const z = player.z;

    // Ground shadow (always at the player's grounded position)
    ctx.fillStyle = `rgba(0, 0, 0, ${0.4 - z * 0.03})`;
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 2, player.radius * (1 - z * 0.05), player.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    const drawY = player.y - z * 4;     // visual lift while jumping
    const r = player.sliding ? 8 : player.radius;

    // Slide trail
    if (player.sliding) {
      ctx.fillStyle = 'rgba(0, 255, 136, 0.18)';
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(player.x - player.vx * 0.015 * i, player.y - player.vy * 0.015 * i, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = flash ? '#ff4444' : player.airborne ? '#88ffaa' : player.sliding ? '#00ddaa' : '#00ff88';
    ctx.beginPath();
    ctx.arc(player.x, drawY, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#ff8888' : '#004422';
    ctx.beginPath();
    ctx.arc(player.x, drawY, r * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Weapon line
    ctx.strokeStyle = player.usingAxe ? '#ffcc00' : '#00ff88';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.x, drawY);
    ctx.lineTo(player.x + Math.cos(player.angle) * (r + 12), drawY + Math.sin(player.angle) * (r + 12));
    ctx.stroke();
    ctx.lineWidth = 1;

    // Axe swing arc
    if (player.swingActive) {
      const t = 1 - player.swingTimer / player.axe.swingTime;
      const arc = player.axe.arc;
      ctx.fillStyle = `rgba(255, 230, 100, ${0.5 - t * 0.5})`;
      ctx.beginPath();
      ctx.moveTo(player.x, drawY);
      ctx.arc(player.x, drawY, player.axe.range, player.angle - arc / 2, player.angle + arc / 2);
      ctx.closePath();
      ctx.fill();
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
    const hpEl = document.getElementById('hp-bar');
    const hpBar = '|'.repeat(Math.ceil(player.hp / 5));
    const hpEmpty = '.'.repeat(Math.ceil((player.maxHp - player.hp) / 5));
    hpEl.innerHTML = `HP  <span style="color:${player.hp < 30 ? '#ff3333' : '#00ff44'}">${hpBar}</span><span style="color:#333">${hpEmpty}</span> ${Math.ceil(player.hp)}`;

    // Replace shield with "movement" status
    const moveEl = document.getElementById('shield-bar');
    const tags = [];
    if (player.airborne) tags.push('<span style="color:#88ffff">AIR</span>');
    if (player.sliding) tags.push('<span style="color:#00ffaa">SLIDE</span>');
    if (player.jumpCooldown > 0) tags.push(`<span style="color:#444">jump ${player.jumpCooldown.toFixed(1)}</span>`);
    if (player.slideCooldown > 0 && !player.sliding) tags.push(`<span style="color:#444">slide ${player.slideCooldown.toFixed(1)}</span>`);
    moveEl.innerHTML = tags.join(' ') || '<span style="color:#333">grounded</span>';

    const ammoEl = document.getElementById('ammo-count');
    if (player.usingAxe) {
      ammoEl.innerHTML = `<span style="color:#ffcc00">AXE</span> [TAB to swap]`;
    } else {
      ammoEl.innerHTML = `${player.gun.name} ${player.reloading ? '<span style="color:#ffcc00">RELOAD</span>' : `${player.gun.ammo}/${player.totalAmmo}`}`;
    }

    const zoneEl = document.getElementById('zone-num');
    zoneEl.innerHTML = `ZONE ${zone.num} — ${zone.archetype.toUpperCase()}${zone.timer != null ? ` [${Math.ceil(zone.timer)}s]` : ''}`;

    const killEl = document.getElementById('kill-count');
    killEl.innerHTML = `KILLS: ${player.kills}`;

    // Material bar — repurpose to Metal + build mode
    const woodEl = document.getElementById('mat-wood');
    const brickEl = document.getElementById('mat-brick');
    const metalEl = document.getElementById('mat-metal');
    woodEl.style.display = 'none';
    brickEl.style.display = 'none';
    metalEl.textContent = `METAL: ${player.metal}  |  BUILD: ${player.buildMode.toUpperCase()} [B to toggle]`;
    metalEl.className = 'mat-item active';

    const alertEl = document.getElementById('zone-alert');
    if (ZoneManager.zoneAlertTimer > 0) {
      alertEl.style.opacity = Math.min(1, ZoneManager.zoneAlertTimer);
      alertEl.innerHTML = `ZONE ${zone.num}<br><span style="font-size:16px;color:#888">${zone.rules.join('<br>')}</span>`;
    } else {
      alertEl.style.opacity = 0;
    }
  },
};
