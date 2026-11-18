const board = document.getElementById('game-board');
const boardSize = 8;
let gameBoard = [];
let bombs = [];       // bombs[row][col] === true, если в клетке бомба
let draggedCell = null;
let score = 0;
let moves = 0;
let combo = 0;        // длина текущей цепочки совпадений
let busy = false;     // блокировка ввода, пока идут анимации
let lastSwap = [];    // клетки, которые игрок поменял последним ходом

// ---------- Звуки ----------
const startSound = new Audio('../shared/start.wav');
const goodSound = new Audio('../shared/good.wav');
goodSound.preservesPitch = false;
goodSound.mozPreservesPitch = false;
goodSound.webkitPreservesPitch = false;

function playSound(sound, rate = 1) {
    try {
        sound.pause();
        sound.currentTime = 0;
        sound.playbackRate = rate;
        const p = sound.play();
        if (p && p.catch) p.catch(() => {}); // браузер может запретить автоплей
    } catch (e) {}
}

// Чем длиннее цепочка, тем выше тон звука
function playMatchSound() {
    playSound(goodSound, Math.min(1 + (combo - 1) * 0.15, 2));
}

// ---------- Картинки кристаллов (gif, с запасным png) ----------
const crystalImages = {
    red:    ['images/red1.gif', 'images/red2.gif', 'images/red3.gif'],
    yellow: ['images/yel1.gif', 'images/yel2.gif', 'images/yel3.gif'],
    green:  ['images/green1.gif', 'images/green2.gif', 'images/green3.gif'],
    blue:   ['images/blue1.gif', 'images/blue2.gif', 'images/blue3.gif'],
    purple: ['images/pink1.gif', 'images/pink2.gif', 'images/pink3.gif']
};

const colors = ['red', 'yellow', 'green', 'blue', 'purple'];

// Анимированные бомбы (цвет бомбы совпадает с цветом кристалла)
const bombImages = {
    red: 'images/bomb_red.gif',
    yellow: 'images/bomb_yellow.gif',
    green: 'images/bomb_green.gif',
    blue: 'images/bomb_blue.gif',
    purple: 'images/bomb_purple.gif'
};

const colorHex = {
    red: '#ff3b3b',
    yellow: '#ffd23b',
    green: '#3bff6a',
    blue: '#3bb8ff',
    purple: '#c13bff'
};

// Если gif-файла нет (сейчас нет yel*.gif), берём png с тем же именем
function preloadImages() {
    const jobs = [];
    Object.values(bombImages).forEach(src => { new Image().src = src; });
    for (const color of colors) {
        crystalImages[color] = crystalImages[color].map(src => {
            return new Promise(resolve => {
                const img = new Image();
                img.onload = () => resolve(src);
                img.onerror = () => resolve(src.replace(/\.gif$/, '.png'));
                img.src = src;
            });
        });
        jobs.push(Promise.all(crystalImages[color]).then(list => { crystalImages[color] = list; }));
    }
    return Promise.all(jobs);
}

// ---------- Инициализация ----------
function initGame() {
    for (let row = 0; row < boardSize; row++) {
        gameBoard[row] = [];
        bombs[row] = [];
        for (let col = 0; col < boardSize; col++) {
            let randomColor;
            do {
                randomColor = getRandomColor();
            } while (createsMatch(row, col, randomColor));

            gameBoard[row][col] = randomColor;
            bombs[row][col] = false;
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.style.backgroundImage = `url(${getRandomCrystal(randomColor)})`;
            cell.dataset.row = row;
            cell.dataset.col = col;

            cell.setAttribute('draggable', true);
            cell.addEventListener('dragstart', onDragStart);
            cell.addEventListener('dragover', onDragOver);
            cell.addEventListener('drop', onDrop);

            board.appendChild(cell);
        }
    }
    playSound(startSound);  // сработает, если браузер разрешит автоплей
    checkAndRemoveAllMatches();
}

function getRandomColor() {
    return colors[Math.floor(Math.random() * colors.length)];
}

function getRandomCrystal(color) {
    const forms = crystalImages[color];
    return forms[Math.floor(Math.random() * forms.length)];
}

function getCell(row, col) {
    return document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
}

