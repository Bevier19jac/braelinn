/* ============================================================================
   TOURNAMENT STATE ENGINE — Braelinn Poker League
   ----------------------------------------------------------------------------
   One authoritative copy of tonight's tournament lives in Firebase. Every
   device renders from it. No device owns it.

   THE TWO IDEAS THAT MAKE THIS SURVIVE GAME NIGHT
   -----------------------------------------------
   1. THE CLOCK NEEDS NO WRITER.
      Most timers store "seconds left" and rely on one device counting down and
      writing the next level when it hits zero. If that device dies, the clock
      dies with it.

      This one stores only when the current run began and how much time had
      already accumulated. Every device computes elapsed time from the
      server-corrected clock and walks the blind structure to work out which
      level that lands in. Nobody advances the level — the level is simply a
      function of elapsed time. Close every phone, come back in an hour, and
      the structure is exactly where it should be.

   2. PLAYERS REPORT, THE HOST RECORDS.
      A player can only ever write into reports/. That is a note on the host's
      desk, not tournament state. Finishing positions change only when the host
      confirms. A misplaced thumb costs nothing.

   SHAPE
   -----
     live/<gameId>/
       status                'checkin' | 'running' | 'final'
       players/<name>        { status:'active'|'out', place, buyins, rebuys,
                               late, bonus, joinedAt }
       reports/<id>          { name, type:'out'|'win', at }        <- player-writable
       seats                 { tables, order:[names], drawnAt }
       timer                 { running, paused, startedAt, elapsedBefore }
     results/<gameId>        finalized record — write once, never edited
   ========================================================================== */

