/**
 * Laboratorio Yahtzee — Método de Montecarlo
 *
 * Simula el juego Yahtzee clásico con 2 jugadores usando generación
 * de números aleatorios con distribución uniforme discreta:
 *   P(X = k) = 1/6  para  k ∈ {1, 2, 3, 4, 5, 6}
 */

'use strict';

/* ================================================================
   CONSTANTS
   ================================================================ */

const NUM_PLAYERS   = 2;
const NUM_DICE      = 5;
const MAX_ROLLS     = 3;
const NUM_TURNS     = 13;   // categories per player

const UPPER_CATEGORIES = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
const LOWER_CATEGORIES = [
    'threeOfKind', 'fourOfKind', 'fullHouse',
    'smallStraight', 'largeStraight', 'yahtzee', 'chance'
];
const ALL_CATEGORIES = [...UPPER_CATEGORIES, ...LOWER_CATEGORIES];

const UPPER_BONUS_THRESHOLD = 63;
const UPPER_BONUS_VALUE     = 35;

/* ================================================================
   GAME STATE
   ================================================================ */

let gameState = {};

function initGameState() {
    gameState = {
        currentPlayer: 0,           // 0 or 1
        rollsLeft: MAX_ROLLS,
        hasRolled: false,
        turnsCompleted: 0,
        totalRolls: 0,
        yahtzeeCount: 0,
        allRollValues: [],          // tracks every individual die value rolled
        dice: Array.from({ length: NUM_DICE }, () => ({ value: null, locked: false })),
        scores: [
            createEmptyScorecard(),
            createEmptyScorecard()
        ],
        gameOver: false
    };
}

function createEmptyScorecard() {
    const card = {};
    ALL_CATEGORIES.forEach(c => { card[c] = null; });  // null = not yet scored
    card.bonus = null;
    return card;
}

/* ================================================================
   MONTE CARLO — RANDOM NUMBER GENERATION
   ================================================================ */

/**
 * Lanzar un dado con distribución uniforme discreta.
 * Genera un entero en [1, 6]: P(X=k) = 1/6.
 * @returns {number} Valor del dado (1–6)
 */
function rollSingleDie() {
    // Genera número aleatorio en [0,1) con distribución uniforme
    const random = Math.random();

    // Transforma a entero en [1,6]
    // P(X=k) = 1/6 para k ∈ {1,2,3,4,5,6}
    return Math.floor(random * 6) + 1;
}

/**
 * Lanzar todos los dados no bloqueados (simulación Montecarlo).
 */
function rollDice() {
    if (gameState.rollsLeft === 0 || gameState.gameOver) return;

    // Lanzar solo dados no bloqueados
    gameState.dice.forEach((die, index) => {
        if (!die.locked) {
            const prev = die.value;
            // Aplicar método de Montecarlo
            die.value = rollSingleDie();
            gameState.totalRolls++;
            gameState.allRollValues.push(die.value);

            // Trigger rolling animation
            const el = document.getElementById('die-' + index);
            el.classList.remove('rolling');
            void el.offsetWidth;           // reflow to restart animation
            el.classList.add('rolling');
        }
    });

    gameState.rollsLeft--;
    gameState.hasRolled = true;

    updateDisplay();
    updateScorecard();  // show available score previews
}

/* ================================================================
   LOCKING DICE
   ================================================================ */

function toggleLock(index) {
    if (!gameState.hasRolled || gameState.gameOver) return;
    if (gameState.dice[index].value === null) return;

    gameState.dice[index].locked = !gameState.dice[index].locked;
    updateDiceDisplay();
}

/* ================================================================
   SCORING
   ================================================================ */

/**
 * Calcular puntuación según categoría.
 * @param {string} category
 * @param {number[]} diceValues  Array de 5 valores
 * @returns {number}
 */
function calculateScore(category, diceValues) {
    const counts = {};
    const sum = diceValues.reduce((a, b) => a + b, 0);

    // Contar frecuencias
    diceValues.forEach(val => {
        counts[val] = (counts[val] || 0) + 1;
    });

    const frequencies = Object.values(counts);

    switch (category) {
        case 'ones':
        case 'twos':
        case 'threes':
        case 'fours':
        case 'fives':
        case 'sixes': {
            const num = { ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6 }[category];
            return (counts[num] || 0) * num;
        }

        case 'threeOfKind':
            return frequencies.some(f => f >= 3) ? sum : 0;

        case 'fourOfKind':
            return frequencies.some(f => f >= 4) ? sum : 0;

        case 'fullHouse':
            return (frequencies.includes(3) && frequencies.includes(2)) ? 25 : 0;

        case 'smallStraight': {
            const unique = [...new Set(diceValues)].sort((a, b) => a - b);
            return hasSequence(unique, 4) ? 30 : 0;
        }

        case 'largeStraight': {
            const sorted = [...new Set(diceValues)].sort((a, b) => a - b);
            return hasSequence(sorted, 5) ? 40 : 0;
        }

        case 'yahtzee':
            return frequencies.includes(5) ? 50 : 0;

        case 'chance':
            return sum;

        default:
            return 0;
    }
}

