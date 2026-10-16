# 三線跑酷遊戲 — 實作任務清單

## Tasks

- [x] 1. 專案骨架建立
  - **需求參考**：AC-6.4、AC-6.5
  - [x] 1.1 建立 `docs/` 目錄
  - [x] 1.2 建立 `docs/index.html`，包含 `<canvas id="gameCanvas" width="480" height="640">`，以 `<link>` 載入 `style.css`，以 `<script src="game.js">` 載入遊戲邏輯，不含任何遊戲程式碼
  - [x] 1.3 建立 `docs/style.css`，設定 body 黑色背景（`background: #000`）、flex 水平垂直置中（`display:flex; justify-content:center; align-items:center; height:100vh; margin:0`），canvas 設為 `display:block` 避免預設 inline 間距
  - [x] 1.4 建立 `docs/game.js`，定義常數 `CANVAS_WIDTH = 480`、`CANVAS_HEIGHT = 640`、`LANE_WIDTH = CANVAS_WIDTH / 3`、`LANE_CENTERS = [80, 240, 400]`
  - [x] 1.5 在 `docs/game.js` 取得 canvas 元素（`document.getElementById('gameCanvas')`）與 2D context，定義空白 `gameLoop` 函式，以 `requestAnimationFrame(gameLoop)` 啟動迴圈

- [x] 2. GameState 與遊戲狀態機
  - **需求參考**：AC-4.4、AC-5.1、AC-5.5
  - [x] 2.1 定義狀態常數物件 `STATE = { IDLE: 'IDLE', RUNNING: 'RUNNING', GAME_OVER: 'GAME_OVER' }`
  - [x] 2.2 實作 `GameState` 物件，包含屬性：`status`（初始值 `STATE.IDLE`）、`score`（0）、`speed`（3）、`elapsedFrames`（0）、`player`（null）、`obstacles`（[]）、`coins`（[]）
  - [x] 2.3 實作 `GameState.reset()` 方法：將 `status` 設為 `STATE.RUNNING`、`score` 歸零、`speed` 重置為 `INITIAL_SPEED`、`elapsedFrames` 歸零、呼叫 `this.player.reset()`、清空 `obstacles` 與 `coins` 陣列

- [x] 3. Player 模組
  - **需求參考**：AC-1.3、AC-2.1、AC-2.2、AC-2.3、AC-2.4、AC-2.5
  - [x] 3.1 實作 `Player` 類別，建構子設定 `this.lane = 1`（預設中道）、`this.width = 40`、`this.height = 60`、`this.y = CANVAS_HEIGHT - 120`（固定於畫面底部附近）
  - [x] 3.2 實作 `get x()` getter，回傳 `LANE_CENTERS[this.lane]` 作為角色目前水平中心座標
  - [x] 3.3 實作 `get hitbox()` getter，回傳 AABB 矩形物件 `{ x: this.x - this.width / 2, y: this.y - this.height / 2, w: this.width, h: this.height }`
  - [x] 3.4 實作 `draw(ctx)` 方法，以 `#00CFFF` 填色繪製矩形角色（左上角由 hitbox 座標決定）
  - [x] 3.5 實作 `reset()` 方法，將 `this.lane` 重置為 1
  - [x] 3.6 在 `GameState` 初始化區段建立 `Player` 實例並指派給 `GameState.player`

- [x] 4. InputHandler
  - **需求參考**：AC-2.1、AC-2.2、AC-2.3、AC-2.4、AC-2.5
  - [x] 4.1 實作 `InputHandler` 物件，包含 `init(player, gameState)` 方法
  - [x] 4.2 在 `init()` 中以 `window.addEventListener('keydown', ...)` 監聽鍵盤事件；當 `gameState.status !== STATE.RUNNING` 時直接 return，忽略所有按鍵輸入
  - [x] 4.3 處理 `ArrowLeft` 鍵：執行 `player.lane = Math.max(0, player.lane - 1)` 向左移動一格並防止越界
  - [x] 4.4 處理 `ArrowRight` 鍵：執行 `player.lane = Math.min(2, player.lane + 1)` 向右移動一格並防止越界
  - [x] 4.5 在 `game.js` 初始化區段呼叫 `InputHandler.init(GameState.player, GameState)`

