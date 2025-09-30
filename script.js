class Grid {
    constructor(size = 4) {
        this.size = size;
        this.cells = Array(size * size).fill(0);
    }

    getCell(row, col) {
        return this.cells[row * this.size + col];
    }

    setCell(row, col, value) {
        this.cells[row * this.size + col] = value;
    }

    getEmptyCells() {
        return this.cells.reduce((acc, cell, index) => {
            if (cell === 0) acc.push(index);
            return acc;
        }, []);
    }

    clone() {
        const newGrid = new Grid(this.size);
        newGrid.cells = [...this.cells];
        return newGrid;
    }
}

class Game2048 {
    constructor() {
        this.grid = new Grid(4);
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('highScore')) || 0;
        this.isAnimating = false;
        
        // 对象池优化
        this.tilePool = [];
        this.maxPoolSize = 20;
        
        // 性能监控
        this.performanceMetrics = {
            moveCount: 0,
            totalMoveTime: 0,
            averageMoveTime: 0
        };
        
        this.setupDOMElements();
        this.setupEventListeners();
        this.init();
    }

    setupDOMElements() {
        this.container = document.querySelector('.grid');
        this.scoreElement = document.getElementById('score');
        this.highScoreElement = document.getElementById('high-score');
        this.tiles = new Map(); // 使用Map存储tile元素
    }

    setupEventListeners() {
        document.addEventListener('keydown', this.handleKeyPress.bind(this));
        document.getElementById('new-game').addEventListener('click', () => this.init());
        this.setupTouchEvents();
    }

    setupTouchEvents() {
        let startX, startY;
        
        this.container.addEventListener('touchstart', e => {
            e.preventDefault();  // 添加这行
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: false });  // 添加这个选项

        this.container.addEventListener('touchmove', e => {
            e.preventDefault();  // 添加这行
        }, { passive: false });  // 添加这个选项

        this.container.addEventListener('touchend', e => {
            if (this.isAnimating) return;
            const deltaX = e.changedTouches[0].clientX - startX;
            const deltaY = e.changedTouches[0].clientY - startY;
            const minSwipeDistance = 50;

            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                if (Math.abs(deltaX) > minSwipeDistance) {
                    this.move(deltaX > 0 ? 'right' : 'left');
                }
            } else {
                if (Math.abs(deltaY) > minSwipeDistance) {
                    this.move(deltaY > 0 ? 'down' : 'up');
                }
            }
        });
    }

    init() {
        this.grid = new Grid(4);
        this.score = 0;
        this.updateScore();
        this.clearTiles();
        this.addNewTile();
        this.addNewTile();
    }

    clearTiles() {
        this.tiles.forEach(tile => this.returnTileToPool(tile));
        this.tiles.clear();
    }

    // 对象池方法
    getTileFromPool() {
        if (this.tilePool.length > 0) {
            return this.tilePool.pop();
        }
        return this.createNewTileElement();
    }

    returnTileToPool(tile) {
        if (this.tilePool.length < this.maxPoolSize) {
            // 重置tile状态
            tile.className = 'tile';
            tile.style.transform = 'translateZ(0) scale(0)';
            tile.style.opacity = '1';
            tile.removeAttribute('data-value');
            tile.textContent = '';
            // 移除所有事件监听器
            tile.replaceWith(tile.cloneNode(true));
            this.tilePool.push(tile);
        } else {
            tile.remove();
        }
    }

    createNewTileElement() {
        const tile = document.createElement('div');
        tile.className = 'tile';
        return tile;
    }

    createTileElement(position, value) {
        const tile = this.getTileFromPool();
        tile.className = 'tile new';
        tile.textContent = value;
        tile.setAttribute('data-value', value);
        this.setTilePosition(tile, position);
        tile.style.transform = 'translateZ(0) scale(0)';
        this.container.appendChild(tile);
        
        // 使用RAF优化动画
        requestAnimationFrame(() => {
            tile.style.transform = 'translateZ(0) scale(1)';
            // 移除new类以避免重复动画
            setTimeout(() => tile.classList.remove('new'), 200);
        });
        
        return tile;
    }

    setTilePosition(tile, position) {
        const row = Math.floor(position / 4);
        const col = position % 4;
        
        // 使用transform代替top/left以获得更好的性能
        const translateX = col * 25;
        const translateY = row * 25;
        
        // 保持现有的scale值
        const currentTransform = tile.style.transform;
        const scaleMatch = currentTransform.match(/scale\(([^)]+)\)/);
        const scale = scaleMatch ? scaleMatch[1] : '1';
        
        tile.style.transform = `translateZ(0) translate(${translateX}%, ${translateY}%) scale(${scale})`;
        
        // 设置初始位置（用于CSS定位）
        tile.style.top = `${row * 25}%`;
        tile.style.left = `${col * 25}%`;
    }

    addNewTile() {
        const emptyCells = this.grid.getEmptyCells();
        if (emptyCells.length === 0) return;

        const position = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const value = Math.random() < 0.9 ? 2 : 4;
        this.grid.cells[position] = value;
        
        const tile = this.createTileElement(position, value);
        this.tiles.set(position, tile);
    }

    async move(direction) {
        // 防抖：如果正在动画中，直接返回
        if (this.isAnimating) return;
        
        // 性能监控开始
        const moveStartTime = performance.now();
        this.isAnimating = true;

        try {
            const moves = await this.calculateMoves(direction);
            if (moves.length > 0) {
                // 批量DOM更新
                await this.animateMoves(moves);
                this.addNewTile();
                
                // 延迟检查游戏状态，避免阻塞动画
                requestAnimationFrame(() => {
                    if (this.isGameOver()) {
                        setTimeout(() => alert('游戏结束！'), 300);
                    } else if (this.grid.cells.includes(2048)) {
                        setTimeout(() => alert('恭喜你赢了！'), 300);
                    }
                });
            }
        } catch (error) {
            console.error('Move operation failed:', error);
        } finally {
            // 性能监控结束
            const moveEndTime = performance.now();
            this.updatePerformanceMetrics(moveEndTime - moveStartTime);
            
            this.isAnimating = false;
        }
    }

    // 性能监控方法
    updatePerformanceMetrics(moveTime) {
        this.performanceMetrics.moveCount++;
        this.performanceMetrics.totalMoveTime += moveTime;
        this.performanceMetrics.averageMoveTime = 
            this.performanceMetrics.totalMoveTime / this.performanceMetrics.moveCount;
        
        // 每100次移动输出性能报告
        if (this.performanceMetrics.moveCount % 100 === 0) {
            console.log('Performance Report:', {
                moves: this.performanceMetrics.moveCount,
                averageTime: this.performanceMetrics.averageMoveTime.toFixed(2) + 'ms',
                totalTime: this.performanceMetrics.totalMoveTime.toFixed(2) + 'ms'
            });
        }
    }

    calculateMoves(direction) {
        const vectors = {
            'up': [-1, 0],
            'down': [1, 0],
            'left': [0, -1],
            'right': [0, 1]
        };
        const [dRow, dCol] = vectors[direction];
        const moves = [];

        // 临时网格用于计算
        const newGrid = this.grid.clone();
        const processed = new Set();

        const traversalOrder = this.getTraversalOrder(direction);

        traversalOrder.forEach(([row, col]) => {
            if (newGrid.getCell(row, col) === 0) return;

            let currentRow = row;
            let currentCol = col;
            let nextRow = currentRow + dRow;
            let nextCol = currentCol + dCol;

            while (
                nextRow >= 0 && nextRow < 4 && 
                nextCol >= 0 && nextCol < 4
            ) {
                const currentValue = newGrid.getCell(currentRow, currentCol);
                const nextValue = newGrid.getCell(nextRow, nextCol);

                if (nextValue === 0) {
                    newGrid.setCell(nextRow, nextCol, currentValue);
                    newGrid.setCell(currentRow, currentCol, 0);
                    moves.push({
                        from: currentRow * 4 + currentCol,
                        to: nextRow * 4 + nextCol,
                        value: currentValue,
                        merge: false
                    });
                } else if (nextValue === currentValue && !processed.has(nextRow * 4 + nextCol)) {
                    newGrid.setCell(nextRow, nextCol, currentValue * 2);
                    newGrid.setCell(currentRow, currentCol, 0);
                    moves.push({
                        from: currentRow * 4 + currentCol,
                        to: nextRow * 4 + nextCol,
                        value: currentValue * 2,
                        merge: true
                    });
                    processed.add(nextRow * 4 + nextCol);
                    this.score += currentValue * 2;
                    break;
                } else {
                    break;
                }

                currentRow = nextRow;
                currentCol = nextCol;
                nextRow += dRow;
                nextCol += dCol;
            }
        });

        if (moves.length > 0) {
            this.grid = newGrid;
            this.updateScore();
        }

        return moves;
    }

    getTraversalOrder(direction) {
        const positions = [];
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                positions.push([row, col]);
            }
        }

        // 根据移动方向调整遍历顺序
        if (direction === 'down') {
            positions.reverse();
        } else if (direction === 'right') {
            positions.sort((a, b) => b[1] - a[1]);
        }

        return positions;
    }

    async animateMoves(moves) {
        if (moves.length === 0) return;
        
        // 批量DOM读取和写入分离
        const tileUpdates = [];
        
        // 第一阶段：批量读取DOM状态
        moves.forEach(move => {
            const tile = this.tiles.get(move.from);
            if (tile) {
                tileUpdates.push({
                    tile,
                    move,
                    currentTransform: tile.style.transform
                });
            }
        });
        
        // 第二阶段：批量写入DOM
        return new Promise(resolve => {
            // 使用RAF确保在下一帧执行
            requestAnimationFrame(() => {
                tileUpdates.forEach(({ tile, move }) => {
                    this.setTilePosition(tile, move.to);
                    
                    if (move.merge) {
                        const mergeTile = this.tiles.get(move.to);
                        if (mergeTile) {
                            tile.addEventListener('transitionend', () => {
                                tile.remove();
                                mergeTile.textContent = move.value;
                                mergeTile.setAttribute('data-value', move.value);
                                mergeTile.classList.add('merged');
                                setTimeout(() => {
                                    mergeTile.classList.remove('merged');
                                }, 200);
                            }, { once: true });
                        }
                    } else {
                        this.tiles.set(move.to, tile);
                    }
                    this.tiles.delete(move.from);
                });
                
                // 统一的动画完成时间
                setTimeout(resolve, 200);
            });
        });
    }

    updateScore() {
        this.scoreElement.textContent = this.score;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('highScore', this.highScore);
            this.highScoreElement.textContent = this.highScore;
        }
    }

    handleKeyPress(event) {
        const keyToDirection = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right'
        };

        const direction = keyToDirection[event.key];
        if (direction) {
            event.preventDefault();
            this.move(direction);
        }
    }

    isGameOver() {
        if (this.grid.getEmptyCells().length > 0) return false;

        // 检查是否还有可合并的相邻格子
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const current = this.grid.getCell(row, col);
                if (
                    (col < 3 && current === this.grid.getCell(row, col + 1)) ||
                    (row < 3 && current === this.grid.getCell(row + 1, col))
                ) {
                    return false;
                }
            }
        }
        return true;
    }
}

new Game2048();
