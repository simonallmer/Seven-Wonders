// PHAROS — the match: turns, input, computer players. Talks to the rules, the world and the HUD.
import {
    createState, cloneState, nextSteps, tryPath, lightsFor, applyMove, outcome, turnOrder, countStones, countBeacons, positionKey, COLOR_NAMES,
} from './rules.js';
import { chooseMove } from './ai.js';
import { sfx } from '../audio.js';

export class PharosGame {
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
        this.sel = null;       // the stone in hand: { from, path, steps }
        this.world.setBoard(this.state);
        this.world.reveal(!this.active, false);
        this.hud.action(null);
        this.refresh();
        if (this.active) this.nextTurn();
    }

    get order() { return turnOrder(this.state.nPlayers); }
    get color() { return this.order[this.state.turn]; }
    seat(turn = this.state.turn) { return this.settings.seats[turn]; }
    isHuman(turn = this.state.turn) { return this.seat(turn).type === 'human'; }

    setActive(on) {
        this.active = on;
        this.world.reveal(!on, on); // the lighthouse is lifted away for the game and back in place at once when you leave
        if (!on) this.hud.action(null);
        if (on && !this.over && !this.busy) this.nextTurn();
    }

    seatsChanged() {
        if (this.thinking && !this.busy) { this.gen++; this.thinking = false; this.pending = null; }
        if (!this.busy && this.sel) { if (this.sel.path.length) { this.commit(); return; } this.deselect(false); }
        this.refresh();
        if (this.active && !this.over && !this.busy) this.nextTurn();
    }

    refresh() {
        const counts = countStones(this.state), lit = countBeacons(this.state), score = [], out = [];
        for (const c of this.order) { score[c] = `${counts[c]}${lit[c] ? ` · <b>▲${lit[c]}</b>` : ''}`; out[c] = !!this.state.out[c]; }
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

    // show the stone in hand where it now stands, with what it may still do
    show() {
        const { from, path } = this.sel, s = this.state;
        const w = path.length ? tryPath(s, from, path) : null, at = path.length ? path[path.length - 1] : from;
        const lights = lightsFor(w ? w.state : s, at, this.color).filter((id) => !w || !w.pick.includes(id));
        this.world.showSelection(at, this.sel.steps, this.sel.steps.length ? lights : [], path.length > 0);
        this.world.setSpent(w ? w.pick : []);
    }

    select(cell) {
        const steps = nextSteps(this.state, cell, []);
        if (!steps.length) {
            sfx('deny');
            this.hud.toast(lightsFor(this.state, cell, this.color).length ? 'That stone has nowhere to go' : 'No light reaches that stone');
            return;
        }
        this.sel = { from: cell, path: [], steps };
        this.show();
        sfx('select');
        this.hud.status('Lit — choose a field');
    }

    deselect(sound = true) {
        this.sel = null;
        this.hud.action(null);
        this.world.clearIndicators(); this.world.setSpent([]);
        if (sound) sfx('tick');
        this.hud.status(`${COLOR_NAMES[this.color]} to move`);
    }

    commit() {
        const { from, path } = this.sel;
        this.sel = null;
        this.doMove({ from, path }, false);
    }

    async step(st) {
        const sel = this.sel, gen = this.gen, color = this.color;
        const at = sel.path.length ? sel.path[sel.path.length - 1] : sel.from;
        sel.path.push(st.to);
        const w = tryPath(this.state, sel.from, sel.path), k = sel.path.length - 1;
        this.busy = true;
        this.hud.action(null);
        this.world.clearIndicators();
        if (w.lit[k] >= 0) this.hud.toast(`${COLOR_NAMES[color]} lights a beacon`);
        await this.world.playStep({ type: 'step', from: at, to: st.to, color, light: w.pick[k], capture: w.captures[k], lit: w.lit[k] });
        if (gen !== this.gen) return;
        this.busy = false;
        sel.steps = nextSteps(this.state, sel.from, sel.path);
        if (!sel.steps.length) { this.commit(); return; }
        this.show();
        this.hud.status('Move on, or end your turn');
        this.hud.action('End turn', () => { if (this.canAct && this.sel) this.commit(); });
    }

    click(cell) {
        if (!this.canAct) return;
        const s = this.state;
        if (this.sel) {
            const st = this.sel.steps.find((o) => o.to === cell);
            if (st) { this.step(st); return; }
            if (this.sel.path.length) { // under way: the stone itself ends the turn
                if (cell === this.sel.path[this.sel.path.length - 1]) this.commit();
                return;
            }
            const same = cell === this.sel.from;
            this.deselect();
            if (same) return;
        }
        if (cell >= 0 && s.grid[cell] === this.color) this.select(cell);
    }

    // is this field something the pointer can act on right now?
    hot(cell) {
        if (cell < 0 || !this.canAct) return false;
        if (this.sel && this.sel.steps.some((o) => o.to === cell)) return true;
        if (this.sel && this.sel.path.length) return cell === this.sel.path[this.sel.path.length - 1];
        return this.state.grid[cell] === this.color;
    }

    // ------------------------------------------------------------ playing a move

    async doMove(move, travel = true) {
        const gen = ++this.gen;
        this.busy = true; this.sel = null;
        this.hud.action(null);
        const mover = this.color;
        const events = applyMove(this.state, move);
        const key = positionKey(this.state);
        this.history.push(key);
        if (travel && events.some((e) => e.type === 'step' && e.lit >= 0)) this.hud.toast(`${COLOR_NAMES[mover]} lights a beacon`);
        this.hud.status('');
        await this.world.play(events, this.state, travel);
        if (gen !== this.gen) return; // a new game began during the animation
        for (const ev of events) {
            if (ev.type === 'out' && this.state.nPlayers > 2) this.hud.toast(`${COLOR_NAMES[ev.color]} stands in the dark and is out`);
            else if (ev.type === 'feud') this.hud.toast('The alliance is over');
        }
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
            title = `${COLOR_NAMES[o.winner]} keeps the light`;
            text = s.nPlayers === 2 ? `${COLOR_NAMES[3 - o.winner]} cannot move a stone.` : 'No rival can move a stone.';
            this.world.celebrate(o.winner);
            sfx(humans.length === 0 || humans.includes(o.winner) ? 'victory' : 'defeat');
        } else {
            title = 'A draw in the harbour';
            text = o.reason === 'repetition' ? 'The same position has come three times.' : 'No one can move a stone.';
            sfx('defeat');
        }
        this.hud.status('');
        this.hud.gameOver(title, text);
    }
}
