const difficultyMap = {
  easy: 40,
  medium: 50,
  hard: 58,
};

const STORAGE_KEY = 'sudoku-app-state-v1';

const startScreen = document.getElementById('startScreen');
const gameScreen = document.getElementById('gameScreen');
const resumeCard = document.getElementById('resumeCard');
const continueBtn = document.getElementById('continueBtn');
const homeBtn = document.getElementById('homeBtn');
const menuBtn = document.getElementById('menuBtn');
const menuPanel = document.getElementById('menuPanel');
const menuCloseBtn = document.getElementById('menuCloseBtn');
const keypadCloseBtn = document.getElementById('keypadCloseBtn');
const gridWrapEl = document.getElementById('gridWrap');
const keypadEl = document.getElementById('keypad');
const gridEl = document.getElementById('grid');
const statusEl = document.getElementById('status');
const statsEl = document.getElementById('stats');
const difficultyEl = document.getElementById('difficulty');
const newGameBtn = document.getElementById('newGameBtn');
const showSolutionBtn = document.getElementById('showSolutionBtn');
const noteModeBtn = document.getElementById('noteModeBtn');
const hintBtn = document.getElementById('hintBtn');
const undoBtn = document.getElementById('undoBtn');
const checkBtn = document.getElementById('checkBtn');
const saveBtn = document.getElementById('saveBtn');
const copyPuzzleBtn = document.getElementById('copyPuzzleBtn');
const copySolutionBtn = document.getElementById('copySolutionBtn');
const clearSaveBtn = document.getElementById('clearSaveBtn');
const startButtons = document.querySelectorAll('[data-start-diff]');

let puzzle = [];
let solution = [];
let values = [];
let notes = [];
let history = [];
let selected = null;
let noteMode = false;
let showingSolution = false;
let timer = 0;
let timerHandle = null;
let errors = new Set();
let loadedFromStorage = false;
let currentDifficulty = 'medium';

function createEmptyGrid(fill = 0) {
  return Array.from({ length: 9 }, () => Array(9).fill(fill));
}

function cloneGrid(grid) {
  return grid.map(row => [...row]);
}

function cloneNotes(src) {
  return src.map(row => row.map(cell => new Set(cell)));
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isValid(board, row, col, num) {
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === num || board[i][col] === num) return false;
  }

  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let r = startRow; r < startRow + 3; r++) {
    for (let c = startCol; c < startCol + 3; c++) {
      if (board[r][c] === num) return false;
    }
  }

  return true;
}

function fillBoard(board) {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] !== 0) continue;
      const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      for (const num of nums) {
        if (isValid(board, row, col, num)) {
          board[row][col] = num;
          if (fillBoard(board)) return true;
          board[row][col] = 0;
        }
      }
      return false;
    }
  }
  return true;
}

function countSolutions(board, limit = 2) {
  let count = 0;

  function solve() {
    if (count >= limit) return;

    let row = -1;
    let col = -1;
    let minCandidates = 10;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] !== 0) continue;
        let candidateCount = 0;
        for (let n = 1; n <= 9; n++) {
          if (isValid(board, r, c, n)) candidateCount++;
        }
        if (candidateCount < minCandidates) {
          minCandidates = candidateCount;
          row = r;
          col = c;
        }
      }
    }

    if (row === -1) {
      count++;
      return;
    }

    for (let n = 1; n <= 9; n++) {
      if (!isValid(board, row, col, n)) continue;
      board[row][col] = n;
      solve();
      board[row][col] = 0;
      if (count >= limit) return;
    }
  }

  solve();
  return count;
}

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function serializeCell(r, c) {
  return `${r}-${c}`;
}

function isMobileView() {
  return window.matchMedia('(max-width: 520px)').matches;
}

function openMobilePad() {
  if (!isMobileView() || gameScreen.hidden || showingSolution) return;
  document.body.classList.add('mobile-pad-open');
}

function closeMobilePad() {
  document.body.classList.remove('mobile-pad-open');
}

function syncMobilePadState() {
  const shouldOpen = isMobileView() && !gameScreen.hidden && !!selected && !showingSolution;
  document.body.classList.toggle('mobile-pad-open', shouldOpen);
}

function fitMobileLayout() {
  if (gameScreen.hidden || !isMobileView()) {
    gameScreen.style.removeProperty('--board-size');
    return;
  }

  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const viewportWidth = window.visualViewport?.width || window.innerWidth;
  const topbarHeight = document.querySelector('.topbar')?.offsetHeight || 0;
  const metaHeight = document.querySelector('.meta')?.offsetHeight || 0;
  const gaps = 26;
  const horizontalPadding = 24;

  const boardSize = Math.max(
    260,
    Math.floor(
      Math.min(
        viewportHeight - topbarHeight - metaHeight - gaps,
        viewportWidth - horizontalPadding,
      ),
    ),
  );

  gameScreen.style.setProperty('--board-size', `${boardSize}px`);
  syncMobilePadState();
}

