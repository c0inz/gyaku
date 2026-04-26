// ── Utility functions ──

const Utils = {
  rand(min, max) {
    return Math.random() * (max - min) + min;
  },

  randInt(min, max) {
    return Math.floor(this.rand(min, max + 1));
  },

  pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  },

  angle(from, to) {
    return Math.atan2(to.y - from.y, to.x - from.x);
  },

  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  },

  rectOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  },

  pointInRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  },

  // Seeded random for reproducible zone layouts
  seededRandom(seed) {
    let s = seed;
    return function() {
      s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
      return (s >>> 0) / 0xFFFFFFFF;
    };
  },

  // Color helpers
  hsl(h, s, l) {
    return `hsl(${h}, ${s}%, ${l}%)`;
  },

  rgba(r, g, b, a) {
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  },

  // Timer helper
  createTimer(duration, callback) {
    return {
      remaining: duration,
      duration,
      callback,
      active: true,
      update(dt) {
        if (!this.active) return;
        this.remaining -= dt;
        if (this.remaining <= 0) {
          this.active = false;
          this.callback();
        }
      },
      progress() {
        return 1 - (this.remaining / this.duration);
      }
    };
  }
};
