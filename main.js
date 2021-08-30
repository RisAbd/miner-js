

class Minefield extends Array {
  constructor(w, h) {
    super(h);
    this.w = w;
    this.h = h; 
    this.fill(0).forEach((_, i, a) => {
      a[i] = new Array(h).fill(0).map(() => ({isChecked: false, isRevealed: false, value: this.VALUE_ZERO}));
    });
  }
  _flattenXY(x, y) {
    return y * this.w + x;
  }
  _xyPos(fromFlat) {
    return [fromFlat % this.w, Math.floor(fromFlat / this.w)];
  }
  _ensureXY(pos) {
    if (typeof pos === 'number') {
      // flattened xy
      return this._xyPos(pos);
    } else {
      // [x, y]
      return pos;
    }
  }
  plantBombs(n, positions = null, excludePos = null) {
    if (positions) {
      this.bombPositions = new Set(positions);
    } else {
      // define random unique places

      if (n > (this.w * this.h)-1) {
        throw new Error(`Impossible to place ${n} bombs on ${this.w}x${this.h} field`);
      }

      this.bombPositions = new Set();
      while (this.bombPositions.size < n) {
        this.bombPositions.add(Math.floor(Math.random() * (this.w * this.h)));

        // todo: to exclude first click on field
        if (excludePos) {
          this.bombPositions.delete(this._flattenXY(...this._ensureXY(excludePos)));
        };
      }
    }

    // check input positions correntness
    if (positions && positions.size !== n) {
      throw new Error('Unique positions size not matching given size');
    }

    // plant on field
    Array.from(this.bombPositions).forEach(flatPos => {
      const [xPos, yPos] = this._xyPos(flatPos);
      this[yPos][xPos].value = this.VALUE_BOMB;
    });

    // todo: fill with values in lazy mode?
    // fill with hint values
    this.forEach((row, y) => {
      row.forEach((_, x) => {
        this[y][x].value = this._calculateValue(x, y);
      })
    });
  }
  _calculateValue(x, y) {
    if (this[y][x].value === this.VALUE_BOMB) return this.VALUE_BOMB;
    let bombCountForCell = 0;
    for (let y2 = Math.max(0, y-1); y2 < Math.min(y+2, this.h); y2++) {
      for (let x2 = Math.max(0, x-1); x2 < Math.min(x+2, this.w); x2++) {
        if (this[y2][x2].value === this.VALUE_BOMB) {
          bombCountForCell += 1;
        }
      }
    }
    return bombCountForCell;
  }
  get(pos) {
    const [x, y] = this._ensureXY(pos);
    return this[y][x];
  }
  reveal(pos) {
    const [x, y] = this._ensureXY(pos);
    const cell = this[y][x];
    if (cell.isRevealed || cell.isChecked) {
      return;
    }
    cell.isRevealed = true;
    if (cell.value === this.VALUE_BOMB) {
      // todo: this.state = LOST
      // reveal all bombs
      // cell.isGameLosing = true;
      return this.REVEAL_RESULT_BOMB;
    } else if (cell.value == this.VALUE_ZERO) {
      return this.REVEAL_RESULT_ZERO;
    } else {
      for (let y2 = 0; y2 < this.h; y2++) {
        for (let x2 = 0; x2 < this.w; x2++) {
          const c = this[y2][x2];
          if (!c.isRevealed && c.value !== this.VALUE_BOMB) {
            return this.REVEAL_RESULT_TIP;
          }
        }
      }
      // todo: this.state = WIN
      // cell.isGameWinning = true;
      return this.REVEAL_RESULT_WIN;
    }
  }
  toggleCheck(pos) {
    const [x, y] = this._ensureXY(pos);
    const v = !this[y][x].isChecked;
    this[y][x].isChecked = v;
    return v;
  }
  _neighborPositions(pos) {
    const [x, y] = this._ensureXY(pos);
    const r = [];
    for (let y2 = Math.max(0, y-1); y2 < Math.min(y+2, this.h); y2++) {
      for (let x2 = Math.max(0, x-1); x2 < Math.min(x+2, this.w); x2++) {
        r.push([x2, y2]);
      }
    }
    return r;
  }
  _unrevealedNeighborPositions(pos) {
    const ns = this._neighborPositions(pos);
    return ns.filter(([x, y]) => !this[y][x].isRevealed);
  }
  toString() {
    return this.map(row => row.map(i => (i.value+'').padStart(2, ' ')).join(' ')).join('\n');
  }
}


Minefield.prototype.VALUE_BOMB = -1;
Minefield.prototype.VALUE_ZERO = 0;

Minefield.prototype.REVEAL_RESULT_BOMB = 0;   // opened bomb
Minefield.prototype.REVEAL_RESULT_WIN = 1;    // revealed last non-bomb cell
Minefield.prototype.REVEAL_RESULT_TIP = 2;    // revealed number (tip)
Minefield.prototype.REVEAL_RESULT_ZERO = 3;   // revealed zero, can recursively open nearby cells again


