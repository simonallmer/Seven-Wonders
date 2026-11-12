// SKYSCRAPER — the match: turns, input, computer players. Talks to the rules, the world and the HUD.
import { createState, cloneState, movesFor, applyMove, outcome, turnOrder, scores, elevator, layout, COLOR_NAMES, ROOF } from './rules.js';
import { chooseMove } from './ai.js';
import { sfx } from '../audio.js';

export class SkyscraperGame {
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
        this.over = null; this.busy = false; this.thinking = false;
        this.moves = [];
        this.world.setBoard(this.state);
        this.world.reveal(!this.active, false);
        this.refresh();
        if (this.active) this.nextTurn();
    }

    get order() { return turnOrder(this.state.nPlayers); }
    get color() { return this.order[this.state.turn]; }
    seat(turn = this.state.turn) { return this.settings.seats[turn]; }
    isHuman(turn = this.state.turn) { return this.seat(turn).type === 'human'; }

    setActive(on) {
        this.active = on;
        this.world.reveal(!on, on); // the crown is lifted away for the game and back in place at once when you leave
        if (!on) this.world.clearIndicators();
        if (on && !this.over && !this.busy) this.nextTurn();
    }

    seatsChanged() {
        if (this.thinking && !this.busy) { this.gen++; this.thinking = false; this.pending = null; }
        this.refresh();
        if (this.active && !this.over && !this.busy) this.nextTurn();
    }

    refresh() {
        const sc = scores(this.state), need = layout(this.state.nPlayers).need, score = [], out = [];
        for (const c of this.order) score[c] = `<b>${sc[c]}</b> / ${need}`;
        this.hud.update({ order: this.order, turn: this.over ? -1 : this.state.turn, score, out, thinking: this.thinking, over: this.over });
    }

    floorText() { const e = elevator(this.state); return e >= ROOF ? 'the roof is open' : `elevator at floor ${e + 1}`; }

    nextTurn() {
        if (this.over || !this.active) return;
        this.refresh();
        const name = COLOR_NAMES[this.color];
        this.moves = movesFor(this.state);
        if (this.isHuman()) { this.world.showMoves(this.moves, this.color); this.hud.status(`${name} to light a window · ${this.floorText()}`); return; }
        this.world.clearIndicators();
        this.hud.status(`${name} is thinking…`);
        this.thinking = true;
        const req = { id: ++this.gen, state: cloneState(this.state), level: this.seat().type, mode: 'standard', history: [] };
        this.pending = { id: req.id, at: performance.now() };
        if (this.worker) this.worker.postMessage(req);
        else setTimeout(() => this.onAI({ id: req.id, move: chooseMove(req.state, req.level) }), 60);
    }

    onAI({ id, move }) {
        if (!this.pending || id !== this.pending.id || id !== this.gen) return;
        const wait = Math.max(0, 650 - (performance.now() - this.pending.at));
        setTimeout(() => {
            if (id !== this.gen || !this.active) { this.thinking = false; return; }
            this.thinking = false;
            if (move !== null && move !== undefined) this.doMove(move);
        }, wait);
    }

    get canAct() { return !this.busy && !this.over && this.active && !this.thinking && this.isHuman(); }

    click(block) {
        if (!this.canAct || block < 0) return;
        if (this.moves.includes(block)) { this.doMove(block); return; }
        const s = this.state, b = layout(s.nPlayers).blocks[block];
        sfx('deny');
        this.hud.toast(s.grid[block] ? 'That window is lit already' : b.w > elevator(s) ? 'The elevator does not go that high yet' : 'No line of sight to one of your windows');
    }

    hot(block) { return this.canAct && block >= 0 && this.moves.includes(block); }

    async doMove(block) {
        const gen = ++this.gen;
        this.busy = true; this.moves = [];
        const events = applyMove(this.state, block);
        for (const ev of events) {
            if (ev.type === 'capture') { const n = ev.changed.length; if (n) this.hud.toast(ev.rows.length > 1 ? `${ev.rows.length} rows taken` : 'A row is taken'); }
            else if (ev.type === 'skip') this.hud.toast(ev.count > 1 ? `${ev.count} players cannot light a window and are passed over` : 'A player cannot light a window and is passed over');
        }
        this.hud.status('');
        this.refresh();
        await this.world.play(events, this.state);
        if (gen !== this.gen) return; // a new game began during the animation
        this.busy = false;
        this.over = outcome(this.state);
        if (this.over) { this.finish(); return; }
        this.nextTurn();
    }

    finish() {
        const o = this.over, s = this.state, humans = this.settings.seats.slice(0, s.nPlayers).map((x, i) => (x.type === 'human' ? this.order[i] : 0)).filter(Boolean);
        this.refresh();
        this.world.clearIndicators();
        let title, text;
        if (o.winner) {
            title = `${COLOR_NAMES[o.winner]} lights the skyline`;
            text = o.reason === 'share' ? `More than ${s.nPlayers === 2 ? 'half' : 'a quarter'} of the windows burn in its colour.` : 'No window is left to light, and it holds the most.';
            this.world.celebrate(o.winner);
            sfx(humans.length === 0 || humans.includes(o.winner) ? 'victory' : 'defeat');
        } else {
            title = 'A draw above the city';
            text = 'No window is left to light, and the count is even.';
            sfx('defeat');
        }
        this.hud.status('');
        this.hud.gameOver(title, text);
    }
}
