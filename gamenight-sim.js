/* ============================================================================
   BRAELINN — GAME NIGHT SIMULATOR
   ----------------------------------------------------------------------------
   Plays whole game nights through the REAL page in a real browser: the actual
   buttons, the actual renders, the actual engine. The unit tests in
   stress-test.js prove the maths; this proves the night survives contact with
   people.

   Chaos it injects on purpose, because all of it will happen on 3 September:
     - the host's phone reloading mid-tournament
     - the clock left running for an hour with nobody looking
     - somebody arriving after two players have already busted
     - a rebuy AFTER the player was marked out
     - double-tapped buttons
     - players reporting nonsense chip counts
     - the host locking and unlocking controls at random moments

   After every single action it re-checks the invariants that must never break.

       node gamenight-sim.js [nights]
   ========================================================================== */
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");

const ROOT = __dirname;
const NIGHTS = Number(process.argv[2]) || 12;
const TYPES = { ".html":"text/html", ".js":"application/javascript", ".css":"text/css",
                ".json":"application/json", ".png":"image/png", ".ico":"image/x-icon" };

const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end("404"); }
  r.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "text/plain" });
  fs.createReadStream(f).pipe(r);
});

const ROSTER = ["Nate","Jacob","Aaron","Tod","Syd","Guy","Tim","Drew","Steele","Philo",
                "Erik V","Zak","Justin","Dave A","Tyler","Mike L","JH","Kelly"];

let seed = 1337;
const rnd  = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pick = a => a[Math.floor(rnd() * a.length)];
const int  = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

const failures = [];
const fail = (night, step, msg, detail) => failures.push({ night, step, msg, detail });

/* ---------------------------------------------------------------------------
   THE INVARIANTS. Checked after every action of every night. If any of these
   is ever false the app has lied to somebody at a poker table.
   ------------------------------------------------------------------------- */
async function invariants(page) {
  return page.evaluate(() => {
    const S = Game.state();
    const out = [];
    const names = Object.keys(S.players);
    const active = Game.active(), busted = Game.busted();
    const order = Game.finishOrder();

    if (active.length + busted.length !== names.length)
      out.push(["active+busted must equal the field", { a: active.length, b: busted.length, n: names.length }]);

    const places = order.map(o => o.place);
    if (new Set(places).size !== places.length)
      out.push(["finishing places must be unique", { places }]);
    places.forEach(p => {
      if (p < 1 || p > names.length) out.push(["place out of range", { p, field: names.length }]);
    });

    /* An active player can never hold a finishing place. */
    active.forEach(n => {
      if (Game.placeOf(n) !== null) out.push(["active player has a place", { n }]);
      if (S.players[n].bustAt) out.push(["active player has a bustAt", { n, at: S.players[n].bustAt }]);
    });
    /* ...and a busted one must always have both. */
    busted.forEach(n => {
      if (Game.placeOf(n) === null) out.push(["busted player has no place", { n }]);
    });

    /* Money is a pure function of entries and rebuys -- never of chip counts. */
    const m = Game.pot();
    const expectGross = names.length * LEAGUE.nextGame.buyin
                      + Game.totalRebuys() * (LEAGUE.nextGame.rebuy || LEAGUE.nextGame.buyin);
    if (m.gross !== expectGross) out.push(["pot gross drifted", { got: m.gross, expect: expectGross }]);
    if (m.net + m.kitty !== m.gross) out.push(["kitty + net must equal gross", m]);

    /* Chips in play must equal what was actually bought, for ACTIVE players. */
    const ng = LEAGUE.nextGame;
    const expectChips = active.reduce((s, n) => {
      const p = S.players[n];
      return s + (p.buyins || 1) * ng.startStack + (p.rebuys || 0) * ng.rebuyStack
               + (p.bonus ? ng.earlyBonus : 0);
    }, 0);
    if (Game.chipsInPlay() !== expectChips)
      out.push(["chipsInPlay drifted", { got: Game.chipsInPlay(), expect: expectChips }]);

    /* No negative or absurd counters. */
    names.forEach(n => {
      const p = S.players[n];
      if ((p.rebuys || 0) < 0) out.push(["negative rebuys", { n }]);
      if ((p.buyins || 0) < 1) out.push(["buyins below 1", { n }]);
      if (p.status !== "active" && p.status !== "out") out.push(["bad status", { n, s: p.status }]);
    });

    /* The clock may never run backwards or off the end of the structure. */
    const c = Game.clock();
    if (c.index < 0 || c.index >= LEAGUE.blinds.length) out.push(["level index out of range", { i: c.index }]);
    if (c.remainingMs < 0) out.push(["negative time remaining", { r: c.remainingMs }]);

    return out;
  });
}

