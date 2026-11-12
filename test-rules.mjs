// node test-rules.mjs — sanity checks for the Pyramid rules and AI
import * as R from './src/pyramid/rules.js';
import { chooseMove } from './src/pyramid/ai.js';
let s = R.createState(2);
console.assert(R.allMoves(s).length > 0);
const ms = R.movesFrom(s, 6*7+3);
console.log('start moves of centre white stone:', ms.map(m=>m.type+'>'+m.to).join(' '));
// osiris: W B B W on bottom row
s.grid.fill(0); s.grid[42]=1; s.grid[43]=2; s.grid[44]=2; s.grid[46]=1; s.grid[0]=2;s.grid[1]=2;s.grid[2]=2;
let ev = R.applyMove(s, {from:46,to:45,type:'run'});
console.log('osiris', JSON.stringify(ev.at(-1)));
// double osiris W B W B
s = R.createState(2); s.grid.fill(0); s.grid[42]=1; s.grid[43]=2; s.grid[44]=1; s.grid[46]=2;
ev = R.applyMove(s,{from:46,to:45,type:'run'}); console.log('double', JSON.stringify(ev.at(-1)));
// pushfall + push drop
s = R.createState(2); s.grid.fill(0); s.grid[8]=1; s.grid[9]=2; s.grid[1]=2; // level1 (1,1),(1,2)
console.log('lvl1', R.movesFrom(s,9).map(m=>m.type+'>'+m.to+(m.pushTo!==undefined?'/'+m.pushTo:'')).join(' '));
for (const [n,a,b] of [[2,'hard','medium'],[2,'easy','hard'],[4,'hard','easy']]) {
  let g = R.createState(n), hist=[], t0=Date.now(), o=null;
  while (!(o=R.outcome(g)) && g.ply<300) { const lv = (g.turn%2===0)?a:b; const m = chooseMove(g, lv, 'standard', hist); R.applyMove(g,m,false); hist.push(R.positionKey(g)); }
  console.log(n,'p',a,'vs',b,'->',JSON.stringify(o),'plies',g.ply,'stones',R.countStones(g).slice(1).join(','),((Date.now()-t0)/g.ply|0)+'ms/move');
}

// ---------------------------------------------------------------- Gardens
import * as G from './src/gardens/rules.js';
import { chooseMove as gardensMove } from './src/gardens/ai.js';
{
  let s = G.createState();
  const start = G.legalMoves(s);
  console.assert(start.every(m => m.type === 'move' && m.from === G.G_WHITE_HOME), 'white starts from home');
  console.log('gardens: opening moves', start.length, 'by count', [1,2,3,4,5].map(k => start.filter(m => m.count === k).length).join(','));
  // stride: three stones set down on three fields in a row
  let ev = G.applyMove(s, { type: 'move', from: G.G_WHITE_HOME, count: 3, path: [5, 6, 7] });
  console.assert(G.towerTop(s.towers[5]) === 1 && G.towerTop(s.towers[7]) === 1 && G.gardenCount(s, G.G_WHITE_HOME, 1) === 7, 'stride');
  // black cannot walk into white's High Garden, white cannot be picked up from its own High Garden
  s = G.createState(); s.gardens.fill(0); s.towers[15] = G.towerPush(1, 2); s.turn = 1; s.gardens[0] = 3;
  console.assert(!G.legalMoves(s).some(m => m.path.includes(G.G_WHITE_HIGH)), 'rival high garden is barred');
  s.turn = 0; s.towers[15] = 1; s.gardens[(G.G_WHITE_HOME - 30) * 2] = 1;
  console.assert(G.legalMoves(s).every(m => m.from !== G.G_WHITE_HIGH), 'high garden is final');
  // capture: white lands on black, the tower is white's and carries the black stone along
  s = G.createState(); s.towers[1] = G.towerPush(1, 2); s.towers[0] = G.towerPush(1, 1);
  ev = G.applyMove(s, { type: 'move', from: 0, count: 1, path: [1] });
  console.assert(ev.some(e => e.capture) && G.towerTop(s.towers[1]) === 1 && G.towerHeight(s.towers[1]) === 2, 'capture');
  s.turn = 0; ev = G.applyMove(s, { type: 'move', from: 1, count: 2, path: [2, 3] });
  console.assert(G.towerTop(s.towers[2]) === 2 && G.towerTop(s.towers[3]) === 1, 'lowest stone is set down first');
  // a full tower closes its field, and no tower can grow past five
  s = G.createState(); for (let i = 0; i < 5; i++) s.towers[5] = G.towerPush(s.towers[5], 2);
  console.assert(!G.legalMoves(s).some(m => m.path.includes(5)), 'full tower');
  s = G.createState(); for (let i = 0; i < 3; i++) s.towers[5] = G.towerPush(s.towers[5], 2);
  console.assert(!G.legalMoves(s).some(m => m.path.filter(p => p === 5).length > 2), 'tower limit while setting down');
  // staircase, from the rulebook: black sets 4 into white's home where 2 whites stand: 2 rise, then the other 2
  s = G.createState(); s.gardens[(G.G_WHITE_HOME - 30) * 2] = 2; s.towers[0] = [2, 2, 2, 2].reduce(G.towerPush, 1); s.towers[9] = G.towerPush(1, 1); s.turn = 1;
  ev = G.applyMove(s, { type: 'move', from: 0, count: 4, path: [G.G_WHITE_HOME] });
  console.assert(ev.at(-1).type === 'stairs' && ev.at(-1).count === 2 && G.gardenCount(s, G.G_WHITE_HIGH, 2) === 2, 'stairs 1');
  ev = G.applyMove(s, { type: 'move', from: G.G_WHITE_HOME, count: 2, path: [5, 10] });
  console.assert(ev.at(-1).count === 2 && G.gardenCount(s, G.G_WHITE_HIGH, 2) === 4 && G.gardenCount(s, G.G_WHITE_HOME, 2) === 0, 'stairs 2');
  // lift: a player with nothing but buried stones pulls them to the top
  s = G.createState(); s.gardens.fill(0); s.towers[3] = [1, 2].reduce(G.towerPush, 1); s.gardens[1] = 9; s.gardens[(G.G_WHITE_HIGH - 30) * 2] = 9;
  let lm = G.legalMoves(s); console.assert(lm.length === 1 && lm[0].type === 'lift', 'lift offered');
  G.applyMove(s, lm[0]); console.assert(G.towerTop(s.towers[3]) === 1, 'lift done');
  console.log('gardens: rule checks done');
  for (const [a, b] of [['hard', 'medium'], ['easy', 'hard'], ['medium', 'easy'], ['hard', 'hard']]) {
    let g = G.createState(), hist = [], t0 = Date.now(), o = null, max = 0;
    while (!(o = G.outcome(g)) && g.ply < 400) {
      const lv = g.turn === 0 ? a : b, t1 = Date.now();
      const m = gardensMove(g, lv, 'standard', hist);
      max = Math.max(max, Date.now() - t1);
      console.assert(G.legalMoves(g).some(x => JSON.stringify(x) === JSON.stringify(m)), 'AI move is legal');
      G.applyMove(g, m, false); hist.push(G.positionKey(g));
      const n = G.countStones(g); console.assert(n[1] === 10 && n[2] === 10, 'stones conserved');
    }
    console.log('gardens', a, 'vs', b, '->', JSON.stringify(o), 'plies', g.ply, 'high', G.goalCount(g, 1) + ':' + G.goalCount(g, 2), ((Date.now() - t0) / g.ply | 0) + 'ms/move, slowest', max + 'ms');
  }
}