(function () {
  "use strict";

  const GAME_ID = LEAGUE.nextGame.date;          // "2026-09-03"
  const BASE    = "live/" + GAME_ID;

  /* ------------------------------------------------------------------ *
   * BLIND STRUCTURE — pure functions over LEAGUE.blinds                 *
   * ------------------------------------------------------------------ */
  const Structure = {
    /** [{ i, lv, startMs, endMs }] cumulative across the whole structure. */
    bounds() {
      let t = 0;
      return LEAGUE.blinds.map((lv, i) => {
        const startMs = t;
        t += lv.mins * 60000;
        return { i: i, lv: lv, startMs: startMs, endMs: t };
      });
    },

    totalMs() {
      return LEAGUE.blinds.reduce((s, l) => s + l.mins * 60000, 0);
    },

    /** Elapsed ms since the structure started -> where we are right now. */
    at(elapsedMs) {
      const b = Structure.bounds();
      const total = Structure.totalMs();
      if (elapsedMs >= total) {
        const last = b[b.length - 1];
        return { index: last.i, lv: last.lv, remainingMs: 0, levelMs: last.lv.mins * 60000, done: true };
      }
      const seg = b.find(x => elapsedMs < x.endMs) || b[0];
      return {
        index: seg.i,
        lv: seg.lv,
        remainingMs: Math.max(0, seg.endMs - elapsedMs),
        levelMs: seg.lv.mins * 60000,
        done: false
      };
    },

    /** Elapsed ms at the START of a given level index — used for jumps. */
    startOf(index) {
      const b = Structure.bounds();
      const i = Math.max(0, Math.min(index, b.length - 1));
      return b[i].startMs;
    },

    count() { return LEAGUE.blinds.length; }
  };

  /* ------------------------------------------------------------------ *
   * STATE                                                               *
   * ------------------------------------------------------------------ */
  const S = {
    status: "checkin",
    players: {},
    reports: {},
    seats: null,
    money: null,          // admin overrides for kitty % and payout splits
    bounty: null,         // who took out the defending champion, once it happens
    highHand: null,       // best hand of the night, claimed by whoever hit it
    results: {},          // finalized games, for the bounty and the streak
    timer: null,
    rsvp: {},
    _subs: []
  };

  function emit() { S._subs.forEach(f => { try { f(S); } catch (e) { console.error(e); } }); }

  const Game = {
    id: GAME_ID,
    Structure: Structure,

    /* -------------------------------------------------------- lifecycle */
    /**
     * Subscribe to state changes. Returns an unsubscribe function -- without
     * one, anything transient (a sheet, an overlay) keeps repainting after it
     * has been removed from the page, forever.
     */
    subscribe(fn) {
      S._subs.push(fn);
      fn(S);
      return function () {
        const i = S._subs.indexOf(fn);
        if (i !== -1) S._subs.splice(i, 1);
      };
    },

    start() {
      DB.on(BASE + "/status",  v => { S.status  = v || "checkin"; emit(); });
      DB.on(BASE + "/players", v => { S.players = v || {};        emit(); });
      DB.on(BASE + "/reports", v => { S.reports = v || {};        emit(); });
      DB.on(BASE + "/seats",   v => { S.seats   = v || null;      emit(); });
      DB.on(BASE + "/timer",   v => { S.timer   = v || null;      emit(); });
      DB.on("rsvp/" + GAME_ID, v => { S.rsvp    = v || {};        emit(); });
      DB.on("config/money",    v => { S.money   = v || null;      emit(); });
      DB.on(BASE + "/bounty",  v => { S.bounty  = v || null;      emit(); });
      DB.on(BASE + "/highHand", v => { S.highHand = v || null;     emit(); });
      /* Finalized history — the bounty rides on the last game's winner, and
         who that is is a fact about games already played. */
      DB.on("results",         v => { S.results = v || {};        emit(); });
    },

    state() { return S; },

    /* ------------------------------------------------------------ views */
    entrants()  { return Object.keys(S.players); },
    active()    { return Object.keys(S.players).filter(n => S.players[n].status === "active"); },
    busted()    { return Object.keys(S.players).filter(n => S.players[n].status === "out"); },
    fieldSize() { return Object.keys(S.players).length; },

    rsvpIn() { return Object.keys(S.rsvp).filter(n => S.rsvp[n] === "in"); },

    /** RSVP'd In but never checked in — the no-show list. */
    noShows() { return Game.rsvpIn().filter(n => !S.players[n]); },

    totalRebuys() {
      return Object.keys(S.players).reduce((s, n) => s + (S.players[n].rebuys || 0), 0);
    },

    /* ------------------------------------------------------------------ *
     * MONEY POLICY                                                        *
     * The kitty percentage and the payout splits are league decisions, not
     * code. They live in the database so Nate can change them on the night
     * without anyone editing a file, and they fall back to the numbers in
     * data.js when nobody has set them.
     * ------------------------------------------------------------------ */

    kittyPct() {
      const m = S.money;
      if (m && typeof m.kittyPct === "number") return m.kittyPct;
      return LEAGUE.payouts.kittyPct || 0;
    },

    /** Payout splits for a field size: admin override first, table second. */
    splits(field) {
      const m = S.money;
      if (m && Array.isArray(m.splits) && m.splits.length) return m.splits.slice();
      return BPL.splitsFor(field || 1);
    },

    /* The kitty as a DOLLAR amount, which is how Nate says it: "kitty's a
       hundred and twenty." When one is set it wins over the percentage --
       a fixed number is a decision, a percentage is a rule of thumb. */
    kittyAmount() {
      const m = S.money;
      return (m && typeof m.kittyAmount === "number") ? m.kittyAmount : null;
    },

    /** What 1st takes tonight, if the host has named a number. */
    firstPrize() {
      const m = S.money;
      return (m && typeof m.firstPrize === "number" && m.firstPrize > 0) ? m.firstPrize : null;
    },

    /** How many places pay, if the host has named a number. */
    placesPaid() {
      const m = S.money;
      return (m && typeof m.places === "number" && m.places >= 1) ? m.places : null;
    },

    /**
     * Tonight's payout table, however the host chose to say it.
     *
     * "First gets 200, pay four" wins when it is set. Otherwise the
     * percentage splits, exactly as before. Returns { table } or { error }.
     */
    payouts(net, field) {
      const size = Math.max(1, field || 1);
      const f = Game.firstPrize();
      const n = Game.placesPaid();

      /* NEVER pay more places than there are players.
       *
       * "Pay four" set when eighteen were expected, then six turn up, used to
       * allocate money to 5th and 6th -- places nobody finished in. Those
       * shares were simply never handed out: the record said $120 pot and the
       * players took $90. Found by walking every field 2..8 against every
       * plan; 4,875 combinations lost money.
       *
       * The plan is a standing instruction, so it is capped at payout time
       * rather than rejected when it is set -- the field moves all night. */
      const places = Math.min(n || size, size);
      if (f) return BPL.payoutPlan(net, f, places, Game.splits(size));

      const splits = Game.splits(size).slice(0, size);
      return { table: BPL.payoutTable(net, size, splits) };
    },

    setKittyAmount(dollars) {
      if (dollars === null || dollars === "") {
        return DB.save("kitty back to a percentage", () => DB.set("config/money/kittyAmount", null));
      }
      /* Snapped to a $10 note like every other number on the night —
         the kitty comes out of the same stack of twenties the pot does. */
      const n = BPL.round10(Number(dollars));
      if (!isFinite(n) || n < 0 || n > 5000) {
        return Promise.reject(new Error("Kitty must be a dollar amount up to $5,000"));
      }
      return DB.save("kitty " + BPL.money(n), () => DB.set("config/money/kittyAmount", n));
    },

    /** "First gets 200, pay four." Both together, or both cleared. */
    setPrizePlan(first, places) {
      if (first === null || first === "" || places === null || places === "") {
        return DB.save("back to percentage payouts",
          () => DB.multi({ "config/money/firstPrize": null, "config/money/places": null }));
      }
      const f = BPL.round10(Number(first));   // every prize is a $10 note
      const n = Math.round(Number(places));
      if (!isFinite(f) || f <= 0) return Promise.reject(new Error("First place needs a dollar amount"));
      if (f > 10000) return Promise.reject(new Error("That's more than any night's pot"));
      if (!isFinite(n) || n < 1 || n > 12) return Promise.reject(new Error("Pay between 1 and 12 places"));

      /* Stored even when it does not work YET.
       *
       * This used to validate against the pot at the moment it was set, and
       * refused "$150 to first, pay three" at 8:30 because the eight buy-ins
       * on the table were only $240 with a $120 kitty. An hour of rebuys
       * later it was perfectly fine. A plan is a standing instruction for a
       * pot that grows all night; rejecting it up front is being right at
       * the wrong moment.
       *
       * The panel says live whether it currently works, the action queue
       * chases it while it doesn't, and finalize refuses rather than
       * inventing money. That is three warnings before it can hurt. */
      return DB.save("payouts: " + BPL.money(f) + " to 1st, " + n + " paid",
        () => DB.multi({ "config/money/firstPrize": f, "config/money/places": n }));
    },

    setKittyPct(pct) {
      const n = Number(pct);
      if (!isFinite(n) || n < 0 || n > 50) {
        return Promise.reject(new Error("Kitty must be between 0 and 50 percent"));
      }
      return DB.save("kitty " + n + "%", () => DB.set("config/money/kittyPct", n));
    },

    /**
     * Payout splits as whole percentages, best finish first. They must add up
     * to 100 -- a payout table that does not is how you end up short at the
     * end of the night with everyone watching.
     */
    setSplits(arr) {
      const a = (arr || []).map(Number).filter(n => isFinite(n) && n > 0);
      if (!a.length) return DB.save("clear payouts", () => DB.set("config/money/splits", null));
      const total = a.reduce((x, y) => x + y, 0);
      if (Math.round(total) !== 100) {
        return Promise.reject(new Error("Splits add up to " + total + "%, they must total 100%"));
      }
      return DB.save("payout splits", () => DB.set("config/money/splits", a));
    },

    /* --------------------------------------------------------- HIGH HAND

       The best hand of the night. Anyone can claim it from their own seat;
       the host can overwrite or clear it. Only a BETTER hand replaces one
       that is already standing, so a later claim cannot quietly demote the
       quads somebody hit at level 3.
       ------------------------------------------------------------------- */
    highHand() { return S.highHand || null; },

    claimHighHand(name, cat, note, force) {
      if (!name) return Promise.reject(new Error("Say who you are first"));
      if (BPL.handRank(cat) === 99) return Promise.reject(new Error("Pick a hand"));
      const cur = S.highHand;
      if (!force && cur && BPL.handRank(cur.cat) <= BPL.handRank(cat)) {
        return Promise.reject(new Error(
          cur.name + "'s " + BPL.handLabel(cur.cat).toLowerCase() + " still beats that."));
      }
      const row = { name: name, cat: cat, at: DB.now() };
      if (note) row.note = String(note).slice(0, 60);
      return DB.save("high hand", () => DB.set(BASE + "/highHand", row));
    },

    clearHighHand() {
      return DB.save("clear high hand", () => DB.set(BASE + "/highHand", null));
    },

    /* ------------------------------------------------------------ BOUNTY */

    /**
     * Who is carrying the bounty tonight, and for how much. Derived from the
     * finalized results, so it is right without anyone entering it.
     */
    bountyTarget() {
      return BPL.bountyOn(S.results, GAME_ID);
    },

    /** True once the bounty player has been knocked out and credited. */
    bountyClaimed() { return !!(S.bounty && S.bounty.wonBy); },

    /**
     * Record who knocked the defending champion out. Asked once, on the night,
     * at the moment it happens -- reconstructing it afterwards is guesswork.
     */
    claimBounty(killer) {
      const t = Game.bountyTarget();
      if (!t) return Promise.reject(new Error("Nobody is carrying a bounty tonight"));
      if (!killer) return Promise.reject(new Error("Say who knocked them out"));
      return DB.save("bounty to " + killer, () => DB.set(BASE + "/bounty", {
        target: t.name, amount: t.amount, wonBy: killer, at: DB.now()
      }));
    },

    /** Undo a mis-tap. */
    clearBounty() {
      return DB.save("clear bounty", () => DB.set(BASE + "/bounty", null));
    },

    /** Money on the table right now, straight from live state.
     *
     *  gross -> kitty (nearest $10) -> bounty (off the top) -> tonight's pot.
     */
    pot() {
      const buyin = LEAGUE.nextGame.buyin;
      const rebuy = LEAGUE.nextGame.rebuy || buyin;
      const entries = Game.fieldSize();
      const rebuys  = Game.totalRebuys();
      const gross   = entries * buyin + rebuys * rebuy;
      const fixed   = Game.kittyAmount();
      const kitty   = Math.min(gross, fixed === null ? BPL.round10(gross * Game.kittyPct() / 100)
                                                     : BPL.round10(fixed));
      const t       = Game.bountyTarget();
      /* The bounty only comes off the pot when the champion is actually at
         the table. If they don't turn up there is nobody to knock out, so
         charging the room for it would take $20 off everyone's payout and
         hand it to no one -- and finalizing would then be blocked forever.
         Their head keeps the price; it just isn't collected tonight.

         Capped at what is on the table, too: a long streak against a tiny
         field must not pay a bounty out of thin air. */
      const playing = !!(t && S.players[t.name]);
      const bounty  = playing ? Math.max(0, Math.min(t.amount, gross - kitty)) : 0;
      return {
        entries: entries, rebuys: rebuys, gross: gross,
        kitty: kitty,
        kittyFixed: fixed !== null,
        bounty: bounty,
        bountyOn: bounty ? t.name : null,
        bountyStreak: bounty ? t.streak : 0,
        bountyPlaying: playing,
        net: gross - kitty - bounty
      };
    },

    /**
     * Finishing order, best first.
     *
     * Places are DERIVED, never stored. We record only *when* each player
     * busted; the place is computed against the final field size at render
     * time. That's how a real tournament works, and it's what makes late
     * entries safe: if someone buys in after two players have already busted,
     * the field grows and everyone's finishing position shifts down by one
     * automatically. Storing an absolute place at bust time produces duplicate
     * positions the moment anyone joins late.
     */
    finishOrder() {
      const field = Game.fieldSize();
      return Game.busted()
        .map(n => ({ name: n, bustAt: S.players[n].bustAt || 0 }))
        .sort((a, b) => a.bustAt - b.bustAt)             // first out first
        .map((r, i) => ({ name: r.name, place: field - i, bustAt: r.bustAt }))
        .sort((a, b) => a.place - b.place);              // best finish first
    },

    /** Current finishing place for one player, or null if still in. */
    placeOf(name) {
      const p = S.players[name];
      if (!p) return null;
      if (p.status === "active") return null;
      const row = Game.finishOrder().find(f => f.name === name);
      return row ? row.place : null;
    },

    /* ------------------------------------------------------------------ *
     * CHIP COUNTS                                                         *
     *                                                                     *
     * These are PLAYER-REPORTED, not observed. Nobody on a poker night is
     * going to keep them perfectly current, so nothing in this app is ever
     * allowed to depend on them: not standings, not payouts, not places,
     * not elimination. They exist to show the table what the table roughly
     * looks like, and every display of them carries who said it and when.
     * ------------------------------------------------------------------ */

    /**
     * How many chips SHOULD be in play, from facts the app actually knows:
     * every buy-in, every rebuy, every on-time bonus. This is exact.
     */
    chipsInPlay() {
      const ng = LEAGUE.nextGame;
      return Object.keys(S.players).reduce((sum, n) => {
        const p = S.players[n];
        if (p.status !== "active") return sum;           // busted chips left the table
        return sum + (p.buyins || 1) * (ng.startStack || 7000)
                   + (p.rebuys || 0) * (ng.rebuyStack || 6000)
                   + (p.bonus ? (ng.earlyBonus || 0) : 0);
      }, 0);
    },

    /** Sum of what players have actually reported (active players only). */
    reportedChips() {
      return Game.active().reduce((s, n) => s + (S.players[n].stack || 0), 0);
    },

    /** How many active players have reported anything at all. */
    reportedCount() {
      return Game.active().filter(n => (S.players[n].stack || 0) > 0).length;
    },

    /**
     * Honest reconciliation. If everyone has reported and the totals don't
     * match, the reported numbers are wrong -- chips do not appear or vanish.
     * Returns null while anyone is still missing, because a partial total
     * tells you nothing.
     */
    stackDrift() {
      const act = Game.active();
      if (!act.length || Game.reportedCount() < act.length) return null;
      const expected = Game.chipsInPlay();
      const reported = Game.reportedChips();
      return { expected: expected, reported: reported, diff: reported - expected,
               pct: expected ? (reported - expected) / expected : 0 };
    },

    /** Average stack among players still in. */
    avgStack() {
      const n = Game.active().length;
      return n ? Math.round(Game.chipsInPlay() / n) : 0;
    },

    /**
     * The big blind that is actually in force right now. On a break the level
     * has no blinds, so fall back to the next real level -- that is the one
     * players are about to face and the one they are counting against.
     */
    currentBB() {
      const c = Game.clock();
      if (c.lv && c.lv.bb) return c.lv.bb;
      const after = LEAGUE.blinds.slice(c.index + 1).find(l => l && l.bb);
      if (after) return after.bb;
      const before = LEAGUE.blinds.slice(0, c.index).reverse().find(l => l && l.bb);
      return before ? before.bb : 0;
    },

    /** A stack in big blinds -- the number that actually means something. */
    bigBlinds(chips) {
      const bb = Game.currentBB();
      if (!bb || !chips) return null;
      return chips / bb;
    },

    /** Minutes since a player last reported. null if they never have. */
    stackAgeMins(name) {
      const p = S.players[name];
      if (!p || !p.stackAt) return null;
      return Math.max(0, Math.round((DB.now() - p.stackAt) / 60000));
    },

    /**
     * Report a chip count. A player may set their own; the host may correct
     * anyone. `by` records who said it so the table can see the difference.
     */
    setStack(name, chips, by) {
      const p = S.players[name];
      if (!p) return Promise.reject(new Error(name + " is not checked in"));
      const n = Math.round(Number(chips));
      if (!isFinite(n) || n < 0) return Promise.reject(new Error("That is not a chip count"));
      if (n > 10000000) return Promise.reject(new Error("That is too many chips"));
      return DB.save("chip count for " + name,
        () => DB.update(BASE + "/players/" + name, {
          stack: n,
          stackAt: DB.now(),
          stackBy: String(by || name).slice(0, 40)
        }));
    },

    /**
     * A player buying their own top-up, from their own seat.
     *
     * This counts immediately -- a deliberate league decision. The pot and the
     * payouts move on the tap, so two things guard it: the one-per-player cap
     * still applies exactly as it does for the host, and the claim records WHO
     * made it. Nate can see what was self-reported and take it back with one
     * tap if somebody was optimistic.
     */
    claimRebuy(name) {
      const p = S.players[name];
      if (!p) return Promise.reject(new Error("You're not checked in yet — see the host."));
      if (p.status === "out") {
        return Promise.reject(new Error("You're out. The host has to put you back in."));
      }
      const cap = LEAGUE.nextGame.maxTopUps;
      if (typeof cap === "number" && (p.rebuys || 0) >= cap) {
        return Promise.reject(new Error("You've already used your top-up for tonight."));
      }
      if (!Game.rebuyWindowOpen()) {
        return Promise.reject(new Error("The rebuy window closed at the break."));
      }
      return DB.save("rebuy for " + name,
        () => DB.update(BASE + "/players/" + name, {
          rebuys: (p.rebuys || 0) + 1,
          rebuyBy: name,                 // self-reported, not host-recorded
          rebuyAt: DB.now()
        }));
    },

    /** Did this rebuy come from the player rather than the host? */
    selfClaimed(name) {
      const p = S.players[name];
      return !!(p && p.rebuyBy === name);
    },

    /**
     * Rebuys and add-ons close at the break that is flagged lastRebuy. Before
     * the clock is started nothing has closed yet.
     */
    rebuyWindowOpen() {
      const c = Game.clock();
      if (!c.started) return true;
      const idx = LEAGUE.blinds.findIndex(b => b.lastRebuy);
      if (idx === -1) return true;
      return c.index <= idx;
    },

    /** Host: wipe a bogus number rather than guessing a replacement. */
    clearStack(name) {
      return DB.save("clear chip count for " + name,
        () => DB.update(BASE + "/players/" + name,
          { stack: null, stackAt: null, stackBy: null }));
    },

    pendingReports() {
      return Object.keys(S.reports).map(id => Object.assign({ id: id }, S.reports[id]))
        .sort((a, b) => (a.at || 0) - (b.at || 0));
    },

    /* ------------------------------------------------------------ timer */
    /** Total elapsed ms of the blind structure, per the shared server clock. */
    elapsedMs() {
      const t = S.timer;
      if (!t) return 0;
      const base = Number(t.elapsedBefore) || 0;
      if (!t.running || t.paused) return base;
      return base + Math.max(0, DB.now() - (Number(t.startedAt) || DB.now()));
    },

    clock() {
      const at = Structure.at(Game.elapsedMs());
      const t = S.timer;
      return {
        index: at.index,
        lv: at.lv,
        remainingMs: at.remainingMs,
        levelMs: at.levelMs,
        structureDone: at.done,
        running: !!(t && t.running && !t.paused),
        paused: !!(t && t.paused),
        started: !!(t && t.running)
      };
    },

    /* ----------------------------------------------------- host: timer  */
    timerStart() {
      const t = S.timer || {};
      return DB.save("start clock", () => DB.set(BASE + "/timer", {
        running: true,
        paused: false,
        startedAt: DB.now(),
        elapsedBefore: Number(t.elapsedBefore) || 0
      }));
    },

    timerPause() {
      const elapsed = Game.elapsedMs();
      return DB.save("pause clock", () => DB.set(BASE + "/timer", {
        running: true, paused: true, startedAt: DB.now(), elapsedBefore: elapsed
      }));
    },

    timerResume() {
      return DB.save("resume clock", () => DB.set(BASE + "/timer", {
        running: true, paused: false, startedAt: DB.now(),
        elapsedBefore: Number((S.timer || {}).elapsedBefore) || 0
      }));
    },

    /** Jump to a level index. Recomputes elapsed so every device agrees. */
    timerGoto(index) {
      const t = S.timer || {};
      const idx = Math.max(0, Math.min(index, Structure.count() - 1));
      return DB.save("change level", () => DB.set(BASE + "/timer", {
        running: t.running !== false,
        paused: !!t.paused,
        startedAt: DB.now(),
        elapsedBefore: Structure.startOf(idx)
      }));
    },

    timerNudge(deltaMs) {
      const elapsed = Math.max(0, Game.elapsedMs() - deltaMs);
      const t = S.timer || {};
      return DB.save("adjust clock", () => DB.set(BASE + "/timer", {
        running: t.running !== false, paused: !!t.paused,
        startedAt: DB.now(), elapsedBefore: elapsed
      }));
    },

    timerReset() {
      return DB.save("reset clock", () => DB.set(BASE + "/timer", {
        running: false, paused: false, startedAt: DB.now(), elapsedBefore: 0
      }));
    },

    /* -------------------------------------------------- host: check-in  */
    checkIn(name, opts) {
      opts = opts || {};
      const existing = S.players[name];
      if (existing) return Promise.resolve();
      const row = {
        status: "active",
        place: null,
        buyins: 1,
        rebuys: 0,
        late: !!opts.late,
        bonus: opts.late ? false : true,   // on-time chips only if not late
        joinedAt: DB.now(),
        paid: 0                            // dollars actually handed over
      };
      if (opts.by) row.inBy = opts.by;     // who checked them in
      return DB.save("check in " + name, () => DB.set(BASE + "/players/" + name, row));
    },

    /* --------------------------------------------------------- THE DOOR

       A player checking themselves in at Nate's. It counts immediately --
       waiting on a host tap at the door is the queue this replaces -- but it
       records WHO did it, so Nate can see at a glance which entries he did
       not make himself.
       ------------------------------------------------------------------- */
    selfCheckIn(name) {
      if (!name) return Promise.reject(new Error("Say who you are first"));
      if (S.players[name]) return Promise.resolve();
      const late = Game.clock().started;
      return Game.checkIn(name, { by: name, late: late });
    },

    /** True when this entry was the player's own tap, not the host's. */
    selfEntered(name) {
      const p = S.players[name];
      return !!(p && p.inBy === name);
    },

    /* ------------------------------------------------------------ MONEY

       What each player OWES tonight is derived from what they took: the
       buy-in plus any top-up. What they have PAID is a number they -- or
       the host -- set. Nobody reconstructs it afterwards from memory.
       ------------------------------------------------------------------- */

    charged(name) {
      const p = S.players[name];
      if (!p) return 0;
      const buyin = LEAGUE.nextGame.buyin;
      const rebuy = LEAGUE.nextGame.rebuy || buyin;
      return (p.buyins || 1) * buyin + (p.rebuys || 0) * rebuy;
    },

    paid(name) {
      const p = S.players[name];
      return p ? (p.paid || 0) : 0;
    },

    owes(name) { return Math.max(0, Game.charged(name) - Game.paid(name)); },

    /** Everyone who still owes something, and the total outstanding. */
    unpaid() {
      const rows = Game.entrants()
        .map(n => ({ name: n, owes: Game.owes(n), charged: Game.charged(n), paid: Game.paid(n) }))
        .filter(r => r.owes > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
      return { rows: rows, total: rows.reduce((s, r) => s + r.owes, 0) };
    },

    /** Money collected so far, against what the night has charged. */
    collected() {
      const ent = Game.entrants();
      return {
        paid: ent.reduce((s, n) => s + Game.paid(n), 0),
        charged: ent.reduce((s, n) => s + Game.charged(n), 0)
      };
    },

    /**
     * Record money handed over. `amount` is the new TOTAL for that player,
     * not a delta -- a retry or a double-tap can never double-count.
     */
    setPaid(name, amount, by) {
      const p = S.players[name];
      if (!p) return Promise.reject(new Error(name + " isn't checked in"));
      const v = Math.max(0, Math.round(Number(amount) || 0));
      if (v > 1000) return Promise.reject(new Error("That's not a buy-in"));
      const patch = { paid: v };
      patch.paidAt = DB.now();
      patch.paidBy = by || name;
      return DB.save("payment for " + name, () => DB.update(BASE + "/players/" + name, patch));
    },

    /** Mark the whole outstanding balance settled. */
    settle(name, by) { return Game.setPaid(name, Game.charged(name), by); },

    undoCheckIn(name) {
      return DB.save("remove " + name, () => DB.set(BASE + "/players/" + name, null));
    },

    /** Bulk check-in from the RSVP "In" list — the normal start-of-night move. */
    checkInAll(names) {
      const patch = {};
      names.forEach(n => {
        if (S.players[n]) return;
        patch[BASE + "/players/" + n] = {
          status: "active", place: null, buyins: 1, rebuys: 0,
          late: false, bonus: true, joinedAt: DB.now(), paid: 0
        };
      });
      if (!Object.keys(patch).length) return Promise.resolve(0);
      return DB.save("check in " + Object.keys(patch).length + " players",
        () => DB.multi(patch)).then(() => Object.keys(patch).length);
    },

    /* ---------------------------------------------------- host: rebuys  */
    /**
     * Rebuy / add-on. Both cost the same, so both increment this counter.
     *
     * A rebuy brings a busted player back in, which means clearing bustAt as
     * well as flipping status — otherwise the old bust timestamp lingers and
     * would order them wrongly if they bust again later.
     * (Previously this also wrote a `place` field that no longer exists.)
     */
    /**
     * Rebuy or add-on. Both cost the same and both count against the SAME
     * one-per-player allowance, so this is capped rather than a counter that
     * grows. Nate can still override from Master Control if the table agrees.
     */
    addRebuy(name, override) {
      const p = S.players[name];
      if (!p) return Promise.resolve();
      const cap = LEAGUE.nextGame.maxTopUps;
      if (!override && typeof cap === "number" && (p.rebuys || 0) >= cap) {
        return Promise.reject(new Error(
          name + " has already used their top-up for tonight" +
          (cap === 1 ? " (one per player)" : " (" + cap + " per player)") + "."));
      }
      /* The buy-in window shuts at the break after 300/600. The host can
         still push one through -- somebody handing over cash as the break
         is called is a real thing -- but it has to be a decision, not a
         mis-tap at level 8. */
      if (!override && !Game.rebuyWindowOpen()) {
        return Promise.reject(new Error(
          "The top-up window closed at the break after 300/600."));
      }
      const wasOut = p.status === "out";
      return DB.save("rebuy for " + name,
        () => DB.update(BASE + "/players/" + name, {
          rebuys: (p.rebuys || 0) + 1,
          status: "active",
          bustAt: null          // back in the game — no finishing place yet
        })).then(() => wasOut);
    },

    removeRebuy(name) {
      const p = S.players[name];
      if (!p || !(p.rebuys > 0)) return Promise.resolve();
      return DB.save("undo rebuy for " + name,
        () => DB.update(BASE + "/players/" + name, { rebuys: p.rebuys - 1 }));
    },

    /* -------------------------------------------- player: reports only  */
    /** The ONLY write a player device makes. Creates a pending note. */
    /**
     * A player's own report. `by` is who they say knocked them out.
     *
     * The player answers this, not the host: they know exactly who got them,
     * they are out of the hand with nothing else to do, and the host is the
     * one person at that table who is genuinely busy. Asking Nate twenty
     * times a night was a tax on the wrong man.
     */
    report(name, type, by) {
      const dupe = Game.pendingReports().find(r => r.name === name && r.type === type);
      if (dupe) return Promise.resolve(dupe.id);
      const row = { name: name, type: type, at: DB.now() };
      if (by && by !== name) row.by = by;
      return DB.save("send report", () => DB.push(BASE + "/reports", row));
    },

    /** Who a pending report says did it, if the player said. */
    reportedBy(name) {
      const r = Game.pendingReports().find(x => x.name === name && x.type === "out");
      return (r && r.by) || null;
    },

    dismissReport(id) {
      return DB.save("dismiss", () => DB.set(BASE + "/reports/" + id, null));
    },

    /* ------------------------------------------ host: authoritative ops */
    /**
     * Record an elimination. We store only the moment they busted — the
     * finishing place is derived from that (see finishOrder above), so late
     * entries and reinstatements renumber everyone correctly on their own.
     */
    /**
     * Record an elimination, and WHO did it.
     *
     * The killer is the one fact the app can never work out for itself, and
     * it is the difference between a stat sheet and a story: without it the
     * most a recap can say is "Nate went out first". With it, it can say
     * Syd busted him for the third straight game. Optional -- a bust nobody
     * saw clearly is still a bust -- but asked every time, because it is
     * only knowable in the ten seconds after it happens.
     *
     * When the busted player is carrying the bounty, the same answer credits
     * it. One question, not two.
     */
    confirmOut(name, reportId, killer) {
      if (Game.active().indexOf(name) === -1) return Promise.resolve(null);
      /* The player's own answer stands unless the host names someone else. */
      const said = killer || Game.reportedBy(name);
      const by = (said && said !== name && S.players[said]) ? said : null;

      const patch = {};
      patch[BASE + "/players/" + name + "/status"] = "out";
      patch[BASE + "/players/" + name + "/bustAt"] = DB.now();
      if (by) patch[BASE + "/players/" + name + "/outBy"] = by;
      if (reportId) patch[BASE + "/reports/" + reportId] = null;

      const t = Game.bountyTarget();
      if (by && t && t.name === name && t.amount && !Game.bountyClaimed()) {
        patch[BASE + "/bounty"] = { target: name, amount: t.amount, wonBy: by, at: DB.now() };
      }

      return DB.save(name + " out", () => DB.multi(patch))
        .then(() => Game.placeOf(name));
    },

    /** Who knocked this player out tonight, if anyone said. */
    outBy(name) {
      const p = S.players[name];
      return (p && p.outBy) || null;
    },

    /**
     * Put someone back in — undoes a mistaken elimination.
     *
     * If seats have been drawn and they are no longer in the order (they were
     * busted before a consolidation, so the redraw left them out), append them
     * the same way a latecomer is seated. Otherwise they'd be alive with
     * nowhere to sit and the felt would simply not show them.
     */
    reinstate(name) {
      const patch = {};
      patch[BASE + "/players/" + name + "/status"] = "active";
      patch[BASE + "/players/" + name + "/bustAt"] = null;
      patch[BASE + "/players/" + name + "/outBy"] = null;   // they're not out any more

      const s = S.seats;
      if (s && Array.isArray(s.order) && s.order.indexOf(name) === -1) {
        patch[BASE + "/seats/order"] = s.order.concat([name]);
      }

      return DB.save("reinstate " + name, () => DB.multi(patch));
    },

    /* ------------------------------------------------------ host: seats */
    drawSeats(tables) {
      const pool = Game.active();
      if (pool.length < 2) return Promise.reject(new Error("Need at least 2 players checked in"));
      const tc = Math.max(1, tables || 1);
      if (pool.length / tc < 2) return Promise.reject(new Error("Too many tables for " + pool.length + " players"));
      return DB.save("draw seats", () => DB.set(BASE + "/seats", {
        tables: tc, order: UI.shuffle(pool), drawnAt: DB.now()
      }));
    },

    /**
     * How many tables SHOULD be running, given who is still alive.
     *
     * Standard practice: break a table as soon as the survivors fit on fewer
     * without anyone sitting more than nine-handed. Nine, not ten, because a
     * table that fills to exactly ten has to break again after the next bust
     * -- and moving everyone twice in ten minutes is how a night gets slow.
     */
    MAX_PER_TABLE: 9,

    idealTables(n) {
      const alive = typeof n === "number" ? n : Game.active().length;
      if (alive < 2) return 1;
      return Math.max(1, Math.ceil(alive / Game.MAX_PER_TABLE));
    },

    /** True when the survivors would fit on fewer tables than are running. */
    shouldConsolidate() {
      const s = S.seats;
      if (!s || !s.tables || s.tables < 2) return false;
      const alive = Game.active().length;
      if (alive < 2) return false;
      return Game.idealTables(alive) < s.tables;
    },

    /**
     * Re-draw the survivors across `tables`. Same shuffle as the opening
     * draw, so a consolidation is as random as the night started -- nobody
     * inherits a seat because of where they happened to be sitting.
     */
    consolidate(tables) {
      const alive = Game.active();
      if (alive.length < 2) return Promise.reject(new Error("Not enough players left to redraw"));
      const tc = Math.max(1, tables || Game.idealTables(alive.length));
      if (alive.length / tc < 2) {
        return Promise.reject(new Error("Too many tables for " + alive.length + " players"));
      }
      return DB.save("redraw seats", () => DB.set(BASE + "/seats", {
        tables: tc, order: UI.shuffle(alive), drawnAt: DB.now()
      })).then(() => tc);
    },

    clearSeats() {
      return DB.save("clear seats", () => DB.set(BASE + "/seats", null));
    },

    /** Seat someone who turned up after the draw — appended, nobody moves. */
    seatLatecomer(name) {
      const s = S.seats;
      if (!s || !Array.isArray(s.order)) return Promise.resolve(null);
      if (s.order.indexOf(name) !== -1) return Promise.resolve(null);
      const order = s.order.concat([name]);
      return DB.save("seat " + name,
        () => DB.update(BASE + "/seats", { order: order })).then(() => order.length);
    },

    /* ----------------------------------------------------- host: status */
    setStatus(v) { return DB.save("update game", () => DB.set(BASE + "/status", v)); },

    /** True when the tournament is down to one player standing. */
    readyToFinalize() { return Game.active().length === 1 && Game.fieldSize() > 1; },

    /**
     * FINALIZE — the whole point of the rework.
     * Builds the permanent record from live state and writes it to results/.
     * After this, standings derive from Firebase and nobody edits data.js.
     */
    finalize() {
      const act = Game.active();
      if (act.length !== 1) return Promise.reject(new Error("Need exactly one player left standing"));

      const winner = act[0];
      const field = Game.fieldSize();
      const money = Game.pot();
      const plan = Game.payouts(money.net, field);
      if (plan.error) return Promise.reject(new Error("Payouts don't add up: " + plan.error));
      const payTable = plan.table;

      const order = Game.finishOrder();                 // busted, best place first
      const finish = [{ place: 1, name: winner }].concat(order);
      finish.sort((a, b) => a.place - b.place);

      /* Sanity check: places must be exactly 1..field with no gaps or repeats.
         If this ever trips, something is wrong with the field and we refuse to
         write a corrupt permanent record rather than quietly saving it. */
      const seen = finish.map(f => f.place).sort((a, b) => a - b);
      const ok = seen.length === field && seen.every((p, i) => p === i + 1);
      if (!ok) {
        return Promise.reject(new Error(
          "Finishing places don't add up (" + seen.length + " players, places " +
          seen[0] + "–" + seen[seen.length - 1] + "). Check the player list before finalizing."));
      }

      /* The bounty. If nobody knocked the champion out, they survived to win
         their own bounty -- there is nobody else it could go to. */
      const bt = Game.bountyTarget();
      const bountyWinner = money.bounty > 0
        ? ((S.bounty && S.bounty.wonBy) || (bt && bt.name === winner ? winner : null))
        : null;

      const rows = finish.map(f => {
        const p = S.players[f.name] || {};
        const win = payTable[f.place - 1] || 0;
        const itm = win > 0;
        const bnty = (bountyWinner && f.name === bountyWinner) ? money.bounty : 0;
        return {
          place: f.place,
          name: f.name,
          /* Base formula unchanged. The 100 for cashing rides on whether they
             actually got paid, because how many places pay moves with the
             field -- three some nights, six others. */
          points: BPL.pointsFor(f.place, field, itm),
          rebuys: p.rebuys || 0,
          late: !!p.late,
          outBy: p.outBy || null,
          winnings: win + bnty,
          bounty: bnty,
          itm: itm
        };
      });

      const ev = (LEAGUE.schedule.find(e => e.date === GAME_ID) || {});
      const record = {
        gameId: GAME_ID,
        date: GAME_ID,
        season: LEAGUE.season,
        label: ev.label || LEAGUE.nextGame.label || "Game",
        /* Stored so a future season-scoring policy can distinguish a regular
           event from the season final. NOT used to change scoring today. */
        type: ev.type || "regular",
        field: field,
        buyinAmount: LEAGUE.nextGame.buyin,
        rebuyAmount: LEAGUE.nextGame.rebuy || LEAGUE.nextGame.buyin,
        rebuys: money.rebuys,
        gross: money.gross,
        kittyPct: Game.kittyPct(),
        kitty: money.kitty,
        pot: money.net,
        /* What the bounty was, who was carrying it, and who took it. Kept on
           the permanent record so a season's worth of bounties can be read
           back without replaying the nights. */
        bounty: money.bounty,
        bountyOn: money.bountyOn || null,
        bountyStreak: money.bountyStreak || 0,
        bountyWonBy: bountyWinner || null,
        highHand: S.highHand || null,
        winner: winner,
        finish: rows,
        finalizedAt: DB.now()
      };

      /* A bounty that was on the table and never accounted for would quietly
         lose $20 of somebody's money. Refuse rather than swallow it. */
      if (money.bounty > 0 && !bountyWinner) {
        return Promise.reject(new Error(
          "$" + money.bounty + " bounty on " + money.bountyOn +
          " hasn't been credited. Say who knocked them out first."));
      }

      const patch = {};
      patch["results/" + GAME_ID] = record;
      patch[BASE + "/status"] = "final";
      patch[BASE + "/players/" + winner + "/status"] = "out";
      patch[BASE + "/players/" + winner + "/bustAt"] = DB.now();

      return DB.save("finalize game", () => DB.multi(patch)).then(() => record);
    },

    /** Wipe tonight's live state. Finalized results are never touched. */
    resetNight() {
      return DB.save("reset game night", () => DB.set(BASE, null));
    }
  };

  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  Game.ordinal = ordinal;
  window.Game = Game;
})();