- [x] 5. Obstacle 與 Coin 模組 + SpawnManager
  - **需求參考**：AC-3.1、AC-3.2、AC-3.4、AC-4.1
  - [x] 5.1 實作 `Obstacle` 類別，建構子接受 `(lane, y)`，設定 `this.lane`、`this.y`、`this.width = 50`、`this.height = 50`、`this.active = true`
  - [x] 5.2 為 `Obstacle` 實作 `get x()` 回傳 `LANE_CENTERS[this.lane]`，實作 `get hitbox()` 回傳 AABB 矩形 `{ x, y, w, h }`（以中心點計算左上角）
  - [x] 5.3 實作 `Obstacle.update(speed)` 方法：每幀將 `this.y += speed`；當物件移出畫面下方（`this.y - this.height / 2 > CANVAS_HEIGHT`）時設 `this.active = false`
  - [x] 5.4 實作 `Obstacle.draw(ctx)` 方法，以 `#FF4444` 填色繪製矩形障礙物
  - [x] 5.5 實作 `spawnObstacleRow(y)` 函式：從 `[0, 1, 2]` 中隨機選取 1 或 2 條跑道作為障礙物（確保至少保留一條空白跑道），回傳對應的 `Obstacle` 實例陣列
  - [x] 5.6 實作 `Coin` 類別，建構子接受 `(lane, y)`，設定 `this.lane`、`this.y`、`this.radius = 15`、`this.active = true`、`this.collected = false`
  - [x] 5.7 為 `Coin` 實作 `get x()` 回傳 `LANE_CENTERS[this.lane]`，實作 `get hitbox()` 回傳 `{ x: this.x - this.radius, y: this.y - this.radius, w: this.radius * 2, h: this.radius * 2 }`
  - [x] 5.8 實作 `Coin.update(speed)` 方法：每幀將 `this.y += speed`；移出畫面時設 `this.active = false`
  - [x] 5.9 實作 `Coin.collect()` 方法：設 `this.collected = true`、`this.active = false`
  - [x] 5.10 實作 `Coin.draw(ctx)` 方法：若 `this.collected` 為 true 則直接 return；否則以 `#FFD700` 填色繪製圓形（`ctx.arc`）
  - [x] 5.11 實作 `SpawnManager` 物件，包含屬性 `obstacleTimer = 0`、`coinTimer = 0`、常數 `OBSTACLE_INTERVAL = 220`、`COIN_INTERVAL = 180`
  - [x] 5.12 實作 `SpawnManager.update(speed, obstacles, coins)` 方法：累加兩個計時器；達到間隔時呼叫 `spawnObstacleRow(-40)` 生成障礙物排、隨機選一條跑道生成 `Coin(-20)`，並重置對應計時器
  - [x] 5.13 實作 `SpawnManager.reset()` 方法，將 `obstacleTimer` 與 `coinTimer` 歸零

- [x] 6. CollisionDetector 與速度漸增
  - **需求參考**：AC-3.3、AC-4.2、AC-6.1、AC-6.2、AC-6.3
  - [x] 6.1 實作 `CollisionDetector.aabbOverlap(a, b)` 函式，使用標準 AABB 重疊公式（`a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y`）回傳布林值
  - [x] 6.2 實作 `CollisionDetector.check(gameState)` 方法：取得 `gameState.player.hitbox`，遍歷 `gameState.obstacles`，發現 `active` 且重疊時將 `gameState.status` 設為 `STATE.GAME_OVER` 並 return
  - [x] 6.3 在 `CollisionDetector.check()` 中繼續遍歷 `gameState.coins`，發現 `active` 且重疊時呼叫 `coin.collect()` 並執行 `gameState.score += 1`
  - [x] 6.4 定義速度常數 `INITIAL_SPEED = 3`、`SPEED_INCREMENT = 0.0005`、`MAX_SPEED = 12`
  - [x] 6.5 實作 `updateSpeed(gameState)` 函式：遞增 `gameState.elapsedFrames`，以 `Math.min(MAX_SPEED, INITIAL_SPEED + gameState.elapsedFrames * SPEED_INCREMENT)` 更新 `gameState.speed`

- [x] 7. Renderer、UI 覆蓋層與完整 gameLoop
  - **需求參考**：AC-1.1、AC-1.2、AC-1.4、AC-4.3、AC-5.1、AC-5.2、AC-5.3、AC-5.4、AC-5.5、AC-6.2
  - [x] 7.1 實作 `Renderer.drawBackground(ctx)` 方法：以 `#1A1A2E` 填滿整個 canvas，再以半透明白色（`#FFFFFF44`）在 `x = LANE_WIDTH` 與 `x = LANE_WIDTH * 2` 繪製垂直分隔線
  - [x] 7.2 實作 `Renderer.drawHUD(ctx, score)` 方法：於 canvas 左上角 `(16, 36)` 以白色 `bold 24px monospace` 字型繪製 `分數：${score}`
  - [x] 7.3 實作 `Renderer._drawSemitransparentOverlay(ctx)` 輔助方法：以 `rgba(0,0,0,0.65)` 填滿整個 canvas 作為半透明遮罩
  - [x] 7.4 實作 `Renderer._drawButton(ctx, label, cx, cy)` 輔助方法：繪製寬 200、高 50 的 `#00CFFF` 圓角矩形按鈕，並將按鈕矩形 `{x, y, w, h}` 儲存至全域 `UI_BUTTONS[label]` 供命中判定使用
  - [x] 7.5 實作 `Renderer.drawOverlay(ctx, state, score)` 方法：當 `state === STATE.IDLE` 時繪製半透明遮罩、標題「三線跑酷」與「開始遊戲」按鈕；當 `state === STATE.GAME_OVER` 時繪製遮罩、「遊戲結束」標題、`最終分數：${score}` 與「重新開始」按鈕
  - [x] 7.6 宣告全域 `UI_BUTTONS = {}` 物件，用於儲存各按鈕的矩形座標
  - [x] 7.7 實作 canvas click 事件監聽：計算滑鼠相對 canvas 的座標，遍歷 `UI_BUTTONS` 判斷命中；命中「開始遊戲」且 `status === STATE.IDLE` 時呼叫 `GameState.reset()` 與 `SpawnManager.reset()`；命中「重新開始」且 `status === STATE.GAME_OVER` 時同樣呼叫兩者
  - [x] 7.8 完善 `gameLoop()` 函式：當 `status === STATE.RUNNING` 時依序執行（1）`updateSpeed`、（2）更新所有 obstacles 與 coins、（3）過濾 `active = false` 的物件、（4）`SpawnManager.update`、（5）`CollisionDetector.check`；無論狀態如何，每幀都依序執行繪製：`drawBackground` → coins → player → obstacles → `drawHUD` → `drawOverlay`，最後呼叫 `requestAnimationFrame(gameLoop)`