function createsMatch(row, col, color) {
    if (col >= 2 && gameBoard[row][col - 1] === color && gameBoard[row][col - 2] === color) {
        return true;
    }
    if (row >= 2 && gameBoard[row - 1][col] === color && gameBoard[row - 2][col] === color) {
        return true;
    }
    return false;
}

// ---------- Перетаскивание ----------
function onDragStart(event) {
    if (busy) {
        event.preventDefault();
        return;
    }
    clearHint();
    draggedCell = event.target;
}

function onDragOver(event) {
    event.preventDefault();
}

function onDrop(event) {
    event.preventDefault();
    if (busy || !draggedCell) return;

    const droppedCell = event.target;
    const draggedRow = parseInt(draggedCell.dataset.row);
    const draggedCol = parseInt(draggedCell.dataset.col);
    const droppedRow = parseInt(droppedCell.dataset.row);
    const droppedCol = parseInt(droppedCell.dataset.col);

    if (isAdjacent(draggedRow, draggedCol, droppedRow, droppedCol)) {
        busy = true;
        combo = 0;
        lastSwap = [[draggedRow, draggedCol], [droppedRow, droppedCol]];
        swapCells(draggedRow, draggedCol, droppedRow, droppedCol);
        if (checkForMatches()) {
            moves++;
            updateMoves();
            checkAndRemoveAllMatches();
        } else {
            // Нет совпадений: кристаллы "мотают головой" и возвращаются назад
            const a = getCell(draggedRow, draggedCol);
            const b = getCell(droppedRow, droppedCol);
            a.classList.add('nope');
            b.classList.add('nope');
            setTimeout(() => {
                a.classList.remove('nope');
                b.classList.remove('nope');
                swapCells(droppedRow, droppedCol, draggedRow, draggedCol);
                busy = false;
                scheduleHint();
            }, 350);
        }
    }
    draggedCell = null;
}

function isAdjacent(row1, col1, row2, col2) {
    const rowDiff = Math.abs(row1 - row2);
    const colDiff = Math.abs(col1 - col2);
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

function swapCells(row1, col1, row2, col2) {
    const temp = gameBoard[row1][col1];
    gameBoard[row1][col1] = gameBoard[row2][col2];
    gameBoard[row2][col2] = temp;

    const tempBomb = bombs[row1][col1];
    bombs[row1][col1] = bombs[row2][col2];
    bombs[row2][col2] = tempBomb;

    const cell1 = getCell(row1, col1);
    const cell2 = getCell(row2, col2);

    const tempImage = cell1.style.backgroundImage;
    cell1.style.backgroundImage = cell2.style.backgroundImage;
    cell2.style.backgroundImage = tempImage;

    cell1.classList.toggle('bomb', bombs[row1][col1]);
    cell2.classList.toggle('bomb', bombs[row2][col2]);
}

// ---------- Поиск совпадений ----------
// Возвращает список "полос" из 3+ одинаковых кристаллов
function findRuns() {
    const runs = [];

    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize - 2; col++) {
            let len = 1;
            while (col + len < boardSize && gameBoard[row][col] === gameBoard[row][col + len]) len++;
            if (len >= 3) {
                const cells = [];
                for (let i = 0; i < len; i++) cells.push([row, col + i]);
                runs.push({ cells });
                col += len - 1;
            }
        }
    }

    for (let col = 0; col < boardSize; col++) {
        for (let row = 0; row < boardSize - 2; row++) {
            let len = 1;
            while (row + len < boardSize && gameBoard[row][col] === gameBoard[row + len][col]) len++;
            if (len >= 3) {
                const cells = [];
                for (let i = 0; i < len; i++) cells.push([row + i, col]);
                runs.push({ cells });
                row += len - 1;
            }
        }
    }
    return runs;
}