// ---------------------------------------------------------------- Temple
import * as T from './src/temple/rules.js';
import { chooseMove as templeMove } from './src/temple/ai.js';
{
  for (const n of [2, 4]) {
    const L = T.layout(n), s = T.createState(n);
    let edges = 0; for (const v of L.step) if (v >= 0) edges++;
    console.log('temple', n, 'players:', L.N, 'fields,', edges / 2, 'paths, stones', T.countStones(s).slice(1).join(','), 'opening moves', T.allMoves(s).length);
  }
  const L = T.layout(2), at = L.at;
  console.assert(L.N === 33 && T.layout(4).N === 61, 'field counts');
  const fresh = () => { const s = T.createState(2); s.grid.fill(0); return s; };
  // walk: forwards and sideways, never back
  let s = fresh(); s.grid[at(4, 2)] = 1; s.grid[at(0, 2)] = 2;
  let st = T.stepsFrom(s, at(4, 2));
  console.assert(st.length === 5 && st.every(x => x.type === 'walk' && L.cells[x.to].row <= 4), 'white walks up or sideways: ' + st.length);
  // odd fields have no diagonals
  s = fresh(); s.grid[at(4, 1)] = 1; s.grid[at(0, 2)] = 2;
  console.assert(T.stepsFrom(s, at(4, 1)).length === 3, 'odd field');
  // leap over an own stone keeps it, over a rival captures; a chain may turn 45 degrees but not 90
  s = fresh(); s.grid[at(6, 2)] = 1; s.grid[at(5, 2)] = 1; s.grid[at(3, 3)] = 2; s.grid[at(3, 2)] = 2; s.grid[at(0, 2)] = 2;
  let ms = T.movesFrom(s, at(6, 2));
  const chain = ms.find(m => m.steps.length === 2);
  console.assert(chain && chain.steps[0].capture === 0 && chain.steps[1].capture === 2, 'chain with capture');
  console.assert(ms.filter(m => m.steps.length === 2).every(m => { const k = Math.abs(m.steps[0].dir - m.steps[1].dir); return k <= 1 || k === 7; }), '45 degree rule');
  console.assert(ms.some(m => m.steps.length === 1 && m.steps[0].type === 'leap'), 'a chain may stop early');
  // two stones in a row cannot be leapt
  s = fresh(); s.grid[at(6, 2)] = 1; s.grid[at(5, 2)] = 2; s.grid[at(4, 2)] = 2;
  console.assert(!T.stepsFrom(s, at(6, 2)).some(x => x.type !== 'walk'), 'no leap over two');
  // Leap of Faith: over the guard on the tip, both stones leave; not over an own stone
  s = fresh(); s.grid[at(1, 2)] = 1; s.grid[at(0, 2)] = 2; s.grid[at(5, 0)] = 2; s.grid[at(6, 0)] = 1;
  st = T.stepsFrom(s, at(1, 2)).filter(x => x.type === 'faith');
  console.assert(st.length === 1 && st[0].over === at(0, 2), 'faith offered');
  T.applyMove(s, { from: at(1, 2), steps: st });
  console.assert(!s.grid[at(1, 2)] && !s.grid[at(0, 2)] && T.countStones(s)[1] === 1 && T.countStones(s)[2] === 1, 'faith removes both');
  // victory on the far tip; last one standing
  s = fresh(); s.grid[at(1, 1)] = 1; s.grid[at(4, 4)] = 2;
  T.applyMove(s, { from: at(1, 1), steps: [T.stepsFrom(s, at(1, 1)).find(x => x.to === at(0, 2))] });
  console.assert(T.outcome(s).winner === 1 && T.outcome(s).reason === 'artemis', 'artemis');
  s = fresh(); s.grid[at(4, 2)] = 1; s.grid[at(3, 2)] = 2;
  T.applyMove(s, T.movesFrom(s, at(4, 2)).find(m => m.steps[0].capture));
  console.assert(T.outcome(s).winner === 1 && T.outcome(s).reason === 'last', 'last standing');
  // a player who cannot move is passed over
  s = fresh(); s.grid[at(0, 2)] = 1; s.grid[at(4, 0)] = 1; s.grid[at(8, 2)] = 2; s.grid[at(4, 4)] = 2; s.turn = 1;
  s.grid[at(8, 2)] = 0; s.grid[at(7, 1)] = 2;
  console.log('temple: rule checks done');
  for (const [n, a, b] of [[2, 'hard', 'medium'], [2, 'easy', 'hard'], [2, 'medium', 'easy'], [4, 'hard', 'easy']]) {
    let g = T.createState(n), hist = [], t0 = Date.now(), o = null, rep = false; const seenN = new Map();
    while (!(o = T.outcome(g)) && g.ply < 400 && !rep) {
      const lv = g.turn % 2 === 0 ? a : b;
      const m = templeMove(g, lv, 'standard', hist);
      console.assert(T.allMoves(g).some(x => JSON.stringify(x) === JSON.stringify(m)), 'AI move is legal');
      T.applyMove(g, m, false); const k = T.positionKey(g); hist.push(k); seenN.set(k, (seenN.get(k) || 0) + 1); rep = seenN.get(k) >= 3;
    }
    console.log('temple', n, 'p', a, 'vs', b, '->', JSON.stringify(o), rep ? 'threefold repetition' : '', 'plies', g.ply, 'stones', T.countStones(g).slice(1).join(','), ((Date.now() - t0) / g.ply | 0) + 'ms/move');
  }
}

