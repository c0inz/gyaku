// ── Building System ──
// Place walls and ramps using materials

const Building = {
  ghostTile: null, // Preview of where build will place

  matCosts: {
    wood:  { wall: 10, ramp: 10 },
    brick: { wall: 10, ramp: 10 },
    metal: { wall: 10, ramp: 10 },
  },

  matHp: {
    wood:  { wall: 100, ramp: 80 },
    brick: { wall: 150, ramp: 120 },
    metal: { wall: 200, ramp: 160 },
  },

  updateGhost(player) {
    const T = ProcGen.TILE;
    const lookDist = T * 1.5;
    const gx = player.x + Math.cos(player.angle) * lookDist;
    const gy = player.y + Math.sin(player.angle) * lookDist;
    const col = Math.floor(gx / T);
    const row = Math.floor(gy / T);

    if (row > 0 && row < ProcGen.ROWS - 1 && col > 0 && col < ProcGen.COLS - 1) {
      this.ghostTile = { col, row, x: col * T, y: row * T };
    } else {
      this.ghostTile = null;
    }
  },

  buildWall(player, zone) {
    if (player.buildCooldown > 0 || !this.ghostTile) return false;

    const mat = player.currentMat;
    const cost = this.matCosts[mat].wall;
    if (player.materials[mat] < cost) return false;

    const { row, col } = this.ghostTile;
    const tile = zone.tiles[row][col];
    if (tile.type !== 'floor' && tile.type !== 'crumble' && tile.type !== 'void') return false;

    player.materials[mat] -= cost;
    player.buildCooldown = 0.25;
    zone.tiles[row][col] = {
      type: 'player_wall',
      hp: this.matHp[mat].wall,
      material: mat,
    };

    Combat.spawnHitParticles(
      col * ProcGen.TILE + ProcGen.TILE / 2,
      row * ProcGen.TILE + ProcGen.TILE / 2,
      mat === 'wood' ? '#8B6914' : mat === 'brick' ? '#B85C38' : '#708090',
      6
    );

    return true;
  },

  buildRamp(player, zone) {
    if (player.buildCooldown > 0 || !this.ghostTile) return false;

    const mat = player.currentMat;
    const cost = this.matCosts[mat].ramp;
    if (player.materials[mat] < cost) return false;

    const { row, col } = this.ghostTile;
    const tile = zone.tiles[row][col];
    if (tile.type !== 'floor' && tile.type !== 'crumble' && tile.type !== 'void') return false;

    player.materials[mat] -= cost;
    player.buildCooldown = 0.25;
    zone.tiles[row][col] = {
      type: 'player_ramp',
      hp: this.matHp[mat].ramp,
      material: mat,
      angle: player.angle,
    };

    return true;
  },
};
