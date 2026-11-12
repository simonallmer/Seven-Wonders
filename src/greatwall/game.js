// GREAT WALL — the match: turns, input, computer players. Talks to the rules, the world and the HUD.
import {
    createState, cloneState, supplyOf, moveTargets, arrow, spinKills, applyMove, outcome, turnOrder, countWarriors, positionKey,
    owner, facing, COLOR_NAMES,
} from './rules.js';
import { chooseMove } from './ai.js';
import { FACE } from './scene.js';
import { sfx } from '../audio.js';

export class GreatWallGame {
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
        this.sel = -1;         // the warrior in hand
        this.pending = null;   // an action waiting for its facing: { type, from?, to? }
        this.world.setBoard(this.state);
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
        if (!on) this.hud.action(null);
        if (on && !this.over && !this.busy) this.nextTurn();
    }

    seatsChanged() {
        if (this.thinking && !this.busy) { this.gen++; this.thinking = false; this.waiting = null; }
        if (!this.busy) this.idle(false);
        this.refresh();
        if (this.active && !this.over && !this.busy) this.nextTurn();
    }

    refresh() {
        const on = countWarriors(this.state), score = [], out = [];
        for (const c of this.order) { score[c] = `<b>${on[c]}</b> + ${this.state.reserve[c]}`; out[c] = !!this.state.out[c]; }
        this.hud.update({ order: this.order, turn: this.over ? -1 : this.state.turn, score, out, thinking: this.thinking, over: this.over });
    }

    nextTurn() {
        if (this.over || !this.active) return;
        this.refresh();
        const name = COLOR_NAMES[this.color];
        if (this.isHuman()) { this.idle(false); return; }
        this.hud.status(`${name} is thinking…`);
        this.thinking = true;
        const req = { id: ++this.gen, state: cloneState(this.state), level: this.seat().type, mode: 'standard', history: this.history.slice(-40) };
        this.waiting = { id: req.id, at: performance.now() };
        if (this.worker) this.worker.postMessage(req);
        else setTimeout(() => this.onAI({ id: req.id, move: chooseMove(req.state, req.level, req.mode, req.history) }), 60);
    }

    onAI({ id, move }) {
        if (!this.waiting || id !== this.waiting.id || id !== this.gen) return;
        const wait = Math.max(0, 650 - (performance.now() - this.waiting.at));
        setTimeout(() => {
            if (id !== this.gen || !this.active) { this.thinking = false; return; }
            this.thinking = false;
            if (move) this.doMove(move);
        }, wait);
    }

    // ------------------------------------------------------------ playing by hand

    get canAct() { return !this.busy && !this.over && this.active && !this.thinking && this.isHuman(); }

    // nothing in hand: show where a warrior could be placed
    idle(sound = true) {
        this.sel = -1; this.pending = null;
        this.hud.action(null);
        this.fields = supplyOf(this.state, this.color).fields;
        if (this.active && this.isHuman() && !this.over) {
            this.world.showPlacements(this.fields);
            const cut = this.state.reserve[this.color] > 0 && !this.fields.length;
            this.hud.status(cut ? `${COLOR_NAMES[this.color]} to move — supply is cut` : `${COLOR_NAMES[this.color]} to move`);
        } else this.world.clearIndicators();
        if (sound) sfx('tick');
    }

    select(cell) {
        this.sel = cell; this.pending = null;
        this.targets = moveTargets(this.state, cell);
        const shot = arrow(this.state, cell), cut = spinKills(this.state, cell);
        this.world.showSelection(cell, this.targets, shot);
        sfx('select');
        this.hud.status('Walk, or choose an action');
        this.hud.action([
            { label: shot.kills.length ? `Shoot · ${shot.kills.length}` : 'Shoot', fn: () => { if (this.canAct && this.sel === cell) this.doMove({ type: 'shoot', from: cell }); } },
            { label: cut.length ? `Spin · ${cut.length}` : 'Spin', fn: () => { if (this.canAct && this.sel === cell) { this.ask({ type: 'spin', from: cell }, cell, false); this.world.showStrike(cut); } } },
            { label: 'Turn', fn: () => { if (this.canAct && this.sel === cell) this.ask({ type: 'move', from: cell, to: cell }, cell, false); } },
        ]);
    }

    // an action is chosen but for the facing: show the eight arrows
    ask(pending, cell, standIn) {
        this.pending = pending; this.pendingCell = cell;
        this.hud.action(null);
        this.world.showFacing(cell, this.color, standIn);
        this.hud.status('Which way shall he face?');
    }

    click(id) {
        if (!this.canAct) return;
        const s = this.state, me = this.color;
        if (this.pending) {
            if (id >= FACE) { const m = { ...this.pending, facing: id - FACE }; this.pending = null; this.doMove(m); return; }
            this.idle();
            return;
        }
        if (id < 0) { if (this.sel >= 0) this.idle(); return; }
        if (this.sel >= 0) {
            if (id === this.sel) { this.idle(); return; }
            if (this.targets.includes(id)) { this.ask({ type: 'move', from: this.sel, to: id }, id, true); return; }
        }
        const v = s.grid[id];
        if (v && owner(v) === me) { this.select(id); return; }
        if (!v && this.fields.includes(id)) { this.sel = -1; this.ask({ type: 'place', to: id }, id, true); return; }
        if (!v && s.reserve[me] > 0 && this.sel < 0) { sfx('deny'); this.hud.toast(this.fields.length ? 'Too far from your supply chain' : 'Your supply is cut'); return; }
        if (this.sel >= 0) this.idle();
    }

    // is this something the pointer can act on right now?
    hot(id) {
        if (!this.canAct || id < 0) return false;
        if (this.pending) { if (id >= FACE) this.world.previewFacing(this.pendingCell, id - FACE); return id >= FACE; }
        if (id >= FACE) return false;
        if (this.sel >= 0 && this.targets.includes(id)) return true;
        const v = this.state.grid[id];
        return v ? owner(v) === this.color : this.fields.includes(id);
    }

    // ------------------------------------------------------------ playing a move

    async doMove(move) {
        const gen = ++this.gen;
        this.busy = true; this.sel = -1; this.pending = null;
        this.hud.action(null);
        const events = applyMove(this.state, move);
        const key = positionKey(this.state);
        this.history.push(key);
        for (const ev of events) {
            if (ev.type === 'shoot') {
                const n = ev.kills.length, back = ev.marks.some((m) => m.type === 'reflect'), off = ev.marks.some((m) => m.type === 'deflect');
                this.hud.toast(n > 1 ? `${n} warriors fall to one arrow` : n === 1 ? 'A warrior falls' : back ? 'The shield throws the arrow back' : off ? 'The shield turns the arrow aside' : 'The arrow flies off the wall');
            } else if (ev.type === 'spin') this.hud.toast(ev.kills.length ? `${ev.kills.length} cut down by the blade` : 'The blade meets only air');
            else if (ev.type === 'out') this.hud.toast(`${COLOR_NAMES[ev.color]}’s army is broken`);
        }
        this.hud.status('');
        this.refresh();
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
        this.world.clearIndicators();
        let title, text;
        if (o.winner) {
            title = `${COLOR_NAMES[o.winner]} holds the Wall`;
            text = s.nPlayers === 2 ? `${COLOR_NAMES[3 - o.winner]}’s army has fewer than four warriors.` : 'Every rival army is broken.';
            this.world.celebrate(o.winner);
            sfx(humans.length === 0 || humans.includes(o.winner) ? 'victory' : 'defeat');
        } else {
            title = 'A draw on the Wall';
            text = o.reason === 'repetition' ? 'The same position has come three times.' : 'No army is left standing.';
            sfx('defeat');
        }
        this.hud.status('');
        this.hud.gameOver(title, text);
    }
}
