/* ============================================================================
   BRAELINN POKER LEAGUE — LEAGUE DATA
   ----------------------------------------------------------------------------
   THIS IS THE ONLY FILE YOU EDIT WEEK TO WEEK.
   Everything on the site reads from the LEAGUE object below.

   >>> TODO markers show what still needs real data from Nate. <<<
   ========================================================================== */

const LEAGUE = {
  name: "Braelinn Poker League",
  shortName: "Braelinn",
  abbr: "BPL",
  season: 7,
  location: "Peachtree City, GA",

  /* Short line shown in the hero and on the schedule page. */
  tagline: "Cards roll at 8:30",

  /* --------------------------------------------------------------------------
     ANNOUNCEMENTS — banner at the top of the home page.
     Set active:false to hide one. First active item wins.
     type: "special" | "info" | "alert"
     ------------------------------------------------------------------------ */
  announcements: [
    {
      active: true,
      type: "special",
      icon: "🏆",
      text: "Season 7 kicks off Thursday, September 3 — cards roll at 8:30. RSVP below."
    },
    {
      active: false,
      type: "info",
      icon: "📋",
      text: "Standings updated after Event 1."
    }
  ],

  /* --------------------------------------------------------------------------
     SCHEDULE
     Only Game 1 is confirmed. Add the rest as the dates get set — the app
     shows "more dates coming" until then rather than inventing any.
     ------------------------------------------------------------------------ */
  schedule: [
    { date: "2026-09-03", label: "Event 1", type: "regular", completed: false, note: "Season 7 Kickoff" }

    /* ---- ADD THE REST HERE AS THE DATES COME IN -------------------------
       Copy a line, change the date and number. Keep them in date order.

       , { date: "2026-09-15", label: "Event 2", type: "regular", completed: false, note: "" }
       , { date: "2026-09-29", label: "Event 3", type: "regular", completed: false, note: "" }

       When you get to the end of the season, add the final:
       , { date: "2027-05-08", label: "Season 7 Final", type: "final", completed: false, note: "" }

       type: "regular" | "tournament" | "final"
       --------------------------------------------------------------------- */
  ],

  /* --------------------------------------------------------------------------
     LAST GAME — populate after each event. Drives the recap card + results table.
     Leave date:"" until Event 1 is in the books.
     ------------------------------------------------------------------------ */
  lastGame: {
    date: "",
    label: "",
    playerCount: 0,
    kitty: 0,
    winner: "",
    recap: "",
    results: [
      // { place: 1, name: "Nate", points: 3600, itm: true, winnings: 240 },
    ]
  },

  /* --------------------------------------------------------------------------
     ROSTER — who's in the league. All 34 names off the Season 6 Final invite.

     >>> THE NUMBERS BELOW ARE NO LONGER MAINTAINED BY HAND. <<<
     events / points / wins / cashes / avgPlace are now DERIVED from finalized
     game results in Firebase. They stay here as zeros so the app still renders
     before the first game is played. Finalizing a tournament on the Game Night
     page writes the real record — you never edit this file after a game again.

     What you DO maintain here:
       name      → what he's called at the table (MUST match RSVP + seat draw)
       fullName  → full name for the roster card
       reg       → true = Season 7 regular (shown by default; others behind a toggle)
       avatar    → "avatars/<file>.png" (200x200). Leave "" for an initials disc.
     ------------------------------------------------------------------------ */
  standings: [
    /* --- Core 18: everyone who was "Going" to the Season 6 Final --------- */
    { name: "Nate",      fullName: "Nate Woods",      reg: true, events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Jacob",     fullName: "Jacob Bevier",    reg: true, events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Aaron",     fullName: "Aaron Wright",    reg: true, events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Eric C",    fullName: "Eric Cunningham", reg: true, events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Joe C",     fullName: "Joe Clark",       reg: true, events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Drew",      fullName: "Drew Channell",   reg: true, events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Tod",       fullName: "Tod Ellison",     reg: true, events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Phil T",    fullName: "Phil Trickey",    reg: true, events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Syd",       fullName: "Syd Graham",      reg: true, events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Tim",       fullName: "Tim Fuller",      reg: true, events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Matt T",    fullName: "Matt Therriault", reg: true, events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Chris P",   fullName: "Chris Pettis",    reg: true, events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Steele",    fullName: "Steele Persons",  reg: true, events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Chris F",   fullName: "Chris Frady",     reg: true, events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Philo",     fullName: "Philo Mitman",    reg: true, events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Erik V",    fullName: "Erik Varnadoe",   reg: true, events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Michael H", fullName: "Michael Hyde",    reg: true, events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Guy",       fullName: "Guy Caldwell",    reg: true, events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },

    /* --- Wider invite list (were "Pending" / "Not going" for the S6 final)
           Still on the roster and can RSVP. Set reg:true if they become
           regulars in Season 7, or delete the row if they're not in the league. */
    { name: "Zak",        fullName: "Zak Ryan",         events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Justin",     fullName: "Justin",           events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Dave A",     fullName: "Dave A",           events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Tyler",      fullName: "Tyler Molleson",   events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Mike L",     fullName: "Mike Leedy",       events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "JH",         fullName: "JH Hooper",        events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Jonathan",   fullName: "Jonathan Moran",   events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Michael S",  fullName: "Michael Shamrock", events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Kelly",      fullName: "Kelly Williams",   events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Andy",       fullName: "Andy Jones",       events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Joe B",      fullName: "Joe Bergeron",     events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Michael L",  fullName: "Michael Lowe",     events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Mark",       fullName: "Mark Fischer",     events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Alieu",      fullName: "Alieu Lette",      events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Jake",       fullName: "Jake Westfall",    events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Sprayberry", fullName: "Sprayberry",       events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" }
  ],

  /* --------------------------------------------------------------------------
     NEXT GAME — powers the hero, the RSVP date key, and the seat draw date key.
     IMPORTANT: `date` decides which Firebase RSVP/seat node the app reads and
     writes (rsvp_2026_09_03, seats_2026_09_03, ...). Roll it forward after
     every game night.
     TODO: confirm buy-in / rebuy / stacks with Nate.
     ------------------------------------------------------------------------ */
  nextGame: {
    date: "2026-09-03",   // Thursday, Sept 3 — Season 7 kickoff
    label: "Event 1 — Season 7 Kickoff",
    time: "8:30 PM",      // CONFIRMED — games always start 8:30
    buyin: 30,          // CONFIRMED
    rebuy: 30,          // CONFIRMED — same price for a rebuy or the 6,000-chip add-on
    startStack: 7000,   // CONFIRMED — buy-in gets you 7,000
    rebuyStack: 6000,   // CONFIRMED — rebuy gets you 6,000 (1k less than a fresh buy-in)
    earlyBonus: 500,    // CONFIRMED — 500 bonus chips for being on time
    maxPlayers: 36,
    notes: "Cards roll at 8:30. $30 buy-in for 7,000 chips, $30 rebuy for 6,000. There by 8:30 = 500 bonus chips."
  },

  /* --------------------------------------------------------------------------
     BLIND STRUCTURE — drives the timer on game.html

     CONFIRMED: starts at 50/100 with 20-minute levels.
     The early levels below follow from that. Levels 5+ (antes, the 15-min
     speed-up, and where the breaks land) are still a sensible guess —
     ask Nate how deep his structure actually goes and edit here.
     mins = length of the level. break:true renders as a break instead.
     ------------------------------------------------------------------------ */
  blinds: [
    /* CONFIRMED: starts 50/100, 20-minute levels, and runs up to 300/600
       just before the first break. No 150/300 level.

       The first break is the REBUY / ADD-ON deadline — last chance to rebuy
       or buy 6,000 more chips. After it, the game plays down.

       Levels 5+ below (antes, the shorter levels, the second break) are still
       a reasonable guess — confirm and edit. */
    { level: 1,  sb: 50,    bb: 100,    ante: 0,     mins: 20 },
    { level: 2,  sb: 100,   bb: 200,    ante: 0,     mins: 20 },
    { level: 3,  sb: 200,   bb: 400,    ante: 0,     mins: 20 },
    { level: 4,  sb: 300,   bb: 600,    ante: 0,     mins: 20 },
    { level: 0,  sb: 0,     bb: 0,      ante: 0,     mins: 10, break: true,
      label: "BREAK — Last Rebuy / Add-On (6,000 chips)", lastRebuy: true },

    { level: 5,  sb: 400,   bb: 800,    ante: 800,   mins: 20 },
    { level: 6,  sb: 600,   bb: 1200,   ante: 1200,  mins: 20 },
    { level: 7,  sb: 800,   bb: 1600,   ante: 1600,  mins: 20 },
    { level: 8,  sb: 1000,  bb: 2000,   ante: 2000,  mins: 20 },
    { level: 0,  sb: 0,     bb: 0,      ante: 0,     mins: 10, break: true,
      label: "BREAK — Colour Up / Consolidate Tables" },

    { level: 9,  sb: 1500,  bb: 3000,   ante: 3000,  mins: 15 },
    { level: 10, sb: 2000,  bb: 4000,   ante: 4000,  mins: 15 },
    { level: 11, sb: 3000,  bb: 6000,   ante: 6000,  mins: 15 },
    { level: 12, sb: 4000,  bb: 8000,   ante: 8000,  mins: 15 },
    { level: 13, sb: 5000,  bb: 10000,  ante: 10000, mins: 15 },
    { level: 14, sb: 8000,  bb: 16000,  ante: 16000, mins: 15 },
    { level: 15, sb: 10000, bb: 20000,  ante: 20000, mins: 15 }
  ],

  /* --------------------------------------------------------------------------
     POINTS — TODO: confirm this is how Braelinn actually scores.
     Points for a finish = (number of players you outlasted + 1) * 300
     i.e. in a 20-player field: 1st = 6000, 2nd = 5700, ... last = 300
     ------------------------------------------------------------------------ */
  /* --------------------------------------------------------------------------
     SEASON SCORING POLICY
     ----------------------------------------------------------------------------
     How the season table is built FROM the permanent event results. This is a
     separate decision from how an event scores — event points are recorded
     permanently and are never rewritten.

         event result  ->  raw points  ->  season scoring policy  ->  standings

     mode "cumulative" (current): every event counts, nothing dropped.

     RULE NEEDS CONFIRMATION — the Season 7 policy has NOT been decided.
     Other modes are implemented but unused; switching is a one-line change and
     recomputes from history, because raw results are never altered.

       { mode: "cumulative" }
       { mode: "bestN",         n: 8 }        // count the 8 best events
       { mode: "bestPercentage", pct: 0.667 } // count the best two-thirds
       { mode: "dropWorst",     drop: 2 }     // discard the 2 worst events
     ------------------------------------------------------------------------ */
  seasonScoring: {
    mode: "cumulative"
  },

  points: {
    perPlaceMultiplier: 300,
    describe: "Points = (players outlasted + 1) × 300. Win a 20-handed field, take 6,000."
  },

  /* --------------------------------------------------------------------------
     PAYOUT STRUCTURE — % of prize pool by field size. Editable live on game.html.
     kittyPct = % skimmed off the top for the season-end championship pot.
     ------------------------------------------------------------------------ */
  payouts: {
    /* kittyPct: % skimmed off the top for a season-end championship pot.
       Set to 0 = no skim, the whole pot pays out tonight. Jacob wasn't sure
       whether Braelinn runs one — 0 is the safe default, since showing money
       going somewhere it doesn't actually go would be worse than showing none.
       If Nate says there IS a season kitty, change this number (or just type
       it into the Payouts tab on game night — no code edit needed). */
    kittyPct: 0,
    tiers: [
      { maxPlayers: 6,   splits: [70, 30] },
      { maxPlayers: 9,   splits: [50, 30, 20] },
      { maxPlayers: 15,  splits: [45, 27, 18, 10] },
      { maxPlayers: 21,  splits: [40, 24, 16, 12, 8] },
      { maxPlayers: 999, splits: [35, 22, 15, 11, 9, 8] }
    ]
  }
};

/* Derived helpers — do not edit below unless you know what you're doing. */
const BPL = {
  dateKey(iso) { return (iso || "").replace(/-/g, "_"); },

  fmtDate(iso, opts) {
    if (!iso) return "TBD";
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("en-US", opts || { weekday: "long", month: "long", day: "numeric" });
  },

  fmtShort(iso) {
    if (!iso) return "TBD";
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  },

  money(n) { return "$" + Number(n || 0).toLocaleString("en-US"); },

  chips(n) { return Number(n || 0).toLocaleString("en-US"); },

  initials(name) {
    return (name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  },

  player(name) {
    return LEAGUE.standings.find(p => p.name === name) || null;
  },

  /** Prize split percentages for a given field size. */
  splitsFor(playerCount) {
    const tier = LEAGUE.payouts.tiers.find(t => playerCount <= t.maxPlayers);
    return (tier ? tier.splits : LEAGUE.payouts.tiers[LEAGUE.payouts.tiers.length - 1].splits).slice();
  },

  /** Points a player earns for finishing `place` out of `field`.
      LEAGUE RULE — do not change without Nate. */
  pointsFor(place, field) {
    return (field - place + 1) * LEAGUE.points.perPlaceMultiplier;
  },

  /**
   * Prize money by place for a given net pool. Rounded to the nearest $5 with
   * the remainder pushed into 1st, so the payouts always sum to the pot exactly.
   * Returns an array indexed by (place - 1).
   */
  payoutTable(net, field) {
    const splits = BPL.splitsFor(field || 1);
    const amounts = splits.map(p => Math.round(net * p / 100 / 5) * 5);
    const drift = net - amounts.reduce((a, b) => a + b, 0);
    if (amounts.length) amounts[0] += drift;
    return amounts;
  },

  /**
   * Season standings, derived from finalized game results in Firebase.
   * `results` is the object at /leagues/braelinn/results.
   * The roster in LEAGUE.standings supplies names and avatars only — every
   * number below is computed from actual recorded games, which is why nobody
   * hand-edits this file after a tournament any more.
   */
  /**
   * Apply the season scoring policy to one player's list of event results.
   * Returns the season points total. NEVER mutates the raw results.
   */
  applySeasonPolicy(eventPoints) {
    const pol = LEAGUE.seasonScoring || { mode: "cumulative" };
    const pts = eventPoints.slice().sort((a, b) => b - a);   // best first
    const sum = arr => arr.reduce((a, b) => a + b, 0);

    switch (pol.mode) {
      case "bestN":
        return sum(pts.slice(0, Math.max(0, pol.n || pts.length)));
      case "bestPercentage": {
        const keep = Math.max(1, Math.ceil(pts.length * (pol.pct || 1)));
        return sum(pts.slice(0, keep));
      }
      case "dropWorst":
        return sum(pts.slice(0, Math.max(0, pts.length - (pol.drop || 0))));
      case "cumulative":
      default:
        return sum(pts);
    }
  },

  /**
   * Season standings, derived from finalized game results in Firebase.
   *
   * The raw event record is the source of truth and is never rewritten. This
   * only READS it, so changing the season policy later recomputes the whole
   * table from history without touching a single stored result.
   */
  aggregate(results) {
    const byName = {};
    LEAGUE.standings.forEach(p => {
      byName[p.name] = Object.assign({}, p, {
        events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0,
        winnings: 0, rebuys: 0, _places: [], _eventPoints: [], _rawPoints: 0
      });
    });

    const games = Object.keys(results || {})
      .map(k => results[k])
      .filter(g => g && Array.isArray(g.finish));

    games.forEach(g => {
      g.finish.forEach(r => {
        if (!byName[r.name]) {
          /* Played but not on the roster in data.js — still counts. */
          byName[r.name] = { name: r.name, fullName: r.name, avatar: "", saying: "",
            events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0,
            winnings: 0, rebuys: 0, _places: [], _eventPoints: [], _rawPoints: 0 };
        }
        const p = byName[r.name];
        p.events += 1;
        p._rawPoints += r.points || 0;
        p._eventPoints.push(r.points || 0);
        p.winnings += r.winnings || 0;
        p.rebuys += r.rebuys || 0;
        if (r.place === 1) p.wins += 1;
        if (r.itm || (r.winnings || 0) > 0) p.cashes += 1;
        p._places.push(r.place);
      });
    });

    Object.keys(byName).forEach(n => {
      const p = byName[n];
      p.avgPlace = p._places.length
        ? p._places.reduce((a, b) => a + b, 0) / p._places.length : 0;
      p.rawPoints = p._rawPoints;                       // every event, always
      p.points = BPL.applySeasonPolicy(p._eventPoints); // season policy applied
      p.eventsCounted = (LEAGUE.seasonScoring || {}).mode === "cumulative"
        ? p.events : Math.min(p.events, p._eventPoints.length);
      delete p._places; delete p._eventPoints; delete p._rawPoints;
    });

    return { players: Object.keys(byName).map(n => byName[n]), gamesPlayed: games.length, games: games };
  },

  /**
   * Rank players for display, with honest ties.
   *
   * Order: points -> wins -> cashes -> better average finish. Those are real
   * competitive comparisons. If two players are still level after all of them
   * they are genuinely tied and BOTH get the same rank number — name order is
   * only a stable sort so the list does not jump around between renders, and
   * is never presented as though it decided anything.
   */
  rankPlayers(players) {
    const cmp = (a, b) =>
      (b.points - a.points) ||
      (b.wins - a.wins) ||
      (b.cashes - a.cashes) ||
      ((a.avgPlace || 999) - (b.avgPlace || 999)) ||
      a.name.localeCompare(b.name);          // stable display only

    const tied = (a, b) =>
      a.points === b.points && a.wins === b.wins &&
      a.cashes === b.cashes && (a.avgPlace || 999) === (b.avgPlace || 999);

    const sorted = players.slice().sort(cmp);
    let rank = 0;
    return sorted.map((p, i) => {
      if (i === 0 || !tied(p, sorted[i - 1])) rank = i + 1;
      return Object.assign({}, p, { rank: rank, tied: (i > 0 && tied(p, sorted[i - 1])) ||
        (i < sorted.length - 1 && tied(p, sorted[i + 1])) });
    });
  },

  /** Standings sorted by points desc, then wins, then fewer events. */
  sortedStandings() {
    return LEAGUE.standings.slice().sort((a, b) =>
      b.points - a.points || b.wins - a.wins || a.events - b.events || a.name.localeCompare(b.name)
    );
  },

  /** Next incomplete event on the schedule (falls back to nextGame). */
  upcoming() {
    return LEAGUE.schedule.filter(e => !e.completed);
  },

  activeAnnouncement() {
    return LEAGUE.announcements.find(a => a.active) || null;
  },

  /**
   * Which event is "now"? Derived from the schedule, never hand-entered.
   *
   * THIS IS THE FIX FOR THE STALE-SITE PROBLEM. Previously the active game
   * came from a date typed into nextGame.date. If nobody remembered to roll
   * it forward after a game, the app kept reading LAST game's RSVP node —
   * which looks exactly like "the site went stale". Now the date comes from
   * the schedule, so it advances on its own.
   *
   * An event stays current through its own calendar day (a game at 8:30pm
   * shouldn't flip to the next event at 00:01 that morning), then rolls over
   * at midnight.
   */
  currentGame() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const upcoming = LEAGUE.schedule.filter(e => {
      if (!e || !e.date) return false;
      const [y, m, d] = e.date.split("-").map(Number);
      return new Date(y, m - 1, d) >= todayStart;
    });
    if (upcoming.length) return upcoming[0];
    return LEAGUE.schedule.length ? LEAGUE.schedule[LEAGUE.schedule.length - 1] : null;
  },

  /** True when every scheduled date has passed — nothing left to RSVP to. */
  seasonOver() {
    const g = BPL.currentGame();
    if (!g) return true;
    const [y, m, d] = g.date.split("-").map(Number);
    const todayStart = new Date();
    return new Date(y, m - 1, d) < new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate());
  },

  /** Total seconds in the configured blind structure. */
  totalMinutes() {
    return LEAGUE.blinds.reduce((s, l) => s + l.mins, 0);
  }
};

/* ============================================================================
   AUTO-ROLL THE ACTIVE GAME
   ----------------------------------------------------------------------------
   Everything downstream (RSVP node, seat draw, live game state) keys off
   LEAGUE.nextGame.date. Rather than trusting a human to edit that after every
   game, derive it from the schedule at load time.

   Add your dates to `schedule` once and the app rolls itself forever.

   Escape hatch: set nextGame.pinDate = true to freeze it on a specific date
   (useful if you ever need to reopen a past game's RSVPs).
   ========================================================================== */
(function autoRollActiveGame() {
  if (LEAGUE.nextGame.pinDate) return;
  const g = BPL.currentGame();
  if (!g) return;
  LEAGUE.nextGame.date  = g.date;
  LEAGUE.nextGame.label = g.label + (g.note ? " — " + g.note : "");
})();
