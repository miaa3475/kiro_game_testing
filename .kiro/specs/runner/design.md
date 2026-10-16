# 三線跑酷遊戲 — 技術設計文件

## 1. 技術架構概覽

### 檔案結構

```
docs/
├── index.html   # 頁面骨架，包含 <canvas> 元素與載入腳本
├── style.css    # 頁面基礎樣式（body 背景、canvas 置中）
└── game.js      # 全部遊戲邏輯
```

### 各檔案職責

| 檔案 | 職責 |
|------|------|
| `index.html` | 建立唯一的 `<canvas id="gameCanvas">` 元素；以 `<script src="game.js">` 載入遊戲；不含任何遊戲邏輯 |
| `style.css` | 設定 `body` 為黑色背景、flex 置中；讓 canvas 顯示為 block 避免預設 inline 間距；不控制遊戲畫面細節 |
| `game.js` | 定義所有模組（`Player`、`Obstacle`、`Coin`、`SpawnManager`、`InputHandler`、`CollisionDetector`、`Renderer`、`GameState`）；管理遊戲狀態機；驅動 `requestAnimationFrame` 主迴圈 |

---

## 2. 遊戲狀態機

### 三個狀態

| 狀態 | 說明 |
|------|------|
| `IDLE` | 等待開始。頁面載入後進入此狀態，顯示開始畫面覆蓋層，遊戲迴圈暫停更新邏輯 |
| `RUNNING` | 遊戲進行中。角色自動前進，物件生成、碰撞判定、分數更新全部啟用 |
| `GAME_OVER` | 遊戲結束。停止更新，顯示結束畫面與最終分數，等待重新開始 |

### 狀態轉換

```
IDLE  ──[點擊「開始遊戲」]──►  RUNNING
RUNNING  ──[碰撞障礙物]──►  GAME_OVER
GAME_OVER  ──[點擊「重新開始」]──►  RUNNING
```

轉換條件整理：
- `IDLE → RUNNING`：玩家點擊開始按鈕區域（滑鼠事件命中 HUD 按鈕矩形）
- `RUNNING → GAME_OVER`：`CollisionDetector` 偵測到角色與任意障礙物的 AABB 重疊
- `GAME_OVER → RUNNING`：玩家點擊重新開始按鈕區域，並呼叫 `GameState.reset()`

---

## 3. Canvas 畫面佈局

### Canvas 尺寸

建議尺寸：**480 × 640 px**（直向比例，適合瀏覽器視窗）

```javascript
const CANVAS_WIDTH  = 480;
const CANVAS_HEIGHT = 640;
```

### 三條跑道 X 座標

將 canvas 水平三等分，每條跑道寬度為 `LANE_WIDTH = CANVAS_WIDTH / 3 = 160px`。
每條跑道的中心 X 為：

```javascript
const LANE_WIDTH = CANVAS_WIDTH / 3;          // 160
const LANE_CENTERS = [
  LANE_WIDTH * 0.5,   // 左道：80
  LANE_WIDTH * 1.5,   // 中道：240
  LANE_WIDTH * 2.5,   // 右道：400
];
// 角色或物件繪製時以 LANE_CENTERS[lane] 為水平中心
```

### 跑道背景線

在 `x = 160` 與 `x = 320` 繪製垂直分隔線，視覺上區分三條跑道。

### HUD 區域

- **分數**：canvas 左上角，`(16, 32)`，字型 `bold 24px monospace`，顏色白色
- 其餘 UI（開始／結束覆蓋層）以半透明矩形覆蓋整個 canvas，見第 8 節

---

## 4. 核心模組設計

### 4.1 `GameState`

持有所有共用遊戲變數，作為單一真相來源（single source of truth）。

```javascript
const GameState = {
  status: 'IDLE',      // 'IDLE' | 'RUNNING' | 'GAME_OVER'
  score: 0,
  speed: 3,            // 目前移動速度（px/frame）
  elapsedFrames: 0,    // 累計幀數，用於計算速度漸增

  player: null,        // Player 實例
  obstacles: [],       // Obstacle 實例陣列
  coins: [],           // Coin 實例陣列

  reset() {
    this.status = 'RUNNING';
    this.score = 0;
    this.speed = INITIAL_SPEED;
    this.elapsedFrames = 0;
    this.player.reset();
    this.obstacles = [];
    this.coins = [];
  }
};
```

