// MAUSOLEUM — the match: turns, input, computer players. Talks to the rules, the world and the HUD.
import {
    createState, cloneState, movesFrom, isTrapped, applyMove, outcome, turnOrder, countStones, positionKey, COLOR_NAMES,
} from './rules.js';
import { chooseMove } from './ai.js';
import { sfx } from '../audio.js';

export class MausoleumGame {
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
        this.selected = -1; this.moves = []; this.lastOut = null;
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
            if (!moves.length) {
                sfx('deny');
                this.hud.toast(isTrapped(s, cell) ? 'Trapped — a stone with one free neighbour cannot move' : 'That stone cannot move');
                return;
            }
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
        for (const ev of events) {
            if (ev.type === 'collapse') this.hud.toast(ev.cells.length > 1 ? `Encircled — ${ev.cells.length} stones fall` : 'Encircled');
            else if (ev.type === 'push' && ev.kill) this.hud.toast('Into the pit');
            else if (ev.type === 'out') { this.lastOut = ev; this.hud.toast(ev.reason === 'entombed' ? `${COLOR_NAMES[ev.color]} is entombed` : `${COLOR_NAMES[ev.color]} has fallen`); }
        }
        this.hud.status('');
        await this.world.play(events, this.state);
        if (gen !== this.gen) return; // a new game began during the animation
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
            title = `${COLOR_NAMES[o.winner]} seals the tomb`;
            if (s.nPlayers === 2) {
                const loser = 3 - o.winner;
                text = countStones(s)[loser] < 4 ? `${COLOR_NAMES[loser]} has fewer than four stones.` : `${COLOR_NAMES[loser]} is entombed: no move is left.`;
            } else text = 'Every rival has fallen.';
            this.world.celebrate(o.winner);
            sfx(humans.length === 0 || humans.includes(o.winner) ? 'victory' : 'defeat');
        } else {
            title = 'A draw among the pits';
            text = o.reason === 'repetition' ? 'The same position has come three times.' : 'No one is left standing.';
            sfx('defeat');
        }
        this.hud.status('');
        this.hud.gameOver(title, text);
    }
}