customElements.define('minefield-game', class MinefieldGame extends HTMLElement {
  static get observedAttributes() {
    return ['width', 'height', 'bombs-count'];
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || oldValue === null) {
      return;
    }
    console.log('todo: %s: %s => %s', name, oldValue, newValue);
  }

  getWidth() {
    return parseInt(this.getAttribute('width')) || 10;
  }
  getHeight() {
    return parseInt(this.getAttribute('height')) || 10;
  }
  getBombsCount() {
    return parseInt(this.getAttribute('bombs-count')) || 10;
  }
  constructor() {
    super();

    this._minefield = new Minefield(this.getWidth(), this.getHeight());
    // todo: plant on first cell reveal with exclude first coordinates
    this._minefield.plantBombs(this.getBombsCount(), null, [0, 0]);
    // console.log(this._minefield+'');

    this._onCellClick = this._onCellClick.bind(this);
    this._onCellMouseDown = this._onCellMouseDown.bind(this);
    this._initCells();
  }
  _initCells() {
    const root = this.attachShadow({mode: 'open'});
    root.innerHTML = `
<style>
  .container {
    width: 100%;
    height: 100%;
    display: grid;
    grid-auto-rows: 1fr;
    grid-template-columns: repeat(${this._minefield.w}, 1fr);
    background-color: rgb(230, 230, 230);
  }
  .cell {
    position: relative;
    display: inline-block;
  }
  .cell.component {
    width: 100%;
    height: 100%;
    position: absolute;
    display: block;
    text-align: center;
    font-size: 2rem;
  }
  span.cell.component {
    border: 1px dashed rgba(200, 200, 200, 0.3);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
  }
  .bomb {

  }
  .cell[data-value="-1"] > span.red {
    background-color: red;
  }
  .cell[data-value="1"] > span { color: blue; }
  .cell[data-value="2"] > span { color: green; }
  .cell[data-value="3"] > span { color: red; }
  .cell[data-value="4"] > span { color: navy; }
  .cell[data-value="5"] > span { color: maroon; }
  .cell[data-value="6"] > span { color: teal; }
  .cell[data-value="7"] > span { color: black; }
  .cell[data-value="8"] > span { color: gray; }

</style>
`;
    const cellsContainer = document.createElement('div');
    cellsContainer.classList.add('container');
    for (let y = 0; y < this._minefield.h; y++) {
      for (let x = 0; x < this._minefield.w; x++) {
        const cell = document.createElement('div');
        cell.dataset.id = this._minefield._flattenXY(x, y);
        const cellModel = this._minefield[y][x];
        cellModel._el = cell;
        const value = cellModel.value;
        cell.dataset.value = value;
        cell.classList.toggle('cell');
        cell.innerHTML = `
<span class="cell component">${value > 0 ? value : (value === -1 ? '*' : '')}</span>
<button class="cell component" oncontextmenu="return false;"></button>
`;
        const button = cell.querySelector('button');
        button.addEventListener('click', this._onCellClick);
        button.addEventListener('mousedown', this._onCellMouseDown);

        cellsContainer.appendChild(cell);
      }
    }

    root.appendChild(cellsContainer);
  }
  _onCellMouseDown(e) {
    if (e.which === 3) {
      const cellEl = e.target.parentNode;
      const id = +cellEl.dataset.id;
      e.target.innerText = this._minefield.toggleCheck(id) ? 'v' : '';
    }
  }
  _onCellClick(e) {
    const cellEl = e.target.parentNode;
    const id = +cellEl.dataset.id;

    const res = this._minefield.reveal(id);
    if (res !== undefined) {
      this._revealCellElement(cellEl);
    }

    const cellText = cellEl.querySelector('span');

    switch (res) {
      case this._minefield.REVEAL_RESULT_BOMB: {
        cellText.classList.add('red');
        console.log('LOST :(');
        break;
      }
      case this._minefield.REVEAL_RESULT_WIN: {
        console.log('WON DA GAME! B)');
        break;
      }
      case this._minefield.REVEAL_RESULT_TIP: {
        break;
      }
      case this._minefield.REVEAL_RESULT_ZERO: {
        this._blackMagic(id);
        break;
      }

    }
  }
  _revealCellElement(el) {
    const button = el.querySelector('button');
    button.removeEventListener('click', this._onCellClick);
    button.removeEventListener('mousedown', this._onCellMouseDown);
    button.style.display = 'none';
  }
  _blackMagic(id) {
    const neighbors = this._minefield._unrevealedNeighborPositions(id);
    while (neighbors.length > 0) {
      const nPos = neighbors.pop();
      this._revealCellElement(this._minefield.get(nPos)._el);
      const res = this._minefield.reveal(nPos);
      if (res === this._minefield.REVEAL_RESULT_ZERO) {
        neighbors.push(...this._minefield._unrevealedNeighborPositions(nPos));
      }
    }
  }
});
