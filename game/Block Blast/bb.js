const GRID_SIZE = 8;
const gridElement = document.getElementById('grid');
const shapesContainer = document.getElementById('shapes-container');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');

let grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));
let score = 0;
let highScore = localStorage.getItem('blockblast_highscore') || 0;
highScoreElement.textContent = highScore;

// DANH SÁCH KHỐI GẠCH (1x1, 2x2, 3x3, L, T, Thanh)
const SHAPES = [
    { shape: [[1]], color: 'color-1' }, // 1x1
    { shape: [[1, 1], [1, 1]], color: 'color-4' }, // 2x2
    { shape: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], color: 'color-5' }, // 3x3
    { shape: [[1, 1]], color: 'color-2' },
    { shape: [[1], [1]], color: 'color-2' },
    { shape: [[1, 1, 1]], color: 'color-3' },
    { shape: [[1], [1], [1]], color: 'color-3' },
    { shape: [[1, 1, 1, 1]], color: 'color-4' },
    { shape: [[1], [1], [1], [1]], color: 'color-4' },
    { shape: [[1, 1, 1, 1, 1]], color: 'color-1' },
    { shape: [[1, 0], [1, 0], [1, 1]], color: 'color-1' },
    { shape: [[0, 1], [0, 1], [1, 1]], color: 'color-1' },
    { shape: [[1, 1, 1], [1, 0, 0]], color: 'color-2' },
    { shape: [[1, 1, 1], [0, 0, 1]], color: 'color-2' },
    { shape: [[1, 0, 0], [1, 0, 0], [1, 1, 1]], color: 'color-2' },
    { shape: [[0, 0, 1], [0, 0, 1], [1, 1, 1]], color: 'color-2' },
    { shape: [[1, 1, 1], [0, 1, 0]], color: 'color-3' },
    { shape: [[0, 1, 0], [1, 1, 1]], color: 'color-3' },
    { shape: [[1, 1], [1, 0]], color: 'color-5' },
    { shape: [[1, 1], [0, 1]], color: 'color-5' }
];

function exitGame() {
    document.getElementById('startScreen').classList.remove('hidden');
}

function startGame() {
    document.getElementById('startScreen').classList.add('hidden');
    resetGame();
}

function resetGame() {
    grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));
    score = 0;
    scoreElement.textContent = score;
    
    const existingGameOver = document.getElementById('gameOverScreen');
    if (existingGameOver) existingGameOver.remove();

    initGrid();
    generateShapes();
}

function initGrid() {
    gridElement.innerHTML = '';
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = r;
            cell.dataset.col = c;
            gridElement.appendChild(cell);
        }
    }
}

function generateShapes() {
    shapesContainer.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const randomShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        createShapePreview(randomShape, i);
    }
}

function createShapePreview(shapeObj, index) {
    const container = document.createElement('div');
    container.classList.add('shape-preview');
    container.dataset.shapeIndex = index;
    container.shapeData = shapeObj;
    
    const cols = shapeObj.shape[0].length;
    container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    
    shapeObj.shape.forEach(row => {
        row.forEach(val => {
            const miniCell = document.createElement('div');
            if (val === 1) {
                miniCell.classList.add('mini-cell', shapeObj.color);
            }
            container.appendChild(miniCell);
        });
    });

    makeElementDraggable(container, shapeObj);
    shapesContainer.appendChild(container);
}

// XỬ LÝ KÉO KHỐI BAY THEO TAY/CHUỘT
function makeElementDraggable(el, shapeObj) {
    let isDragging = false;
    let startX = 0, startY = 0;

    const onPointerDown = (e) => {
        isDragging = true;
        el.setPointerCapture(e.pointerId);
        
        const rect = el.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;

        el.style.position = 'fixed';
        el.style.zIndex = '1000';
        el.style.pointerEvents = 'none';
        moveAt(e.clientX, e.clientY);
    };

    const onPointerMove = (e) => {
        if (!isDragging) return;
        moveAt(e.clientX, e.clientY);

        clearPreview();
        const targetCell = getCellUnderPointer(e.clientX, e.clientY);
        if (targetCell) {
            const r = parseInt(targetCell.dataset.row);
            const c = parseInt(targetCell.dataset.col);
            if (canPlace(shapeObj.shape, r, c)) {
                showPreview(shapeObj.shape, r, c);
            }
        }
    };

    const onPointerUp = (e) => {
        if (!isDragging) return;
        isDragging = false;
        clearPreview();

        const targetCell = getCellUnderPointer(e.clientX, e.clientY);
        let placed = false;

        if (targetCell) {
            const r = parseInt(targetCell.dataset.row);
            const c = parseInt(targetCell.dataset.col);
            if (canPlace(shapeObj.shape, r, c)) {
                placeShape(shapeObj.shape, shapeObj.color, r, c);
                
                // Cộng điểm theo số ô vuông của khối
                let blockCellCount = 0;
                shapeObj.shape.forEach(row => {
                    row.forEach(val => { if (val === 1) blockCellCount++; });
                });
                addScore(blockCellCount);

                el.remove();
                placed = true;

                checkLines();

                if (shapesContainer.children.length === 0) {
                    generateShapes();
                }

                setTimeout(checkGameOver, 350);
            }
        }

        if (!placed) {
            el.style.position = 'relative';
            el.style.left = '0px';
            el.style.top = '0px';
            el.style.zIndex = '1';
            el.style.pointerEvents = 'auto';
        }
    };

    function moveAt(pageX, pageY) {
        el.style.left = (pageX - startX) + 'px';
        el.style.top = (pageY - startY - 30) + 'px';
    }

    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
}

