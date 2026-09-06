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

  /* Who gets offered the Master Control PIN prompt on identifying themselves.
     This is convenience, not security -- the PIN is the only gate, and it is
     bypassable by anyone who opens devtools. See SECURITY.md. */
  hosts: ["Jacob", "Nate"],

  /* Short line shown in the hero and on the schedule page. */
  tagline: "Cards roll at 8:30",

  /* --------------------------------------------------------------------------
     ANNOUNCEMENTS — banner at the top of the home page.
     Set active:false to hide one. First active item wins.
     type: "special" | "info" | "alert"
     ------------------------------------------------------------------------ */
  /* --------------------------------------------------------------------------
     LEAGUE NEWS — the banner on Tonight.

     Every announcement carries `until`: the last day it should be seen. Once
     that day has passed the app stops showing it, on its own. A banner still
     advertising a night that already happened is the same stale-site problem
     as a stale game date, and it went live once already ("Season 7 kicks off
     Thursday, September 3" was still up on the 6th).

     Leave `until` off only for something genuinely timeless.
     ------------------------------------------------------------------------ */
  announcements: [
    {
      active: true,
      type: "special",
      icon: "🎯",
      until: "2027-05-31",
      text: "$20 rides on the last winner's head — knock them out and it's yours. " +
            "Back-to-back wins stack it."
    }
  ],

  /* --------------------------------------------------------------------------
     SCHEDULE
     Only Game 1 is confirmed. Add the rest as the dates get set — the app
     shows "more dates coming" until then rather than inventing any.
     ------------------------------------------------------------------------ */
  schedule: [
    { date: "2026-09-03", label: "Event 1", type: "regular", completed: false, note: "Season 7 Kickoff" }
    , { date: "2026-09-15", label: "Event 2", type: "regular", completed: false, note: "" }

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
    { name: "Sprayberry", fullName: "Tyler Sprayberry", events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Larry",      fullName: "Larry Stewart",    events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    { name: "Greg",       fullName: "Gregory James Lee",events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" },
    /* Short name is "Matt M" -- "Matt" alone would collide with Matt
       Therriault, and the short name is the database key every RSVP,
       check-in and result is filed under. */
    { name: "Matt M",     fullName: "Matt McCoy",       reg: true, events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0, avatar: "", saying: "" }
  ],

  /* --------------------------------------------------------------------------
     NEXT GAME — the money and the chip counts. NOT the date.

     `date` and `label` below are only a seed: BPL.currentGame() overwrites
     both from the schedule above every time the app loads. Add the night to
     `schedule` and the whole app follows. Editing the date here does nothing.
     ------------------------------------------------------------------------ */
  nextGame: {
    date: "2026-09-03",   // seed only — the schedule decides
    label: "Event 1 — Season 7 Kickoff",   // seed only
    time: "8:30 PM",      // CONFIRMED — games always start 8:30
    buyin: 30,          // CONFIRMED
    rebuy: 30,          // CONFIRMED — same price for a rebuy or the 6,000-chip add-on
    maxTopUps: 1,       // CONFIRMED 29 Aug — ONE top-up per player, all night,
                        // whether they take it as a rebuy or as the add-on.
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
    /* CONFIRMED with Nate, 29 Aug 2026: the full ladder, and NO ANTES at any
       level. The antes that used to sit on levels 5-8 were my guess and have
       been removed -- a wrong number on the clock is worse than no number.

       The break after 300/600 is the deadline: last chance to rebuy, or to
       buy the 6,000-chip add-on. One top-up per player for the whole night,
       whichever form it takes. After the break the game just plays down. */
    { level: 1,  sb: 50,    bb: 100,    ante: 0, mins: 20 },
    { level: 2,  sb: 100,   bb: 200,    ante: 0, mins: 20 },
    { level: 3,  sb: 200,   bb: 400,    ante: 0, mins: 20 },
    { level: 4,  sb: 300,   bb: 600,    ante: 0, mins: 20 },

    { level: 0,  sb: 0,     bb: 0,      ante: 0, mins: 10, break: true,
      label: "BREAK — Last Rebuy / Add-On (6,000 chips)", lastRebuy: true },

    { level: 5,  sb: 500,   bb: 1000,   ante: 0, mins: 20 },
    { level: 6,  sb: 600,   bb: 1200,   ante: 0, mins: 20 },
    { level: 7,  sb: 1000,  bb: 2000,   ante: 0, mins: 20 },
    { level: 8,  sb: 2500,  bb: 5000,   ante: 0, mins: 20 },
    { level: 9,  sb: 3000,  bb: 6000,   ante: 0, mins: 20 },
    { level: 10, sb: 4000,  bb: 8000,   ante: 0, mins: 20 },
    { level: 11, sb: 5000,  bb: 10000,  ante: 0, mins: 20 }
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
    /* CONFIRMED: 300 for busting first, +300 for every place you climb.
       So in a 20-handed field the winner takes 6,000. */
    perPlaceMultiplier: 300,

    /* RULE NEEDS CONFIRMATION — a top-finishers bonus.
       Jacob recalls Nate mentioning "a bonus once you reach the top 5 or so"
       but not the amounts. The mechanism below is built and tested; it is
       switched OFF because nobody has confirmed the numbers, and inventing
       them would quietly change who wins the season.

       To turn it on, list the bonus for 1st, 2nd, 3rd... e.g.
           placeBonus: [1500, 1000, 750, 500, 250]
       Standings recompute from history the moment it changes -- raw results
       are never rewritten, so switching it on later costs nothing. This is
       true because BPL.scoreOf recomputes every row from place/field/itm;
       it was NOT true until 5 Sep, when the stored number was trusted. */
    placeBonus: [],

    /* CONFIRMED 4 Sep — everyone who finishes in the money gets a flat 100 on
       top, however many places happen to pay that night (three some nights,
       six others). Tied to cashing, not to a place number. */
    itmBonus: 100,

    describe: "Points = (players outlasted + 1) × 300, plus 100 for cashing. Win a 20-handed field, take 6,100."
  },

  /* --------------------------------------------------------------------------
     RECAPS — the story of each night, keyed by date.

     Written between games from the finalized record, not generated live: a
     recap that fails has to fail on a Tuesday, not while twenty people are
     waiting to be seated. Plain text; blank lines separate paragraphs.
     ------------------------------------------------------------------------ */
  recaps: {
    "2026-09-03":
      "Twelve came, eleven rebought. Read that again. Every single player at " +
      "Nate's on opening night reached for a second $30 except Chris F — who " +
      "then proceeded to outlast four men who'd bought themselves a whole extra " +
      "life. Seventh place, one buy-in, and the moral high ground.\n\n" +

      "Nate went out first. The host. In his own house. On the opening night of " +
      "the season he runs. Twelve players, twelve finishing positions, and the " +
      "man whose kitchen it is found the bottom of the list before anyone else. " +
      "He rebought. It didn't help.\n\n" +

      "Up top, Tod closed it out for $245 — and inherits something new: the first " +
      "bounty of Season 7 rides on his head next time out. Twenty dollars to " +
      "whoever knocks him out. Win again and it's forty. Tim got heads-up and took " +
      "$165; Eric C and Guy rounded out the money.\n\n" +

      "Greg played his first Braelinn night and finished 8th of 12 — mid-pack, " +
      "rebought like everyone else, blended right in. Sprayberry managed 11th, " +
      "which is one spot better than the host.\n\n" +

      "$690 through the door. $140 to the season kitty. $550 across four places. " +
      "Tod leads the table with 3,700, and everyone else has the rest of the " +
      "season to do something about it."
  },

  /* --------------------------------------------------------------------------
     BOUNTY — $20 off the top of the night's pot, on the last winner's head.
     Whoever knocks them out takes it. Back-to-back wins stack it: two in a
     row and they carry $40, three and it's $60.
     ------------------------------------------------------------------------ */
  bounty: {
    amount: 20,
    describe: "$20 on the last winner's head, stacking $20 per consecutive win."
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

  /**
   * Points a player earns for finishing `place` out of `field`.
   * LEAGUE RULE — do not change without Nate.
   *
   * `itm` is whether they finished in the money. How many places pay changes
   * with the field — three some nights, six others — so the bonus is tied to
   * cashing, not to a place number. Pass it and the ITM bonus is included.
   */
  pointsFor(place, field, itm) {
    const base  = (field - place + 1) * LEAGUE.points.perPlaceMultiplier;
    const bonus = (LEAGUE.points.placeBonus || [])[place - 1] || 0;
    const cash  = itm ? (LEAGUE.points.itmBonus || 0) : 0;
    return base + bonus + cash;
  },

  /* ------------------------------------------------------------- BOUNTY ---

     $20 comes off the top of the night's pot and rides on the last game's
     winner. Knock them out, take the $20. Win two in a row and they carry
     $40 the next night, three in a row $60.

     Derived from the finalized results, never entered by hand — who the
     champion is and how long the streak runs are facts about games already
     played, and a fact kept in two places drifts.
     --------------------------------------------------------------------- */

  /** Finalized games, oldest first. */
  gamesByDate(results) {
    return Object.keys(results || {})
      .map(k => results[k])
      .filter(g => g && g.date && g.winner && g.finish)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  },

  /**
   * Who carries the bounty into the next game, and for how much.
   * null before the first game of the league — nothing to defend yet.
   */
  bountyOn(results, beforeDate) {
    const games = BPL.gamesByDate(results)
      .filter(g => !beforeDate || String(g.date) < String(beforeDate));
    if (!games.length) return null;

    const champ = games[games.length - 1].winner;

    /* Consecutive wins counting back from the most recent game. Somebody else
       winning resets it, whether or not the champion played that night. */
    let streak = 0;
    for (let i = games.length - 1; i >= 0; i--) {
      if (games[i].winner !== champ) break;
      streak++;
    }

    const per = (LEAGUE.bounty && LEAGUE.bounty.amount) || 0;
    return {
      name: champ,
      streak: streak,
      amount: per * streak,
      since: games[games.length - streak].date
    };
  },

  /** Nearest $10. Nobody at this table wants to count out singles. */
  round10(n) { return Math.round(Number(n || 0) / 10) * 10; },

  /**
   * Payouts the way a host actually says them out loud:
   *
   *     "kitty's a hundred and twenty, first gets two hundred, pay four."
   *
   * Give it the money left after the kitty and the bounty, what 1st takes,
   * and how many places pay. Everything below 1st is worked out from the
   * league's own split curve for that many places, scaled to whatever is
   * left, rounded to $10, with the drift pushed into 2nd so the table adds
   * up to the pot exactly.
   *
   * Returns null when the numbers cannot make an honest table, and says why
   * — a payout list that doesn't add up is worse than no payout list.
   */
  payoutPlan(net, first, places, splitsOverride) {
    const pot = Math.max(0, Math.round(Number(net) || 0));
    const n = Math.max(1, Math.round(Number(places) || 1));
    const top = Math.round(Number(first) || 0);

    if (top <= 0) return { error: "First place needs a dollar amount." };
    if (top > pot) return { error: "First place is more than the " + BPL.money(pot) + " pot." };
    if (n === 1) {
      return top === pot
        ? { table: [pot] }
        : { error: "Paying one place means 1st takes the whole " + BPL.money(pot) + "." };
    }

    const rest = pot - top;
    if (rest <= 0) return { error: "Nothing left for the other " + (n - 1) + " places." };

    /* Shape the tail on the league's own curve for a field this deep, so
       2nd through last still slope the way they always have. */
    const curve = (Array.isArray(splitsOverride) && splitsOverride.length >= n)
      ? splitsOverride.slice(0, n)
      : BPL.splitsFor(n * 3);              // a tier deep enough to have n places
    const tail = (curve.length >= n ? curve : BPL.splitsFor(999)).slice(1, n);
    while (tail.length < n - 1) tail.push(tail[tail.length - 1] || 1);
    const tailSum = tail.reduce((a, b) => a + b, 0) || 1;

    const amounts = [top].concat(tail.map(w => BPL.round10(rest * w / tailSum)));
    const drift = pot - amounts.reduce((a, b) => a + b, 0);
    amounts[1] += drift;

    if (amounts.some(a => a <= 0)) {
      return { error: "That leaves a place on $0 — pay fewer places, or less to 1st." };
    }
    for (let i = 1; i < amounts.length; i++) {
      if (amounts[i] >= amounts[i - 1]) {
        return { error: BPL.ordinalOf(i + 1) + " would get as much as " + BPL.ordinalOf(i) +
                        ". Give 1st more, or pay fewer places." };
      }
    }
    return { table: amounts };
  },

  /* --------------------------------------------------------- HIGH HAND

     Ranked by category, best first. A home game does not want to type in
     five cards at 11pm, so the category is the ranking and the note is
     whatever they actually said ("quad 8s", "aces full"). Two royal
     flushes in a season are a genuine tie and are shown as one.
     --------------------------------------------------------------------- */
  HANDS: [
    { key: "royal",    label: "Royal flush" },
    { key: "sflush",   label: "Straight flush" },
    { key: "quads",    label: "Four of a kind" },
    { key: "boat",     label: "Full house" },
    { key: "flush",    label: "Flush" },
    { key: "straight", label: "Straight" },
    { key: "trips",    label: "Three of a kind" },
    { key: "twopair",  label: "Two pair" },
    { key: "pair",     label: "One pair" }
  ],

  handRank(key) {
    const i = BPL.HANDS.findIndex(h => h.key === key);
    return i === -1 ? 99 : i;                 // lower is better
  },

  handLabel(key) {
    const h = BPL.HANDS.find(x => x.key === key);
    return h ? h.label : "";
  },

  /**
   * The best hand of the season, and everyone tied for it.
   * Returns null until somebody records one.
   */
  highHand(results) {
    const all = [];
    BPL.gamesByDate(results).forEach(g => {
      const h = g.highHand;
      if (h && h.name && h.cat) all.push(Object.assign({ date: g.date }, h));
    });
    if (!all.length) return null;
    const best = Math.min.apply(null, all.map(h => BPL.handRank(h.cat)));
    const top = all.filter(h => BPL.handRank(h.cat) === best)
                   .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return { cat: top[0].cat, label: BPL.handLabel(top[0].cat), holders: top };
  },

  /** Knockout leaderboard, most first. Only games that recorded them count. */
  knockoutBoard(results) {
    const k = BPL.knockouts(results);
    return Object.keys(k)
      .map(n => ({ name: n, kills: k[n].kills, deaths: k[n].deaths }))
      .filter(r => r.kills > 0)
      .sort((a, b) => b.kills - a.kills || a.name.localeCompare(b.name));
  },

  /* ---------------------------------------------------------- KNOCKOUTS

     Who has busted whom, across every finalized game. Only rows that
     recorded a killer count — a night nobody tracked simply isn't in here,
     which is honest and keeps the numbers meaningful.
     --------------------------------------------------------------------- */
  knockouts(results) {
    const out = {};      // name -> { got: {victim:n}, gotBy: {killer:n}, kills, deaths }
    const touch = n => (out[n] = out[n] || { got: {}, gotBy: {}, kills: 0, deaths: 0 });

    BPL.gamesByDate(results).forEach(g => {
      const rows = Array.isArray(g.finish) ? g.finish
                 : Object.keys(g.finish || {}).map(k => g.finish[k]);
      rows.forEach(r => {
        if (!r || !r.outBy || r.outBy === r.name) return;
        const k = touch(r.outBy), v = touch(r.name);
        k.got[r.name] = (k.got[r.name] || 0) + 1;
        k.kills += 1;
        v.gotBy[r.outBy] = (v.gotBy[r.outBy] || 0) + 1;
        v.deaths += 1;
      });
    });
    return out;
  },

  /**
   * The one line worth printing on a player's card: whoever has taken them
   * out most. Needs at least two, because being busted by someone once is
   * not a rivalry, it is a Thursday.
   */
  nemesisOf(results, name) {
    const k = BPL.knockouts(results)[name];
    if (!k) return null;
    let best = null;
    Object.keys(k.gotBy).forEach(n => {
      if (!best || k.gotBy[n] > k.gotBy[best]) best = n;
    });
    return (best && k.gotBy[best] >= 2) ? { name: best, times: k.gotBy[best] } : null;
  },

  /** Head to head, both directions. */
  headToHead(results, a, b) {
    const k = BPL.knockouts(results);
    return {
      aGotB: ((k[a] || { got: {} }).got[b]) || 0,
      bGotA: ((k[b] || { got: {} }).got[a]) || 0
    };
  },

  ordinalOf(n) {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  },

  /**
   * Prize money by place for a given net pool. Every payout lands on a $10
   * note, with the remainder pushed into 1st so the table still sums to the
   * pot exactly. Returns an array indexed by (place - 1).
   *
   * Rounding to tens can push a small last paid place to $0, which would list
   * somebody as "in the money" for nothing — and now that cashing is worth
   * 100 points, a $0 cash would be worth points too. Those places are dropped
   * and their share rolls up, so every paid place is genuinely paid.
   */
  payoutTable(net, field, splitsOverride) {
    const splits = (Array.isArray(splitsOverride) && splitsOverride.length)
      ? splitsOverride : BPL.splitsFor(field || 1);
    const amounts = splits.map(p => BPL.round10(net * p / 100));
    while (amounts.length > 1 && amounts[amounts.length - 1] <= 0) amounts.pop();
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
  /**
   * What a finished row is worth, TODAY.
   *
   * Points are recomputed from the facts the record stores — the place, the
   * size of the field, and whether they got paid — rather than read back out
   * of the record. A game is a permanent record of what HAPPENED; what that
   * is worth is a league rule, and league rules change.
   *
   * Found on 5 Sep: the in-the-money bonus went live after a game was already
   * in the books, so the standings kept scoring that night under the old
   * formula. The comment in `points` above had claimed for weeks that
   * standings "recompute from history the moment it changes". They didn't.
   * Now they do, and switching a scoring rule on genuinely costs nothing.
   *
   * Falls back to the stored number only if the record is too old or too odd
   * to recompute from — better a stale point total than a zero.
   */
  scoreOf(game, row) {
    const field = Number(game && game.field);
    const place = Number(row && row.place);
    if (!isFinite(field) || !isFinite(place) || field < 1 || place < 1) {
      return Number(row && row.points) || 0;
    }
    const itm = row.itm !== undefined ? !!row.itm : (Number(row.winnings) || 0) > 0;
    return BPL.pointsFor(place, field, itm);
  },

  aggregate(results) {
    const byName = {};
    LEAGUE.standings.forEach(p => {
      byName[p.name] = Object.assign({}, p, {
        events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0,
        winnings: 0, rebuys: 0, _places: [], _eventPoints: [], _rawPoints: 0
      });
    });

    /* Firebase stores a finish list as an array when the keys happen to be
       0..n-1 and as an object otherwise. Accept both, or a real game quietly
       vanishes from the standings. */
    const rowsOf = g => Array.isArray(g.finish) ? g.finish
                      : (g.finish && typeof g.finish === "object" ? Object.keys(g.finish).map(k => g.finish[k]) : null);

    /* Only records that actually look like a finalized tournament are allowed
       to move the season table. Anything else in /results -- a stray write, a
       half-finished record, a leftover test row -- is ignored rather than
       silently corrupting everyone's points. */
    const isRealGame = g => {
      if (!g || typeof g !== "object") return false;
      if (typeof g.gameId !== "string" || typeof g.date !== "string") return false;
      if (typeof g.finalizedAt !== "number") return false;
      const rows = rowsOf(g);
      if (!rows || rows.length < 2) return false;
      return rows.every(r => r && typeof r.name === "string" && r.name &&
                             typeof r.place === "number" && r.place >= 1);
    };

    const skipped = Object.keys(results || {}).filter(k => !isRealGame(results[k]));
    if (skipped.length) console.warn("[BPL] ignoring non-game records in /results:", skipped);

    const games = Object.keys(results || {})
      .filter(k => isRealGame(results[k]))
      .map(k => results[k]);

    games.forEach(g => {
      rowsOf(g).forEach(r => {
        if (!byName[r.name]) {
          /* Played but not on the roster in data.js — still counts. */
          byName[r.name] = { name: r.name, fullName: r.name, avatar: "", saying: "",
            events: 0, points: 0, wins: 0, cashes: 0, avgPlace: 0,
            winnings: 0, rebuys: 0, _places: [], _eventPoints: [], _rawPoints: 0 };
        }
        const p = byName[r.name];
        p.events += 1;
        const pts = BPL.scoreOf(g, r);
        p._rawPoints += pts;
        p._eventPoints.push(pts);
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

  /**
   * Events still to come: not marked complete AND not already in the past.
   *
   * The date check matters more than the flag. Nobody remembers to tick
   * "completed" the morning after a game, and a past date sitting in the
   * "What's Coming" list is exactly the stale-site problem in miniature --
   * people plan around a night that already happened.
   */
  upcoming() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return LEAGUE.schedule.filter(e => {
      if (!e || !e.date || e.completed) return false;
      const [y, m, d] = e.date.split("-").map(Number);
      return new Date(y, m - 1, d) >= todayStart;
    });
  },

  /**
   * The banner to show, if any. An announcement past its `until` date is
   * gone whether or not anybody remembered to switch it off.
   */
  activeAnnouncement() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return LEAGUE.announcements.find(a => {
      if (!a || !a.active) return false;
      if (!a.until) return true;
      const [y, m, d] = String(a.until).split("-").map(Number);
      return new Date(y, m - 1, d) >= today;
    }) || null;
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
/* If the calendar has run out, say so loudly in the console. A schedule with
   no future date is not a code bug -- it is missing information -- and it is
   exactly how an app ends up advertising last month's game as "next". */
(function warnIfCalendarRanOut() {
  const g = BPL.currentGame();
  if (!g) { console.warn("[BPL] No games on the schedule at all."); return; }
  const [y, m, d] = g.date.split("-").map(Number);
  const now = new Date();
  if (new Date(y, m - 1, d) < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    console.warn("[BPL] The last scheduled game (" + g.date + ") has passed and nothing " +
                 "follows it. Add the next date to LEAGUE.schedule in data.js.");
  }
})();

(function autoRollActiveGame() {
  if (LEAGUE.nextGame.pinDate) return;
  const g = BPL.currentGame();
  if (!g) return;
  LEAGUE.nextGame.date  = g.date;
  LEAGUE.nextGame.label = g.label + (g.note ? " — " + g.note : "");
})();