---

### 4.2 `Player`

```javascript
class Player {
  constructor() {
    this.lane = 1;           // 0=左、1=中、2=右，預設中道
    this.width = 40;
    this.height = 60;
    this.y = CANVAS_HEIGHT - 120;  // 固定在畫面底部附近
  }

  get x() {
    return LANE_CENTERS[this.lane];
  }

  // 碰撞框（以中心點計算左上角）
  get hitbox() {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height / 2,
      w: this.width,
      h: this.height,
    };
  }

  reset() {
    this.lane = 1;
  }

  draw(ctx) {
    // 以矩形代替角色；可替換為更精緻的圖形
    ctx.fillStyle = '#00CFFF';
    ctx.fillRect(
      this.x - this.width / 2,
      this.y - this.height / 2,
      this.width,
      this.height
    );
  }
}
```

---

### 4.3 `Obstacle`

**生成規則**：每次生成一排，隨機決定哪些跑道有障礙物，但至少保留一條空白跑道。

```javascript
class Obstacle {
  constructor(lane, y) {
    this.lane = lane;
    this.y = y;          // 生成時 y = -height（畫面上方外側）
    this.width = 50;
    this.height = 50;
    this.active = true;  // false 表示離開畫面，待回收
  }

  get x() {
    return LANE_CENTERS[this.lane];
  }

  get hitbox() {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height / 2,
      w: this.width,
      h: this.height,
    };
  }

  update(speed) {
    this.y += speed;
    if (this.y - this.height / 2 > CANVAS_HEIGHT) {
      this.active = false;   // 移出畫面，標記回收
    }
  }

  draw(ctx) {
    ctx.fillStyle = '#FF4444';
    ctx.fillRect(
      this.x - this.width / 2,
      this.y - this.height / 2,
      this.width,
      this.height
    );
  }
}

// 生成一排障礙物（至少保留一條空白跑道）
function spawnObstacleRow(y) {
  // 從 [0,1,2] 中隨機移除 1~2 個 lane 作為障礙物佔用
  // 確保剩餘空白 lane >= 1
  const blockedCount = Math.floor(Math.random() * 2) + 1; // 1 或 2
  const lanes = [0, 1, 2];
  const blocked = lanes
    .sort(() => Math.random() - 0.5)
    .slice(0, blockedCount);
  return blocked.map(lane => new Obstacle(lane, y));
}
```

---

### 4.4 `Coin`