async function check(page, night, step) {
  const bad = await invariants(page);
  bad.forEach(([msg, detail]) => fail(night, step, msg, detail));
  return bad.length === 0;
}

/* ------------------------------------------------------------------------- */
async function playNight(page, night, log) {
  const field = int(4, 14);
  const names = ROSTER.slice(0, field);
  const errs = [];
  page.removeAllListeners("pageerror");
  page.on("pageerror", e => errs.push(e.message));

  await page.goto("http://localhost:8919/index.html", { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });

  await page.evaluate(async ns => {
    sessionStorage.setItem("bpl_admin_ok", "1");
    await Game.resetNight();
    await Game.start();
    for (const n of ns) await Game.checkIn(n, {});
  }, names);
  await check(page, night, "check-in");

  /* Seat draw, sized like a real room. */
  const tables = Math.max(1, Math.min(4, Math.floor(field / 6) + 1));
  await page.evaluate(t => Game.drawSeats(t), tables);
  await page.evaluate(async () => { await Game.setStatus("running"); await Game.timerStart(); });
  await check(page, night, "seat draw");

  /* Identify as a random player -- exercises the self-report path. */
  await page.evaluate(n => localStorage.setItem("bpl_me", n), pick(names));

  let alive = names.slice();
  let step = 0;

  while (alive.length > 1) {
    step++;
    const roll = rnd();

    /* --- CHAOS ---------------------------------------------------------- */
    if (roll < 0.10) {
      /* The host's phone reloads. Everything must come back.
         Checking the invariants alone is not enough here -- a wiped state
         satisfies all of them trivially. So snapshot first and demand the
         field, the bust order and the clock all survive. */
      const before = await page.evaluate(() => ({
        field: Game.fieldSize(),
        busted: Game.busted().sort(),
        rebuys: Game.totalRebuys(),
        elapsed: Game.elapsedMs(),
        seats: (Game.state().seats && Game.state().seats.order || []).join("|")
      }));
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      await page.evaluate(() => { sessionStorage.setItem("bpl_admin_ok", "1"); });
      const after = await page.evaluate(() => ({
        field: Game.fieldSize(),
        busted: Game.busted().sort(),
        rebuys: Game.totalRebuys(),
        elapsed: Game.elapsedMs(),
        seats: (Game.state().seats && Game.state().seats.order || []).join("|")
      }));
      if (after.field !== before.field)
        fail(night, "step " + step + " reload", "field size did not survive a reload", { before: before.field, after: after.field });
      if (after.busted.join(",") !== before.busted.join(","))
        fail(night, "step " + step + " reload", "bust order did not survive a reload", { before: before.busted, after: after.busted });
      if (after.rebuys !== before.rebuys)
        fail(night, "step " + step + " reload", "rebuys did not survive a reload", { before: before.rebuys, after: after.rebuys });
      if (after.seats !== before.seats)
        fail(night, "step " + step + " reload", "seat draw did not survive a reload", {});
      /* The clock is derived from server time, so it must not go backwards. */
      if (after.elapsed + 2000 < before.elapsed)
        fail(night, "step " + step + " reload", "clock went backwards across a reload", { before: before.elapsed, after: after.elapsed });
      if (!await check(page, night, "step " + step + " after host reload")) return errs;
      log.reloads++;
    } else if (roll < 0.18) {
      /* An hour passes with nobody looking at the clock. */
      await page.evaluate(() => Game.timerNudge ? Game.timerNudge(60 * 60000) : null);
      await check(page, night, "step " + step + " after long gap");
      log.gaps++;
    } else if (roll < 0.26 && alive.length > 2) {
      /* Somebody rebuys. Sometimes after they were already marked out. */
      const who = pick(alive);
      /* The one-top-up cap will refuse most of these now. That is the rule
         holding, not a failure -- swallow it and carry on. */
      await page.evaluate(n => Game.addRebuy(n).catch(() => {}), who);
      if (!await check(page, night, "step " + step + " rebuy " + who)) return errs;
      log.rebuys++;
    } else if (roll < 0.32) {
      /* Double-tap: the same elimination fired twice in quick succession. */
      const who = pick(alive.filter(n => alive.length > 1));
      await page.evaluate(async n => { Game.confirmOut(n); Game.confirmOut(n); }, who);
      await page.waitForTimeout(120);
      alive = await page.evaluate(() => Game.active());
      if (!await check(page, night, "step " + step + " double-tap out " + who)) return errs;
      log.doubleTaps++;
    } else if (roll < 0.40 && alive.length > 2) {
      /* A busted player is put back in -- the classic "he had chips behind". */
      const outs = await page.evaluate(() => Game.busted());
      if (outs.length) {
        const who = pick(outs);
        /* Reinstating a busted player IS the host-override case, so keep
           exercising that path rather than letting the cap swallow it. */
        await page.evaluate(n => Game.addRebuy(n, true), who);
        alive = await page.evaluate(() => Game.active());
        if (!await check(page, night, "step " + step + " reinstate " + who)) return errs;
        log.reinstates++;
      }
    } else if (roll < 0.46 && step > 2) {
      /* Late entry, after players have already busted. The trap that
         produced duplicate finishing places the first time round. */
      const late = ROSTER[names.length];
      if (late && !names.includes(late)) {
        names.push(late);
        await page.evaluate(n => Game.checkIn(n, { late: true }), late);
        alive = await page.evaluate(() => Game.active());
        if (!await check(page, night, "step " + step + " late entry " + late)) return errs;
        log.lateEntries++;
      }
    } else if (roll < 0.60) {
      /* Chip counts, including deliberately silly ones. */
      const who = pick(alive);
      const v = pick([0, 25, 1500, 13000, 250000, 9999999]);
      await page.evaluate(([n, v]) => Game.setStack(n, v, n).catch(() => {}), [who, v]);
      await page.waitForTimeout(60);
      if (!await check(page, night, "step " + step + " stack " + who + "=" + v)) return errs;
      log.stacks++;
    } else if (roll < 0.66) {
      /* Host locks and unlocks controls mid-hand. */
      await page.evaluate(() => Admin.lock());
      await page.waitForTimeout(60);
      await page.evaluate(() => { sessionStorage.setItem("bpl_admin_ok","1"); window.dispatchEvent(new Event("bpl:adminchange")); });
      await check(page, night, "step " + step + " lock/unlock");
    } else if (roll < 0.72) {
      /* Pause and resume the clock. */
      await page.evaluate(async () => { await Game.timerPause(); await Game.timerResume(); });
      await check(page, night, "step " + step + " pause/resume");
    } else {
      /* The ordinary case: somebody busts. */
      const who = pick(alive);
      await page.evaluate(n => Game.confirmOut(n), who);
      await page.waitForTimeout(60);
      alive = await page.evaluate(() => Game.active());
      if (!await check(page, night, "step " + step + " out " + who)) return errs;
      log.busts++;
    }

    alive = await page.evaluate(() => Game.active());
    if (step > 400) { fail(night, "runaway", "night never ended", { step, alive: alive.length }); break; }
  }

  /* --- FINALIZE -------------------------------------------------------- */
  const ready = await page.evaluate(() => Game.readyToFinalize());
  if (!ready) { fail(night, "finalize", "not ready with one player left", { alive: alive.length }); return errs; }

  const rec = await page.evaluate(() => Game.finalize().then(r => r, e => ({ error: e.message })));
  if (rec && rec.error) { fail(night, "finalize", "finalize threw", rec); return errs; }

  /* The recorded result must be internally consistent and complete. */
  const v = await page.evaluate(r => {
    const bad = [];
    if (!r) { return [["no record"]]; }
    if (!Array.isArray(r.finish)) bad.push(["finish is not an array", { t: typeof r.finish }]);
    const places = r.finish.map(x => x.place).sort((a,b)=>a-b);
    const want = Array.from({length: r.field}, (_,i)=>i+1);
    if (JSON.stringify(places) !== JSON.stringify(want))
      bad.push(["places must be exactly 1..field", { places, field: r.field }]);
    if (r.finish.length !== r.field) bad.push(["row count must equal field", { rows: r.finish.length, field: r.field }]);
    if (r.finish[0].name !== r.winner) bad.push(["winner must be place 1", { w: r.winner, first: r.finish[0].name }]);
    r.finish.forEach(x => {
      if (typeof x.points !== "number" || x.points < 0) bad.push(["bad points", x]);
      if (!x.name) bad.push(["row with no name", x]);
      if ("stack" in x) bad.push(["chip counts must never reach the permanent record", x]);
    });
    if (typeof r.finalizedAt !== "number") bad.push(["no finalizedAt", { at: r.finalizedAt }]);
    /* The finalized record must survive the standings guard. */
    const agg = BPL.aggregate({ [r.gameId]: r });
    if (agg.gamesPlayed !== 1) bad.push(["standings rejected a real finalized game", { got: agg.gamesPlayed }]);
    return bad;
  }, rec);
  v.forEach(([msg, detail]) => fail(night, "finalize", msg, detail));

  const real = errs.filter(e => !/ERR_|gstatic|firebase/i.test(e));
  real.forEach(e => fail(night, "console", "page threw", { e }));
  return { field: names.length, steps: step, winner: rec && rec.winner };
}

