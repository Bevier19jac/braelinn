/* ============================================================================
   RANDOMIZED STRESS TEST — Braelinn tournament engine
   5 iterations x 10 games = 50 randomized tournaments.

   This loads the REAL data.js and game-state.js (no reimplementation) and
   drives them through chaotic game nights: random field sizes, no-shows, late
   entries, rebuys, mistaken eliminations that get undone, host device swaps
   mid-tournament, and random table counts.

   Every game asserts hard invariants. Any violation is a real bug.
   ========================================================================== */

const fs = require('fs');
const vm = require('vm');

const DIR = __dirname + '/';

/* ---------------------------------------------------------------- RNG ---- */
let seed = 1;
function srand(s) { seed = s >>> 0; }
function rnd() {                       // deterministic xorshift, so failures replay
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >> 17;
  seed ^= seed << 5;  seed >>>= 0;
  return seed / 4294967296;
}
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = arr => arr[ri(0, arr.length - 1)];

/* ------------------------------------------------------- in-memory DB ---- */
function makeDB() {
  const store = {};
  const listeners = {};
  let clock = 1_700_000_000_000;

  const walk = (path, create) => {
    const parts = path.split('/').filter(Boolean);
    let cur = store;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) {
        if (!create) return { parent: null, key: null };
        cur[parts[i]] = {};
      }
      cur = cur[parts[i]];
    }
    return { parent: cur, key: parts[parts.length - 1] };
  };

  const read = path => {
    const { parent, key } = walk(path, false);
    if (!parent) return null;
    return parent[key] === undefined ? null : parent[key];
  };

  const write = (path, value) => {
    const { parent, key } = walk(path, true);
    if (value === null) delete parent[key]; else parent[key] = value;
  };

  const fire = () => {
    Object.keys(listeners).forEach(p => {
      listeners[p].forEach(cb => cb(read(p)));
    });
  };

  return {
    mode: 'test',
    _store: store,
    _advance(ms) { clock += ms; },
    now() { return clock; },
    path: p => p,
    isConnected: () => true,
    onConnection(cb) { cb(true); },
    on(path, cb) { (listeners[path] = listeners[path] || []).push(cb); cb(read(path)); },
    get(path) { return Promise.resolve(read(path)); },
    set(path, v) { write(path, v); fire(); return Promise.resolve(); },
    update(path, patch) {
      const cur = read(path);
      const next = Object.assign({}, (cur && typeof cur === 'object') ? cur : {}, patch);
      Object.keys(next).forEach(k => { if (next[k] === null) delete next[k]; });
      write(path, next); fire(); return Promise.resolve();
    },
    multi(map) { Object.keys(map).forEach(k => write(k, map[k])); fire(); return Promise.resolve(); },
    push(path, v) {
      const id = 'k' + (clock++) + '_' + ri(1000, 9999);
      write(path + '/' + id, v); fire(); return Promise.resolve(id);
    },
    save(label, work) { return Promise.resolve(typeof work === 'function' ? work() : work); }
  };
}