// ---------------------------------------------------------------- Statue
import * as Z from './src/statue/rules.js';
import { chooseMove as statueMove } from './src/statue/ai.js';
{
  for (const n of [2, 4]) { const L = Z.layout(n), s = Z.createState(n); console.log('statue', n, 'players:', L.N - L.hole.reduce((a, b) => a + b, 0), 'fields, opening moves', Z.legalMoves(s).length); }
  const C = 11, at = (r, c) => r * C + c, die = (color, p) => color * 8 + p;
  let s = Z.createState(2);
  console.assert(Z.legalMoves(s).length === 105 && Z.legalMoves(s).every(m => m.type === 'place'), 'opening: place anywhere but the feet of the throne');
  // a stride takes as many steps as the die shows, may turn, and the die grows by one
  s = Z.createState(2); s.grid[at(0, 0)] = die(1, 2); s.grid[at(10, 10)] = die(2, 1);
  let ms = Z.stridesFrom(s, at(0, 0));
  console.assert(ms.every(m => m.path.length === 2) && ms.some(m => m.path.at(-1) === at(1, 1)) && ms.some(m => m.path.at(-1) === at(0, 0)), 'two steps, turning allowed');
  Z.applyMove(s, ms.find(m => m.path.at(-1) === at(1, 1)));
  console.assert(s.grid[at(1, 1)] === die(1, 3) && !s.grid[at(0, 0)], 'grows to 3');
  // a 6 becomes a 1; the feet of the throne block the way
  s = Z.createState(2); s.grid[at(2, 3)] = die(1, 6); s.grid[at(10, 10)] = die(2, 1);
  ms = Z.stridesFrom(s, at(2, 3));
  console.assert(!ms.some(m => m.path.some(i => Z.layout(2).hole[i])), 'no stepping onto the throne');
  Z.applyMove(s, ms[0]); console.assert(Z.pips(s.grid[ms[0].path.at(-1)]) === 1, 'six turns to one');
  // capture: rival dice above 1 on the way are taken, a 1 cannot be, own dice block
  s = Z.createState(2); s.grid[at(0, 0)] = die(1, 2); s.grid[at(0, 1)] = die(2, 3); s.grid[at(0, 2)] = die(2, 4); s.grid[at(1, 0)] = die(2, 1); s.reserve[2] = 2;
  ms = Z.stridesFrom(s, at(0, 0));
  console.assert(ms.length && ms.every(m => m.path[0] === at(0, 1)), 'the 1 blocks, the 3 can be taken');
  const dbl = ms.find(m => m.path[1] === at(0, 2));
  let ev = Z.applyMove(s, dbl);
  console.assert(ev.filter(e => e.capture).length === 2 && Z.countDice(s)[2] === 1, 'two captures in one stride');
  console.assert(s.out[2] && Z.outcome(s).winner === 1, 'fewer than four dice loses');
  // diminish: only when the rival has a 1 that can move; then that rival must move a 1
  s = Z.createState(2); s.grid[at(0, 0)] = die(1, 3); s.grid[at(5, 5)] = die(2, 4);
  console.assert(!Z.legalMoves(s).some(m => m.type === 'diminish'), 'no diminish without a rival 1');
  s.grid[at(9, 9)] = die(2, 1);
  const dim = Z.legalMoves(s).find(m => m.type === 'diminish');
  console.assert(dim && dim.target === 2, 'diminish offered');
  Z.applyMove(s, dim);
  console.assert(Z.pips(s.grid[at(0, 0)]) === 2 && s.forced === 1 && s.turn === 1, 'forced');
  ms = Z.legalMoves(s);
  console.assert(ms.every(m => m.type === 'stride' && m.from === at(9, 9) && m.path.length === 1), 'only the 1 may move');
  Z.applyMove(s, ms[0]); console.assert(s.turn === 0 && !s.forced && Z.pips(s.grid[ms[0].path[0]]) === 2, 'then play returns');
  // four players: place in your own quarter only, never on the joining row
  s = Z.createState(4);
  const L4 = Z.layout(4);
  console.assert(Z.legalMoves(s).every(m => Math.floor(m.to / 11) > 10 && m.to % 11 < 5), 'white places near-left');
  console.assert([1, 2, 3, 4].every(c => !L4.home[c].some((h, i) => h && Math.floor(i / 11) === 10)), 'joining row');
  console.log('statue: rule checks done');
  for (const [n, a, b] of [[2, 'hard', 'medium'], [2, 'easy', 'hard'], [2, 'medium', 'easy'], [4, 'medium', 'easy']]) {
    let g = Z.createState(n), hist = [], t0 = Date.now(), o = null, max = 0;
    while (!(o = Z.outcome(g)) && g.ply < 500) {
      const lv = g.turn % 2 === 0 ? a : b, t1 = Date.now();
      const m = statueMove(g, lv, 'standard', hist); max = Math.max(max, Date.now() - t1);
      console.assert(Z.legalMoves(g).some(x => JSON.stringify(x) === JSON.stringify(m)), 'AI move is legal');
      Z.applyMove(g, m, false); hist.push(Z.positionKey(g));
    }
    console.log('statue', n, 'p', a, 'vs', b, '->', JSON.stringify(o), 'plies', g.ply, 'dice', Z.totals(g).slice(1).join(','), ((Date.now() - t0) / g.ply | 0) + 'ms/move, slowest', max + 'ms');
  }
}