function setScreen(mode) {
  const game = mode === 'game';
  startScreen.hidden = game;
  gameScreen.hidden = !game;
  document.body.classList.toggle('game-mode', game);
  if (!game) closeMenu();
  if (!game) document.body.classList.remove('mobile-pad-open');
  requestAnimationFrame(fitMobileLayout);
}

function openMenu() {
  menuPanel.hidden = false;
  document.body.classList.add('menu-open');
}

function closeMenu() {
  menuPanel.hidden = true;
  document.body.classList.remove('menu-open');
}

function toggleMenu() {
  if (menuPanel.hidden) openMenu();
  else closeMenu();
}

function setNoteModeUI() {
  noteModeBtn.textContent = `Poznámky: ${noteMode ? 'zapnuto' : 'vypnuto'}`;
  noteModeBtn.classList.toggle('active', noteMode);
}

function updateStats() {
  const given = puzzle.flat().filter(Boolean).length;
  const filled = values.flat().filter(Boolean).length;
  statsEl.textContent = `Dáno: ${given} · Vyplněno: ${filled} · Čas: ${formatTime(timer)}`;
}

function startTimer() {
  clearInterval(timerHandle);
  timerHandle = setInterval(() => {
    if (!showingSolution && gameScreen && !gameScreen.hidden) {
      timer++;
      updateStats();
    }
  }, 1000);
}

function markErrorCells() {
  errors.clear();
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const value = values[r][c];
      if (!value || puzzle[r][c] !== 0) continue;
      if (value !== solution[r][c]) errors.add(serializeCell(r, c));
    }
  }
}

function isRelatedCell(r, c) {
  if (!selected) return false;
  const [sr, sc] = selected;
  return r === sr || c === sc || (Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(c / 3) === Math.floor(sc / 3));
}

function renderCell(r, c) {
  const cell = document.createElement('button');
  const value = showingSolution ? solution[r][c] : values[r][c];
  const given = puzzle[r][c] !== 0;
  const selectedHere = selected && selected[0] === r && selected[1] === c;
  const related = isRelatedCell(r, c);
  const same = selected && values[selected[0]][selected[1]] !== 0 && value !== 0 && value === values[selected[0]][selected[1]] && !selectedHere;
  const error = errors.has(serializeCell(r, c));

  cell.type = 'button';
  cell.setAttribute('aria-label', `Řádek ${r + 1}, sloupec ${c + 1}`);

  if (value === 0) {
    const noteWrap = document.createElement('div');
    noteWrap.className = 'notes';
    for (let n = 1; n <= 9; n++) {
      const span = document.createElement('span');
      span.className = 'note' + (notes[r][c].has(n) ? ' filled' : '');
      span.textContent = notes[r][c].has(n) ? String(n) : '';
      noteWrap.appendChild(span);
    }
    cell.appendChild(noteWrap);
  } else {
    cell.textContent = String(value);
  }

  cell.className = 'cell';
  if (given) cell.classList.add('given', 'fixed');
  else if (!showingSolution && value) cell.classList.add('user');
  else if (showingSolution) cell.classList.add('solution');
  else cell.classList.add('empty');
  if (selectedHere) cell.classList.add('selected');
  if (related) cell.classList.add('related');
  if (same) cell.classList.add('same');
  if (error) cell.classList.add('error');

  if (c === 2 || c === 5) cell.style.borderRight = '2px solid rgba(60, 45, 22, 0.24)';
  if (r === 2 || r === 5) cell.style.borderBottom = '2px solid rgba(60, 45, 22, 0.24)';

  cell.addEventListener('click', () => {
    if (showingSolution) return;
    selected = [r, c];
    render();
    openMobilePad();
    syncMobilePadState();
  });

  return cell;
}

function render() {
  gridEl.innerHTML = '';
  markErrorCells();

  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const box = document.createElement('div');
      box.className = 'box';
      for (let r = br * 3; r < br * 3 + 3; r++) {
        for (let c = bc * 3; c < bc * 3 + 3; c++) {
          box.appendChild(renderCell(r, c));
        }
      }
      gridEl.appendChild(box);
    }
  }

  showSolutionBtn.textContent = showingSolution ? 'Skrýt řešení' : 'Ukázat řešení';
  updateStats();
  setNoteModeUI();
  syncMobilePadState();
}

