// Hàm mở Game
function openGame(gameUrl, gameTitle) {
    const gamePlayer = document.getElementById('gamePlayer');
    const gameFrame = document.getElementById('gameFrame');
    const titleHeader = document.getElementById('gameTitle');

    if (gamePlayer && gameFrame) {
        // Gán link game và đổi tên tiêu đề
        gameFrame.src = gameUrl;
        if (titleHeader) titleHeader.innerText = gameTitle;

        // Bật hiển thị khung game
        gamePlayer.classList.add('active');

        // Cuộn màn hình tới khung game
        gamePlayer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Hàm đóng Game
function closeGame() {
    const gamePlayer = document.getElementById('gamePlayer');
    const gameFrame = document.getElementById('gameFrame');

    if (gamePlayer) {
        gamePlayer.classList.remove('active');
    }
    if (gameFrame) {
        gameFrame.src = '';
    }
}

// Hàm phóng to / Thu nhỏ Full Màn Hình
function toggleFullscreen() {
    const gameFrame = document.getElementById('gameFrame');
    if (!gameFrame) return;

    if (!document.fullscreenElement) {
        if (gameFrame.requestFullscreen) {
            gameFrame.requestFullscreen();
        } else if (gameFrame.webkitRequestFullscreen) {
            gameFrame.webkitRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// GẮN SỰ KIỆN CLICK ĐÚNG ĐƯỜNG DẪN THỰC TẾ
document.addEventListener('DOMContentLoaded', () => {
    const snakeCard = document.getElementById('snakeCard');
    const tdCard = document.getElementById('tdCard');

    if (snakeCard) {
        snakeCard.addEventListener('click', () => openGame('game/snake/snake.html', 'Snake Classic'));
    }

    if (tdCard) {
        snakeCard && tdCard.addEventListener('click', () => openGame('game/tower defense/td.html', 'Tower Defense'));
    }
});