// ---------------------------------------------------------------- Mausoleum
import * as M from './src/mausoleum/rules.js';
import { chooseMove as mausoleumMove } from './src/mausoleum/ai.js';
{
  for (const n of [2, 4]) { const L = M.layout(n), s = M.createState(n); console.log('mausoleum', n, 'players:', L.N, 'fields, stones', M.countStones(s).slice(1, 5).join(','), 'opening moves', M.allMoves(s).length); }
  const L = M.layout(2);
  console.assert(L.N === 52 && M.layout(4).N === 65, 'field counts');
  console.assert(Math.max(...L.degree) === 6 && Math.min(...L.degree) === 3, 'six neighbours inside, three at a corner');
  const cell = (r, c) => { let i = 0; for (let k = 0; k < r; k++) i += [4, 5, 6, 7, 8, 7, 6, 5, 4][k]; return i + c; };
  const fresh = () => { const s = M.createState(2); s.grid.fill(0); return s; };
  const pad = (s) => { for (const [r, c, v] of [[0, 0, 1], [0, 1, 1], [0, 2, 1], [0, 3, 1], [8, 0, 2], [8, 1, 2], [8, 2, 2], [8, 3, 2]]) s.grid[cell(r, c)] = v; };
  // glide: all the way to the last free field of a line
  let s = fresh(); pad(s); s.grid[cell(4, 0)] = 1;
  let ms = M.movesFrom(s, cell(4, 0));
  console.assert(ms.some(m => m.type === 'glide' && m.to === cell(4, 7)), 'glides to the far edge');
  s.grid[cell(4, 5)] = 2;
  console.assert(M.movesFrom(s, cell(4, 0)).some(m => m.to === cell(4, 4)), 'stops before a stone');
  // push: the neighbour moves one on, the pusher follows; the pushed stone cannot be pushed again at once
  s = fresh(); pad(s); s.grid[cell(4, 2)] = 1; s.grid[cell(4, 3)] = 2;
  const push = M.movesFrom(s, cell(4, 2)).find(m => m.type === 'push');
  console.assert(push && push.pushTo === cell(4, 4) && !push.kill, 'push offered');
  M.applyMove(s, push);
  console.assert(s.grid[cell(4, 3)] === 1 && s.grid[cell(4, 4)] === 2 && s.lastPushed === cell(4, 4), 'pushed');
  s.grid[cell(4, 5)] = 2; s.turn = 0; s.grid[cell(4, 5)] = 0;
  console.assert(!M.movesFrom(s, cell(4, 3)).some(m => m.type === 'push' && m.to === cell(4, 4)), 'no second push at once');
  // push into a pit kills; nothing is pushed over the edge
  s = fresh(); pad(s); s.grid[cell(4, 2)] = 1; s.grid[cell(4, 3)] = 2; s.grid[cell(4, 4)] = M.PIT;
  const kill = M.movesFrom(s, cell(4, 2)).find(m => m.kill);
  let ev = M.applyMove(s, kill);
  console.assert(s.grid[cell(4, 4)] === M.PIT && s.grid[cell(4, 3)] === 1 && M.countStones(s)[2] === 4, 'into the pit');
  s = fresh(); pad(s); s.grid[cell(4, 6)] = 1; s.grid[cell(4, 7)] = 2;
  console.assert(!M.movesFrom(s, cell(4, 6)).some(m => m.type === 'push' && m.to === cell(4, 7)), 'not over the edge');
  // trapped: one free neighbour or none
  s = fresh(); pad(s); s.grid[cell(4, 3)] = 1; for (const d of [0, 1, 2, 3, 4]) s.grid[L.step[cell(4, 3) * 6 + d]] = 2;
  console.assert(M.isTrapped(s, cell(4, 3)) && !M.movesFrom(s, cell(4, 3)).length, 'trapped');
  // encircle: the ring closes, the stone falls, its field becomes a pit
  const gap = L.step[cell(4, 3) * 6 + 5]; s.grid[cell(6, 0)] = 2; s.turn = 1;
  const close = M.allMoves(s).find(m => m.type === 'glide' && m.to === gap);
  console.assert(close, 'a stone can close the ring');
  ev = M.applyMove(s, close);
  console.assert(s.grid[cell(4, 3)] === M.PIT && ev.some(e => e.type === 'collapse'), 'collapse');
  // a corner needs only three stones; more friends than rivals around it keep a stone alive
  s = fresh(); pad(s); s.grid[cell(4, 0)] = 1; s.grid[cell(3, 0)] = 2; s.grid[cell(5, 0)] = 2; s.grid[cell(4, 3)] = 2; s.turn = 1;
  ev = M.applyMove(s, { type: 'glide', from: cell(4, 3), to: cell(4, 1) });
  console.assert(s.grid[cell(4, 0)] === M.PIT, 'the edge helps to encircle');
  // fewer than four stones loses; a player who cannot move is entombed
  s = fresh(); for (const [r, c, v] of [[0, 0, 1], [0, 1, 1], [0, 2, 1], [0, 3, 1], [8, 0, 2], [8, 1, 2], [8, 2, 2], [4, 3, 2], [4, 4, M.PIT], [4, 2, 1]]) s.grid[cell(r, c)] = v;
  M.applyMove(s, M.movesFrom(s, cell(4, 2)).find(m => m.kill));
  console.assert(M.outcome(s) && M.outcome(s).winner === 1, 'below four');
  console.log('mausoleum: rule checks done');
  for (const [n, a, b] of [[2, 'hard', 'medium'], [2, 'easy', 'hard'], [2, 'medium', 'easy'], [2, 'easy', 'medium'], [4, 'hard', 'easy']]) {
    let g = M.createState(n), hist = [], t0 = Date.now(), o = null, rep = false; const seenN = new Map();
    while (!(o = M.outcome(g)) && g.ply < 400 && !rep) {
      const lv = g.turn % 2 === 0 ? a : b;
      const m = mausoleumMove(g, lv, 'standard', hist);
      console.assert(M.allMoves(g).some(x => JSON.stringify(x) === JSON.stringify(m)), 'AI move is legal');
      M.applyMove(g, m, false); const k = M.positionKey(g); hist.push(k); seenN.set(k, (seenN.get(k) || 0) + 1); rep = seenN.get(k) >= 3;
    }
    console.log('mausoleum', n, 'p', a, 'vs', b, '->', JSON.stringify(o), rep ? 'threefold repetition' : '', 'plies', g.ply, 'stones', M.countStones(g).slice(1, 5).join(','), 'pits', M.countStones(g)[5], ((Date.now() - t0) / g.ply | 0) + 'ms/move');
  }
}

