// ============================================================
// Constants (Tasks 1.4, 6.4)
// ============================================================
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 640;
const LANE_WIDTH = CANVAS_WIDTH / 3;
const LANE_CENTERS = [80, 240, 400];

const INITIAL_SPEED = 3;
const SPEED_INCREMENT = 0.0005;
const MAX_SPEED = 12;

// ============================================================
// State constants (Task 2.1)
// ============================================================
const STATE = { IDLE: 'IDLE', RUNNING: 'RUNNING', GAME_OVER: 'GAME_OVER' };

// ============================================================
// Player class (Tasks 3.1-3.5)
// ============================================================
class Player {
  constructor() {
    this.lane = 1;
    this.width = 40;
    this.height = 60;
    this.y = CANVAS_HEIGHT - 120;
  }
  get x() { return LANE_CENTERS[this.lane]; }
  get hitbox() {
    return { x: this.x - this.width/2, y: this.y - this.height/2, w: this.width, h: this.height };
  }
  draw(ctx) {
    ctx.fillStyle = '#00CFFF';
    const hb = this.hitbox;
    ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
  }
  reset() { this.lane = 1; }
}

// ============================================================
// Obstacle class (Tasks 5.1-5.4)
// ============================================================
class Obstacle {
  constructor(lane, y) {
    this.lane = lane;
    this.y = y;
    this.width = 50;
    this.height = 50;
    this.active = true;
  }
  get x() { return LANE_CENTERS[this.lane]; }
  get hitbox() {
    return { x: this.x - this.width/2, y: this.y - this.height/2, w: this.width, h: this.height };
  }
  update(speed) {
    this.y += speed;
    if (this.y - this.height/2 > CANVAS_HEIGHT) this.active = false;
  }
  draw(ctx) {
    ctx.fillStyle = '#FF4444';
    const hb = this.hitbox;
    ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
  }
}

// spawnObstacleRow (Task 5.5)
function spawnObstacleRow(y) {
  const blockedCount = Math.floor(Math.random() * 2) + 1;
  const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
  return lanes.slice(0, blockedCount).map(lane => new Obstacle(lane, y));
}

// ============================================================
// Coin class (Tasks 5.6-5.10)
// ============================================================
class Coin {
  constructor(lane, y) {
    this.lane = lane;
    this.y = y;
    this.radius = 15;
    this.active = true;
    this.collected = false;
  }
  get x() { return LANE_CENTERS[this.lane]; }
  get hitbox() {
    return { x: this.x - this.radius, y: this.y - this.radius, w: this.radius*2, h: this.radius*2 };
  }
  update(speed) {
    this.y += speed;
    if (this.y - this.radius > CANVAS_HEIGHT) this.active = false;
  }
  collect() { this.collected = true; this.active = false; }
  draw(ctx) {
    if (this.collected) return;
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================================
// SpawnManager (Tasks 5.11-5.13)
// ============================================================
const SpawnManager = {
  obstacleTimer: 0,
  coinTimer: 0,
  OBSTACLE_INTERVAL: 220,
  COIN_INTERVAL: 180,
  // Center spacing leaves 140px between a coin and an obstacle in its lane.
  MIN_COIN_OBSTACLE_DISTANCE: 180,
  hasClearance(lane, y, entities) {
    return entities.every(entity => !entity.active || entity.lane !== lane ||
      Math.abs(entity.y - y) >= this.MIN_COIN_OBSTACLE_DISTANCE);
  },
  update(speed, obstacles, coins) {
    this.obstacleTimer += speed;
    this.coinTimer += speed;
    if (this.obstacleTimer >= this.OBSTACLE_INTERVAL) {
      obstacles.push(...spawnObstacleRow(-40).filter(obstacle =>
        this.hasClearance(obstacle.lane, obstacle.y, coins)));
      this.obstacleTimer = 0;
    }
    if (this.coinTimer >= this.COIN_INTERVAL) {
      const safeLanes = [0, 1, 2].filter(lane => this.hasClearance(lane, -20, obstacles));
      if (safeLanes.length > 0) {
        coins.push(new Coin(safeLanes[Math.floor(Math.random() * safeLanes.length)], -20));
      }
      this.coinTimer = 0;
    }
  },
  reset() { this.obstacleTimer = 0; this.coinTimer = 0; }
};

// ============================================================
// InputHandler (Tasks 4.1-4.4)
// ============================================================
const InputHandler = {
  init(player, gameState) {
    window.addEventListener('keydown', (e) => {
      if (gameState.status !== STATE.RUNNING) return;
      if (e.key === 'ArrowLeft')  player.lane = Math.max(0, player.lane - 1);
      if (e.key === 'ArrowRight') player.lane = Math.min(2, player.lane + 1);
    });
  }
};

// ============================================================
// CollisionDetector (Tasks 6.1-6.3)
// ============================================================
const CollisionDetector = {
  aabbOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  },
  check(gameState) {
    const ph = gameState.player.hitbox;
    for (const obs of gameState.obstacles) {
      if (obs.active && this.aabbOverlap(ph, obs.hitbox)) {
        gameState.status = STATE.GAME_OVER;
        return;
      }
    }
    for (const coin of gameState.coins) {
      if (coin.active && this.aabbOverlap(ph, coin.hitbox)) {
        coin.collect();
        gameState.score += 1;
      }
    }
  }
};

// updateSpeed (Task 6.5)
function updateSpeed(gameState) {
  gameState.elapsedFrames++;
  gameState.speed = Math.min(MAX_SPEED, INITIAL_SPEED + gameState.elapsedFrames * SPEED_INCREMENT);
}

// UI_BUTTONS (Task 7.6)
const UI_BUTTONS = {};

// ============================================================
// Renderer (Tasks 7.1-7.5)
// ============================================================
const Renderer = {
  drawBackground(ctx) {
    ctx.fillStyle = '#1A1A2E';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.strokeStyle = '#FFFFFF44';
    ctx.lineWidth = 2;
    [LANE_WIDTH, LANE_WIDTH * 2].forEach(x => {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT); ctx.stroke();
    });
  },
  drawHUD(ctx, score) {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('\u5206\u6578\uff1a' + score, 16, 36);
  },
  _drawSemitransparentOverlay(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  },
  _drawButton(ctx, label, cx, cy) {
    const bw = 200, bh = 50;
    const bx = cx - bw/2, by = cy - bh/2;
    ctx.fillStyle = '#00CFFF';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 8);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy + 8);
    UI_BUTTONS[label] = { x: bx, y: by, w: bw, h: bh };
  },
  drawOverlay(ctx, state, score) {
    if (state === STATE.IDLE) {
      this._drawSemitransparentOverlay(ctx);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('\u4e09\u7dda\u8de8\u9177', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 60);
      this._drawButton(ctx, '\u958b\u59cb\u904a\u6232', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 20);
      ctx.textAlign = 'left';
    } else if (state === STATE.GAME_OVER) {
      this._drawSemitransparentOverlay(ctx);
      ctx.fillStyle = '#FF4444';
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('\u904a\u6232\u7d50\u675f', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 80);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '28px monospace';
      ctx.fillText('\u6700\u7d42\u5206\u6578\uff1a' + score, CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 30);
      this._drawButton(ctx, '\u91cd\u65b0\u958b\u59cb', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 40);
      ctx.textAlign = 'left';
    }
  }
};

