// ==========================================
// 1. CLEANUP OLD HTML & CANVAS SETUP
// ==========================================
document.body.innerHTML = ''; 

const cssStyles = `
    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        user-select: none;
    }
    html, body {
        width: 100%;
        height: 100%;
        overflow: hidden;
        background-color: #08090d;
        display: block;
    }
    canvas {
        display: block;
        width: 100vw;
        height: 100vh;
        cursor: pointer;
    }
`;
const styleElement = document.createElement('style');
styleElement.innerHTML = cssStyles;
document.head.appendChild(styleElement);

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
document.body.appendChild(canvas);

const GRID_COLS = 30;
const GRID_ROWS = 20;

let cellWidth = 0;
let cellHeight = 0;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    cellWidth = canvas.width / GRID_COLS;
    cellHeight = canvas.height / GRID_ROWS;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();


// ==========================================
// 2. AUDIO SYSTEM (Web Audio API Pure JS)
// ==========================================
let audioCtx = null;
let soundEnabled = localStorage.getItem('snake_sound') !== 'false';

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!soundEnabled || !audioCtx) return;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'eat') {
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'gold_eat') {
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if (type === 'click') {
        osc.frequency.setValueAtTime(400, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
    } else if (type === 'die') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.3);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'shield') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(200, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    }
}


// ==========================================
// 3. GAME STATES, ECONOMY & SAFE DATA LOADING
// ==========================================
const STATES = {
    LOBBY: 'LOBBY',
    SHOP: 'SHOP',
    UPGRADE: 'UPGRADE',
    SETTINGS: 'SETTINGS',
    HOW_TO_PLAY: 'HOW_TO_PLAY',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAMEOVER: 'GAMEOVER'
};

let gameState = STATES.LOBBY;
let score = 0;
let highScore = parseInt(localStorage.getItem('snake_high_score')) || 0;
let coins = parseInt(localStorage.getItem('snake_coins')) || 0;
if (isNaN(coins)) coins = 0;

// Hệ thống Skin
const SKINS = [
    { id: 'default', name: 'Xanh Lá', color: '#00ff88', price: 0 },
    { id: 'cyan', name: 'Xanh Cyber', color: '#00f2fe', price: 20 },
    { id: 'gold', name: 'Vàng Hoàng Gia', color: '#ffcc00', price: 50 },
    { id: 'pink', name: 'Hồng Neon', color: '#ff007f', price: 80 },
    { id: 'rainbow', name: 'Cầu Vồng', color: 'rainbow', price: 150 }
];

let unlockedSkins = JSON.parse(localStorage.getItem('snake_unlocked_skins')) || ['default'];
let equippedSkinId = localStorage.getItem('snake_equipped_skin') || 'default';

// Đọc và Kiểm tra An toàn cho Hệ thống Upgrades (Chống lỗi NaN dữ liệu cũ)
let rawUpgrades = JSON.parse(localStorage.getItem('snake_upgrades')) || {};
let upgrades = {
    coinLevel: parseInt(rawUpgrades.coinLevel) || 0,
    shieldLevel: parseInt(rawUpgrades.shieldLevel) || 0,
    goldFoodLevel: parseInt(rawUpgrades.goldFoodLevel) || 0,
    magnetLevel: parseInt(rawUpgrades.magnetLevel) || 0
};

function saveStorage() {
    localStorage.setItem('snake_high_score', highScore);
    localStorage.setItem('snake_coins', coins);
    localStorage.setItem('snake_unlocked_skins', JSON.stringify(unlockedSkins));
    localStorage.setItem('snake_equipped_skin', equippedSkinId);
    localStorage.setItem('snake_upgrades', JSON.stringify(upgrades));
    localStorage.setItem('snake_sound', soundEnabled);
}

// Lưu lại ngay để ghi đè chuẩn dữ liệu
saveStorage();

let lastRenderTime = 0;
let baseSpeed = 8;
let currentSpeed = baseSpeed;
let currentShields = 0;


// ==========================================
// 4. PARTICLES & VISUAL EFFECTS
// ==========================================
let particles = [];
let bgParticles = [];

for (let i = 0; i < 40; i++) {
    bgParticles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        radius: Math.random() * 2 + 1,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        alpha: Math.random() * 0.5 + 0.1
    });
}