function pushHistory() {
  history.push({
    values: cloneGrid(values),
    notes: cloneNotes(notes),
    selected: selected ? [...selected] : null,
    timer,
    errors: [...errors],
  });

  if (history.length > 200) history.shift();
}

function restoreHistory() {
  const state = history.pop();
  if (!state) return;
  values = cloneGrid(state.values);
  notes = cloneNotes(state.notes);
  selected = state.selected;
  timer = state.timer;
  errors = new Set(state.errors);
  render();
  statusEl.textContent = 'Vrácen předchozí krok.';
}

function checkWin() {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (values[r][c] !== solution[r][c]) return false;
    }
  }
  statusEl.textContent = 'Hotovo. Sudoku je vyřešené.';
  return true;
}

function generatePuzzle(difficulty = currentDifficulty) {
  currentDifficulty = difficulty;
  difficultyEl.value = difficulty;

  const full = createEmptyGrid();
  fillBoard(full);
  solution = cloneGrid(full);

  puzzle = cloneGrid(full);
  const removals = difficultyMap[difficulty] ?? 50;
  let removed = 0;
  const cells = shuffle(Array.from({ length: 81 }, (_, i) => i));

  for (const index of cells) {
    if (removed >= removals) break;
    const r = Math.floor(index / 9);
    const c = index % 9;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;

    const testBoard = cloneGrid(puzzle);
    if (countSolutions(testBoard, 2) !== 1) {
      puzzle[r][c] = backup;
    } else {
      removed++;
    }
  }

  values = cloneGrid(puzzle);
  notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
  history = [];
  selected = null;
  errors = new Set();
  showingSolution = false;
  noteMode = false;
  timer = 0;
  loadedFromStorage = false;
  render();
  startTimer();
  statusEl.textContent = 'Nové sudoku je připravené.';
  requestAnimationFrame(fitMobileLayout);
}

function boardToText(board) {
  return board.map(row => row.map(n => (n === 0 ? '.' : n)).join(' ')).join('\n');
}

function persistState() {
  const state = {
    difficulty: currentDifficulty,
    puzzle,
    solution,
    values,
    notes: notes.map(row => row.map(cell => [...cell])),
    history,
    selected,
    noteMode,
    timer,
    errors: [...errors],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function saveState() {
  persistState();
  statusEl.textContent = 'Hra uložena.';
}

function getSavedState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSavedState() {
  localStorage.removeItem(STORAGE_KEY);
  statusEl.textContent = 'Uložená hra smazána.';
  showResumeCard();
}

function showResumeCard() {
  resumeCard.hidden = !getSavedState();
}

function loadState(state) {
  if (!state) return false;

  try {
    currentDifficulty = state.difficulty || 'medium';
    difficultyEl.value = currentDifficulty;
    puzzle = state.puzzle;
    solution = state.solution;
    values = state.values;
    notes = state.notes.map(row => row.map(cell => new Set(cell)));
    history = state.history || [];
    selected = state.selected;
    noteMode = !!state.noteMode;
    showingSolution = false;
    timer = state.timer || 0;
    errors = new Set(state.errors || []);
    loadedFromStorage = true;
    render();
    startTimer();
    statusEl.textContent = 'Načtená rozehraná hra.';
    setNoteModeUI();
    requestAnimationFrame(fitMobileLayout);
    return true;
  } catch {
    return false;
  }
}

function inputNumber(num) {
  if (!selected || showingSolution) return;
  const [r, c] = selected;
  if (puzzle[r][c] !== 0) return;
  pushHistory();

  if (noteMode) {
    if (values[r][c] !== 0) values[r][c] = 0;
    if (notes[r][c].has(num)) notes[r][c].delete(num);
    else notes[r][c].add(num);
    statusEl.textContent = `Poznámka ${num} přepnuta.`;
  } else {
    values[r][c] = num;
    notes[r][c].clear();
    statusEl.textContent = `Zapsáno ${num}.`;
  }

  render();
  closeMobilePad();
  checkWin();
  requestAnimationFrame(fitMobileLayout);
}

function eraseSelected() {
  if (!selected || showingSolution) return;
  const [r, c] = selected;
  if (puzzle[r][c] !== 0) return;
  pushHistory();
  values[r][c] = 0;
  notes[r][c].clear();
  render();
  statusEl.textContent = 'Buňka smazána.';
  requestAnimationFrame(fitMobileLayout);
}

function hint() {
  if (!selected || showingSolution) return;
  const [r, c] = selected;
  if (puzzle[r][c] !== 0) return;
  pushHistory();
  values[r][c] = solution[r][c];
  notes[r][c].clear();
  render();
  statusEl.textContent = 'Doplněna nápověda.';
  checkWin();
  requestAnimationFrame(fitMobileLayout);
}

function checkBoard() {
  markErrorCells();
  render();
  const count = errors.size;
  statusEl.textContent = count === 0 ? 'Žádná chyba nenalezena.' : `Nalezeno chyb: ${count}.`;
}

function toggleSolution() {
  showingSolution = !showingSolution;
  render();
  statusEl.textContent = showingSolution ? 'Zobrazeno řešení.' : 'Zobrazeno zadání.';
}

function handleKeydown(e) {
  if (startScreen && !startScreen.hidden) return;
  if (menuPanel && !menuPanel.hidden) {
    if (e.key === 'Escape') closeMenu();
    return;
  }
  if (showingSolution) return;

  if (/^[1-9]$/.test(e.key)) {
    inputNumber(Number(e.key));
    return;
  }

  if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
    eraseSelected();
    return;
  }

  if (!selected) return;
  let [r, c] = selected;
  if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
  else if (e.key === 'ArrowDown') r = Math.min(8, r + 1);
  else if (e.key === 'ArrowLeft') c = Math.max(0, c - 1);
  else if (e.key === 'ArrowRight') c = Math.min(8, c + 1);
  else if (e.key.toLowerCase() === 'n') {
    noteMode = !noteMode;
    setNoteModeUI();
    statusEl.textContent = `Režim poznámek ${noteMode ? 'zapnut' : 'vypnut'}.`;
    return;
  } else if (e.key.toLowerCase() === 'h') {
    hint();
    return;
  } else if (e.key.toLowerCase() === 'u') {
    restoreHistory();
    return;
  } else {
    return;
  }

  selected = [r, c];
  render();
  requestAnimationFrame(fitMobileLayout);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    statusEl.textContent = 'Zkopírováno do schránky.';
  } catch {
    statusEl.textContent = 'Kopírování se nepodařilo.';
  }
}