// ---------------------------------------------------------------- Colossus
import * as C from './src/colossus/rules.js';
import { chooseMove as colossusMove } from './src/colossus/ai.js';
{
  for (const n of [2, 4]) { const L = C.layout(n), s = C.createState(n); console.log('colossus', n, 'players:', L.active.reduce((a, b) => a + b, 0), 'fields, stones', C.countStones(s).slice(1).join(','), 'opening moves', C.allMoves(s).length); }
  const S = 11, at = (r, c) => r * S + c, L = C.layout(2);
  console.assert(L.active.reduce((a, b) => a + b, 0) === 93 && C.countStones(C.createState(2))[1] === 12 && C.countStones(C.createState(4))[3] === 10, 'board and stones');
  const fresh = () => { const s = C.createState(2); s.grid.fill(0); for (const [r, c, v] of [[9, 1, 1], [9, 2, 1], [8, 1, 1], [1, 9, 1], [1, 1, 2], [1, 2, 2], [2, 1, 2], [9, 9, 2]]) s.grid[at(r, c)] = v; return s; };
  // run: any distance over free fields, never through a stone
  let s = fresh(); s.grid[at(5, 3)] = 1; s.grid[at(5, 7)] = 2;
  let ms = C.movesFrom(s, at(5, 3));
  console.assert(ms.some(m => m.to === at(5, 6)) && !ms.some(m => m.to === at(5, 8)) && ms.some(m => m.to === at(5, 1)), 'run');
  // push, and no pushing straight back
  s = fresh(); s.grid[at(5, 5)] = 1; s.grid[at(5, 6)] = 2;
  const push = C.movesFrom(s, at(5, 5)).find(m => m.type === 'push');
  C.applyMove(s, push);
  console.assert(s.grid[at(5, 6)] === 1 && s.grid[at(5, 7)] === 2, 'push');
  s.turn = 0; s.lastPushed = -1; s.grid[at(5, 8)] = 1; // a white stone on the far side tries to shove it back
  console.assert(!C.movesFrom(s, at(5, 8)).some(m => m.type === 'push' && m.to === at(5, 7)), 'not straight back');
  // tilt: a stone on a direction field leans the board; every stone slides until stopped
  s = fresh(); s.grid[at(1, 5)] = 1; s.grid[at(6, 3)] = 2;
  let ev = C.applyMove(s, { type: 'run', from: at(1, 5), to: at(0, 5) });
  console.assert(ev.some(e => e.type === 'tilt' && e.dir === 0) && s.grid[at(1, 3)] === 2 && s.grid[at(6, 3)] === 0, 'tilt north');
  console.assert(s.grid[at(0, 5)] === 1, 'the stone on the field stays');
  // opposite fields cancel
  s = fresh(); s.grid[at(0, 5)] = 1; s.grid[at(9, 5)] = 2; s.grid[at(5, 5)] = 2; s.turn = 1;
  ev = C.applyMove(s, { type: 'run', from: at(9, 5), to: at(10, 5) });
  console.assert(!ev.some(e => e.type === 'tilt') && s.grid[at(5, 5)] === 2, 'opposite fields cancel');
  // Hades: a group with no free field beside it is removed; the edge closes it in
  s = fresh(); s.grid[at(5, 9)] = 2; s.grid[at(4, 9)] = 1; s.grid[at(6, 9)] = 1; s.grid[at(5, 7)] = 1;
  s.grid[at(5, 10)] = 2; s.grid[at(4, 10)] = 1; s.grid[at(6, 10)] = 1; // black pair in the east arm, walled in
  s.grid[at(9, 9)] = 0; // black is down to five stones: losing two leaves three
  ev = C.applyMove(s, { type: 'run', from: at(5, 7), to: at(5, 8) });
  console.assert(ev.some(e => e.type === 'hades' && e.cells.length === 2) && !s.grid[at(5, 9)] && !s.grid[at(5, 10)], 'hades');
  console.assert(!ev.some(e => e.type === 'tilt'), 'a Hades ends the sliding');
  console.assert(s.out[2] === 1 && C.outcome(s).winner === 1, 'fewer than four stones loses');
  console.log('colossus: rule checks done');
  for (const [n, a, b] of [[2, 'hard', 'medium'], [2, 'medium', 'hard'], [2, 'medium', 'easy'], [2, 'easy', 'medium'], [4, 'medium', 'easy']]) {
    let g = C.createState(n), hist = [], t0 = Date.now(), o = null, rep = false, tilts = 0, max = 0; const seenN = new Map();
    while (!(o = C.outcome(g)) && g.ply < 500 && !rep) {
      const lv = g.turn % 2 === 0 ? a : b, t1 = Date.now();
      const m = colossusMove(g, lv, 'standard', hist); max = Math.max(max, Date.now() - t1);
      console.assert(C.allMoves(g).some(x => JSON.stringify(x) === JSON.stringify(m)), 'AI move is legal');
      tilts += C.applyMove(g, m).filter(e => e.type === 'tilt').length; const k = C.positionKey(g); hist.push(k); seenN.set(k, (seenN.get(k) || 0) + 1); rep = seenN.get(k) >= 3;
    }
    console.log('colossus', n, 'p', a, 'vs', b, '->', JSON.stringify(o), rep ? 'threefold repetition' : '', 'plies', g.ply, 'stones', C.countStones(g).slice(1).join(','), 'tilts', tilts, ((Date.now() - t0) / g.ply | 0) + 'ms/move, slowest', max + 'ms');
  }
}

