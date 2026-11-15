// CATHEDRAL — the match: turns, input, computer players. Talks to the rules, the world and the HUD.
import { createState, cloneState, stepsFrom, applyMove, outcome, turnOrder, countStones, positionKey, COLOR_NAMES, MIN_STONES } from './rules.js';
import { chooseMove } from './ai.js';
import { sfx } from '../audio.js';

export class CathedralGame {
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
        this.sel = null;       // the stone in hand: { from, at, steps, options, work, visited }
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
        this.world.reveal(!on, on); // walls, vaults and towers are lifted away for the game
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
        for (const c of this.order) { score[c] = `<b>${counts[c]}</b>`; out[c] = counts[c] < MIN_STONES; }
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
        this.sel = { from: cell, at: cell, steps: [], options, work: cloneState(this.state), visited: new Set([cell]) };
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
        const victim = st.run ? sel.work.grid[st.run[0]] : 0;
        await this.world.playStep({ ...st, color, victim });
        if (gen !== this.gen) return;
        this.busy = false;
        // keep a working copy of the floor so the next conversion is judged on what is really there
        const g = sel.work.grid;
        g[st.from] = 0; g[st.to] = color; if (st.run) for (const i of st.run) g[i] = color;
        sel.steps.push(st); sel.at = st.to; sel.visited.add(st.to);
        const won = !!outcome(sel.work);
        sel.options = st.type === 'convert' && !won ? stepsFrom(sel.work, st.to, sel.visited) : [];
        if (!sel.options.length) { this.commit(); return; }
        this.world.showSelection(st.to, sel.options, true);
        this.hud.status('Convert on, or click your stone to rest');
    }

    click(id) {
        if (!this.canAct) return;
        const s = this.state;
        if (this.sel) {
            // two steps may end on the same field (a walk never does where a conversion can): take the first
            const st = this.sel.options.find((o) => o.to === id);
            if (st) { this.step(st); return; }
            if (this.sel.steps.length) { // in the middle of a chain: the stone itself ends it
                if (id === this.sel.at) this.commit();
                return;
            }
            const same = id === this.sel.from;
            this.deselect();
            if (same) return;
        }
        if (id >= 0 && s.grid[id] === this.color) this.select(id);
    }

    // is this something the pointer can act on right now?
    hot(id) {
        if (id < 0 || !this.canAct) return false;
        if (this.sel && (this.sel.options.some((o) => o.to === id) || id === this.sel.at)) return true;
        return (!this.sel || !this.sel.steps.length) && this.state.grid[id] === this.color;
    }

    // ------------------------------------------------------------ playing a move

    async doMove(move, travel = true) {
        const gen = ++this.gen;
        this.busy = true; this.sel = null;
        const mover = this.color, before = countStones(this.state);
        const events = applyMove(this.state, move);
        const key = positionKey(this.state);
        this.history.push(key);
        this.hud.status('');
        await this.world.play(events, this.state, travel);
        if (gen !== this.gen) return; // a new game began during the animation
        this.busy = false;
        this.refresh();
        const counts = countStones(this.state);
        for (const c of this.order) if (before[c] >= MIN_STONES && counts[c] < MIN_STONES) this.hud.toast(`${COLOR_NAMES[c]} has fallen silent`);
        this.over = outcome(this.state);
        if (!this.over && this.history.filter((k) => k === key).length >= 3) this.over = { winner: 0, reason: 'repetition' };
        if (this.over) { this.finish(); return; }
        const n = this.state.nPlayers;
        for (let t = (this.order.indexOf(mover) + 1) % n; t !== this.state.turn; t = (t + 1) % n) {
            if (counts[this.order[t]] >= MIN_STONES) this.hud.toast(`${COLOR_NAMES[this.order[t]]} has no move and is passed over`);
        }
        this.nextTurn();
    }

    finish() {
        const o = this.over, humans = this.settings.seats.slice(0, this.state.nPlayers).map((s, i) => (s.type === 'human' ? this.order[i] : 0)).filter(Boolean);
        this.refresh();
        let title, text;
        if (o.winner) {
            title = `${COLOR_NAMES[o.winner]} claims the Cathedral`;
            text = o.reason === 'silence' ? 'Every other congregation has fallen below four stones.' : 'No one can move, and it is the largest congregation.';
            this.world.celebrate(o.winner);
            sfx(humans.length === 0 || humans.includes(o.winner) ? 'victory' : 'defeat');
        } else {
            title = 'A draw beneath the vaults';
            text = o.reason === 'repetition' ? 'The same position has come three times.' : 'No congregation is left to claim it.';
            sfx('defeat');
        }
        this.hud.status('');
        this.hud.gameOver(title, text);
    }
}