```javascript
class Coin {
  constructor(lane, y) {
    this.lane = lane;
    this.y = y;
    this.radius = 15;
    this.active = true;    // false = 已收集或離開畫面
    this.collected = false;
  }

  get x() {
    return LANE_CENTERS[this.lane];
  }

  get hitbox() {
    return {
      x: this.x - this.radius,
      y: this.y - this.radius,
      w: this.radius * 2,
      h: this.radius * 2,
    };
  }

  update(speed) {
    this.y += speed;
    if (this.y - this.radius > CANVAS_HEIGHT) {
      this.active = false;
    }
  }

  collect() {
    this.collected = true;
    this.active = false;
  }

  draw(ctx) {
    if (this.collected) return;
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

---

### 4.5 `SpawnManager`

控制障礙物與金幣的生成時機，以「Y 距離間隔」計算，使間隔隨速度保持相對穩定。

```javascript
const SpawnManager = {
  obstacleTimer: 0,   // 距上次生成的累計像素距離
  coinTimer: 0,

  OBSTACLE_INTERVAL: 220,  // 每隔 220px 生成一排障礙物
  COIN_INTERVAL: 180,      // 每隔 180px 生成一枚金幣

  update(speed, obstacles, coins) {
    this.obstacleTimer += speed;
    this.coinTimer += speed;

    if (this.obstacleTimer >= this.OBSTACLE_INTERVAL) {
      const row = spawnObstacleRow(-40);
      obstacles.push(...row);
      this.obstacleTimer = 0;
    }

    if (this.coinTimer >= this.COIN_INTERVAL) {
      const lane = Math.floor(Math.random() * 3);
      coins.push(new Coin(lane, -20));
      this.coinTimer = 0;
    }
  },

  reset() {
    this.obstacleTimer = 0;
    this.coinTimer = 0;
  }
};
```

> **設計說明**：使用像素距離而非時間（ms）作為間隔計量，可讓間隔自然隨速度增加而在視覺上保持一致，無需額外補償計算。

---

### 4.6 `InputHandler`

```javascript
const InputHandler = {
  init(player, gameState) {
    window.addEventListener('keydown', (e) => {
      if (gameState.status !== 'RUNNING') return;
      if (e.key === 'ArrowLeft') {
        player.lane = Math.max(0, player.lane - 1);  // 邊界保護
      } else if (e.key === 'ArrowRight') {
        player.lane = Math.min(2, player.lane + 1);  // 邊界保護
      }
    });
  }
};
```

> **AC-2.5 說明**：`keydown` 每次觸發只移動一格，不做累積佇列，天然防止跳越多道。

---

### 4.7 `CollisionDetector`

AABB（Axis-Aligned Bounding Box）矩形重疊判定：

```javascript
const CollisionDetector = {
  // 判斷兩個矩形是否重疊
  aabbOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  },

  check(gameState) {
    const ph = gameState.player.hitbox;

    // 障礙物碰撞 → GAME_OVER
    for (const obs of gameState.obstacles) {
      if (obs.active && this.aabbOverlap(ph, obs.hitbox)) {
        gameState.status = 'GAME_OVER';
        return;
      }
    }

    // 金幣收集 → +1 分
    for (const coin of gameState.coins) {
      if (coin.active && this.aabbOverlap(ph, coin.hitbox)) {
        coin.collect();
        gameState.score += 1;
      }
    }
  }
};
```

---

### 4.8 `Renderer`

每幀完整重繪 canvas，依序：背景 → 跑道分隔線 → 金幣 → 角色 → 障礙物 → HUD → UI 覆蓋層。

```javascript
const Renderer = {
  drawBackground(ctx) {
    ctx.fillStyle = '#1A1A2E';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    // 跑道分隔線
    ctx.strokeStyle = '#FFFFFF44';
    ctx.lineWidth = 2;
    [LANE_WIDTH, LANE_WIDTH * 2].forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    });
  },

  drawHUD(ctx, score) {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(`分數：${score}`, 16, 36);
  },

  drawOverlay(ctx, state, score) {
    if (state === 'IDLE') {
      this._drawSemitransparentOverlay(ctx);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('三線跑酷', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);
      this._drawButton(ctx, '開始遊戲', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
      ctx.textAlign = 'left';
    } else if (state === 'GAME_OVER') {
      this._drawSemitransparentOverlay(ctx);
      ctx.fillStyle = '#FF4444';
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('遊戲結束', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '28px monospace';
      ctx.fillText(`最終分數：${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);
      this._drawButton(ctx, '重新開始', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
      ctx.textAlign = 'left';
    }
  },

  _drawSemitransparentOverlay(ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  },

  // 繪製按鈕，同時更新 UI_BUTTONS 供點擊命中判定使用
  _drawButton(ctx, label, cx, cy) {
    const bw = 200, bh = 50;
    const bx = cx - bw / 2, by = cy - bh / 2;
    ctx.fillStyle = '#00CFFF';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 8);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(label, cx, cy + 8);
    // 記錄按鈕矩形供滑鼠命中判定
    UI_BUTTONS[label] = { x: bx, y: by, w: bw, h: bh };
  }
};
```

---

## 5. 遊戲迴圈設計

使用 `requestAnimationFrame` 驅動，確保畫面更新與瀏覽器刷新率同步。

```javascript
function gameLoop() {
  if (GameState.status === 'RUNNING') {
    // 1. 更新速度
    updateSpeed(GameState);

    // 2. 移動所有物件
    GameState.obstacles.forEach(o => o.update(GameState.speed));
    GameState.coins.forEach(c => c.update(GameState.speed));

    // 3. 回收離開畫面的物件
    GameState.obstacles = GameState.obstacles.filter(o => o.active);
    GameState.coins     = GameState.coins.filter(c => c.active);

    // 4. 生成新物件
    SpawnManager.update(GameState.speed, GameState.obstacles, GameState.coins);

    // 5. 碰撞判定
    CollisionDetector.check(GameState);
  }

  // 6. 繪製（每幀必繪，包含 IDLE / GAME_OVER 覆蓋層）
  const ctx = canvas.getContext('2d');
  Renderer.drawBackground(ctx);
  GameState.coins.forEach(c => c.draw(ctx));
  GameState.player.draw(ctx);
  GameState.obstacles.forEach(o => o.draw(ctx));
  Renderer.drawHUD(ctx, GameState.score);
  Renderer.drawOverlay(ctx, GameState.status, GameState.score);

  requestAnimationFrame(gameLoop);
}
```

---

## 6. 速度漸增機制

```javascript
const INITIAL_SPEED  = 3;    // px/frame（約 180px/s @60fps）
const SPEED_INCREMENT = 0.0005; // 每幀增加量
const MAX_SPEED      = 12;   // 上限（約 720px/s @60fps）

function updateSpeed(gameState) {
  gameState.elapsedFrames++;
  gameState.speed = Math.min(
    MAX_SPEED,
    INITIAL_SPEED + gameState.elapsedFrames * SPEED_INCREMENT
  );
}
```

| 參數 | 值 | 說明 |
|------|----|------|
| 初始速度 | 3 px/frame | 約 180 px/s，感覺舒適不急迫 |
| 每幀增量 | 0.0005 | 約 2000 幀（33 秒）速度翻倍 |
| 上限速度 | 12 px/frame | 約 720 px/s，維持可玩性 |

---

## 7. 生成間隔機制

| 物件 | 間隔 | 說明 |
|------|------|------|
| 障礙物排 | 220 px | 以累計移動距離觸發，速度快時觸發更頻繁（間隔時間縮短） |
| 金幣 | 180 px | 同上，略短於障礙物間隔，讓金幣出現更密集 |

以距離而非時間計間隔的優點：
- 速度 3 → 間隔約 1.2 s；速度 12 → 間隔約 0.3 s
- 視覺密度隨速度自然增加，難度感受線性提升
- 不需要 `Date.now()` 或 `deltaTime` 補償

若需微調視覺間距，可在 `SpawnManager` 中讓 `OBSTACLE_INTERVAL` 隨速度動態調整：

```javascript
// 可選：動態間隔（保持視覺間距恆定）
const dynamicInterval = Math.max(140, 220 - (gameState.speed - 3) * 10);
```

---

## 8. UI 覆蓋層設計

### 繪製方式

1. 每幀 `Renderer.drawOverlay()` 依 `GameState.status` 決定繪製何種覆蓋層
2. 先以 `rgba(0,0,0,0.65)` 填滿整個 canvas（半透明遮罩）
3. 再繪製標題文字與按鈕矩形

### 按鈕命中判定

以全域物件 `UI_BUTTONS` 記錄各按鈕的矩形座標，在滑鼠點擊事件中判斷：

```javascript
const UI_BUTTONS = {};  // { '開始遊戲': {x,y,w,h}, '重新開始': {x,y,w,h} }

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  for (const [label, btn] of Object.entries(UI_BUTTONS)) {
    if (mx >= btn.x && mx <= btn.x + btn.w &&
        my >= btn.y && my <= btn.y + btn.h) {
      handleButtonClick(label);
    }
  }
});

function handleButtonClick(label) {
  if (label === '開始遊戲' && GameState.status === 'IDLE') {
    GameState.reset();
    SpawnManager.reset();
  } else if (label === '重新開始' && GameState.status === 'GAME_OVER') {
    GameState.reset();
    SpawnManager.reset();
  }
}
```

> **注意**：`UI_BUTTONS` 的按鈕矩形在每幀 `_drawButton()` 呼叫時更新，因此滑鼠事件讀到的永遠是最新繪製位置。

### 畫面示意

```
┌─────────────────────────┐
│  IDLE 狀態              │
│  ████████████████████   │  ← 半透明黑色遮罩
│         三線跑酷        │
│                         │
│     [  開始遊戲  ]      │  ← 按鈕矩形（命中區域）
│                         │
└─────────────────────────┘

┌─────────────────────────┐
│  GAME_OVER 狀態         │
│  ████████████████████   │
│        遊戲結束         │
│      最終分數：42       │
│                         │
│     [  重新開始  ]      │
└─────────────────────────┘
```

---

## 9. 需求對應表

| 需求 AC | 對應模組 / 設計決策 |
|---------|---------------------|
| AC-1.1 三條跑道視覺可區分 | `Renderer.drawBackground()`：繪製分隔線與不同底色 |
| AC-1.2 障礙物背景持續移動 | `Obstacle.update(speed)`、`Coin.update(speed)` 每幀下移 |
| AC-1.3 角色圖形顯示 | `Player.draw(ctx)` 繪製矩形角色 |
| AC-1.4 跑道不得缺失 | `Renderer.drawBackground()` 每幀重繪完整背景 |
| AC-2.1 左鍵向左移動 | `InputHandler` keydown ArrowLeft → `player.lane--` |
| AC-2.2 右鍵向右移動 | `InputHandler` keydown ArrowRight → `player.lane++` |
| AC-2.3 最左不再左移 | `Math.max(0, player.lane - 1)` 邊界保護 |
| AC-2.4 最右不再右移 | `Math.min(2, player.lane + 1)` 邊界保護 |
| AC-2.5 每次僅移一格 | keydown 每次觸發只執行一次 lane 加減，無佇列 |
| AC-3.1 隨機障礙物 | `spawnObstacleRow()` 隨機選取佔用 lane |
| AC-3.2 至少一條空白跑道 | `spawnObstacleRow()` 最多阻擋 2 條 lane |
| AC-3.3 碰撞判定觸發結束 | `CollisionDetector.check()` AABB → `status = 'GAME_OVER'` |
| AC-3.4 移出畫面回收 | `Obstacle.update()` 設 `active = false`，主迴圈過濾 |
| AC-4.1 隨機金幣 | `SpawnManager.update()` 隨機 lane 生成 `Coin` |
| AC-4.2 收集金幣得分 | `CollisionDetector.check()` AABB → `coin.collect()`、`score++` |
| AC-4.3 即時顯示分數 | `Renderer.drawHUD(ctx, score)` 每幀重繪 |
| AC-4.4 重新開始分數歸零 | `GameState.reset()` → `score = 0` |
| AC-5.1 開始畫面 | `IDLE` 狀態 + `Renderer.drawOverlay()` 繪製開始覆蓋層 |
| AC-5.2 點擊開始按鈕 | canvas click → `handleButtonClick('開始遊戲')` → `GameState.reset()` |
| AC-5.3 碰撞後顯示結束畫面 | `status = 'GAME_OVER'` → `drawOverlay()` 繪製結束覆蓋層 |
| AC-5.4 提供重新開始按鈕 | `GAME_OVER` 覆蓋層包含「重新開始」按鈕 |
| AC-5.5 重置所有狀態 | `GameState.reset()` + `SpawnManager.reset()` |
| AC-6.1 速度漸增 | `updateSpeed()` 每幀累加，上限 12 px/frame |
| AC-6.2 畫面流暢 | `requestAnimationFrame` 主迴圈，無阻塞運算 |
| AC-6.3 當幀碰撞判定 | 碰撞判定在每幀 `gameLoop()` 內同步執行 |
| AC-6.4 無需額外安裝 | 純 HTML/CSS/JS，開啟 `index.html` 即可執行 |
| AC-6.5 不發送網路請求 | 無任何 `fetch`、`XHR`、外部 CDN；全部邏輯在 `game.js` |