/* -------------------------------------------------------- load the app --- */
function loadEngine() {
  const ctx = {
    console, Math, JSON, Date, Number, String, Array, Object, Boolean,
    setTimeout, clearTimeout, setInterval, clearInterval
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  ctx.DB = makeDB();
  ctx.UI = {
    shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    esc: s => String(s), toast() {}, saveState() {}, avatar: () => '', tables(seats, n) {
      const out = Array.from({ length: Math.max(1, n) }, () => []);
      seats.forEach((s, i) => out[i % Math.max(1, n)].push(s));
      return out;
    }
  };

  /* `const LEAGUE = {...}` creates a lexical binding, not a global property,
     so surface them explicitly after evaluating. */
  vm.runInContext(
    fs.readFileSync(DIR + 'data.js', 'utf8') +
    '\n; globalThis.LEAGUE = LEAGUE; globalThis.BPL = BPL;', ctx);
  vm.runInContext(fs.readFileSync(DIR + 'game-state.js', 'utf8'), ctx);
  return ctx;
}

/* ------------------------------------------------------------ asserts --- */
let failures = [];
function check(cond, msg, detail) {
  if (!cond) failures.push({ msg, detail });
  return cond;
}

/* ------------------------------------------------------- one full game --- */
async function playGame(gameNo) {
  const ctx = loadEngine();
  const { Game, DB, LEAGUE, BPL } = ctx;
  Game.start();

  const roster = LEAGUE.standings.map(p => p.name);

  /* --- RSVP a random slice --- */
  const rsvpCount = ri(4, Math.min(28, roster.length));
  const rsvped = ctx.UI.shuffle(roster).slice(0, rsvpCount);
  for (const n of rsvped) await DB.set('rsvp/' + Game.id + '/' + n, pick(['in', 'in', 'in', 'maybe', 'out']));

  /* --- check in everyone who said In, minus random no-shows --- */
  await Game.checkInAll(Game.noShows());
  const noShowCount = ri(0, Math.min(3, Math.max(0, Game.fieldSize() - 2)));
  for (let i = 0; i < noShowCount; i++) {
    const victims = Game.entrants();
    if (victims.length <= 2) break;
    await Game.undoCheckIn(pick(victims));
  }

  if (Game.fieldSize() < 2) {                      // too small to be a tournament
    const extras = roster.filter(n => !Game.state().players[n]).slice(0, 3);
    for (const n of extras) await Game.checkIn(n, {});
  }

  /* --- seats --- */
  const alive0 = Game.active().length;
  const tables = Math.max(1, Math.min(4, Math.floor(alive0 / ri(2, 9)) || 1));
  try { await Game.drawSeats(tables); } catch (_) {}

  /* --- start the clock --- */
  await Game.timerStart();
  DB._advance(ri(1, 40) * 60000);

  /* --- random late entries AFTER play started --- */
  const lateCount = ri(0, 3);
  for (let i = 0; i < lateCount; i++) {
    const avail = roster.filter(n => !Game.state().players[n]);
    if (!avail.length) break;
    const n = pick(avail);
    await Game.checkIn(n, { late: true });
    await Game.seatLatecomer(n);
    check(Game.state().players[n].late === true, 'late flag not set', { game: gameNo, n });
    check(Game.state().players[n].bonus === false, 'late player wrongly got bonus chips', { game: gameNo, n });
  }

  /* --- random rebuys --- */
  for (let i = 0, k = ri(0, 6); i < k; i++) {
    const who = Game.entrants();
    if (!who.length) break;
    await Game.addRebuy(pick(who));
  }

  /* --- play it out: eliminate until one remains, with chaos --- */
  let guard = 0;
  while (Game.active().length > 1 && guard++ < 500) {
    const act = Game.active();
    const victim = pick(act);

    /* sometimes the player self-reports first — must NOT change state */
    if (rnd() < 0.5) {
      const beforeAlive = Game.active().length;
      const id = await Game.report(victim, 'out');
      check(Game.active().length === beforeAlive,
        'PLAYER REPORT CHANGED TOURNAMENT STATE', { game: gameNo, victim });
      await Game.confirmOut(victim, id);
    } else {
      await Game.confirmOut(victim);
    }
    DB._advance(ri(5, 400) * 1000);

    /* occasionally the host mistakenly busts someone and undoes it */
    if (rnd() < 0.12 && Game.busted().length) {
      const back = pick(Game.busted());
      await Game.reinstate(back);
      check(Game.state().players[back].status === 'active', 'reinstate failed', { game: gameNo, back });
      DB._advance(1000);
    }

    /* occasionally consolidate tables */
    if (rnd() < 0.15 && Game.active().length >= 2) {
      try { await Game.drawSeats(Game.active().length <= 10 ? 1 : 2); } catch (_) {}
    }

    /* occasionally simulate the host device dying: rebuild view from Firebase */
    if (rnd() < 0.1) {
      const elapsedBefore = Game.elapsedMs();
      const c1 = Game.clock();
      DB._advance(3000);
      const c2 = Game.clock();
      check(Game.elapsedMs() >= elapsedBefore, 'clock went backwards', { game: gameNo });
      check(c2.index >= c1.index, 'blind level went backwards', { game: gameNo });
    }
  }

  /* --- finalize --- */
  check(Game.readyToFinalize(), 'not ready to finalize after playing out',
    { game: gameNo, active: Game.active().length, field: Game.fieldSize() });

  let rec = null;
  try { rec = await Game.finalize(); }
  catch (e) { check(false, 'finalize threw: ' + e.message, { game: gameNo }); return; }

  /* ================= INVARIANTS ================= */
  const field = rec.field;
  const places = rec.finish.map(f => f.place).sort((a, b) => a - b);
  const names = rec.finish.map(f => f.name);

  check(places.length === field, 'finish rows != field size', { game: gameNo, rows: places.length, field });
  check(places.every((p, i) => p === i + 1), 'places are not exactly 1..N',
    { game: gameNo, places: places.join(',') });
  check(new Set(names).size === names.length, 'duplicate player in finish', { game: gameNo });

  const paid = rec.finish.reduce((s, f) => s + (f.winnings || 0), 0);
  check(paid === rec.pot, 'payouts do not sum to pot', { game: gameNo, paid, pot: rec.pot });

  rec.finish.forEach(f => {
    const expect = (field - f.place + 1) * 300;
    check(f.points === expect, 'points formula wrong',
      { game: gameNo, name: f.name, place: f.place, got: f.points, expect });
  });

  check(rec.winner === rec.finish[0].name && rec.finish[0].place === 1,
    'winner is not place 1', { game: gameNo });

  const expectGross = field * LEAGUE.nextGame.buyin + rec.rebuys * LEAGUE.nextGame.rebuy;
  check(rec.gross === expectGross, 'gross money wrong',
    { game: gameNo, got: rec.gross, expect: expectGross });
  check(rec.pot === rec.gross - rec.kitty, 'pot != gross - kitty', { game: gameNo });
  check(rec.finish.every(f => f.winnings >= 0), 'negative payout', { game: gameNo });

  /* standings aggregation must agree with the record */
  const agg = BPL.aggregate({ [rec.gameId]: rec });
  const winnerRow = agg.players.find(p => p.name === rec.winner);
  check(winnerRow && winnerRow.wins === 1, 'aggregate lost the win', { game: gameNo });
  check(winnerRow && winnerRow.points === (field * 300), 'aggregate points wrong',
    { game: gameNo, got: winnerRow && winnerRow.points, expect: field * 300 });

  const totalPts = agg.players.reduce((s, p) => s + p.points, 0);
  const recPts = rec.finish.reduce((s, f) => s + f.points, 0);
  check(totalPts === recPts, 'aggregate points total mismatch',
    { game: gameNo, totalPts, recPts });

  return { field, pot: rec.pot, rebuys: rec.rebuys, winner: rec.winner };
}



/* ============================================================================
   TARGETED EDGE-CASE TESTS
   Specific scenarios rather than random play, so a regression names itself.
   ========================================================================== */
async function scenarios() {
  const F = [];
  const chk = (c, m, d) => { if (!c) F.push({ msg: m, detail: d }); };

  async function fresh(names) {
    const ctx = loadEngine();
    ctx.Game.start();
    for (const n of names) await ctx.Game.checkIn(n, {});
    return ctx;
  }
  const roster = n => {
    const ctx = loadEngine();
    return ctx.LEAGUE.standings.map(p => p.name).slice(0, n);
  };

  /* ---- field sizes: 2, 8, 20, 36 -------------------------------------- */
  for (const size of [2, 8, 20, 34]) {
    const names = roster(size);
    const ctx = await fresh(names);
    const { Game, BPL } = ctx;
    while (Game.active().length > 1) await Game.confirmOut(Game.active()[0]);
    const rec = await Game.finalize();
    const places = rec.finish.map(f => f.place).sort((a, b) => a - b);
    chk(rec.field === size, `field ${size}: wrong field size`, { got: rec.field });
    chk(places.every((p, i) => p === i + 1), `field ${size}: places not 1..N`, { places });
    chk(rec.finish[0].points === size * 300, `field ${size}: winner points wrong`,
        { got: rec.finish[0].points, expect: size * 300 });
    const paid = rec.finish.reduce((s, f) => s + (f.winnings || 0), 0);
    chk(paid === rec.pot, `field ${size}: payouts != pot`, { paid, pot: rec.pot });
    chk(rec.type === "regular", `field ${size}: event type not preserved`, { type: rec.type });
  }

  /* ---- bust then REBUY: must not leave a phantom finishing place ------- */
  {
    const names = roster(6);
    const ctx = await fresh(names);
    const { Game } = ctx;
    const victim = names[0];
    await Game.confirmOut(victim);
    chk(Game.busted().includes(victim), "rebuy: victim should be out first", {});
    await Game.addRebuy(victim);
    chk(Game.active().includes(victim), "rebuy: player not back in", {});
    chk(!Game.busted().includes(victim), "rebuy: still counted as busted", {});
    chk(Game.state().players[victim].bustAt == null,
        "rebuy: stale bustAt left behind (phantom finishing place)",
        { bustAt: Game.state().players[victim].bustAt });
    chk(Game.finishOrder().every(f => f.name !== victim),
        "rebuy: player still appears in finishing order", {});
    // play it out — places must still be clean
    while (Game.active().length > 1) await Game.confirmOut(Game.active()[0]);
    const rec = await Game.finalize();
    const places = rec.finish.map(f => f.place).sort((a, b) => a - b);
    chk(places.every((p, i) => p === i + 1), "rebuy: places corrupted after rebuy", { places });
    chk(rec.rebuys === 1, "rebuy: rebuy not counted in money", { rebuys: rec.rebuys });
  }

  /* ---- mistaken elimination then reinstate ----------------------------- */
  {
    const names = roster(7);
    const ctx = await fresh(names);
    const { Game } = ctx;
    await Game.confirmOut(names[2]);
    await Game.reinstate(names[2]);
    chk(Game.active().includes(names[2]), "reinstate: not active again", {});
    chk(Game.state().players[names[2]].bustAt == null, "reinstate: bustAt not cleared", {});
    while (Game.active().length > 1) await Game.confirmOut(Game.active()[0]);
    const rec = await Game.finalize();
    const places = rec.finish.map(f => f.place).sort((a, b) => a - b);
    chk(places.every((p, i) => p === i + 1), "reinstate: places corrupted", { places });
  }

  /* ---- late entry after busts ------------------------------------------ */
  {
    const names = roster(8);
    const ctx = await fresh(names);
    const { Game, LEAGUE } = ctx;
    await Game.confirmOut(names[0]);
    await Game.confirmOut(names[1]);
    const late = LEAGUE.standings.map(p => p.name).find(n => !names.includes(n));
    await Game.checkIn(late, { late: true });
    chk(Game.state().players[late].bonus === false, "late: got on-time bonus chips", {});
    while (Game.active().length > 1) await Game.confirmOut(Game.active()[0]);
    const rec = await Game.finalize();
    const places = rec.finish.map(f => f.place).sort((a, b) => a - b);
    chk(rec.field === 9, "late: field should be 9", { got: rec.field });
    chk(places.every((p, i) => p === i + 1), "late: places not 1..N", { places });
  }

  /* ---- seat draw balance: 17 players / 2 tables should be 9 + 8 -------- */
  {
    const ctx = loadEngine();
    const t = ctx.UI.tables(Array.from({ length: 17 }, (_, i) => "P" + i), 2);
    const sizes = t.map(x => x.length).sort((a, b) => b - a);
    chk(sizes[0] - sizes[1] <= 1, "seats: 17/2 unbalanced", { sizes });
    const t3 = ctx.UI.tables(Array.from({ length: 20 }, (_, i) => "P" + i), 3);
    const s3 = t3.map(x => x.length).sort((a, b) => b - a);
    chk(s3[0] - s3[1] <= 1, "seats: 20/3 unbalanced", { sizes: s3 });
  }

  /* ---- latecomer seating must not unbalance tables --------------------- */
  {
    const ctx = loadEngine();
    for (const n of [17, 18, 19, 20]) {
      const t = ctx.UI.tables(Array.from({ length: n }, (_, i) => "P" + i), 2);
      const sizes = t.map(x => x.length);
      chk(Math.max(...sizes) - Math.min(...sizes) <= 1,
          `latecomer: appending to ${n} players unbalanced the tables`, { sizes });
    }
  }

  /* ---- finalization guards --------------------------------------------- */
  {
    const names = roster(5);
    const ctx = await fresh(names);
    const { Game } = ctx;
    let threw = false;
    try { await Game.finalize(); } catch (e) { threw = true; }
    chk(threw, "finalize: allowed with more than one player active", {});
    while (Game.active().length > 1) await Game.confirmOut(Game.active()[0]);
    const rec = await Game.finalize();
    chk(!!rec, "finalize: failed with exactly one active", {});
    const names2 = rec.finish.map(f => f.name);
    chk(new Set(names2).size === names2.length, "finalize: duplicate player in results", {});
  }

  /* ---- season policy: raw history untouched, standings recomputable ---- */
  {
    const ctx = loadEngine();
    const { BPL, LEAGUE } = ctx;
    const results = {
      "2026-09-03": { gameId:"a", date:"2026-09-03", type:"regular", field:10, pot:300, winner:"Nate",
        finish:[{place:1,name:"Nate",points:3000,winnings:150,itm:true},
                {place:2,name:"Jacob",points:2700,winnings:100,itm:true}] },
      "2026-09-17": { gameId:"b", date:"2026-09-17", type:"regular", field:10, pot:300, winner:"Jacob",
        finish:[{place:1,name:"Jacob",points:3000,winnings:150,itm:true},
                {place:10,name:"Nate",points:300,winnings:0,itm:false}] }
    };
    const agg = BPL.aggregate(results);
    const nate  = agg.players.find(p => p.name === "Nate");
    const jacob = agg.players.find(p => p.name === "Jacob");
    chk(nate.points === 3300, "policy: cumulative total wrong for Nate", { got: nate.points });
    chk(jacob.points === 5700, "policy: cumulative total wrong for Jacob", { got: jacob.points });
    chk(nate.rawPoints === 3300, "policy: rawPoints must always be the full total", { got: nate.rawPoints });

    // switching the policy must recompute from the same untouched history
    LEAGUE.seasonScoring = { mode: "bestN", n: 1 };
    const agg2 = BPL.aggregate(results);
    const nate2 = agg2.players.find(p => p.name === "Nate");
    chk(nate2.points === 3000, "policy: bestN did not apply", { got: nate2.points });
    chk(nate2.rawPoints === 3300, "policy: raw history was altered by policy change",
        { got: nate2.rawPoints });
    chk(results["2026-09-03"].finish[0].points === 3000,
        "policy: stored event result was mutated", {});
    LEAGUE.seasonScoring = { mode: "cumulative" };
  }

  /* ---- tie handling ----------------------------------------------------- */
  {
    const ctx = loadEngine();
    const { BPL } = ctx;
    const ranked = BPL.rankPlayers([
      { name:"Aaron", points:5700, wins:0, cashes:1, avgPlace:3 },
      { name:"Nate",  points:6000, wins:1, cashes:1, avgPlace:2 },
      { name:"Jacob", points:6000, wins:1, cashes:1, avgPlace:2 }
    ]);
    chk(ranked[0].rank === 1 && ranked[1].rank === 1,
        "ties: genuinely tied players should share rank 1",
        { ranks: ranked.map(r => r.name + ":" + r.rank + (r.tied ? "(T)" : "")) });
    chk(ranked[2].rank === 3, "ties: next player should be rank 3, not 2",
        { got: ranked[2].rank });
    chk(ranked[0].tied && ranked[1].tied && !ranked[2].tied, "ties: tied flag wrong", {});

    // a real tiebreak must NOT show as tied
    const r2 = BPL.rankPlayers([
      { name:"Zed", points:6000, wins:1, cashes:2, avgPlace:2 },
      { name:"Abe", points:6000, wins:1, cashes:1, avgPlace:2 }
    ]);
    chk(r2[0].name === "Zed" && !r2[0].tied,
        "ties: more ITM finishes should win the tiebreak, not alphabetical", {});
  }

  return F;
}

/* ------------------------------------------------------------- runner --- */
(async () => {
  const ITER = 5, PER = 10;
  let n = 0;
  const stats = [];

  for (let it = 1; it <= ITER; it++) {
    srand(it * 7919 + 13);                      // deterministic per iteration
    let itFailStart = failures.length;
    const sizes = [];
    for (let g = 1; g <= PER; g++) {
      n++;
      const r = await playGame(n);
      if (r) { sizes.push(r.field); stats.push(r); }
    }
    const newFails = failures.length - itFailStart;
    console.log(`Iteration ${it}: ${PER} games | fields ${Math.min(...sizes)}-${Math.max(...sizes)} | ` +
      (newFails ? `❌ ${newFails} FAILURES` : '✅ all invariants held'));
  }

  console.log(`\nTotal games simulated: ${n}`);
  console.log(`Field sizes: ${Math.min(...stats.map(s => s.field))}–${Math.max(...stats.map(s => s.field))}`);
  console.log(`Pots: $${Math.min(...stats.map(s => s.pot))}–$${Math.max(...stats.map(s => s.pot))}`);
  console.log(`Total rebuys across all games: ${stats.reduce((s, x) => s + x.rebuys, 0)}`);

  console.log("\n== TARGETED EDGE CASES ==");
  const scen = await scenarios();
  if (scen.length) {
    scen.forEach(f => console.log("  ❌ " + f.msg + "  " + JSON.stringify(f.detail)));
    failures.push(...scen);
  } else {
    console.log("  ✅ all edge-case scenarios passed");
  }

  if (failures.length) {
    console.log(`\n❌ ${failures.length} INVARIANT VIOLATIONS`);
    const grouped = {};
    failures.forEach(f => { (grouped[f.msg] = grouped[f.msg] || []).push(f.detail); });
    Object.keys(grouped).forEach(m => {
      console.log(`\n  ${m}  (${grouped[m].length}x)`);
      grouped[m].slice(0, 3).forEach(d => console.log('    ' + JSON.stringify(d)));
    });
    process.exit(1);
  } else {
    console.log('\n✅ ALL 50 GAMES PASSED EVERY INVARIANT');
  }
})();