function checkForMatches() {
    const runs = findRuns();
    if (runs.length === 0) return false;

    let gained = 0;
    runs.forEach(run => { gained += addScore(run.cells.length); });

    const key = (r, c) => `${r},${c}`;
    const toRemove = new Map();
    runs.forEach(run => run.cells.forEach(([r, c]) => toRemove.set(key(r, c), [r, c])));
    const runCellCount = toRemove.size;

    // Полоса из 4+ кристаллов оставляет на поле бомбу (на месте хода игрока или в середине)
    const newBombs = [];
    runs.forEach(run => {
        if (run.cells.length < 4) return;
        const pos = run.cells.find(([r, c]) => lastSwap.some(([sr, sc]) => sr === r && sc === c))
            || run.cells[Math.floor(run.cells.length / 2)];
        if (!bombs[pos[0]][pos[1]]) newBombs.push(pos);
    });

    // Бомбы в совпадении взрываются: убирают область 3x3 (взрыв может задеть другие бомбы)
    const exploding = [];
    const queue = [...toRemove.values()].filter(([r, c]) => bombs[r][c]);
    const seen = new Set(queue.map(([r, c]) => key(r, c)));
    while (queue.length) {
        const [r, c] = queue.pop();
        exploding.push([r, c]);
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr, nc = c + dc;
                if (nr < 0 || nc < 0 || nr >= boardSize || nc >= boardSize) continue;
                toRemove.set(key(nr, nc), [nr, nc]);
                if (bombs[nr][nc] && !seen.has(key(nr, nc))) {
                    seen.add(key(nr, nc));
                    queue.push([nr, nc]);
                }
            }
        }
    }
    gained += (toRemove.size - runCellCount) * 2; // очки за кристаллы, снесённые взрывом

    // Новые бомбы не удаляем: они остаются на поле
    newBombs.forEach(([r, c]) => {
        toRemove.delete(key(r, c));
        bombs[r][c] = true;
        const cell = getCell(r, c);
        cell.style.backgroundImage = `url(${bombImages[gameBoard[r][c]]})`;
        cell.classList.add('bomb');
        cell.animate([
            { transform: 'scale(1.6)', filter: 'brightness(3)' },
            { transform: 'scale(1)', filter: 'brightness(1)' }
        ], { duration: 450, easing: 'ease-out' });
    });

    combo++;
    if (combo > 1) {
        const bonus = gained * (combo - 1); // бонус за цепочку
        score += bonus;
        gained += bonus;
    }
    updateScoreBoard();
    playMatchSound();

    exploding.forEach(([r, c]) => spawnBoom(getCell(r, c)));
    removeMatches([...toRemove.values()], gained, exploding.length > 0);
    lastSwap = [];
    return true;
}

// Возвращает начисленные очки (общий счёт обновляется здесь)
function addScore(matchLength) {
    let points = 0;
    if (matchLength === 3) points = 3;
    else if (matchLength === 4) points = 5;
    else if (matchLength >= 5) points = 8;
    score += points;
    return points;
}

function updateScoreBoard() {
    const el = document.getElementById('score');
    el.textContent = `Score: ${score}`;
    el.classList.remove('bump');
    void el.offsetWidth; // перезапуск анимации
    el.classList.add('bump');
}

function updateMoves() {
    document.getElementById('moves').textContent = `Moves: ${moves}`;
}

// ---------- Удаление, гравитация и эффекты ----------
const CELL_STEP = 52;   // 50px клетка + 2px зазор
const POP_TIME = 250;   // длительность "схлопывания"
let animDelay = 300;    // сколько ждать до следующей проверки совпадений