function startGameFromStart(difficulty) {
  closeMenu();
  setScreen('game');
  generatePuzzle(difficulty);
}

function resumeGame() {
  const saved = getSavedState();
  if (saved && loadState(saved)) {
    closeMenu();
    setScreen('game');
    return;
  }
  statusEl.textContent = 'Uložená hra nebyla nalezena.';
  showResumeCard();
}

newGameBtn.addEventListener('click', () => startGameFromStart(difficultyEl.value));
showSolutionBtn.addEventListener('click', toggleSolution);
noteModeBtn.addEventListener('click', () => {
  noteMode = !noteMode;
  setNoteModeUI();
  statusEl.textContent = `Režim poznámek ${noteMode ? 'zapnut' : 'vypnut'}.`;
});
hintBtn.addEventListener('click', hint);
undoBtn.addEventListener('click', restoreHistory);
checkBtn.addEventListener('click', checkBoard);
saveBtn.addEventListener('click', saveState);
copyPuzzleBtn.addEventListener('click', () => copyText(boardToText(puzzle)));
copySolutionBtn.addEventListener('click', () => copyText(boardToText(solution)));
clearSaveBtn.addEventListener('click', clearSavedState);
difficultyEl.addEventListener('change', () => {
  currentDifficulty = difficultyEl.value;
});
menuBtn.addEventListener('click', toggleMenu);
menuCloseBtn.addEventListener('click', closeMenu);
keypadCloseBtn.addEventListener('click', closeMobilePad);
homeBtn.addEventListener('click', () => {
  setScreen('start');
  showResumeCard();
});
continueBtn.addEventListener('click', resumeGame);

startButtons.forEach(btn => {
  btn.addEventListener('click', () => startGameFromStart(btn.dataset.startDiff));
});

document.querySelectorAll('[data-num]').forEach(btn => {
  btn.addEventListener('click', () => inputNumber(Number(btn.dataset.num)));
});

document.addEventListener('keydown', handleKeydown);
document.addEventListener('click', event => {
  if (menuPanel.hidden) return;
  if (menuPanel.contains(event.target) || menuBtn.contains(event.target)) return;
  closeMenu();
});
window.addEventListener('resize', fitMobileLayout);
window.visualViewport?.addEventListener('resize', fitMobileLayout);
window.addEventListener('beforeunload', () => {
  if (!startScreen.hidden) return;
  persistState();
});

showResumeCard();
const saved = getSavedState();
if (saved) {
  currentDifficulty = saved.difficulty || 'medium';
  difficultyEl.value = currentDifficulty;
}
setScreen('start');
setNoteModeUI();