// ---------------------------------------------------------------- Pharos
import * as P from './src/pharos/rules.js';
import { chooseMove as pharosMove } from './src/pharos/ai.js';
{
  for (const n of [2, 4]) { const s = P.createState(n); console.log('pharos', n, 'players:', P.layout(n).N, 'fields, stones', P.countStones(s).slice(1).join(','), 'opening moves', P.allMoves(s).length); }
  const S = 9, at = (r, c) => r * S + c;
  const fresh = () => { const s = P.createState(2); s.grid.fill(0); return s; };
  // a stone alone cannot move; a friend in line gives it light
  let s = fresh(); s.grid[at(4, 2)] = 1; s.grid[at(8, 8)] = 2; s.grid[at(8, 6)] = 2;
  console.assert(!P.canMove(s, 1) && !P.nextSteps(s, at(4, 2), []).length, 'no light, no move');
  s.grid[at(4, 6)] = 1;
  console.assert(P.nextSteps(s, at(4, 2), []).length === 4, 'lit by a friend in the row');
  // a rival between them cuts the light
  s.grid[at(4, 4)] = 2;
  console.assert(!P.nextSteps(s, at(4, 2), []).length, 'light blocked');
  // one light per stone per turn: two friends give two steps, not three
  s = fresh(); s.grid[at(4, 2)] = 1; s.grid[at(4, 6)] = 1; s.grid[at(7, 2)] = 1; s.grid[at(0, 0)] = 2; s.grid[at(0, 8)] = 2;
  let ms = P.movesFrom(s, at(4, 2), 4);
  console.assert(Math.max(...ms.map(m => m.path.length)) >= 2, 'chain of two');
  console.assert(ms.every(m => P.tryPath(s, m.from, m.path)), 'every listed path is legal');
  // stepping on a rival takes it; a friend cannot be stepped on
  s = fresh(); s.grid[at(4, 2)] = 1; s.grid[at(4, 6)] = 1; s.grid[at(4, 3)] = 2; s.grid[at(3, 2)] = 1; s.grid[at(0, 0)] = 2; s.grid[at(0, 4)] = 2;
  const steps = P.nextSteps(s, at(4, 2), []);
  console.assert(steps.some(x => x.to === at(4, 3) && x.capture === 2) && !steps.some(x => x.to === at(3, 2)), 'capture, and friends block');
  // beacons: entering one lights it; its light crosses stones; it does not light the stone standing on it
  s = fresh(); s.grid[at(0, 1)] = 1; s.grid[at(3, 1)] = 1; s.grid[at(8, 8)] = 2; s.grid[at(8, 6)] = 2;
  let ev = P.applyMove(s, { from: at(0, 1), path: [at(0, 0)] });
  console.assert(s.lit[0] === 1 && ev[0].lit === 0, 'beacon lit');
  s.turn = 0;
  console.assert(!P.lightsFor(s, at(0, 0), 1).some(P.isBeaconLight), 'not for the stone on it');
  s.grid[at(0, 5)] = 1; s.grid[at(0, 3)] = 2;
  console.assert(P.lightsFor(s, at(0, 5), 1).some(P.isBeaconLight), 'beacon light is not stopped by a rival');
  // a player who cannot move has lost
  s = fresh(); s.grid[at(4, 2)] = 1; s.grid[at(4, 6)] = 1; s.grid[at(0, 0)] = 2; s.grid[at(8, 8)] = 2;
  P.applyMove(s, { from: at(4, 2), path: [at(4, 3)] });
  console.assert(s.out[2] === 1 && P.outcome(s).winner === 1, 'standing still loses');
  // four players: allies share light and do not take each other
  const q = P.createState(4);
  console.assert(P.allied(q, 1, 2) && P.allied(q, 3, 4) && !P.allied(q, 1, 3) && !P.allied(P.createState(2), 1, 2), 'alliances');
  q.feud = 1; console.assert(!P.allied(q, 1, 2), 'the alliance ends when only the partners are left');
  console.log('pharos: rule checks done');
  for (const [n, a, b] of [[2, 'hard', 'medium'], [2, 'medium', 'hard'], [2, 'medium', 'easy'], [2, 'easy', 'medium'], [4, 'medium', 'easy']]) {
    let g = P.createState(n), hist = [], t0 = Date.now(), o = null, rep = false, max = 0; const seenN = new Map();
    while (!(o = P.outcome(g)) && g.ply < 400 && !rep) {
      const lv = g.turn % 2 === 0 ? a : b, t1 = Date.now();
      const m = pharosMove(g, lv, 'standard', hist); max = Math.max(max, Date.now() - t1);
      console.assert(m && P.tryPath(g, m.from, m.path), 'AI move is legal');
      P.applyMove(g, m, false); const k = P.positionKey(g); hist.push(k); seenN.set(k, (seenN.get(k) || 0) + 1); rep = seenN.get(k) >= 3;
    }
    console.log('pharos', n, 'p', a, 'vs', b, '->', JSON.stringify(o), rep ? 'threefold repetition' : '', 'plies', g.ply, 'stones', P.countStones(g).slice(1).join(','), 'beacons', P.countBeacons(g).slice(1).join(','), ((Date.now() - t0) / g.ply | 0) + 'ms/move, slowest', max + 'ms');
  }
}