function removeMatches(cells, gained, boom) {
    const removed = new Set(cells.map(([r, c]) => `${r},${c}`));

    // 1. Схлопываем кристаллы
    cells.forEach(([row, col]) => {
        const cell = getCell(row, col);
        spawnSparkles(cell, colorHex[gameBoard[row][col]]);
        cell.classList.add('pop');
    });

    // 2. Гравитация: в каждом затронутом столбце кристаллы сверху падают вниз,
    //    а сверху добавляются новые
    const columns = [...new Set(cells.map(([, c]) => c))];
    const pending = [];
    let maxDist = 0;

    columns.forEach(col => {
        const kept = [];
        for (let row = boardSize - 1; row >= 0; row--) {
            if (!removed.has(`${row},${col}`)) {
                kept.push({
                    color: gameBoard[row][col],
                    bomb: bombs[row][col],
                    img: getCell(row, col).style.backgroundImage,
                    fromRow: row
                });
            }
        }
        const removedCount = boardSize - kept.length;

        for (let i = 0; i < boardSize; i++) {
            const row = boardSize - 1 - i;
            let color, img, dist, isNew, bomb;
            if (i < kept.length) {
                color = kept[i].color;
                img = kept[i].img;
                bomb = kept[i].bomb;
                dist = row - kept[i].fromRow;
                isNew = false;
            } else {
                color = getRandomColor();
                img = `url(${getRandomCrystal(color)})`;
                bomb = false;
                dist = removedCount;   // новые падают из-за верхней границы поля
                isNew = true;
            }
            gameBoard[row][col] = color;
            bombs[row][col] = bomb;
            if (dist > 0) {
                pending.push({ cell: getCell(row, col), img, bomb, dist, isNew });
                maxDist = Math.max(maxDist, dist);
            }
        }
    });

    setTimeout(() => {
        cells.forEach(([row, col]) => getCell(row, col).classList.remove('pop'));
        pending.forEach(({ cell, img, bomb, dist, isNew }) => {
            cell.style.backgroundImage = img;
            cell.classList.toggle('bomb', bomb);
            cell.animate([
                { transform: `translateY(${-dist * CELL_STEP}px)`, opacity: isNew ? 0 : 1 },
                { transform: 'translateY(0)', opacity: 1, offset: 0.75 },
                { transform: 'translateY(-5px)', offset: 0.88 },
                { transform: 'translateY(0)' }
            ], { duration: 300 + dist * 80, easing: 'ease-in' });
        });
    }, POP_TIME);

    // подождать, пока всё упадёт, и только потом искать новые совпадения
    animDelay = POP_TIME + 300 + maxDist * 80 + 100;

    // всплывающие очки над центром совпадения
    const mid = cells[Math.floor(cells.length / 2)];
    showFloatingText(getCell(mid[0], mid[1]), `+${gained}`, '#fff');

    if (combo >= 2) showBanner(comboWords[Math.min(combo, comboWords.length - 1)]);
    if (cells.length >= 5 || combo >= 3 || boom) shakeBoard();
    if (combo >= 3 || cells.length >= 7) rainCrystals(Math.min(14 + combo * 6 + (boom ? 10 : 0), 50));
}

