// TEMPLE — the match: turns, input, computer players. Talks to the rules, the world and the HUD.
import {
    createState, cloneState, stepsFrom, applyMove, outcome, turnOrder, countStones, positionKey, layout, COLOR_NAMES,
} from './rules.js';
import { chooseMove } from './ai.js';
import { FAITH } from './scene.js';
import { sfx } from '../audio.js';

const stepId = (st) => (st.to >= 0 ? st.to : FAITH + st.dir);

export class TempleGame {
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
        this.world.tweens.clear();
        this.state = createState(settings.players);
        this.history = [positionKey(this.state)];
        this.over = null; this.busy = false; this.thinking = false;
        this.sel = null;       // the stone in hand: { from, at, steps, options, work }
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
        this.world.reveal(!on, on); // the roof is lifted away for the game and back in place at once when you leave
        if (on && !this.over && !this.busy) this.nextTurn();
    }

    seatsChanged() {
        if (this.thinking && !this.busy) { this.gen++; this.thinking = false; this.pending = null; }
        if (this.sel && !this.busy) { if (this.sel.steps.length) { this.commit(); return; } this.deselect(false); }
        this.refresh();
        if (this.active && !this.over && !this.busy) this.nextTurn();
    }

    refresh() {
        const counts = countStones(this.state), score = [], out = [];
        for (const c of this.order) { score[c] = `${counts[c]}`; out[c] = counts[c] === 0; }
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

    // ------------------------------------------------------------ moving a stone by hand

    get canAct() { return !this.busy && !this.over && this.active && !this.thinking && this.isHuman(); }

    select(cell) {
        const options = stepsFrom(this.state, cell);
        if (!options.length) { sfx('deny'); this.hud.toast('That stone cannot move'); return; }
        this.sel = { from: cell, at: cell, steps: [], options, work: cloneState(this.state) };
        this.world.showSelection(cell, options);
        sfx('select');
    }

    deselect(sound = true) {
        this.sel = null;
        this.world.clearIndicators();
        if (sound) sfx('tick');
    }

    commit() {
        const { from, steps } = this.sel;
        this.sel = null;
        this.doMove({ from, steps }, false);
    }

    async step(st) {
        const sel = this.sel, gen = this.gen, color = this.color;
        this.busy = true;
        this.world.clearIndicators();
        this.announce(st);
        await this.world.playStep({ ...st, color });
        if (gen !== this.gen) return;
        this.busy = false;
        // keep a working copy of the floor so the next leap is judged on what is really there
        const g = sel.work.grid;
        g[st.from] = 0; if (st.capture) g[st.over] = 0; if (st.to >= 0) g[st.to] = color;
        sel.steps.push(st); sel.at = st.to;
        const won = st.to >= 0 && st.to === layout(this.state.nPlayers).target[color];
        sel.options = st.type === 'leap' && !won ? stepsFrom(sel.work, st.to, st.dir) : [];
        if (!sel.options.length) { this.commit(); return; }
        this.world.showSelection(st.to, sel.options, true);
        this.hud.status('Leap on, or click your stone to stay');
    }

    click(id) {
        if (!this.canAct) return;
        const s = this.state;
        if (this.sel) {
            const st = this.sel.options.find((o) => stepId(o) === id);
            if (st) { this.step(st); return; }
            if (this.sel.steps.length) { // in the middle of a chain: the stone itself ends it
                if (id === this.sel.at) this.commit();
                return;
            }
            const same = id === this.sel.from;
            this.deselect();
            if (same) return;
        }
        if (id >= 0 && id < FAITH && s.grid[id] === this.color) this.select(id);
    }

    // is this something the pointer can act on right now?
    hot(id) {
        if (id < 0 || !this.canAct) return false;
        if (this.sel && (this.sel.options.some((o) => stepId(o) === id) || id === this.sel.at)) return true;
        return (!this.sel || !this.sel.steps.length) && id < FAITH && this.state.grid[id] === this.color;
    }

    // ------------------------------------------------------------ playing a move

    announce(st) {
        if (st.type === 'faith') this.hud.toast('Leap of Faith');
    }

    async doMove(move, travel = true) {
        const gen = ++this.gen;
        this.busy = true; this.sel = null;
        const mover = this.color;
        const events = applyMove(this.state, move);
        const key = positionKey(this.state);
        this.history.push(key);
        if (travel) for (const ev of events) this.announce(ev);
        this.hud.status('');
        await this.world.play(events, this.state, travel);
        if (gen !== this.gen) return; // a new game began during the animation
        this.busy = false;
        this.over = outcome(this.state);
        if (!this.over && this.history.filter((k) => k === key).length >= 3) this.over = { winner: 0, reason: 'repetition' };
        if (this.over) { this.finish(); return; }
        const n = this.state.nPlayers, counts = countStones(this.state);
        for (let t = (this.order.indexOf(mover) + 1) % n; t !== this.state.turn; t = (t + 1) % n) {
            if (counts[this.order[t]]) this.hud.toast(`${COLOR_NAMES[this.order[t]]} has no move and is passed over`);
        }
        this.nextTurn();
    }

    finish() {
        const o = this.over, humans = this.settings.seats.slice(0, this.state.nPlayers).map((s, i) => (s.type === 'human' ? this.order[i] : 0)).filter(Boolean);
        this.refresh();
        let title, text;
        if (o.winner) {
            const name = COLOR_NAMES[o.winner];
            title = o.reason === 'artemis' ? `${name} stands before Artemis` : `${name} holds the Temple`;
            text = o.reason === 'artemis' ? 'A stone has reached the Artemis field on the far side.' : 'No rival stone is left on the floor.';
            if (o.reason === 'artemis') this.world.celebrate(layout(this.state.nPlayers).target[o.winner]);
            sfx(humans.length === 0 || humans.includes(o.winner) ? 'victory' : 'defeat');
        } else {
            title = 'A draw before the goddess';
            text = o.reason === 'repetition' ? 'The same position has come three times.' : o.reason === 'stuck' ? 'No one has a move left.' : 'No stone is left on the floor.';
            sfx('defeat');
        }
        this.hud.status('');
        this.hud.gameOver(title, text);
    }
}
