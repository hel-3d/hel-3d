const board = document.getElementById('game-board'); 
const boardSize = 8;
let gameBoard = [];
let draggedCell = null;
let score = 0;
let moves = 0;

// Загружаем звуки
const startSound = new Audio('start.wav');
const goodSound = new Audio('good.wav');

// Функция для воспроизведения звука
function playSound(sound) {
    sound.play();
}

const crystalImages = {
    red: ['images/red1.png', 'images/red2.png', 'images/red3.png'],
    yellow: ['images/yel1.png', 'images/yel2.png', 'images/yel3.png'],
    green: ['images/green1.png', 'images/green2.png', 'images/green3.png'],
    blue: ['images/blue1.png', 'images/blue2.png', 'images/blue3.png'],
    purple: ['images/pink1.png', 'images/pink2.png', 'images/pink3.png']
};

const colors = ['red', 'yellow', 'green', 'blue', 'purple'];

function initGame() {
    for (let row = 0; row < boardSize; row++) {
        gameBoard[row] = [];
        for (let col = 0; col < boardSize; col++) {
            let randomColor;
            do {
                randomColor = getRandomColor();
            } while (createsMatch(row, col, randomColor));

            gameBoard[row][col] = randomColor;
            const randomCrystalImage = getRandomCrystal(randomColor);
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.style.backgroundImage = `url(${randomCrystalImage})`;
            cell.dataset.row = row;
            cell.dataset.col = col;

            cell.setAttribute('draggable', true);
            cell.addEventListener('dragstart', onDragStart);
            cell.addEventListener('dragover', onDragOver);
            cell.addEventListener('drop', onDrop);

            board.appendChild(cell);
        }
    }
    playSound(startSound);  // Воспроизведение звука при загрузке игры
    checkAndRemoveAllMatches();  // Проверка после генерации
}

function getRandomColor() {
    return colors[Math.floor(Math.random() * colors.length)];
}

function getRandomCrystal(color) {
    const forms = crystalImages[color];
    return forms[Math.floor(Math.random() * forms.length)];
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

function onDragStart(event) {
    draggedCell = event.target;
}

function onDragOver(event) {
    event.preventDefault();
}

function onDrop(event) {
    const droppedCell = event.target;
    const draggedRow = parseInt(draggedCell.dataset.row);
    const draggedCol = parseInt(draggedCell.dataset.col);
    const droppedRow = parseInt(droppedCell.dataset.row);
    const droppedCol = parseInt(droppedCell.dataset.col);

    if (isAdjacent(draggedRow, draggedCol, droppedRow, droppedCol)) {
        swapCells(draggedRow, draggedCol, droppedRow, droppedCol);
        if (checkForMatches()) {
            moves++;
            updateMoves();
            checkAndRemoveAllMatches(); // Добавляем проверку после хода
        } else {
            setTimeout(() => {
                swapCells(droppedRow, droppedCol, draggedRow, draggedCol);
            }, 300);
        }
    }
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

    const cell1 = document.querySelector(`[data-row="${row1}"][data-col="${col1}"]`);
    const cell2 = document.querySelector(`[data-row="${row2}"][data-col="${col2}"]`);

    const tempImage = cell1.style.backgroundImage;
    cell1.style.backgroundImage = cell2.style.backgroundImage;
    cell2.style.backgroundImage = tempImage;
}

function checkForMatches() {
    let matches = [];

    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize - 2; col++) {
            let matchLength = 1;
            while (col + matchLength < boardSize && gameBoard[row][col] === gameBoard[row][col + matchLength]) {
                matchLength++;
            }

            if (matchLength >= 3) {
                for (let i = 0; i < matchLength; i++) {
                    matches.push([row, col + i]);
                }
                addScore(matchLength);
                col += matchLength - 1;
            }
        }
    }

    for (let col = 0; col < boardSize; col++) {
        for (let row = 0; row < boardSize - 2; row++) {
            let matchLength = 1;
            while (row + matchLength < boardSize && gameBoard[row][col] === gameBoard[row + matchLength][col]) {
                matchLength++;
            }

            if (matchLength >= 3) {
                for (let i = 0; i < matchLength; i++) {
                    matches.push([row + i, col]);
                }
                addScore(matchLength);
                row += matchLength - 1;
            }
        }
    }

    if (matches.length > 0) {
        playSound(goodSound);  // Воспроизведение звука при совпадении
        removeMatches(matches);
        return true;
    }
    return false;
}

function addScore(matchLength) {
    if (matchLength === 3) {
        score += 3;
    } else if (matchLength === 4) {
        score += 5;
    } else if (matchLength >= 5) {
        score += 8;
    }
    updateScoreBoard();
}

function updateScoreBoard() {
    document.getElementById('score').textContent = `Очки: ${score}`;
}

function updateMoves() {
    document.getElementById('moves').textContent = `Ходы: ${moves}`;
}

function removeMatches(matches) {
    matches.forEach(([row, col]) => {
        gameBoard[row][col] = getRandomColor();
        const randomCrystalImage = getRandomCrystal(gameBoard[row][col]);
        const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        cell.style.backgroundImage = `url(${randomCrystalImage})`;
    });
}

function checkAndRemoveAllMatches() {
    setTimeout(() => {
        if (checkForMatches()) {
            checkAndRemoveAllMatches();
        }
    }, 300);
}

initGame();
