// GARDENS — the match: turns, input, computer players. Talks to the rules, the world and the HUD.
import {
    createState, cloneState, legalMoves, movesFrom, sources, applyMove, outcome, partial, positionKey,
    turnOrder, goalCount, goalOf, isGarden, towerTop, towerHeight, gardenCount, currentColor,
    COLOR_NAMES, WIN_COUNT,
} from './rules.js';
import { chooseMove } from './ai.js';
import { sfx } from '../audio.js';

const GARDEN_NAMES = { 30: 'White’s High Garden', 31: 'White’s Home Garden', 32: 'Black’s Home Garden', 33: 'Black’s High Garden' };

export class GardensGame {
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
        this.state = createState();
        this.history = [positionKey(this.state)];
        this.over = null; this.busy = false; this.thinking = false;
        this.sel = null;       // the move being built: { from, count, max, path, cands }
        this.world.setBoard(this.state);
        this.refresh();
        if (this.active) this.nextTurn();
    }

    get order() { return turnOrder(); }
    get color() { return currentColor(this.state); }
    seat(turn = this.state.turn) { return this.settings.seats[turn]; }
    isHuman(turn = this.state.turn) { return this.seat(turn).type === 'human'; }

    setActive(on) {
        this.active = on;
        if (on && !this.over && !this.busy) this.nextTurn();
    }

    seatsChanged() {
        if (this.thinking && !this.busy) { this.gen++; this.thinking = false; this.pending = null; }
        if (this.sel && !this.busy) this.cancel(false);
        this.refresh();
        if (this.active && !this.over && !this.busy) this.nextTurn();
    }

    refresh() {
        const score = [], out = [];
        for (const c of this.order) score[c] = `<b>▲${goalCount(this.state, c)}</b> / ${WIN_COUNT}`;
        this.hud.update({ order: this.order, turn: this.over ? -1 : this.state.turn, score, out, thinking: this.thinking, over: this.over });
    }

    nextTurn() {
        if (this.over || !this.active) return;
        this.refresh();
        const name = COLOR_NAMES[this.color];
        this.moves = legalMoves(this.state);
        const forced = this.moves[0].type;
        if (forced === 'pass') { // nothing can be done at all: the turn passes by itself
            this.hud.toast(`${name} has no move and is passed over`);
            this.doMove(this.moves[0]);
            return;
        }
        if (this.isHuman()) {
            this.hud.status(forced === 'lift' ? `${name}: no move — choose a tower to lift your stones to the top` : `${name} to move`);
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

    // ------------------------------------------------------------ building a move by hand

    get canAct() { return !this.busy && !this.over && this.active && !this.thinking && this.isHuman(); }

    // what the next click may be, given the path walked so far
    options() {
        const { path, cands } = this.sel, k = path.length, seen = new Set(), out = [];
        for (const m of cands) {
            if (m.path.length <= k || seen.has(m.path[k])) continue;
            let ok = true;
            for (let i = 0; i < k; i++) if (m.path[i] !== path[i]) { ok = false; break; }
            if (ok) { seen.add(m.path[k]); out.push(m.path[k]); }
        }
        return out;
    }

    show() {
        const { from, count, path } = this.sel;
        const p = partial(this.state, from, count, path), at = path.length ? path.at(-1) : from, me = this.color;
        const targets = this.options().map((node) => ({
            node,
            kind: isGarden(node) ? 'garden' : node === at ? 'stay' : !towerHeight(p.state.towers[node]) ? 'empty' : towerTop(p.state.towers[node]) === me ? 'own' : p.hand[0] === me ? 'capture' : 'own',
        }));
        this.sel.targets = targets;
        return { p, at, targets };
    }

    select(node) {
        const src = sources(this.state).find((s) => s.from === node);
        if (!src) return false;
        const garden = isGarden(node);
        let count = garden ? 1 : src.max;
        if (this.sel && this.sel.from === node && !this.sel.path.length && garden) count = (this.sel.count % src.max) + 1; // click again: one more
        let cands = movesFrom(this.state, node, count);
        if (!cands.length && garden) { count = 1; cands = movesFrom(this.state, node, 1); }
        if (!cands.length) { sfx('deny'); this.hud.toast(garden ? 'No way out of this garden' : 'That tower cannot move'); return true; }
        this.sel = { from: node, count, max: src.max, path: [], cands };
        const { p, targets } = this.show();
        this.world.sync(p.state, p.hand, node);
        this.world.showTargets(p.state, targets);
        sfx('select');
        this.hud.status(garden && src.max > 1
            ? `${count} of ${src.max} in hand — click the garden again for ${count < src.max ? 'more' : 'one'}`
            : `${count} ${count === 1 ? 'stone' : 'stones'} in hand — the lowest is set down first`);
        return true;
    }

    cancel(sound = true) {
        if (!this.sel) return;
        const walked = this.sel.path.length > 0;
        this.sel = null;
        this.world.clearIndicators();
        this.world.sync(this.state);
        if (sound) sfx('tick');
        if (walked) this.hud.toast('Move taken back');
        this.hud.status(`${COLOR_NAMES[this.color]} to move`);
    }

    async step(node) {
        const sel = this.sel, before = partial(this.state, sel.from, sel.count, sel.path);
        sel.path.push(node);
        const done = sel.cands.find((m) => m.path.length === sel.path.length && m.path.every((x, i) => x === sel.path[i]));
        const dropped = isGarden(node) ? before.hand.slice() : [before.hand[0]];
        const gen = this.gen;
        this.busy = true;
        this.world.clearIndicators();
        const { p, targets } = this.show();
        await this.world.stepTo(p.state, p.hand, node, dropped);
        if (gen !== this.gen) return;
        this.busy = false;
        if (done) { this.sel = null; this.doMove(done, false); return; }
        this.world.showTargets(p.state, targets);
        this.hud.status(`${p.hand.length} still in hand`);
    }

    click(node) {
        if (!this.canAct) return;
        if (this.moves[0].type === 'lift') {
            const mv = this.moves.find((m) => m.from === node);
            if (mv) this.doMove(mv); else if (node >= 0) { sfx('deny'); this.hud.toast('Choose a tower that holds your stones'); }
            return;
        }
        if (this.sel) {
            if (this.sel.targets.some((t) => t.node === node)) { this.step(node); return; }
            if (!this.sel.path.length && node === this.sel.from && isGarden(node)) { this.select(node); return; }
            const walked = this.sel.path.length > 0, same = node === this.sel.from;
            this.cancel();
            if (walked || same || node < 0) return;
        }
        if (node < 0) return;
        if (!this.select(node)) {
            const s = this.state, me = this.color;
            if (isGarden(node) && node === goalOf(me) && gardenCount(s, node, me)) this.hud.toast('Stones in your High Garden stay there');
            else if (!isGarden(node) && towerHeight(s.towers[node]) && towerTop(s.towers[node]) !== me) { sfx('deny'); this.hud.toast('You only move towers with your stone on top'); }
        }
    }

    // is this node something the pointer can act on right now?
    hot(node) {
        if (node < 0 || !this.canAct || !this.moves) return false;
        if (this.moves[0].type === 'lift') return this.moves.some((m) => m.from === node);
        if (this.sel && (this.sel.targets.some((t) => t.node === node) || node === this.sel.from)) return true;
        return (!this.sel || !this.sel.path.length) && sources(this.state).some((s) => s.from === node);
    }

    // ------------------------------------------------------------ playing a move

    async doMove(move, travel = true) {
        const gen = ++this.gen;
        this.busy = true; this.sel = null;
        const mover = this.color, prev = cloneState(this.state);
        const events = applyMove(this.state, move);
        this.history.push(positionKey(this.state));
        for (const ev of events) {
            if (ev.type === 'stairs') this.hud.toast(`${ev.count} ${COLOR_NAMES[ev.color]} ${ev.count === 1 ? 'stone climbs' : 'stones climb'} the stairs`);
            else if (ev.type === 'lift') this.hud.toast('Lift');
            else if (ev.type === 'enter' && ev.at === goalOf(mover)) this.hud.toast(`${GARDEN_NAMES[ev.at]} · ${goalCount(this.state, mover)} of ${WIN_COUNT}`);
        }
        this.hud.status('');
        await this.world.play(move, events, prev, this.state, travel);
        if (gen !== this.gen) return; // a new game began during the animation
        this.busy = false;
        this.over = outcome(this.state);
        if (this.over) { this.finish(); return; }
        this.nextTurn();
    }

    finish() {
        const o = this.over, humans = this.settings.seats.slice(0, 2).map((s, i) => (s.type === 'human' ? this.order[i] : 0)).filter(Boolean);
        this.refresh();
        let title, text;
        if (o.winner) {
            title = `${COLOR_NAMES[o.winner]} reaches the High Garden`;
            text = `Seven ${COLOR_NAMES[o.winner].toLowerCase()} stones rest at the top of Babylon.`;
            this.world.celebrate(goalOf(o.winner));
            sfx(humans.length === 0 || humans.includes(o.winner) ? 'victory' : 'defeat');
        } else {
            title = 'A draw among the terraces';
            text = 'Neither side can move a stone.';
            sfx('defeat');
        }
        this.hud.status('');
        this.hud.gameOver(title, text);
    }
}