// ---------------------------------------------------------------- Great Wall
import * as W from './src/greatwall/rules.js';
import { chooseMove as wallMove, candidates as wallCandidates } from './src/greatwall/ai.js';
{
  for (const n of [2, 4]) { const L = W.layout(n), s = W.createState(n); console.log('great wall', n, 'players:', L.on.reduce((a, b) => a + b, 0), 'fields, first placements', W.supplyOf(s, 1).fields.length); }
  const C = 15, at = (r, c) => r * C + c, man = (color, f) => color * 8 + f;
  const N = 0, E = 2, S = 4, Wd = 6;
  let s = W.createState(2);
  // supply: the first warrior goes within two steps of the Legendary Field; a rival on that field cuts the supply
  const first = W.supplyOf(s, 1).fields;
  console.assert(first.length === 14 && first.every(i => i % C >= 12), 'around white’s field: ' + first.length);
  s.grid[at(2, 14)] = man(2, Wd);
  console.assert(!W.supplyOf(s, 1).fields.length, 'supply cut');
  // the chain runs on through friendly warriors
  s = W.createState(2); s.grid[at(2, 12)] = man(1, Wd); s.grid[at(2, 10)] = man(1, Wd);
  console.assert(W.supplyOf(s, 1).fields.some(i => i % C === 8), 'chain extends');
  // walking: two fields need an empty field between
  s = W.createState(2); s.grid[at(2, 5)] = man(1, Wd);
  console.assert(W.moveTargets(s, at(2, 5)).length === 24, 'free walk');
  // the shield: back and rear flanks; an arrow from the front kills
  console.assert(W.shielded(N, S) && W.shielded(N, 3) && W.shielded(N, 5) && !W.shielded(N, N) && !W.shielded(N, E), 'shield covers three rear sides');
  s = W.createState(2); s.grid[at(2, 3)] = man(1, E); s.grid[at(2, 8)] = man(2, S);
  let a = W.arrow(s, at(2, 3));
  console.assert(a.kills.length === 1 && a.kills[0] === at(2, 8), 'a shot in the unshielded side');
  // a warrior shot from the front falls — and the arrow flies on the way he faced: back at the archer
  s.grid[at(2, 8)] = man(2, Wd);
  console.assert(W.arrow(s, at(2, 3)).kills.length === 2, 'face to face, both fall');
  // square on the shield it comes straight back — and fells the archer
  s.grid[at(2, 8)] = man(2, E);
  a = W.arrow(s, at(2, 3));
  console.assert(a.marks[0].type === 'reflect' && a.kills[0] === at(2, 3), 'reflected onto the archer');
  // on a rear flank it glances off by a quarter turn
  s.grid[at(2, 8)] = man(2, 1); // facing north-east: its rear flanks are west and south
  a = W.arrow(s, at(2, 3));
  console.assert(a.marks[0].type === 'deflect' && !a.kills.length, 'deflected');
  // the arrow flies on the way the fallen warrior faced
  s = W.createState(2); s.grid[at(2, 3)] = man(1, E); s.grid[at(2, 6)] = man(2, S); s.grid[at(4, 6)] = man(2, N);
  a = W.arrow(s, at(2, 3));
  console.assert(a.kills.length === 2, 'chain of two');
  // spin: all eight fields, shields still count
  s = W.createState(2); s.grid[at(2, 5)] = man(1, E); s.grid[at(2, 6)] = man(2, Wd); s.grid[at(1, 5)] = man(2, N); s.grid[at(3, 4)] = man(1, N);
  console.assert(W.spinKills(s, at(2, 5)).sort().join() === [at(2, 6), at(3, 4)].sort().join(), 'spin spares the shielded, not your own');
  // an army below four is beaten
  s = W.createState(2); s.reserve[2] = 3; s.grid[at(2, 3)] = man(1, E); s.grid[at(2, 8)] = man(2, S);
  W.applyMove(s, { type: 'shoot', from: at(2, 3) });
  console.assert(s.out[2] === 1 && W.outcome(s).winner === 1, 'below four');
  console.log('great wall: rule checks done');
  for (const [n, a1, b1] of [[2, 'hard', 'medium'], [2, 'medium', 'hard'], [2, 'medium', 'easy'], [2, 'easy', 'medium'], [4, 'medium', 'easy']]) {
    let g = W.createState(n), hist = [], t0 = Date.now(), o = null, rep = false, max = 0, cand = 0; const seenN = new Map(), kinds = {};
    while (!(o = W.outcome(g)) && g.ply < 500 && !rep) {
      const lv = g.turn % 2 === 0 ? a1 : b1, t1 = Date.now();
      cand = Math.max(cand, wallCandidates(g).length);
      const m = wallMove(g, lv, 'standard', hist); max = Math.max(max, Date.now() - t1);
      kinds[m.type] = (kinds[m.type] || 0) + 1;
      W.applyMove(g, m, false); const k = W.positionKey(g); hist.push(k); seenN.set(k, (seenN.get(k) || 0) + 1); rep = seenN.get(k) >= 3;
    }
    console.log('great wall', n, 'p', a1, 'vs', b1, '->', JSON.stringify(o), rep ? 'threefold repetition' : '', 'plies', g.ply, 'forces', W.forces(g).slice(1).join(','), JSON.stringify(kinds), 'most candidates', cand, ((Date.now() - t0) / g.ply | 0) + 'ms/move, slowest', max + 'ms');
  }
}