function createEatParticles(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            radius: Math.random() * 4 + 2,
            color, alpha: 1
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.03;
        p.radius *= 0.96;
        if (p.alpha <= 0) particles.splice(i, 1);
    }

    bgParticles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
    });
}

function drawParticles() {
    bgParticles.forEach(p => {
        ctx.fillStyle = `rgba(0, 242, 254, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    });

    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}


// ==========================================
// 5. SNAKE LOGIC
// ==========================================
let snake = [];
let dir = { x: 0, y: 0 };
let nextDir = { x: 0, y: 0 };

function initSnake() {
    snake = [
        { x: 15, y: 10 },
        { x: 15, y: 11 },
        { x: 15, y: 12 }
    ];
    dir = { x: 0, y: -1 };
    nextDir = { x: 0, y: -1 };
    currentShields = upgrades.shieldLevel;
}

function updateSnake() {
    dir = { ...nextDir };
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    let isDead = false;

    // Va chạm tường
    if (head.x < 0 || head.x >= GRID_COLS || head.y < 0 || head.y >= GRID_ROWS) {
        isDead = true;
    }

    // Va chạm thân
    for (let i = 0; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            isDead = true;
            break;
        }
    }

    if (isDead) {
        if (currentShields > 0) {
            currentShields--;
            playSound('shield');
            nextDir = { x: -dir.x, y: -dir.y };
            return;
        } else {
            playSound('die');
            gameOver();
            return;
        }
    }

    // Nam Châm hút mồi
    if (upgrades.magnetLevel > 0) {
        const dist = Math.hypot(head.x - food.x, head.y - food.y);
        if (dist <= upgrades.magnetLevel + 1) {
            if (food.x < head.x) food.x++;
            else if (food.x > head.x) food.x--;
            if (food.y < head.y) food.y++;
            else if (food.y > head.y) food.y--;
        }
    }

    snake.unshift(head);

    // Ăn mồi
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        
        const multiplier = 1 + (upgrades.coinLevel * 0.1);
        const earnedCoins = Math.round((food.isGold ? 5 : 1) * multiplier);
        coins += earnedCoins;

        if (score > highScore) highScore = score;
        saveStorage();

        playSound(food.isGold ? 'gold_eat' : 'eat');

        const pixelX = food.x * cellWidth + cellWidth / 2;
        const pixelY = food.y * cellHeight + cellHeight / 2;
        createEatParticles(pixelX, pixelY, food.isGold ? '#ffcc00' : '#ff0055');

        currentSpeed = baseSpeed + Math.floor(score / 30);
        spawnFood();
    } else {
        snake.pop();
    }
}


// ==========================================
// 6. FOOD LOGIC
// ==========================================
let food = { x: 0, y: 0, isGold: false };

function spawnFood() {
    let valid = false;
    while (!valid) {
        food.x = Math.floor(Math.random() * GRID_COLS);
        food.y = Math.floor(Math.random() * GRID_ROWS);
        valid = !snake.some(segment => segment.x === food.x && segment.y === food.y);
    }

    const goldChance = upgrades.goldFoodLevel * 0.1;
    food.isGold = Math.random() < goldChance;
}


// ==========================================
// 7. INPUT & BUTTON INTERACTION
// ==========================================
let activeButtons = [];

function addButton(text, x, y, width, height, onClick) {
    activeButtons.push({ text, x, y, width, height, onClick });
}

window.addEventListener('click', (e) => {
    initAudio();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    activeButtons.forEach(btn => {
        if (
            mouseX >= btn.x - btn.width / 2 &&
            mouseX <= btn.x + btn.width / 2 &&
            mouseY >= btn.y - btn.height / 2 &&
            mouseY <= btn.y + btn.height / 2
        ) {
            playSound('click');
            btn.onClick();
        }
    });
});

window.addEventListener('keydown', (e) => {
    initAudio();
    const key = e.key.toLowerCase();

    if (e.code === 'Space') {
        if (gameState === STATES.LOBBY || gameState === STATES.GAMEOVER) {
            resetGame();
            gameState = STATES.PLAYING;
        }
        return;
    }

    if (key === 'escape') {
        if (gameState !== STATES.LOBBY && gameState !== STATES.PLAYING) {
            gameState = STATES.LOBBY;
        } else if (gameState === STATES.PLAYING) {
            gameState = STATES.PAUSED;
        } else if (gameState === STATES.PAUSED) {
            gameState = STATES.PLAYING;
        }
        return;
    }

    if (key === 'p') {
        if (gameState === STATES.PLAYING) gameState = STATES.PAUSED;
        else if (gameState === STATES.PAUSED) gameState = STATES.PLAYING;
        return;
    }

    if (gameState === STATES.PLAYING) {
        if ((key === 'arrowup' || key === 'w') && dir.y === 0) nextDir = { x: 0, y: -1 };
        else if ((key === 'arrowdown' || key === 's') && dir.y === 0) nextDir = { x: 0, y: 1 };
        else if ((key === 'arrowleft' || key === 'a') && dir.x === 0) nextDir = { x: -1, y: 0 };
        else if ((key === 'arrowright' || key === 'd') && dir.x === 0) nextDir = { x: 1, y: 0 };
    }
});


// ==========================================
// 8. RENDER GRAPHICS & HUD
// ==========================================
function drawBackground() {
    let gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#0a0d14');
    gradient.addColorStop(1, '#101522');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(0, 242, 254, 0.05)';
    ctx.lineWidth = 1;

    for (let i = 0; i <= GRID_COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellWidth, 0);
        ctx.lineTo(i * cellWidth, canvas.height);
        ctx.stroke();
    }
    for (let j = 0; j <= GRID_ROWS; j++) {
        ctx.beginPath();
        ctx.moveTo(0, j * cellHeight);
        ctx.lineTo(canvas.width, j * cellHeight);
        ctx.stroke();
    }

    drawParticles();
}

function getSkinColor(index) {
    const activeSkin = SKINS.find(s => s.id === equippedSkinId) || SKINS[0];
    if (activeSkin.color === 'rainbow') {
        const hue = (Date.now() / 10 + index * 15) % 360;
        return `hsl(${hue}, 100%, 50%)`;
    }
    return activeSkin.color;
}

function drawSnake() {
    snake.forEach((segment, index) => {
        const x = segment.x * cellWidth;
        const y = segment.y * cellHeight;
        const color = getSkinColor(index);

        ctx.fillStyle = color;

        if (index === 0) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 12;
            ctx.fillRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);

            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 0;
            const eyeSize = Math.max(3, cellWidth * 0.18);

            let eye1X, eye1Y, eye2X, eye2Y;
            if (dir.x === 1) {
                eye1X = eye2X = x + cellWidth * 0.75;
                eye1Y = y + cellHeight * 0.25;
                eye2Y = y + cellHeight * 0.75;
            } else if (dir.x === -1) {
                eye1X = eye2X = x + cellWidth * 0.25;
                eye1Y = y + cellHeight * 0.25;
                eye2Y = y + cellHeight * 0.75;
            } else if (dir.y === -1) {
                eye1Y = eye2Y = y + cellHeight * 0.25;
                eye1X = x + cellWidth * 0.25;
                eye2X = x + cellWidth * 0.75;
            } else {
                eye1Y = eye2Y = y + cellHeight * 0.75;
                eye1X = x + cellWidth * 0.25;
                eye2X = x + cellWidth * 0.75;
            }

            ctx.beginPath();
            ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
            ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(eye1X, eye1Y, eyeSize / 2, 0, Math.PI * 2);
            ctx.arc(eye2X, eye2Y, eyeSize / 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.shadowBlur = 0;
            ctx.fillRect(x + 2, y + 2, cellWidth - 4, cellHeight - 4);
        }
    });
    ctx.shadowBlur = 0;
}

function drawFood() {
    const x = food.x * cellWidth;
    const y = food.y * cellHeight;
    const pulse = Math.sin(Date.now() / 150) * 3;

    const foodColor = food.isGold ? '#ffcc00' : '#ff0055';

    ctx.fillStyle = foodColor;
    ctx.shadowColor = foodColor;
    ctx.shadowBlur = 12 + pulse;

    ctx.beginPath();
    ctx.arc(x + cellWidth / 2, y + cellHeight / 2, Math.min(cellWidth, cellHeight) / 2 - 2 + pulse / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
}

function drawHUD() {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    
    ctx.textAlign = 'left';
    ctx.fillText(`Điểm: ${score}`, 20, 35);

    ctx.fillStyle = '#ffcc00';
    ctx.fillText(`🪙 Xu: ${coins}`, 140, 35);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(`Kỷ lục: ${highScore}`, canvas.width - 20, 35);

    if (currentShields > 0) {
        ctx.fillStyle = '#00f2fe';
        ctx.fillText(`🛡️ Khiên: ${currentShields}`, canvas.width - 20, 65);
    }

    drawButtonUI('⏸️', 260, 28, 40, 30, '#00f2fe');
    addButton('PAUSE_BTN', 260, 28, 40, 30, () => {
        gameState = STATES.PAUSED;
    });
}


// ==========================================
// 9. RENDER MENUS & FIXED UPGRADE LOGIC
// ==========================================
function drawButtonUI(text, x, y, width, height, color = '#00f2fe') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(16, 21, 34, 0.85)';
    
    ctx.fillRect(x - width / 2, y - height / 2, width, height);
    ctx.strokeRect(x - width / 2, y - height / 2, width, height);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
}

function drawLobbyMenu() {
    activeButtons = [];

    ctx.textAlign = 'center';
    ctx.fillStyle = '#00f2fe';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('SNAKE GAME', canvas.width / 2, canvas.height / 2 - 160);

    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`🪙 Tiền hiện có: ${coins} Xu`, canvas.width / 2, canvas.height / 2 - 110);

    const btnWidth = 220;
    const btnHeight = 45;
    const centerX = canvas.width / 2;
    let startY = canvas.height / 2 - 40;

    drawButtonUI('BẮT ĐẦU (SPACE)', centerX, startY, btnWidth, btnHeight, '#00ff88');
    addButton('START', centerX, startY, btnWidth, btnHeight, () => {
        resetGame();
        gameState = STATES.PLAYING;
    });

    drawButtonUI('CỬA HÀNG SKIN', centerX, startY + 60, btnWidth, btnHeight, '#ff007f');
    addButton('SHOP', centerX, startY + 60, btnWidth, btnHeight, () => {
        gameState = STATES.SHOP;
    });

    drawButtonUI('NÂNG CẤP', centerX, startY + 120, btnWidth, btnHeight, '#ffcc00');
    addButton('UPGRADE', centerX, startY + 120, btnWidth, btnHeight, () => {
        gameState = STATES.UPGRADE;
    });

    drawButtonUI('CÀI ĐẶT', centerX, startY + 180, btnWidth, btnHeight);
    addButton('SETTINGS', centerX, startY + 180, btnWidth, btnHeight, () => {
        gameState = STATES.SETTINGS;
    });
}

function drawShopMenu() {
    activeButtons = [];
    const centerX = canvas.width / 2;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff007f';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('CỬA HÀNG SKIN', centerX, 80);

    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`🪙 Xu sở hữu: ${coins}`, centerX, 120);

    let startY = 180;
    const itemWidth = 400;
    const itemHeight = 45;

    SKINS.forEach((skin) => {
        const isUnlocked = unlockedSkins.includes(skin.id);
        const isEquipped = equippedSkinId === skin.id;

        let btnText = `${skin.name} `;
        let btnColor = '#00f2fe';

        if (isEquipped) {
            btnText += ' (ĐANG DÙNG)';
            btnColor = '#00ff88';
        } else if (isUnlocked) {
            btnText += ' (SỬ DỤNG)';
        } else {
            btnText += ` - Giá: ${skin.price} Xu`;
            btnColor = '#ffcc00';
        }

        drawButtonUI(btnText, centerX, startY, itemWidth, itemHeight, btnColor);
        addButton(`SKIN_${skin.id}`, centerX, startY, itemWidth, itemHeight, () => {
            if (isUnlocked) {
                equippedSkinId = skin.id;
                saveStorage();
            } else if (coins >= skin.price) {
                coins -= skin.price;
                unlockedSkins.push(skin.id);
                equippedSkinId = skin.id;
                saveStorage();
            }
        });

        startY += 55;
    });

    drawButtonUI('QUAY LẠI (ESC)', centerX, startY + 20, 200, 45, '#ff0055');
    addButton('BACK', centerX, startY + 20, 200, 45, () => {
        gameState = STATES.LOBBY;
    });
}

// Menu Nâng Cấp - Đã Sửa Hoàn Toàn Lỗi NaN
function drawUpgradeMenu() {
    activeButtons = [];
    const centerX = canvas.width / 2;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('NÂNG CẤP TÍNH NĂNG', centerX, 70);

    ctx.fillStyle = '#ffffff';
    ctx.font = '18px sans-serif';
    ctx.fillText(`🪙 Xu sở hữu: ${coins}`, centerX, 105);

    let startY = 160;
    const itemWidth = 480;
    const itemHeight = 50;

    // 1. Multiplier Xu
    const currentCoinLvl = upgrades.coinLevel || 0;
    const currentRate = (1 + currentCoinLvl * 0.1).toFixed(1);
    const nextRate = (1 + (currentCoinLvl + 1) * 0.1).toFixed(1);
    const multCost = (currentCoinLvl + 1) * 20;

    const multText = currentCoinLvl >= 10 
        ? `Bội số Xu: x${currentRate} (Tối Đa)` 
        : `Bội số Xu: x${currentRate} -> x${nextRate} (${multCost} Xu)`;

    drawButtonUI(multText, centerX, startY, itemWidth, itemHeight, '#00f2fe');
    addButton('UPG_COIN', centerX, startY, itemWidth, itemHeight, () => {
        if (currentCoinLvl < 10 && coins >= multCost) {
            coins -= multCost;
            upgrades.coinLevel = currentCoinLvl + 1;
            saveStorage();
        }
    });

    // 2. Khiên Bảo Vệ (Max 2)
    const currentShieldLvl = upgrades.shieldLevel || 0;
    const shieldCost = (currentShieldLvl + 1) * 60;
    const shieldText = currentShieldLvl >= 2 
        ? `Khiên bảo vệ: ${currentShieldLvl} Khiên (Tối Đa)` 
        : `Khiên bảo vệ: ${currentShieldLvl} -> ${currentShieldLvl + 1} Khiên (${shieldCost} Xu)`;

    drawButtonUI(shieldText, centerX, startY + 65, itemWidth, itemHeight, '#00ff88');
    addButton('UPG_SHIELD', centerX, startY + 65, itemWidth, itemHeight, () => {
        if (currentShieldLvl < 2 && coins >= shieldCost) {
            coins -= shieldCost;
            upgrades.shieldLevel = currentShieldLvl + 1;
            saveStorage();
        }
    });

    // 3. Mồi Vàng May Mắn
    const currentGoldLvl = upgrades.goldFoodLevel || 0;
    const goldCost = (currentGoldLvl + 1) * 30;
    const goldText = currentGoldLvl >= 5 
        ? `Mồi Vàng (+5 Xu): ${currentGoldLvl * 10}% tỷ lệ (Tối Đa)` 
        : `Mồi Vàng (+5 Xu): ${currentGoldLvl * 10}% -> ${(currentGoldLvl + 1) * 10}% tỷ lệ (${goldCost} Xu)`;

    drawButtonUI(goldText, centerX, startY + 130, itemWidth, itemHeight, '#ffcc00');
    addButton('UPG_GOLD', centerX, startY + 130, itemWidth, itemHeight, () => {
        if (currentGoldLvl < 5 && coins >= goldCost) {
            coins -= goldCost;
            upgrades.goldFoodLevel = currentGoldLvl + 1;
            saveStorage();
        }
    });

    // 4. Nam châm
    const currentMagLvl = upgrades.magnetLevel || 0;
    const magCost = (currentMagLvl + 1) * 40;
    const magText = currentMagLvl >= 3 
        ? `Nam châm hút mồi: Cấp ${currentMagLvl} (Tối Đa)` 
        : `Nam châm hút mồi: Cấp ${currentMagLvl} -> Cấp ${currentMagLvl + 1} (${magCost} Xu)`;

    drawButtonUI(magText, centerX, startY + 195, itemWidth, itemHeight, '#ff007f');
    addButton('UPG_MAG', centerX, startY + 195, itemWidth, itemHeight, () => {
        if (currentMagLvl < 3 && coins >= magCost) {
            coins -= magCost;
            upgrades.magnetLevel = currentMagLvl + 1;
            saveStorage();
        }
    });

    drawButtonUI('QUAY LẠI (ESC)', centerX, startY + 270, 200, 45, '#ff0055');
    addButton('BACK', centerX, startY + 270, 200, 45, () => {
        gameState = STATES.LOBBY;
    });
}

function drawSettingsMenu() {
    activeButtons = [];
    const centerX = canvas.width / 2;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#00f2fe';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('CÀI ĐẶT', centerX, canvas.height / 2 - 100);

    const soundText = `Âm thanh: ${soundEnabled ? 'BẬT 🔊' : 'TẮT 🔇'}`;
    drawButtonUI(soundText, centerX, canvas.height / 2 - 20, 300, 50, soundEnabled ? '#00ff88' : '#ff0055');
    addButton('TOGGLE_SOUND', centerX, canvas.height / 2 - 20, 300, 50, () => {
        soundEnabled = !soundEnabled;
        saveStorage();
    });

    drawButtonUI('QUAY LẠI (ESC)', centerX, canvas.height / 2 + 60, 200, 45, '#ff0055');
    addButton('BACK', centerX, canvas.height / 2 + 60, 200, 45, () => {
        gameState = STATES.LOBBY;
    });
}

function drawOverlay(title, subtitle) {
    activeButtons = [];
    ctx.fillStyle = 'rgba(8, 9, 13, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#00f2fe';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(title, centerX, centerY - 60);

    ctx.fillStyle = '#ffffff';
    ctx.font = '18px sans-serif';
    ctx.fillText(subtitle, centerX, centerY - 20);

    if (gameState === STATES.PAUSED) {
        drawButtonUI('TIẾP TỤC (P)', centerX - 110, centerY + 40, 180, 45, '#00ff88');
        addButton('RESUME', centerX - 110, centerY + 40, 180, 45, () => {
            gameState = STATES.PLAYING;
        });
    } else if (gameState === STATES.GAMEOVER) {
        drawButtonUI('CHƠI LẠI (SPACE)', centerX - 110, centerY + 40, 180, 45, '#00ff88');
        addButton('RESTART', centerX - 110, centerY + 40, 180, 45, () => {
            resetGame();
            gameState = STATES.PLAYING;
        });
    }

    drawButtonUI('VỀ SẢNH', centerX + 110, centerY + 40, 180, 45, '#ff0055');
    addButton('GOTO_LOBBY', centerX + 110, centerY + 40, 180, 45, () => {
        gameState = STATES.LOBBY;
    });
}

function render() {
    drawBackground();

    if (gameState === STATES.LOBBY) {
        drawLobbyMenu();
    } else if (gameState === STATES.SHOP) {
        drawShopMenu();
    } else if (gameState === STATES.UPGRADE) {
        drawUpgradeMenu();
    } else if (gameState === STATES.SETTINGS) {
        drawSettingsMenu();
    } else {
        drawFood();
        drawSnake();
        drawHUD();

        if (gameState === STATES.PAUSED) {
            drawOverlay('TẠM DỪNG', 'Game đang tạm dừng');
        } else if (gameState === STATES.GAMEOVER) {
            drawOverlay('GAME OVER', `Điểm của bạn: ${score}`);
        }
    }
}


// ==========================================
// 10. GAME LOOP
// ==========================================
function resetGame() {
    score = 0;
    currentSpeed = baseSpeed;
    particles = [];
    initSnake();
    spawnFood();
}

function gameOver() {
    gameState = STATES.GAMEOVER;
}

function gameLoop(currentTime) {
    requestAnimationFrame(gameLoop);

    updateParticles();

    const secondsSinceLastRender = (currentTime - lastRenderTime) / 1000;
    if (secondsSinceLastRender < 1 / currentSpeed) {
        render();
        return;
    }

    lastRenderTime = currentTime;

    if (gameState === STATES.PLAYING) {
        updateSnake();
    }

    render();
}

// Khởi chạy game
initSnake();
spawnFood();
requestAnimationFrame(gameLoop);