function getCellUnderPointer(x, y) {
    const el = document.elementFromPoint(x, y);
    if (el && el.classList.contains('cell')) {
        return el;
    }
    return null;
}

function showPreview(shape, r, c) {
    const cells = gridElement.children;
    for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
            if (shape[row][col] === 1) {
                let targetR = r + row;
                let targetC = c + col;
                let idx = targetR * GRID_SIZE + targetC;
                if (cells[idx]) {
                    cells[idx].classList.add('preview');
                }
            }
        }
    }
}

function clearPreview() {
    const cells = gridElement.querySelectorAll('.cell.preview');
    cells.forEach(cell => cell.classList.remove('preview'));
}

function canPlace(shape, r, c) {
    for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
            if (shape[row][col] === 1) {
                let targetR = r + row;
                let targetC = c + col;
                if (targetR >= GRID_SIZE || targetC >= GRID_SIZE || grid[targetR][targetC] !== 0) {
                    return false;
                }
            }
        }
    }
    return true;
}

function placeShape(shape, colorClass, r, c) {
    for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
            if (shape[row][col] === 1) {
                grid[r + row][c + col] = colorClass;
            }
        }
    }
    updateGridUI();
}

function updateGridUI() {
    const cells = gridElement.children;
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const index = r * GRID_SIZE + c;
            const cell = cells[index];
            cell.className = 'cell';
            if (grid[r][c] !== 0) {
                cell.classList.add('filled', grid[r][c]);
            }
        }
    }
}

function addScore(points) {
    score += points;
    scoreElement.textContent = score;

    if (score > highScore) {
        highScore = score;
        highScoreElement.textContent = highScore;
        localStorage.setItem('blockblast_highscore', highScore);
    }
}

function checkLines() {
    let rowsToClear = [];
    let colsToClear = [];

    for (let r = 0; r < GRID_SIZE; r++) {
        if (grid[r].every(val => val !== 0)) rowsToClear.push(r);
    }

    for (let c = 0; c < GRID_SIZE; c++) {
        let full = true;
        for (let r = 0; r < GRID_SIZE; r++) {
            if (grid[r][c] === 0) { full = false; break; }
        }
        if (full) colsToClear.push(c);
    }

    let clearedCount = rowsToClear.length + colsToClear.length;
    if (clearedCount > 0) {
        const cells = gridElement.children;

        rowsToClear.forEach(r => {
            for (let c = 0; c < GRID_SIZE; c++) cells[r * GRID_SIZE + c].classList.add('explode');
        });
        colsToClear.forEach(c => {
            for (let r = 0; r < GRID_SIZE; r++) cells[r * GRID_SIZE + c].classList.add('explode');
        });

        setTimeout(() => {
            rowsToClear.forEach(r => grid[r].fill(0));
            colsToClear.forEach(c => {
                for (let r = 0; r < GRID_SIZE; r++) grid[r][c] = 0;
            });

            addScore(clearedCount * 100);
            updateGridUI();
        }, 300);
    }
}

function checkGameOver() {
    const remainingPreviews = document.querySelectorAll('.shape-preview');
    if (remainingPreviews.length === 0) return;

    let canMove = false;

    remainingPreviews.forEach(preview => {
        const shapeObj = preview.shapeData;
        if (!shapeObj) return;

        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (canPlace(shapeObj.shape, r, c)) {
                    canMove = true;
                    return;
                }
            }
            if (canMove) break;
        }
    });

    if (!canMove) {
        showGameOverScreen();
    }
}

function showGameOverScreen() {
    let gameOverDiv = document.getElementById('gameOverScreen');
    if (!gameOverDiv) {
        gameOverDiv = document.createElement('div');
        gameOverDiv.id = 'gameOverScreen';
        gameOverDiv.style.cssText = `
            position: absolute;
            inset: 0;
            background: rgba(15, 23, 42, 0.9);
            backdrop-filter: blur(8px);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 150;
        `;
        gameOverDiv.innerHTML = `
            <h1 style="font-size: 2.5rem; color: #ff0055; text-shadow: 0 0 15px #ff0055; margin-bottom: 10px;">GAME OVER</h1>
            <p style="color: #cbd5e1; font-size: 1.1rem; margin-bottom: 20px;">Điểm của bạn: <b style="color: #00f2fe; font-size: 1.5rem;">${score}</b></p>
            <button class="btn-play" onclick="resetGame()">THỬ LẠI</button>
        `;
        document.querySelector('.game-container').appendChild(gameOverDiv);
    }
}

initGrid();