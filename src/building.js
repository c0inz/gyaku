// ── Building System ──
// Metal only. Two variants: WALL (solid) or WINDOW (shoot through, can't walk through).
// Window placement is the core building riddle — wrong height/wrong column and the
// enemy line-of-sight cuts you down.

const Building = {
  ghostTile: null,

  COSTS: { wall: 8, window: 12 },
  HP:    { wall: 180, window: 140 },

  updateGhost(player) {
    const T = ProcGen.TILE;
    const lookDist = T * 1.4;
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

  build(player, zone) {
    if (player.buildCooldown > 0 || !this.ghostTile) return false;

    const variant = player.buildMode;       // 'wall' or 'window'
    const cost = this.COSTS[variant];
    if (player.metal < cost) return false;

    const { row, col } = this.ghostTile;
    const tile = zone.tiles[row][col];
    if (tile.type !== 'floor' && tile.type !== 'crumble' && tile.type !== 'void' && tile.type !== 'low_gap') {
      return false;
    }

    player.metal -= cost;
    player.buildCooldown = 0.18;

    if (variant === 'wall') {
      zone.tiles[row][col] = { type: 'player_wall', hp: this.HP.wall, material: 'metal' };
    } else {
      zone.tiles[row][col] = { type: 'player_window', hp: this.HP.window, material: 'metal' };
    }
    return true;
  },

  toggleMode(player) {
    player.buildMode = player.buildMode === 'wall' ? 'window' : 'wall';
  },
};