/**
 * Check if the sorted unique array contains a consecutive sequence of length n.
 * @param {number[]} sorted  Sorted array of unique values
 * @param {number}   n       Required sequence length
 * @returns {boolean}
 */
function hasSequence(sorted, n) {
    if (sorted.length < n) return false;
    let consecutive = 1;
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i - 1] + 1) {
            consecutive++;
            if (consecutive >= n) return true;
        } else if (sorted[i] !== sorted[i - 1]) {
            consecutive = 1;
        }
    }
    return consecutive >= n;
}

/**
 * Player selects a scoring category.
 * @param {number} playerIndex  0 or 1
 * @param {string} category
 */
function selectCategory(playerIndex, category) {
    // Only the active player can score
    if (playerIndex !== gameState.currentPlayer) return;
    if (!gameState.hasRolled) return;
    if (gameState.scores[playerIndex][category] !== null) return;
    if (gameState.gameOver) return;

    const diceValues = gameState.dice.map(d => d.value);
    const score = calculateScore(category, diceValues);

    gameState.scores[playerIndex][category] = score;

    // Detect Yahtzee for stats
    if (category === 'yahtzee' && score === 50) {
        gameState.yahtzeeCount++;
    }

    // Check upper bonus
    checkUpperBonus(playerIndex);

    gameState.turnsCompleted++;

    // Advance turn
    nextTurn();
}

/**
 * Award upper-section bonus once all upper categories are scored.
 * The bonus is only evaluated after all six upper categories are filled.
 */
function checkUpperBonus(playerIndex) {
    const card = gameState.scores[playerIndex];
    const allUpperScored = UPPER_CATEGORIES.every(c => card[c] !== null);

    if (allUpperScored) {
        const upperSum = UPPER_CATEGORIES.reduce((acc, c) => acc + (card[c] || 0), 0);
        card.bonus = upperSum >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS_VALUE : 0;
    }
}

/**
 * Move to the next player / end the game.
 */
function nextTurn() {
    // Check if game is over (all 13 categories scored for both players)
    const allDone = [0, 1].every(p =>
        ALL_CATEGORIES.every(c => gameState.scores[p][c] !== null)
    );

    if (allDone) {
        endGame();
        return;
    }

    // Find next player who still has categories left
    let next = (gameState.currentPlayer + 1) % NUM_PLAYERS;
    let tries = 0;
    while (
        ALL_CATEGORIES.every(c => gameState.scores[next][c] !== null) &&
        tries < NUM_PLAYERS
    ) {
        next = (next + 1) % NUM_PLAYERS;
        tries++;
    }

    gameState.currentPlayer = next;
    gameState.rollsLeft = MAX_ROLLS;
    gameState.hasRolled = false;
    gameState.dice = Array.from({ length: NUM_DICE }, () => ({ value: null, locked: false }));

    updateDisplay();
    updateScorecard();
}

/**
 * Calculate the grand total for a player (scores + bonus).
 */
function getTotal(playerIndex) {
    const card = gameState.scores[playerIndex];
    let total = ALL_CATEGORIES.reduce((acc, c) => acc + (card[c] || 0), 0);
    if (card.bonus === UPPER_BONUS_VALUE) total += UPPER_BONUS_VALUE;
    return total;
}

/* ================================================================
   GAME FLOW
   ================================================================ */

function endGame() {
    gameState.gameOver = true;

    const t0 = getTotal(0);
    const t1 = getTotal(1);

    let title, msg;
    if (t0 > t1) {
        title = '🏆 ¡Jugador 1 Gana!';
        msg   = 'Jugador 1 obtiene la victoria con mayor puntuación.';
    } else if (t1 > t0) {
        title = '🏆 ¡Jugador 2 Gana!';
        msg   = 'Jugador 2 obtiene la victoria con mayor puntuación.';
    } else {
        title = '🤝 ¡Empate!';
        msg   = 'Ambos jugadores obtuvieron la misma puntuación.';
    }

    document.getElementById('winnerTitle').textContent   = title;
    document.getElementById('winnerMessage').textContent = msg;
    document.getElementById('finalScores').innerHTML =
        `<div>👤 Jugador 1: ${t0} pts</div><div>👤 Jugador 2: ${t1} pts</div>`;

    document.getElementById('winnerModal').style.display = 'flex';
    updateDisplay();
    updateScorecard();
}

function newGame() {
    document.getElementById('winnerModal').style.display = 'none';
    initGameState();
    updateDisplay();
    updateScorecard();
}

/* ================================================================
   UI UPDATES
   ================================================================ */

