// PYRAMID — the match: turns, input, computer players. Talks to the rules, the world and the HUD.
import {
    createState, movesFrom, applyMove, outcome, turnOrder, countStones, victoryCells,
    positionKey, COLOR_NAMES, cloneState,
} from './rules.js';
import { chooseMove } from './ai.js';
import { sfx } from '../audio.js';

export class PyramidGame {
    constructor(world, hud) {
        this.world = world; this.hud = hud;
        this.active = false;   // false while the visitor is still in the palace
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
        this.world.tweens.clear();
        this.state = createState(settings.players);
        this.history = [positionKey(this.state)];
        this.over = null; this.busy = false; this.selected = -1; this.moves = [];
        this.thinking = false;
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

    // seats were changed in the panel while a game is running
    seatsChanged() {
        if (this.thinking && !this.busy) { this.gen++; this.thinking = false; this.pending = null; }
        this.refresh();
        if (this.active && !this.over && !this.busy) this.nextTurn();
    }

    refresh() {
        const counts = countStones(this.state), vc = victoryCells(this.state.B);
        const top = [0, 0, 0, 0, 0];
        for (const c of vc) top[this.state.grid[c]]++;
        const score = [], out = [];
        for (const c of this.order) { score[c] = `${counts[c]}${top[c] ? ` · <b>▲${top[c]}</b>` : ''}`; out[c] = counts[c] < 4; }
        this.hud.update({ order: this.order, turn: this.over ? -1 : this.state.turn, score, out, thinking: this.thinking, over: this.over });
    }

    nextTurn() {
        if (this.over || !this.active) return;
        this.refresh();
        const name = COLOR_NAMES[this.color];
        if (this.isHuman()) { this.hud.status(`${name} to move`); return; }
        this.hud.status(`${name} is thinking…`);
        this.thinking = true;
        const req = { id: ++this.gen, state: cloneState(this.state), level: this.seat().type, mode: this.settings.mode, history: this.history.slice(-40) };
        this.pending = { id: req.id, at: performance.now() };
        if (this.worker) this.worker.postMessage(req);
        else setTimeout(() => this.onAI({ id: req.id, move: chooseMove(req.state, req.level, req.mode, req.history) }), 60);
    }

    onAI({ id, move }) {
        if (!this.pending || id !== this.pending.id || id !== this.gen) return;
        // never answer instantly: a beat of thought reads better than a reflex
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

    // is this cell something the pointer can act on right now?
    hot(cell) {
        if (cell < 0 || this.busy || this.over || this.thinking || !this.isHuman()) return false;
        return this.state.grid[cell] === this.color || this.moves.some((m) => m.to === cell);
    }

    async doMove(move) {
        const gen = ++this.gen;
        this.busy = true; this.selected = -1; this.moves = [];
        const mover = this.color;
        const events = applyMove(this.state, move);
        this.history.push(positionKey(this.state));
        for (const ev of events) {
            if (ev.type === 'osiris') this.hud.toast(ev.captured.length > 1 ? `Osiris — ${ev.captured.length} stones taken` : 'Osiris', 'osiris');
            else if (ev.type === 'fall') this.hud.toast('Fall');
            else if (ev.smash) this.hud.toast('Smash');
        }
        this.hud.status('');
        await this.world.play(events, this.state);
        if (gen !== this.gen) return; // a new game began during the animation
        this.busy = false;
        this.over = outcome(this.state, this.settings.mode);
        if (this.over) { this.finish(mover); return; }
        const expected = (this.order.indexOf(mover) + 1) % this.state.nPlayers;
        if (this.state.turn !== expected) this.hud.toast(`${COLOR_NAMES[this.order[expected]]} has no move and is passed over`);
        this.nextTurn();
    }

    finish() {
        const o = this.over, humans = this.settings.seats.slice(0, this.state.nPlayers).map((s, i) => (s.type === 'human' ? this.order[i] : 0)).filter(Boolean);
        this.refresh();
        let title, text;
        if (o.winner) {
            const name = COLOR_NAMES[o.winner];
            title = `${name} conquers the Pyramid`;
            text = o.reason === 'summit' ? 'All four victory fields are held.' : 'Every rival has fewer than four stones left.';
            if (o.reason === 'summit') this.world.celebrate(victoryCells(this.state.B));
            sfx(humans.length === 0 || humans.includes(o.winner) ? 'victory' : 'defeat');
        } else {
            title = 'A draw in the sand';
            text = o.reason === 'stuck' ? 'No one has a move left.' : 'No one has four stones left to hold the summit.';
            sfx('defeat');
        }
        this.hud.status('');
        this.hud.gameOver(title, text);
    }
}