/* ------------------------------------------------------------------------- */
(async () => {
  await new Promise(r => server.listen(8919, r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await ctx.route("**/gstatic.com/**", r => r.abort());
  const page = await ctx.newPage();

  const log = { reloads:0, gaps:0, rebuys:0, doubleTaps:0, reinstates:0, lateEntries:0, stacks:0, busts:0 };
  console.log("Simulating " + NIGHTS + " full game nights through the real UI...\n");

  for (let n = 1; n <= NIGHTS; n++) {
    const before = failures.length;
    const r = await playNight(page, n, log);
    const ok = failures.length === before;
    console.log("  Night " + String(n).padStart(2) +
      ": " + String((r && r.field) || "?").padStart(2) + " players, " +
      String((r && r.steps) || "?").padStart(3) + " events" +
      (r && r.winner ? ", won by " + r.winner : "") +
      "  " + (ok ? "OK" : "FAILED"));
  }

  console.log("\nChaos injected across all nights:");
  Object.keys(log).forEach(k => console.log("  " + k.padEnd(13) + log[k]));

  await browser.close(); server.close();

  if (!failures.length) {
    console.log("\nALL " + NIGHTS + " NIGHTS HELD EVERY INVARIANT\n");
    process.exit(0);
  }
  console.log("\n" + failures.length + " FAILURES\n");
  const seen = {};
  failures.forEach(f => {
    const k = f.msg;
    seen[k] = (seen[k] || 0) + 1;
    if (seen[k] <= 2) console.log("  night " + f.night + " @ " + f.step + " -- " + f.msg + "  " + JSON.stringify(f.detail));
  });
  Object.keys(seen).forEach(k => { if (seen[k] > 2) console.log("  (" + k + " x" + seen[k] + ")"); });
  process.exit(1);
})();
