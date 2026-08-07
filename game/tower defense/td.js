const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// --- HỆ THỐNG ÂM THANH ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
}

function playSound(type) {
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle && !soundToggle.checked) return;
    if (!audioCtx) return;

    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'shoot') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(450, now);
            osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
            osc.start(now); osc.stop(now + 0.08);
        } else if (type === 'hit') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(160, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
            osc.start(now); osc.stop(now + 0.08);
        } else if (type === 'hurt') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.linearRampToValueAtTime(60, now + 0.15);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
            osc.start(now); osc.stop(now + 0.15);
        } else if (type === 'gameover') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.6);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.6);
            osc.start(now); osc.stop(now + 0.6);
        }
    } catch (e) {}
}

// --- GAME STATE ---
let gold = 50;
let wave = 1;
let inWave = false;
let isGameOver = false;
let gameStarted = false;
let enemiesToSpawn = 0;
let spawnTimer = 0;
let lastShootTime = 0;
let animationFrameId = null;
let currentSkin = 'default';

// Cấu hình Tháp
const tower = {
    x: 0,
    y: 0,
    maxHp: 100,
    hp: 100,
    damage: 15,
    attackSpeed: 2.0,
    range: 150,
    multishotChance: 0.02
};

const costs = { damage: 10, speed: 15, range: 20, hp: 20, multishot: 30 };

let enemies = [];
let bullets = [];
let enemyBullets = [];

// Tự động căn chỉnh kích thước Canvas chuẩn theo màn hình
function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    tower.x = canvas.width / 2;
    tower.y = canvas.height / 2;
}
window.addEventListener('resize', resizeCanvas);
document.addEventListener('fullscreenchange', () => setTimeout(resizeCanvas, 100));

// --- POPUP & TAB SKIN ---
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function switchSkinTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).style.display = 'block';
    event.target.classList.add('active');
}

function selectSkin(skin) {
    currentSkin = skin;
    closeModal('skin-modal');
}

// --- GAME LOGIC ---
function startGame() {
    initAudio();
    document.getElementById('start-menu').style.display = 'none';
    document.getElementById('game-play-ui').style.display = 'flex';
    document.getElementById('game-over-overlay').style.display = 'none';
    
    resizeCanvas();
    resetGame();
    gameStarted = true;
    lastTime = performance.now();
    
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(gameLoop);
}

function quitToMenu() {
    gameStarted = false;
    isGameOver = false;
    inWave = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    
    document.getElementById('game-play-ui').style.display = 'none';
    document.getElementById('start-menu').style.display = 'flex';
}

function restartGame() {
    document.getElementById('game-over-overlay').style.display = 'none';
    startGame();
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && document.getElementById('start-menu').style.display !== 'none') {
        startGame();
    }
});

function resetGame() {
    gold = 50;
    wave = 1;
    inWave = false;
    isGameOver = false;
    enemies = [];
    bullets = [];
    enemyBullets = [];
    tower.maxHp = 100;
    tower.hp = 100;
    tower.damage = 15;
    tower.attackSpeed = 2.0;
    tower.range = 150;
    tower.multishotChance = 0.02;
    costs.damage = 10;
    costs.speed = 15;
    costs.range = 20;
    costs.hp = 20;
    costs.multishot = 30;

    const waveBtn = document.getElementById('start-wave-btn');
    if (waveBtn) {
        waveBtn.style.display = 'block';
        waveBtn.innerText = 'BẮT ĐẦU GAME';
    }
    updateUI();
}

function startWave() {
    if (inWave || isGameOver) return;
    initAudio();
    inWave = true;
    enemiesToSpawn = 5 + wave * 3;
    const waveBtn = document.getElementById('start-wave-btn');
    if (waveBtn) waveBtn.style.display = 'none';
}

function buyUpgrade(type) {
    if (gold < costs[type] || isGameOver) return;

    gold -= costs[type];
    if (type === 'damage') {
        tower.damage += 10;
        costs.damage = Math.floor(costs.damage * 1.5);
    } else if (type === 'speed') {
        tower.attackSpeed += 0.5;
        costs.speed = Math.floor(costs.speed * 1.6);
    } else if (type === 'range') {
        tower.range += 20;
        costs.range = Math.floor(costs.range * 1.4);
    } else if (type === 'hp') {
        tower.maxHp += 30;
        tower.hp += 30;
        costs.hp = Math.floor(costs.hp * 1.4);
    } else if (type === 'multishot') {
        tower.multishotChance += 0.015;
        costs.multishot = Math.floor(costs.multishot * 1.7);
    }
    updateUI();
}

