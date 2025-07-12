class TetrisGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.scoreElement = document.getElementById('score');
        this.titleScreen = document.getElementById('titleScreen');
        this.startButton = document.getElementById('startButton');
        this.soundToggle = document.getElementById('soundToggle');
        this.pauseOverlay = document.getElementById('pauseOverlay');
        
        this.COLS = 10;
        this.ROWS = 20;
        this.BLOCK_SIZE = 30;
        
        this.canvas.width = this.COLS * this.BLOCK_SIZE;
        this.canvas.height = this.ROWS * this.BLOCK_SIZE;
        
        // ピクセルアート風の設定
        this.ctx.imageSmoothingEnabled = false;
        
        this.board = this.createBoard();
        this.score = 0;
        this.lines = 0;
        this.garbageCounter = 0;
        
        this.currentPiece = null;
        this.nextPiece = null;
        this.dropTime = 0;
        this.dropInterval = 1000;
        this.gameStarted = false;
        this.soundEnabled = true;
        this.garbageBlocks = [];
        this.softDropping = false;
        this.isPaused = false;
        
        this.characterImages = {};
        this.loadImages();
        this.setupBGM();
        this.setupStartButton();
        this.setupSoundToggle();
        this.setupPauseControls();
        
        this.setupControls();
        this.setupTouchControls();
        
        this.lastTime = 0;
        this.gameLoop = this.gameLoop.bind(this);
    }
    
    createBoard() {
        return Array(this.ROWS).fill().map(() => Array(this.COLS).fill(0));
    }
    
    loadImages() {
        const characters = [
            { name: 'toshi', color: '#00ff00' },    // I型 - 緑
            { name: 'riko', color: '#ff0000' },     // O型 - 赤
            { name: 'renton', color: '#00ffff' },   // T型 - 水色
            { name: 'nori', color: '#ffff00' },     // L型 - 黄色
            { name: 'niina', color: '#ff00ff' },    // J型 - 紫
            { name: 'syou', color: '#ffc0cb' },     // S型 - ピンク
            { name: 'nagisa', color: '#808080' }    // Z型 - グレー
        ];
        
        characters.forEach((char, index) => {
            const img = new Image();
            img.src = `images/${char.name}.png`;
            this.characterImages[index + 1] = {
                image: img,
                color: char.color,
                name: char.name
            };
        });
    }
    
    setupBGM() {
        this.bgm = new Audio('pipopipobgm.mp3');
        this.bgm.loop = true;
        this.bgm.volume = 0.3;
        
        // ユーザーの初回操作後にBGMを開始
        const startBGM = () => {
            if (this.soundEnabled) {
                this.bgm.play().catch(e => console.log('BGM再生エラー:', e));
            }
            document.removeEventListener('click', startBGM);
            document.removeEventListener('touchstart', startBGM);
            document.removeEventListener('keydown', startBGM);
        };
        
        document.addEventListener('click', startBGM);
        document.addEventListener('touchstart', startBGM);
        document.addEventListener('keydown', startBGM);
    }
    
    setupStartButton() {
        this.startButton.addEventListener('click', () => {
            this.startGame();
        });
        
        this.startButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startGame();
        });
    }
    
    setupSoundToggle() {
        this.soundToggle.addEventListener('click', () => {
            this.toggleSound();
        });
        
        this.soundToggle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.toggleSound();
        });
    }
    
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        
        if (this.soundEnabled) {
            this.soundToggle.textContent = '🔊';
            this.soundToggle.classList.remove('muted');
            if (this.bgm && this.gameStarted) {
                this.bgm.play().catch(e => console.log('BGM再生エラー:', e));
            }
        } else {
            this.soundToggle.textContent = '🔇';
            this.soundToggle.classList.add('muted');
            if (this.bgm) {
                this.bgm.pause();
            }
        }
    }
    
    setupPauseControls() {
        // キャンバスクリックで一時停止/再開
        this.canvas.addEventListener('click', (e) => {
            if (this.gameStarted) {
                this.togglePause();
                e.preventDefault();
            }
        });
        
        // 一時停止オーバーレイクリックで再開
        this.pauseOverlay.addEventListener('click', (e) => {
            if (this.isPaused) {
                this.togglePause();
                e.preventDefault();
            }
        });
        
        // タッチイベント
        this.canvas.addEventListener('touchstart', (e) => {
            if (this.gameStarted && e.touches.length === 1) {
                // 他のタッチ操作と区別するため、短時間のタッチのみ一時停止
                this.pauseTouchTimer = setTimeout(() => {
                    this.togglePause();
                }, 300);
                // e.preventDefault(); // コメントアウトして他のタッチ操作を阻害しないように
            }
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            if (this.pauseTouchTimer) {
                clearTimeout(this.pauseTouchTimer);
                this.pauseTouchTimer = null;
            }
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            if (this.pauseTouchTimer) {
                clearTimeout(this.pauseTouchTimer);
                this.pauseTouchTimer = null;
            }
        });
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        
        if (this.isPaused) {
            this.pauseOverlay.style.display = 'flex';
            if (this.bgm && this.soundEnabled) {
                this.bgm.pause();
            }
        } else {
            this.pauseOverlay.style.display = 'none';
            if (this.bgm && this.soundEnabled) {
                this.bgm.play().catch(e => console.log('BGM再生エラー:', e));
            }
        }
    }
    
    startGame() {
        this.titleScreen.style.display = 'none';
        this.gameStarted = true;
        this.currentPiece = this.createPiece();
        this.updateUI();
        requestAnimationFrame(this.gameLoop);
    }
    
    // テトロミノの定義（7種類のブロック）
    get tetrominoes() {
        return [
            {
                // I型 - toshi (緑)
                type: 1,
                shape: [
                    [0, 0, 0, 0],
                    [1, 1, 1, 1],
                    [0, 0, 0, 0],
                    [0, 0, 0, 0]
                ]
            },
            {
                // O型 - riko (赤)
                type: 2,
                shape: [
                    [2, 2],
                    [2, 2]
                ]
            },
            {
                // T型 - renton (水色)
                type: 3,
                shape: [
                    [0, 3, 0],
                    [3, 3, 3],
                    [0, 0, 0]
                ]
            },
            {
                // L型 - nori (黄色)
                type: 4,
                shape: [
                    [0, 0, 4],
                    [4, 4, 4],
                    [0, 0, 0]
                ]
            },
            {
                // J型 - niina (紫)
                type: 5,
                shape: [
                    [5, 0, 0],
                    [5, 5, 5],
                    [0, 0, 0]
                ]
            },
            {
                // S型 - syou (ピンク)
                type: 6,
                shape: [
                    [0, 6, 6],
                    [6, 6, 0],
                    [0, 0, 0]
                ]
            },
            {
                // Z型 - nagisa (グレー)
                type: 7,
                shape: [
                    [7, 7, 0],
                    [0, 7, 7],
                    [0, 0, 0]
                ]
            }
        ];
    }
    
    createPiece() {
        const tetrominoes = this.tetrominoes;
        const randomIndex = Math.floor(Math.random() * tetrominoes.length);
        const tetromino = tetrominoes[randomIndex];
        
        return {
            x: Math.floor(this.COLS / 2) - Math.floor(tetromino.shape[0].length / 2),
            y: 0,
            shape: tetromino.shape,
            type: tetromino.type
        };
    }
    
    drawBlock(x, y, type) {
        const blockX = x * this.BLOCK_SIZE;
        const blockY = y * this.BLOCK_SIZE;
        
        if (type === 0) return;
        
        // 透明お邪魔ブロック（type 8）の処理
        if (type === 8) {
            // 半透明の灰色背景
            this.ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
            this.ctx.fillRect(blockX, blockY, this.BLOCK_SIZE, this.BLOCK_SIZE);
            
            // 点線の枠線
            this.ctx.strokeStyle = 'rgba(200, 200, 200, 0.8)';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([4, 4]);
            this.ctx.strokeRect(blockX, blockY, this.BLOCK_SIZE, this.BLOCK_SIZE);
            this.ctx.setLineDash([]);
            return;
        }
        
        const character = this.characterImages[type];
        if (character) {
            // 背景色を描画
            this.ctx.fillStyle = character.color;
            this.ctx.fillRect(blockX, blockY, this.BLOCK_SIZE, this.BLOCK_SIZE);
            
            // キャラクター画像を描画
            if (character.image.complete) {
                this.ctx.drawImage(
                    character.image,
                    blockX + 2,
                    blockY + 2,
                    this.BLOCK_SIZE - 4,
                    this.BLOCK_SIZE - 4
                );
            }
            
            // 枠線を描画
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(blockX, blockY, this.BLOCK_SIZE, this.BLOCK_SIZE);
        }
    }
    
    drawBoard() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (let row = 0; row < this.ROWS; row++) {
            for (let col = 0; col < this.COLS; col++) {
                this.drawBlock(col, row, this.board[row][col]);
            }
        }
        
        // 落下中の透明ブロックを描画
        this.drawGarbageBlocks();
    }
    
    drawGarbageBlocks() {
        for (let garbage of this.garbageBlocks) {
            for (let col = 0; col < garbage.line.length; col++) {
                if (garbage.line[col] !== 0) {
                    this.drawBlock(col, garbage.y, garbage.line[col]);
                }
            }
        }
    }
    
    updateGarbageBlocks() {
        for (let i = this.garbageBlocks.length - 1; i >= 0; i--) {
            const garbage = this.garbageBlocks[i];
            garbage.y += garbage.speed;
            
            // 既存ブロックの上に乗るかチェック
            let landingRow = this.ROWS - 1;
            
            // 各列で一番上のブロックを探す
            for (let col = 0; col < this.COLS; col++) {
                if (garbage.line[col] !== 0) { // 透明ブロックがある列
                    for (let row = 0; row < this.ROWS; row++) {
                        if (this.board[row][col] !== 0) {
                            // この列の一番上のブロックを発見
                            landingRow = Math.min(landingRow, row - 1);
                            break;
                        }
                    }
                }
            }
            
            // 落下位置に到達したら配置
            if (garbage.y >= landingRow) {
                // 透明ブロックを適切な位置に配置
                if (landingRow >= 0) {
                    for (let col = 0; col < this.COLS; col++) {
                        if (garbage.line[col] !== 0) {
                            this.board[landingRow][col] = garbage.line[col];
                        }
                    }
                }
                // 配列から削除
                this.garbageBlocks.splice(i, 1);
            }
        }
    }
    
    drawPiece(piece) {
        for (let row = 0; row < piece.shape.length; row++) {
            for (let col = 0; col < piece.shape[row].length; col++) {
                if (piece.shape[row][col] !== 0) {
                    this.drawBlock(
                        piece.x + col,
                        piece.y + row,
                        piece.shape[row][col]
                    );
                }
            }
        }
    }
    
    isValidMove(piece, dx = 0, dy = 0, newShape = null) {
        const shape = newShape || piece.shape;
        const newX = piece.x + dx;
        const newY = piece.y + dy;
        
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col] !== 0) {
                    const boardX = newX + col;
                    const boardY = newY + row;
                    
                    if (boardX < 0 || boardX >= this.COLS || 
                        boardY >= this.ROWS || 
                        (boardY >= 0 && this.board[boardY][boardX] !== 0)) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    
    rotatePiece(piece) {
        const rotated = piece.shape[0].map((_, index) =>
            piece.shape.map(row => row[index]).reverse()
        );
        
        if (this.isValidMove(piece, 0, 0, rotated)) {
            piece.shape = rotated;
            return true;
        }
        return false;
    }
    
    placePiece(piece) {
        for (let row = 0; row < piece.shape.length; row++) {
            for (let col = 0; col < piece.shape[row].length; col++) {
                if (piece.shape[row][col] !== 0) {
                    const boardY = piece.y + row;
                    const boardX = piece.x + col;
                    if (boardY >= 0) {
                        this.board[boardY][boardX] = piece.shape[row][col];
                    }
                }
            }
        }
    }
    
    clearLines() {
        let linesCleared = 0;
        
        for (let row = this.ROWS - 1; row >= 0; row--) {
            if (this.board[row].every(cell => cell !== 0)) {
                this.board.splice(row, 1);
                this.board.unshift(Array(this.COLS).fill(0));
                linesCleared++;
                row++;
            }
        }
        
        if (linesCleared > 0) {
            this.lines += linesCleared;
            this.score += linesCleared * 100;
            this.garbageCounter += linesCleared;
            
            // 5ライン消すごとに透明お邪魔ブロックを追加
            if (this.garbageCounter >= 5) {
                this.addGarbageLine();
                this.garbageCounter = 0;
            }
            
            this.updateUI();
        }
        
        return linesCleared;
    }
    
    addGarbageLine() {
        // 新しい透明お邪魔ブロックラインを作成
        const garbageLine = [];
        for (let col = 0; col < this.COLS; col++) {
            // ランダムに穴を開ける（30%の確率で空白）
            if (Math.random() < 0.3) {
                garbageLine.push(0);
            } else {
                garbageLine.push(8); // 透明お邪魔ブロック
            }
        }
        
        // 落下アニメーション用の配列に追加
        this.garbageBlocks.push({
            line: garbageLine,
            y: -1, // 画面上部から開始
            speed: 0.5 // 高速で落下
        });
    }
    
    updateUI() {
        this.scoreElement.textContent = this.score;
    }
    
    isGameOver() {
        return !this.isValidMove(this.currentPiece);
    }
    
    setupControls() {
        document.addEventListener('keydown', (e) => {
            if (!this.gameStarted || !this.currentPiece || this.isPaused) return;
            
            switch(e.code) {
                case 'ArrowLeft':
                    this.movePiece(-1, 0);
                    break;
                case 'ArrowRight':
                    this.movePiece(1, 0);
                    break;
                case 'ArrowDown':
                    this.softDropping = true;
                    break;
                case 'ArrowUp':
                    this.rotate();
                    break;
                case 'Space':
                    this.hardDrop();
                    break;
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (!this.gameStarted || this.isPaused) return;
            
            switch(e.code) {
                case 'ArrowDown':
                    this.softDropping = false;
                    break;
            }
        });
        
        // タッチコントロール
        document.getElementById('leftBtn').addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.gameStarted && !this.isPaused) this.movePiece(-1, 0);
        });
        document.getElementById('rightBtn').addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.gameStarted && !this.isPaused) this.movePiece(1, 0);
        });
        document.getElementById('rotateBtn').addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.gameStarted && !this.isPaused) this.rotate();
        });
        document.getElementById('dropBtn').addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.gameStarted && !this.isPaused) this.softDropping = true;
        });
        document.getElementById('dropBtn').addEventListener('touchend', (e) => {
            e.preventDefault();
            if (this.gameStarted && !this.isPaused) this.softDropping = false;
        });
        document.getElementById('hardDropBtn').addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.gameStarted && !this.isPaused) this.hardDrop();
        });
        
        // クリックイベントも追加
        document.getElementById('leftBtn').addEventListener('click', () => {
            if (this.gameStarted && !this.isPaused) this.movePiece(-1, 0);
        });
        document.getElementById('rightBtn').addEventListener('click', () => {
            if (this.gameStarted && !this.isPaused) this.movePiece(1, 0);
        });
        document.getElementById('rotateBtn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.gameStarted && !this.isPaused) this.rotate();
        });
        document.getElementById('dropBtn').addEventListener('mousedown', () => {
            if (this.gameStarted && !this.isPaused) this.softDropping = true;
        });
        document.getElementById('dropBtn').addEventListener('mouseup', () => {
            if (this.gameStarted && !this.isPaused) this.softDropping = false;
        });
        document.getElementById('dropBtn').addEventListener('mouseleave', () => {
            if (this.gameStarted && !this.isPaused) this.softDropping = false;
        });
        document.getElementById('hardDropBtn').addEventListener('click', () => {
            if (this.gameStarted && !this.isPaused) this.hardDrop();
        });
    }
    
    setupTouchControls() {
        let startX, startY;
        
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (!this.gameStarted || this.isPaused || !startX || !startY) return;
            
            const touch = e.changedTouches[0];
            const endX = touch.clientX;
            const endY = touch.clientY;
            
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                if (Math.abs(deltaX) > 30) {
                    if (deltaX > 0) {
                        this.movePiece(1, 0);
                    } else {
                        this.movePiece(-1, 0);
                    }
                }
            } else {
                if (deltaY > 30) {
                    this.movePiece(0, 1);
                } else if (Math.abs(deltaX) < 20 && Math.abs(deltaY) < 20) {
                    this.rotate();
                }
            }
            
            startX = startY = null;
        });
    }
    
    movePiece(dx, dy) {
        if (this.isValidMove(this.currentPiece, dx, dy)) {
            this.currentPiece.x += dx;
            this.currentPiece.y += dy;
            return true;
        }
        return false;
    }
    
    rotate() {
        if (this.currentPiece) {
            this.rotatePiece(this.currentPiece);
        }
    }
    
    hardDrop() {
        while (this.movePiece(0, 1)) {
            this.score += 2;
        }
        this.updateUI();
    }
    
    start() {
        // タイトル画面を表示
    }
    
    gameLoop(currentTime) {
        if (!this.gameStarted) return;
        
        // 一時停止中はゲームロジックを停止
        if (this.isPaused) {
            this.drawBoard();
            if (this.currentPiece) {
                this.drawPiece(this.currentPiece);
            }
            requestAnimationFrame(this.gameLoop);
            return;
        }
        
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.dropTime += deltaTime;
        
        // 透明ブロックの更新
        this.updateGarbageBlocks();
        
        // 高速落下中は落下間隔を短くする
        const currentDropInterval = this.softDropping ? 50 : this.dropInterval;
        
        if (this.dropTime >= currentDropInterval) {
            if (!this.movePiece(0, 1)) {
                this.placePiece(this.currentPiece);
                this.clearLines();
                this.currentPiece = this.createPiece();
                this.softDropping = false; // 新しいピースが生成されたら高速落下解除
                
                if (this.isGameOver()) {
                    alert('ゲームオーバー！ スコア: ' + this.score);
                    this.board = this.createBoard();
                    this.score = 0;
                    this.lines = 0;
                    this.garbageCounter = 0;
                    this.garbageBlocks = [];
                    this.softDropping = false;
                    this.isPaused = false;
                    this.pauseOverlay.style.display = 'none';
                    this.updateUI();
                }
            }
            this.dropTime = 0;
        }
        
        this.drawBoard();
        if (this.currentPiece) {
            this.drawPiece(this.currentPiece);
        }
        
        requestAnimationFrame(this.gameLoop);
    }
}

// ゲーム開始
window.addEventListener('load', () => {
    const game = new TetrisGame();
    game.start();
});