// ============================================================
// GameState (Tasks 2.2, 2.3, 3.6)
// ============================================================
const GameState = {
  status: STATE.IDLE,
  score: 0,
  speed: INITIAL_SPEED,
  elapsedFrames: 0,
  player: null,
  obstacles: [],
  coins: [],
  reset() {
    this.status = STATE.RUNNING;
    this.score = 0;
    this.speed = INITIAL_SPEED;
    this.elapsedFrames = 0;
    this.player.reset();
    this.obstacles = [];
    this.coins = [];
  }
};
GameState.player = new Player();

// ============================================================
// Canvas & context (Task 1.5)
// ============================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// InputHandler init (Task 4.5)
InputHandler.init(GameState.player, GameState);

// Canvas click handler (Task 7.7)
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  for (const [label, btn] of Object.entries(UI_BUTTONS)) {
    if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
      if (label === '\u958b\u59cb\u904a\u6232' && GameState.status === STATE.IDLE) {
        GameState.reset(); SpawnManager.reset();
      } else if (label === '\u91cd\u65b0\u958b\u59cb' && GameState.status === STATE.GAME_OVER) {
        GameState.reset(); SpawnManager.reset();
      }
    }
  }
});

// ============================================================
// gameLoop (Tasks 1.5, 7.8)
// ============================================================
function gameLoop() {
  if (GameState.status === STATE.RUNNING) {
    updateSpeed(GameState);
    GameState.obstacles.forEach(o => o.update(GameState.speed));
    GameState.coins.forEach(c => c.update(GameState.speed));
    GameState.obstacles = GameState.obstacles.filter(o => o.active);
    GameState.coins     = GameState.coins.filter(c => c.active);
    SpawnManager.update(GameState.speed, GameState.obstacles, GameState.coins);
    CollisionDetector.check(GameState);
  }
  Renderer.drawBackground(ctx);
  GameState.coins.forEach(c => c.draw(ctx));
  GameState.player.draw(ctx);
  GameState.obstacles.forEach(o => o.draw(ctx));
  Renderer.drawHUD(ctx, GameState.score);
  Renderer.drawOverlay(ctx, GameState.status, GameState.score);
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