// ---------------------------------------------------------------- Skyscraper
import * as K from './src/skyscraper/rules.js';
import { chooseMove as skyMove } from './src/skyscraper/ai.js';
{
  for (const n of [2, 4]) { const L = K.layout(n), s = K.createState(n); console.log('skyscraper', n, 'players:', L.N, 'blocks,', L.windows, 'windows, need', L.need, 'opening moves', K.movesFor(s).length, 'elevator', K.elevator(s)); }
  const L = K.layout(2), f = L.find;
  console.assert(L.windows === 105 && L.need === 53 && K.layout(4).windows === 205, 'window counts');
  // only blocks in line with one of your own, no higher than the elevator
  let s = K.createState(2);
  let ms = K.movesFor(s);
  console.assert(ms.every(i => L.blocks[i].w <= 6) && ms.includes(f(0, 4, 5)) && ms.includes(f(2, 4, 6)) && !ms.includes(f(2, 4, 7)), 'elevator limits the first round');
  console.assert(!ms.includes(f(0, 3, 5)), 'not in line');
  // a rival's block between cuts the line; the inside of the tower does not
  s = K.createState(2); s.grid.fill(0); s.grid[f(0, 4, 5)] = 1; s.grid[f(2, 4, 5)] = 2; s.ply = 20;
  console.assert(!K.movesFor(s, 1).includes(f(4, 4, 5)), 'shadow');
  s.grid[f(2, 4, 5)] = 0; s.grid[f(0, 2, 5)] = 1;
  console.assert(K.movesFor(s, 1).includes(f(4, 2, 5)), 'sight passes through the tower');
  // completing a row of five: the majority takes it all
  s = K.createState(2); s.grid.fill(0); s.ply = 20;
  for (const [u, c] of [[0, 1], [1, 1], [2, 2], [3, 2]]) s.grid[f(u, 4, 6)] = c;
  let ev = K.applyMove(s, f(4, 4, 6));
  console.assert([0, 1, 2, 3, 4].every(u => s.grid[f(u, 4, 6)] === 1) && ev.some(e => e.type === 'capture'), 'row captured');
  // a tie stands
  s = K.createState(4); s.grid.fill(0); s.ply = 80; const f4 = K.layout(4).find;
  for (const [u, c] of [[0, 1], [1, 1], [2, 3], [3, 3]]) s.grid[f4(u, 4, 6)] = c;
  s.turn = 2; K.applyMove(s, f4(4, 4, 6));
  console.assert(s.grid[f4(0, 4, 6)] === 1 && s.grid[f4(2, 4, 6)] === 3 && s.grid[f4(4, 4, 6)] === 2, 'tie stands');
  console.log('skyscraper: rule checks done');
  for (const [n, a, b] of [[2, 'hard', 'medium'], [2, 'medium', 'hard'], [2, 'medium', 'easy'], [2, 'easy', 'medium'], [4, 'medium', 'easy']]) {
    let g = K.createState(n), t0 = Date.now(), o = null, max = 0;
    while (!(o = K.outcome(g)) && g.ply < 400) {
      const lv = g.turn % 2 === 0 ? a : b, t1 = Date.now();
      const m = skyMove(g, lv); max = Math.max(max, Date.now() - t1);
      console.assert(K.movesFor(g).includes(m), 'AI move is legal');
      K.applyMove(g, m, false);
    }
    console.log('skyscraper', n, 'p', a, 'vs', b, '->', JSON.stringify(o), 'plies', g.ply, 'windows', K.scores(g).slice(1).join(','), ((Date.now() - t0) / g.ply | 0) + 'ms/move, slowest', max + 'ms');
  }
}
