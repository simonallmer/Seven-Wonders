// STATUE — the match: turns, input, computer players. Talks to the rules, the world and the HUD.
import {
    createState, cloneState, legalMoves, stepsFrom, diminishTargets, applyMove, outcome, turnOrder, countDice, positionKey,
    layout, owner, pips, canStep, COLOR_NAMES,
} from './rules.js';
import { chooseMove } from './ai.js';
import { sfx } from '../audio.js';

export class StatueGame {
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
        this.sel = null;       // the die in hand: { from, at, path, left, work }
        this.choosing = null;  // picking whom a Diminish forces: { at, targets }
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
        this.world.reveal(!on, on); // Zeus is lifted away for the game and back in his place at once when you leave
        if (!on) this.hud.action(null);
        if (on && !this.over && !this.busy) this.nextTurn();
    }

    seatsChanged() {
        if (this.thinking && !this.busy) { this.gen++; this.thinking = false; this.pending = null; }
        if (!this.busy && this.sel && this.sel.path.length) return; // a stride under way is finished first
        if (!this.busy) this.deselect(false);
        this.refresh();
        if (this.active && !this.over && !this.busy) this.nextTurn();
    }

    refresh() {
        const on = countDice(this.state), score = [], out = [];
        for (const c of this.order) { score[c] = `<b>${on[c]}</b> + ${this.state.reserve[c]}`; out[c] = !!this.state.out[c]; }
        this.hud.update({ order: this.order, turn: this.over ? -1 : this.state.turn, score, out, thinking: this.thinking, over: this.over });
    }

    // the dice a forced player may move
    forcedDice() {
        const g = this.state.grid, one = this.color * 8 + 1, out = [];
        for (let i = 0; i < g.length; i++) if (g[i] === one && canStep(this.state, i)) out.push(i);
        return out;
    }

    nextTurn() {
        if (this.over || !this.active) return;
        this.refresh();
        const name = COLOR_NAMES[this.color], forced = this.state.forced;
        this.moves = legalMoves(this.state);
        if (this.moves[0].type === 'pass') { this.hud.toast(`${name} cannot move and is passed over`); this.doMove(this.moves[0]); return; }
        if (this.isHuman()) {
            this.hud.status(forced ? `${name} must move a die showing 1` : `${name} to move`);
            if (forced) this.world.showChoices(this.forcedDice());
            return;
        }
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

    // ------------------------------------------------------------ playing by hand

    get canAct() { return !this.busy && !this.over && this.active && !this.thinking && this.isHuman(); }

    select(cell) {
        const s = this.state, n = pips(s.grid[cell]);
        if (s.forced && n !== 1) { sfx('deny'); this.hud.toast('A die showing 1 must move'); return; }
        const work = cloneState(s); work.grid[cell] = 0;
        const steps = stepsFrom(work, cell, this.color);
        const targets = !s.forced && n > 1 ? diminishTargets(s) : [];
        if (!steps.length && !targets.length) { sfx('deny'); this.hud.toast('That die cannot move'); return; }
        this.sel = { from: cell, at: cell, path: [], left: n, work, steps };
        this.world.showSelection(cell, steps);
        sfx('select');
        this.hud.status(steps.length ? `${n} ${n === 1 ? 'step' : 'steps'} to take` : 'This die can only be diminished');
        this.hud.action(targets.length ? 'Diminish' : null, () => this.diminish(cell, targets));
    }

    deselect(sound = true) {
        if (!this.sel && !this.choosing) return;
        this.sel = null; this.choosing = null;
        this.hud.action(null);
        this.world.clearIndicators();
        if (this.state.forced && this.isHuman()) this.world.showChoices(this.forcedDice());
        if (sound) sfx('tick');
        this.hud.status(this.state.forced ? `${COLOR_NAMES[this.color]} must move a die showing 1` : `${COLOR_NAMES[this.color]} to move`);
    }

    diminish(at, targets) {
        if (!this.canAct || !this.sel || this.sel.path.length) return;
        this.hud.action(null);
        if (targets.length === 1) { this.sel = null; this.doMove({ type: 'diminish', at, target: targets[0] }); return; }
        // several rivals could be forced: point at one of their 1s
        const g = this.state.grid, cells = [];
        for (let i = 0; i < g.length; i++) if (pips(g[i]) === 1 && targets.includes(owner(g[i])) && canStep(this.state, i)) cells.push(i);
        this.sel = null; this.choosing = { at, targets };
        this.world.showChoices(cells, 0x7fd8ff);
        this.hud.status('Whose die must move? Click one of their 1s');
    }

    async step(st) {
        const sel = this.sel, gen = this.gen, color = this.color;
        this.busy = true;
        this.hud.action(null);
        this.world.clearIndicators();
        const n = pips(this.state.grid[sel.from]);
        await this.world.playStep({ type: 'step', from: sel.at, to: st.to, color, pips: n, capture: st.capture ? {} : null });
        if (gen !== this.gen) return;
        this.busy = false;
        sel.work.grid[st.to] = 0; // whatever stood there has been taken
        sel.path.push(st.to); sel.at = st.to; sel.left--;
        sel.steps = sel.left > 0 ? stepsFrom(sel.work, st.to, color) : [];
        if (!sel.steps.length) { this.sel = null; this.doMove({ type: 'stride', from: sel.from, path: sel.path }, false); return; }
        this.world.showSelection(st.to, sel.steps);
        this.hud.status(`${sel.left} ${sel.left === 1 ? 'step' : 'steps'} left`);
    }

    click(cell) {
        if (!this.canAct || cell < 0) { if (this.canAct && this.choosing) this.deselect(); return; }
        const s = this.state, v = s.grid[cell], me = this.color;
        if (this.choosing) {
            const t = owner(v);
            if (v && pips(v) === 1 && this.choosing.targets.includes(t)) { const at = this.choosing.at; this.choosing = null; this.doMove({ type: 'diminish', at, target: t }); } else this.deselect();
            return;
        }
        if (this.sel) {
            const st = this.sel.steps.find((o) => o.to === cell);
            if (st) { this.step(st); return; }
            if (this.sel.path.length) return; // a stride under way must be finished
            const same = cell === this.sel.from;
            this.deselect();
            if (same) return;
        }
        if (v && owner(v) === me) { this.select(cell); return; }
        if (v || s.forced) return;
        if (!s.reserve[me]) { this.hud.toast('No dice left in reserve'); return; }
        if (!layout(s.nPlayers).home[me][cell]) { sfx('deny'); this.hud.toast('Place dice in your own quarter'); return; }
        this.doMove({ type: 'place', to: cell });
    }

    // is this field something the pointer can act on right now?
    hot(cell) {
        if (cell < 0 || !this.canAct) return false;
        const s = this.state, v = s.grid[cell], me = this.color;
        if (this.choosing) return !!v && pips(v) === 1 && this.choosing.targets.includes(owner(v));
        if (this.sel && this.sel.steps.some((o) => o.to === cell)) return true;
        if (this.sel && this.sel.path.length) return false;
        if (v) return owner(v) === me && (!s.forced || pips(v) === 1);
        return !s.forced && s.reserve[me] > 0 && !!layout(s.nPlayers).home[me][cell];
    }

    // ------------------------------------------------------------ playing a move

    async doMove(move, travel = true) {
        const gen = ++this.gen;
        this.busy = true; this.sel = null; this.choosing = null;
        this.hud.action(null);
        const events = applyMove(this.state, move);
        this.history.push(positionKey(this.state));
        for (const ev of events) {
            if (ev.type === 'forced') this.hud.toast(`Diminish — ${COLOR_NAMES[ev.color]} must move a 1`);
            else if (ev.type === 'out') this.hud.toast(`${COLOR_NAMES[ev.color]} is out`);
        }
        this.hud.status('');
        this.refresh();
        await this.world.play(events, this.state, travel);
        if (gen !== this.gen) return; // a new game began during the animation
        this.busy = false;
        this.over = outcome(this.state);
        if (this.over) { this.finish(); return; }
        this.nextTurn();
    }

    finish() {
        const o = this.over, humans = this.settings.seats.slice(0, this.state.nPlayers).map((s, i) => (s.type === 'human' ? this.order[i] : 0)).filter(Boolean);
        this.refresh();
        let title, text;
        if (o.winner) {
            title = `${COLOR_NAMES[o.winner]} holds the floor of Zeus`;
            text = this.state.nPlayers === 2 ? `${COLOR_NAMES[3 - o.winner]} has fewer than four dice left.` : 'Every rival has fewer than four dice left.';
            this.world.celebrate(o.winner);
            sfx(humans.length === 0 || humans.includes(o.winner) ? 'victory' : 'defeat');
        } else {
            title = 'A draw beneath the throne';
            text = 'No one can move a die.';
            sfx('defeat');
        }
        this.hud.status('');
        this.hud.gameOver(title, text);
    }
}
