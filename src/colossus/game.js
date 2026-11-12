// COLOSSUS — the match: turns, input, computer players. Talks to the rules, the world and the HUD.
import {
    createState, cloneState, movesFrom, allMoves, applyMove, outcome, turnOrder, countStones, positionKey, COLOR_NAMES, DIR_NAMES,
} from './rules.js';
import { chooseMove } from './ai.js';
import { sfx } from '../audio.js';

export class ColossusGame {
    constructor(world, hud) {
        this.world = world; this.hud = hud;
        this.active = false;   // false while the visitor is still in the exhibition
        this.gen = 0;
        this.busy = false;
        try {
            this.worker = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' });
            this.worker.onmessage = (e) => this.onAI(e.data);
            this.worker.onerror = () => { this.worker = null; };
        } catch (e) { this.worker = null; }
    }

    newGame(settings) {
        this.settings = settings;
        this.gen++;
        this.state = createState(settings.players);
        this.history = [positionKey(this.state)];
        this.over = null; this.busy = false; this.thinking = false;
        this.selected = -1; this.moves = [];
        this.world.setBoard(this.state);
        this.refresh();
        if (this.active) this.nextTurn();
    }

    get order() { return turnOrder(this.state.nPlayers); }
    get color() { return this.order[this.state.turn]; }
    seat(turn = this.state.turn) { return this.settings.seats[turn]; }
    isHuman(turn = this.state.turn) { return this.seat(turn).type === 'human'; }

    setActive(on) {
        this.active = on;
        if (on && !this.over && !this.busy) this.nextTurn();
    }

    seatsChanged() {
        if (this.thinking && !this.busy) { this.gen++; this.thinking = false; this.pending = null; }
        this.refresh();
        if (this.active && !this.over && !this.busy) this.nextTurn();
    }

    refresh() {
        const counts = countStones(this.state), score = [], out = [];
        for (const c of this.order) { score[c] = `${counts[c]}`; out[c] = !!this.state.out[c]; }
        this.hud.update({ order: this.order, turn: this.over ? -1 : this.state.turn, score, out, thinking: this.thinking, over: this.over });
    }

    nextTurn() {
        if (this.over || !this.active) return;
        this.refresh();
        const name = COLOR_NAMES[this.color];
        if (allMoves(this.state)[0].type === 'pass') { this.hud.toast(`${name} cannot move and is passed over`); this.doMove({ type: 'pass' }); return; }
        if (this.isHuman()) { this.hud.status(`${name} to move`); return; }
        this.hud.status(`${name} is thinking…`);
        this.thinking = true;
        const req = { id: ++this.gen, state: cloneState(this.state), level: this.seat().type, mode: 'standard', history: this.history.slice(-40) };
        this.pending = { id: req.id, at: performance.now() };
        if (this.worker) this.worker.postMessage(req);
        else setTimeout(() => this.onAI({ id: req.id, move: chooseMove(req.state, req.level, req.mode, req.history) }), 60);
    }

    onAI({ id, move }) {
        if (!this.pending || id !== this.pending.id || id !== this.gen) return;
        const wait = Math.max(0, 650 - (performance.now() - this.pending.at));
        setTimeout(() => {
            if (id !== this.gen || !this.active) { this.thinking = false; return; }
            this.thinking = false;
            if (move) this.doMove(move);
        }, wait);
    }

    click(cell) {
        if (this.busy || this.over || !this.active || this.thinking || !this.isHuman()) return;
        const s = this.state;
        if (this.selected >= 0) {
            const mv = this.moves.find((m) => m.to === cell);
            if (mv) { this.doMove(mv); return; }
        }
        if (cell >= 0 && s.grid[cell] === this.color && cell !== this.selected) {
            const moves = movesFrom(s, cell);
            if (!moves.length) { sfx('deny'); this.hud.toast('That stone cannot move'); return; }
            this.selected = cell; this.moves = moves;
            this.world.showSelection(cell, moves);
            sfx('select');
            return;
        }
        if (this.selected >= 0) { this.selected = -1; this.moves = []; this.world.clearIndicators(); sfx('tick'); }
    }

    // is this field something the pointer can act on right now?
    hot(cell) {
        if (cell < 0 || this.busy || this.over || this.thinking || !this.isHuman()) return false;
        return this.state.grid[cell] === this.color || this.moves.some((m) => m.to === cell);
    }

    async doMove(move) {
        const gen = ++this.gen;
        this.busy = true; this.selected = -1; this.moves = [];
        const events = applyMove(this.state, move);
        const key = positionKey(this.state);
        this.history.push(key);
        const tilts = events.filter((e) => e.type === 'tilt');
        if (tilts.length) this.hud.toast(tilts.length > 1 ? `The board tilts ${tilts.map((t) => DIR_NAMES[t.dir]).join(', then ')}` : `The board tilts ${DIR_NAMES[tilts[0].dir]}`);
        this.hud.status('');
        // the Hades is announced when it happens, after the slides that led to it
        const hades = events.find((e) => e.type === 'hades');
        const shown = this.world.play(events, this.state);
        if (hades) setTimeout(() => { if (gen === this.gen) this.hud.toast(hades.cells.length > 1 ? `Hades — ${hades.cells.length} stones` : 'Hades', 'osiris'); }, tilts.length ? 900 * tilts.length : 250);
        await shown;
        if (gen !== this.gen) return; // a new game began during the animation
        for (const ev of events) if (ev.type === 'out' && this.state.nPlayers > 2) this.hud.toast(`${COLOR_NAMES[ev.color]} is out`);
        this.busy = false;
        this.over = outcome(this.state);
        if (!this.over && this.history.filter((k) => k === key).length >= 3) this.over = { winner: 0, reason: 'repetition' };
        if (this.over) { this.finish(); return; }
        this.nextTurn();
    }

    finish() {
        const o = this.over, s = this.state, humans = this.settings.seats.slice(0, s.nPlayers).map((x, i) => (x.type === 'human' ? this.order[i] : 0)).filter(Boolean);
        this.refresh();
        let title, text;
        if (o.winner) {
            title = `${COLOR_NAMES[o.winner]} holds the harbour`;
            text = s.nPlayers === 2 ? `${COLOR_NAMES[3 - o.winner]} has fewer than four stones.` : 'Every rival has fewer than four stones.';
            this.world.celebrate(o.winner);
            sfx(humans.length === 0 || humans.includes(o.winner) ? 'victory' : 'defeat');
        } else {
            title = 'A draw under Helios';
            text = o.reason === 'repetition' ? 'The same position has come three times.' : o.reason === 'stuck' ? 'No one can move.' : 'No one has four stones left.';
            sfx('defeat');
        }
        this.hud.status('');
        this.hud.gameOver(title, text);
    }
}
