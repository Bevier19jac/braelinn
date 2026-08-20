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
    timer: null,
    rsvp: {},
    _subs: []
  };

  function emit() { S._subs.forEach(f => { try { f(S); } catch (e) { console.error(e); } }); }

  const Game = {
    id: GAME_ID,
    Structure: Structure,

    /* -------------------------------------------------------- lifecycle */
    subscribe(fn) { S._subs.push(fn); fn(S); },

    start() {
      DB.on(BASE + "/status",  v => { S.status  = v || "checkin"; emit(); });
      DB.on(BASE + "/players", v => { S.players = v || {};        emit(); });
      DB.on(BASE + "/reports", v => { S.reports = v || {};        emit(); });
      DB.on(BASE + "/seats",   v => { S.seats   = v || null;      emit(); });
      DB.on(BASE + "/timer",   v => { S.timer   = v || null;      emit(); });
      DB.on("rsvp/" + GAME_ID, v => { S.rsvp    = v || {};        emit(); });
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

    /** Money on the table right now, straight from live state. */
    pot() {
      const buyin = LEAGUE.nextGame.buyin;
      const rebuy = LEAGUE.nextGame.rebuy || buyin;
      const entries = Game.fieldSize();
      const rebuys  = Game.totalRebuys();
      const gross   = entries * buyin + rebuys * rebuy;
      const kitty   = Math.round(gross * (LEAGUE.payouts.kittyPct || 0) / 100);
      return { entries: entries, rebuys: rebuys, gross: gross, kitty: kitty, net: gross - kitty };
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
      return DB.save("check in " + name, () => DB.set(BASE + "/players/" + name, {
        status: "active",
        place: null,
        buyins: 1,
        rebuys: 0,
        late: !!opts.late,
        bonus: opts.late ? false : true,   // on-time chips only if not late
        joinedAt: DB.now()
      }));
    },

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
          late: false, bonus: true, joinedAt: DB.now()
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
    addRebuy(name) {
      const p = S.players[name];
      if (!p) return Promise.resolve();
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
    report(name, type) {
      const dupe = Game.pendingReports().find(r => r.name === name && r.type === type);
      if (dupe) return Promise.resolve(dupe.id);
      return DB.save("send report",
        () => DB.push(BASE + "/reports", { name: name, type: type, at: DB.now() }));
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
    confirmOut(name, reportId) {
      if (Game.active().indexOf(name) === -1) return Promise.resolve(null);
      const patch = {};
      patch[BASE + "/players/" + name + "/status"] = "out";
      patch[BASE + "/players/" + name + "/bustAt"] = DB.now();
      if (reportId) patch[BASE + "/reports/" + reportId] = null;
      return DB.save(name + " out", () => DB.multi(patch))
        .then(() => Game.placeOf(name));
    },

    /** Put someone back in — undoes a mistaken elimination. */
    reinstate(name) {
      const patch = {};
      patch[BASE + "/players/" + name + "/status"] = "active";
      patch[BASE + "/players/" + name + "/bustAt"] = null;
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
      const payTable = BPL.payoutTable(money.net, field);

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

      const rows = finish.map(f => {
        const p = S.players[f.name] || {};
        const win = payTable[f.place - 1] || 0;
        return {
          place: f.place,
          name: f.name,
          points: BPL.pointsFor(f.place, field),   // existing formula, unchanged
          rebuys: p.rebuys || 0,
          late: !!p.late,
          winnings: win,
          itm: win > 0
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
        kittyPct: LEAGUE.payouts.kittyPct || 0,
        kitty: money.kitty,
        pot: money.net,
        winner: winner,
        finish: rows,
        finalizedAt: DB.now()
      };

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