function spawnSparkles(cell, color) {
    const rect = cell.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const count = 10;

    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'sparkle';
        p.style.left = cx + 'px';
        p.style.top = cy + 'px';
        p.style.background = color;
        p.style.boxShadow = `0 0 8px ${color}`;
        document.body.appendChild(p);

        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
        const dist = 25 + Math.random() * 35;
        const anim = p.animate([
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
            { transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist + 15}px)) scale(0)`, opacity: 0 }
        ], { duration: 500 + Math.random() * 250, easing: 'cubic-bezier(.2,.7,.3,1)' });
        anim.onfinish = () => p.remove();
    }
}

// Кольцо взрыва бомбы
function spawnBoom(cell) {
    const rect = cell.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'boom';
    el.style.left = rect.left + rect.width / 2 + 'px';
    el.style.top = rect.top + rect.height / 2 + 'px';
    document.body.appendChild(el);
    const anim = el.animate([
        { transform: 'translate(-50%, -50%) scale(.3)', opacity: 1 },
        { transform: 'translate(-50%, -50%) scale(3.4)', opacity: 0 }
    ], { duration: 550, easing: 'ease-out' });
    anim.onfinish = () => el.remove();
}

function showFloatingText(cell, text, color) {
    const rect = cell.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = text;
    el.style.left = rect.left + rect.width / 2 + 'px';
    el.style.top = rect.top + 'px';
    el.style.color = color;
    document.body.appendChild(el);
    const anim = el.animate([
        { transform: 'translate(-50%, 0) scale(.6)', opacity: 0 },
        { transform: 'translate(-50%, -20px) scale(1.2)', opacity: 1, offset: 0.25 },
        { transform: 'translate(-50%, -60px) scale(1)', opacity: 0 }
    ], { duration: 900, easing: 'ease-out' });
    anim.onfinish = () => el.remove();
}

const comboWords = ['', '', 'Combo x2!', 'Great! x3', 'Awesome! x4', 'Incredible! x5', 'LEGENDARY! x6'];

function showBanner(text) {
    const container = document.getElementById('game-container');
    const rect = container.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'combo-banner';
    el.textContent = text;
    el.style.left = rect.left + rect.width / 2 + 'px';
    el.style.top = rect.top + rect.height / 2 + 'px';
    document.body.appendChild(el);
    const anim = el.animate([
        { transform: 'translate(-50%, -50%) scale(.3) rotate(-8deg)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(1.15) rotate(3deg)', opacity: 1, offset: 0.3 },
        { transform: 'translate(-50%, -80%) scale(1) rotate(0deg)', opacity: 0 }
    ], { duration: 1100, easing: 'ease-out' });
    anim.onfinish = () => el.remove();
}

function shakeBoard() {
    const container = document.getElementById('game-container');
    container.classList.remove('shake');
    void container.offsetWidth;
    container.classList.add('shake');
}

// Дождь из мини-кристаллов при больших комбо
function rainCrystals(count) {
    const rect = document.getElementById('game-container').getBoundingClientRect();
    const fallTo = window.innerHeight + 80;

    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        const size = 16 + Math.random() * 20;
        el.className = 'rain-gem';
        el.style.width = el.style.height = size + 'px';
        el.style.left = rect.left - 60 + Math.random() * (rect.width + 120) + 'px';
        el.style.backgroundImage = `url(${getRandomCrystal(getRandomColor())})`;
        document.body.appendChild(el);

        const drift = (Math.random() - 0.5) * 120;
        const spin = (Math.random() - 0.5) * 720;
        const anim = el.animate([
            { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
            { transform: `translate(${drift}px, ${fallTo}px) rotate(${spin}deg)`, opacity: 1, offset: 0.9 },
            { transform: `translate(${drift}px, ${fallTo + 30}px) rotate(${spin}deg)`, opacity: 0 }
        ], {
            duration: 1400 + Math.random() * 1200,
            delay: Math.random() * 700,
            easing: 'cubic-bezier(.4, 0, .9, .6)',
            fill: 'backwards'
        });
        anim.onfinish = () => el.remove();
    }
}

// ---------- Подсказка и перемешивание ----------
let hintTimer = null;

function boardHasMatch() {
    return findRuns().length > 0;
}

// Ищет любой ход, после которого появится совпадение
function findMove() {
    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            for (const [dr, dc] of [[0, 1], [1, 0]]) {
                const nr = r + dr, nc = c + dc;
                if (nr >= boardSize || nc >= boardSize) continue;
                const t = gameBoard[r][c];
                gameBoard[r][c] = gameBoard[nr][nc];
                gameBoard[nr][nc] = t;
                const ok = boardHasMatch();
                gameBoard[nr][nc] = gameBoard[r][c];
                gameBoard[r][c] = t;
                if (ok) return [[r, c], [nr, nc]];
            }
        }
    }
    return null;
}

function clearHint() {
    clearTimeout(hintTimer);
    document.querySelectorAll('.cell.hint').forEach(c => c.classList.remove('hint'));
}

function scheduleHint() {
    clearHint();
    hintTimer = setTimeout(showHint, 6000);
}

function showHint() {
    if (busy) {
        scheduleHint();
        return;
    }
    const move = findMove();
    if (!move) return;
    move.forEach(([r, c]) => getCell(r, c).classList.add('hint'));
}

// Если ходов не осталось, перемешиваем кристаллы (бомбы остаются на своих местах)
function reshuffle() {
    showBanner('No moves left. Shuffling!');
    do {
        for (let r = 0; r < boardSize; r++) {
            for (let c = 0; c < boardSize; c++) {
                let color;
                do { color = getRandomColor(); } while (createsMatch(r, c, color));
                gameBoard[r][c] = color;
            }
        }
    } while (!findMove());

    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            const cell = getCell(r, c);
            cell.style.backgroundImage = bombs[r][c]
                ? `url(${bombImages[gameBoard[r][c]]})`
                : `url(${getRandomCrystal(gameBoard[r][c])})`;
            cell.animate([
                { transform: 'scale(0) rotate(-90deg)', opacity: 0 },
                { transform: 'scale(1) rotate(0deg)', opacity: 1 }
            ], { duration: 450, delay: (r + c) * 25, easing: 'ease-out', fill: 'backwards' });
        }
    }
}

function checkAndRemoveAllMatches() {
    busy = true;
    clearHint();
    setTimeout(() => {
        if (checkForMatches()) {
            checkAndRemoveAllMatches();
            return;
        }
        combo = 0;
        animDelay = 300;
        if (!findMove()) {
            reshuffle();
            setTimeout(() => { busy = false; scheduleHint(); }, 900);
        } else {
            busy = false;
            scheduleHint();
        }
    }, animDelay);
}

// Сначала подгружаем картинки (с запасным png), потом запускаем игру
preloadImages().then(initGame);