function updateUI() {
    if (document.getElementById('gold-txt')) document.getElementById('gold-txt').innerText = gold;
    if (document.getElementById('wave-txt')) document.getElementById('wave-txt').innerText = wave;
    if (document.getElementById('hp-txt')) {
        document.getElementById('hp-txt').innerText = `${Math.max(0, Math.floor(tower.hp))}/${tower.maxHp}`;
    }

    if (document.getElementById('val-dmg')) document.getElementById('val-dmg').innerText = tower.damage;
    if (document.getElementById('cost-dmg')) document.getElementById('cost-dmg').innerText = costs.damage;
    if (document.getElementById('btn-dmg')) document.getElementById('btn-dmg').disabled = gold < costs.damage;

    if (document.getElementById('val-spd')) document.getElementById('val-spd').innerText = tower.attackSpeed.toFixed(1) + '/s';
    if (document.getElementById('cost-spd')) document.getElementById('cost-spd').innerText = costs.speed;
    if (document.getElementById('btn-spd')) document.getElementById('btn-spd').disabled = gold < costs.speed;

    if (document.getElementById('val-rng')) document.getElementById('val-rng').innerText = tower.range;
    if (document.getElementById('cost-rng')) document.getElementById('cost-rng').innerText = costs.range;
    if (document.getElementById('btn-rng')) document.getElementById('btn-rng').disabled = gold < costs.range;

    if (document.getElementById('val-hp')) document.getElementById('val-hp').innerText = tower.maxHp;
    if (document.getElementById('cost-hp')) document.getElementById('cost-hp').innerText = costs.hp;
    if (document.getElementById('btn-hp')) document.getElementById('btn-hp').disabled = gold < costs.hp;

    if (document.getElementById('val-multi')) document.getElementById('val-multi').innerText = (tower.multishotChance * 100).toFixed(2) + '%';
    if (document.getElementById('cost-multi')) document.getElementById('cost-multi').innerText = costs.multi;
    if (document.getElementById('btn-multi')) document.getElementById('btn-multi').disabled = gold < costs.multishot;
}

// --- SINH QUÁI ---
function spawnEnemy() {
    const angle = Math.random() * Math.PI * 2;
    const spawnDist = Math.max(canvas.width, canvas.height) / 2 + 50;
    
    let type = 'normal';
    if (wave >= 10 && enemiesToSpawn === 1) {
        type = 'boss';
    } else if (wave >= 3 && Math.random() < 0.4) {
        type = 'archer';
    }

    let enemy = {
        x: tower.x + Math.cos(angle) * spawnDist,
        y: tower.y + Math.sin(angle) * spawnDist,
        type: type,
        hp: 20 + wave * 15,
        maxHp: 20 + wave * 15,
        speed: 0.8 + Math.random() * 0.3,
        reward: 3 + wave,
        damage: 8 + wave * 2,
        attackCooldown: 0,
        range: 25
    };

    if (type === 'archer') {
        enemy.hp *= 0.8;
        enemy.range = 140;
        enemy.damage *= 0.8;
        enemy.color = '#ffaa00';
    } else if (type === 'boss') {
        enemy.hp = (100 + wave * 50) * 3;
        enemy.maxHp = enemy.hp;
        enemy.speed = 0.5;
        enemy.damage = 30 + wave * 5;
        enemy.reward = 50;
        enemy.color = '#aa00ff';
        enemy.radius = 20;
    } else {
        enemy.color = '#00ff88';
        enemy.radius = 8;
    }

    enemies.push(enemy);
}

function shootBullet(target, isExtra = false, angleOffset = 0) {
    if (!isExtra) playSound('shoot');
    const baseAngle = Math.atan2(target.y - tower.y, target.x - tower.x) + angleOffset;
    bullets.push({
        x: tower.x,
        y: tower.y,
        vx: Math.cos(baseAngle) * 10,
        vy: Math.sin(baseAngle) * 10,
        damage: tower.damage
    });
}

function handleGameOver() {
    isGameOver = true;
    inWave = false;
    playSound('gameover');
    document.getElementById('go-wave-text').innerText = `Bạn đã vượt qua Wave ${wave - 1}`;
    document.getElementById('game-over-overlay').style.display = 'flex';
}

// --- GAME LOOP ---
let lastTime = performance.now();