function updateDisplay() {
    const p = gameState.currentPlayer;

    document.getElementById('currentPlayer').textContent =
        gameState.gameOver ? '—' : `Jugador ${p + 1}`;
    document.getElementById('rollsLeft').textContent = gameState.rollsLeft;

    const completedTurns = Math.ceil(gameState.turnsCompleted / NUM_PLAYERS);
    document.getElementById('turnInfo').textContent =
        `${Math.min(completedTurns + 1, NUM_TURNS)} / ${NUM_TURNS}`;

    updateDiceDisplay();
    updateStats();

    // Roll button state
    const rollBtn = document.getElementById('rollBtn');
    rollBtn.disabled = gameState.rollsLeft === 0 || gameState.gameOver;

    // Active player highlight on scorecards
    [0, 1].forEach(i => {
        const sc = document.getElementById('scorecard-' + i);
        sc.classList.toggle('active-player', i === p && !gameState.gameOver);
    });

    // Hint text
    const hint = document.getElementById('diceHint');
    if (gameState.gameOver) {
        hint.textContent = '🏁 Juego terminado. ¡Mira el marcador final!';
    } else if (!gameState.hasRolled) {
        hint.textContent = '🎲 Haz clic en "Lanzar Dados" para comenzar tu turno';
    } else if (gameState.rollsLeft > 0) {
        hint.textContent = '🔒 Haz clic en un dado para bloquearlo · Luego vuelve a lanzar o elige una categoría';
    } else {
        hint.textContent = '📊 Lanzamientos agotados — elige una categoría de puntuación';
    }
}

function updateDiceDisplay() {
    gameState.dice.forEach((die, index) => {
        const dieEl  = document.getElementById('die-' + index);
        const faceEl = document.getElementById('dieFace-' + index);

        faceEl.textContent = die.value !== null ? die.value : '?';
        dieEl.classList.toggle('locked', die.locked);
    });
}

function updateStats() {
    document.getElementById('statTotalRolls').textContent    = gameState.totalRolls;
    document.getElementById('statTurnsCompleted').textContent = gameState.turnsCompleted;
    document.getElementById('statYahtzees').textContent       = gameState.yahtzeeCount;

    const avg = gameState.allRollValues.length > 0
        ? (gameState.allRollValues.reduce((a, b) => a + b, 0) / gameState.allRollValues.length).toFixed(2)
        : '3.50';
    document.getElementById('statAvgRoll').textContent = avg;
}

/**
 * Refresh all scorecard cells:
 *  - Used categories → show final score (styled)
 *  - Available categories during active turn → show preview score
 *  - Unavailable → show dash
 */
function updateScorecard() {
    const p          = gameState.currentPlayer;
    const diceValues = gameState.hasRolled ? gameState.dice.map(d => d.value) : null;

    [0, 1].forEach(playerIndex => {
        const card = gameState.scores[playerIndex];

        ALL_CATEGORIES.forEach(cat => {
            const rowEl   = document.getElementById(`score-${playerIndex}-${cat}`);
            const scoreEl = document.getElementById(`scoreVal-${playerIndex}-${cat}`);
            if (!rowEl || !scoreEl) return;

            if (card[cat] !== null) {
                // Already scored
                scoreEl.textContent = card[cat];
                scoreEl.className   = 'category-score ' + (card[cat] > 0 ? 'scored' : 'zero');
                rowEl.classList.add('used');
                rowEl.classList.remove('available-hint');
            } else if (
                playerIndex === p &&
                gameState.hasRolled &&
                !gameState.gameOver &&
                diceValues
            ) {
                // Show preview
                const preview = calculateScore(cat, diceValues);
                scoreEl.textContent = preview;
                scoreEl.className   = 'category-score';
                rowEl.classList.add('available-hint');
                rowEl.classList.remove('used');
            } else {
                scoreEl.textContent = '-';
                scoreEl.className   = 'category-score';
                rowEl.classList.remove('used', 'available-hint');
            }
        });

        // Bonus display
        const bonusEl  = document.getElementById(`bonusVal-${playerIndex}`);
        const upperSum = UPPER_CATEGORIES.reduce((acc, c) => acc + (card[c] || 0), 0);
        if (card.bonus !== null) {
            bonusEl.textContent = card.bonus > 0 ? `+${card.bonus}` : '0';
            bonusEl.className   = 'category-score ' + (card.bonus > 0 ? 'scored' : 'zero');
        } else {
            bonusEl.textContent = `${upperSum} / ${UPPER_BONUS_THRESHOLD}`;
            bonusEl.className   = 'category-score';
        }

        // Totals
        document.getElementById(`total-${playerIndex}`).textContent = getTotal(playerIndex);
    });
}

/* ================================================================
   MISC UI
   ================================================================ */

function toggleInstructions() {
    const panel = document.getElementById('instructionsPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

/* ================================================================
   INITIALISATION
   ================================================================ */

document.addEventListener('DOMContentLoaded', () => {
    initGameState();
    updateDisplay();
    updateScorecard();
});