function gameLoop(now) {
    if (!gameStarted || isGameOver) return;

    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (inWave && enemiesToSpawn > 0) {
        spawnTimer += dt;
        if (spawnTimer >= 0.8) {
            spawnEnemy();
            enemiesToSpawn--;
            spawnTimer = 0;
        }
    }

    if (now - lastShootTime >= 1000 / tower.attackSpeed) {
        let nearestEnemy = null;
        let minDist = tower.range;

        enemies.forEach(e => {
            const dist = Math.hypot(e.x - tower.x, e.y - tower.y);
            if (dist < minDist) {
                minDist = dist;
                nearestEnemy = e;
            }
        });

        if (nearestEnemy) {
            shootBullet(nearestEnemy);
            if (Math.random() < tower.multishotChance) {
                shootBullet(nearestEnemy, true, -0.2);
                shootBullet(nearestEnemy, true, 0.2);
            }
            lastShootTime = now;
        }
    }

    // Đạn Tháp
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;

        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j];
            if (Math.hypot(e.x - b.x, e.y - b.y) < (e.radius || 8) + 4) {
                e.hp -= b.damage;
                playSound('hit');
                hit = true;
                break;
            }
        }

        if (hit || Math.hypot(b.x - tower.x, b.y - tower.y) > tower.range + 50) {
            bullets.splice(i, 1);
        }
    }

    // Đạn Quái Cung
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        let eb = enemyBullets[i];
        eb.x += eb.vx;
        eb.y += eb.vy;

        if (Math.hypot(tower.x - eb.x, tower.y - eb.y) < 18) {
            tower.hp -= eb.damage;
            playSound('hurt');
            updateUI();
            enemyBullets.splice(i, 1);

            if (tower.hp <= 0) {
                tower.hp = 0;
                updateUI();
                handleGameOver();
                return;
            }
        } else if (Math.hypot(eb.startX - eb.x, eb.startY - eb.y) > 300) {
            enemyBullets.splice(i, 1);
        }
    }

    // Cập nhật Quái
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];

        if (e.hp <= 0) {
            gold += e.reward;
            enemies.splice(i, 1);
            updateUI();
            continue;
        }

        const distToTower = Math.hypot(tower.x - e.x, tower.y - e.y);
        if (distToTower > e.range) {
            const angle = Math.atan2(tower.y - e.y, tower.x - e.x);
            e.x += Math.cos(angle) * e.speed;
            e.y += Math.sin(angle) * e.speed;
        } else {
            e.attackCooldown = (e.attackCooldown || 0) - dt;
            if (e.attackCooldown <= 0) {
                if (e.type === 'archer') {
                    const angle = Math.atan2(tower.y - e.y, tower.x - e.x);
                    enemyBullets.push({
                        x: e.x, y: e.y,
                        startX: e.x, startY: e.y,
                        vx: Math.cos(angle) * 5,
                        vy: Math.sin(angle) * 5,
                        damage: e.damage
                    });
                    e.attackCooldown = 1.5;
                } else {
                    tower.hp -= e.damage;
                    playSound('hurt');
                    updateUI();
                    e.attackCooldown = 1.0;

                    if (tower.hp <= 0) {
                        tower.hp = 0;
                        updateUI();
                        handleGameOver();
                        return;
                    }
                }
            }
        }
    }

    // Auto Skip Wave
    if (inWave && enemiesToSpawn === 0 && enemies.length === 0) {
        inWave = false;
        wave++;
        updateUI();
        setTimeout(() => {
            if (!isGameOver && gameStarted) {
                startWave();
            }
        }, 1000);
    }

    // --- RENDER CANVAS ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Vòng Tầm Bắn
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2);
    ctx.stroke();

    // Render Skin Tháp
    let towerColor = '#ff0055';
    if (currentSkin === 'ice') towerColor = '#00f2fe';
    if (currentSkin === 'metal') towerColor = '#ffd700';

    ctx.fillStyle = towerColor;
    ctx.shadowColor = towerColor;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Render Quái
    enemies.forEach(e => {
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius || 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ff0055';
        ctx.fillRect(e.x - 10, e.y - (e.radius || 8) - 6, 20, 3);
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(e.x - 10, e.y - (e.radius || 8) - 6, Math.max(0, (e.hp / e.maxHp)) * 20, 3);
    });

    // Render Đạn
    ctx.fillStyle = '#00f2fe';
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 8;
    bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.fillStyle = '#ffaa00';
    ctx.shadowColor = '#ffaa00';
    enemyBullets.forEach(eb => {
        ctx.beginPath();
        ctx.arc(eb.x, eb.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.shadowBlur = 0;

    animationFrameId = requestAnimationFrame(gameLoop);
}

updateUI();