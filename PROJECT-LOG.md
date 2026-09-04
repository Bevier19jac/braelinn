# Braelinn Poker League — Project Log

**Live:** https://bevier19jac.github.io/braelinn/
**Last updated:** 2026-08-29

A running record of what this app is, what's been decided, what's still open,
and why things are built the way they are. Written so that a cold reader — or a
future chat with no memory of this one — can pick it up without archaeology.

---

## 1. What it is

A game-night tool for the Braelinn Poker League: RSVP, check-in, seat draw,
blind timer, live eliminations, and season standings. Season 7 begins
**Thursday, September 3, 2026**, cards at **8:30 PM**.

Built to survive a real game night — bad phone signal, a dead host phone,
someone arriving late, a misclicked elimination — not to look good in a demo.

## 2. Where everything lives

| Piece | Location |
|---|---|
| Site | `https://bevier19jac.github.io/braelinn/` |
| Repo | `github.com/Bevier19jac/braelinn` |
| Local clone | `C:\Users\bevie\source\repos\braelinn` (deliberately NOT in OneDrive) |
| Database | Firebase Realtime DB, project `braelinn`, all data under `/leagues/braelinn/` |
| Deploys | GitHub Actions (`.github/workflows/deploy.yml`) → GitHub Pages |

**Ardenlee (Tod's league) is a completely separate app**: different repo, different
Firebase project (`tod-admin-page`), different deployment. Nothing is shared.
Many of the same people play in both leagues. Do not touch Ardenlee.

## 3. How to deploy

1. Files are edited in the local clone.
2. GitHub Desktop → Commit to main → Push origin.

That's it. The workflow stamps every CSS/JS URL with the commit SHA on the way
out, so a phone cannot serve stale code. **Never hand-edit a version number.**

## 4. Confirmed league facts

- Buy-in **$30** → 7,000 chips
- Rebuy **$30** → 6,000 chips (same price, 1,000 fewer chips)
- On time by 8:30 → **+500 bonus chips**
- Start time **8:30 PM** always
- Blinds: 50/100 → 100/200 → 200/400 → 300/600 → **BREAK (last rebuy / add-on)**
- 20-minute levels
- 34 players on the roster
- Points: `(players outlasted + 1) × 300`
- Season kitty: **0%** (nothing withheld)

Blind levels past 300/600 are still guesses in `data.js`. So are payouts.

## 5. RULES STILL TO DECIDE

Not guessed at, not assumed, not encoded. Get these from Nate:

- [ ] **Season scoring policy** — cumulative, best-N, drop-worst? Currently cumulative.
- [ ] **How the Season Final counts** — multiplier, separate event, or same as any other?
- [ ] **Attendance threshold** for standings eligibility
- [ ] **Season kitty percentage** (currently 0)
- [ ] **Rebuy / add-on limits** per player
- [ ] **Blind levels past 300/600**
- [ ] **Payout percentages**

The scoring policy is a **one-line change** in `data.js` (`LEAGUE.seasonScoring`).
Raw results are never rewritten, so switching recomputes the whole season from
history. Deciding late costs nothing.

## 6. Open items

- [ ] Blind structure past level 4 — confirm with Nate
- [ ] `RULECHECK` row in `/leagues/braelinn/results` — harmless now (standings
      ignore it), delete from the Firebase console whenever
- [x] ~~Publish Firebase rules for chip counts~~ — done 2026-08-29, verified
      accepted while every guard still refuses bad writes
- [x] ~~Move the clone out of OneDrive~~ — done 2026-08-29, `fsck` clean after
- [x] ~~Host PIN changed from default 1234~~ — done 2026-08-20
- [x] ~~Pages switched to GitHub Actions~~ — done 2026-08-20

## 7. Design rules this app is held to

These came from explicit direction and should not be quietly dropped:

- **RSVP is not check-in.** Saying "in" doesn't seat you; the door does.
- **Player reports are never authoritative.** A player can say they busted; only
  the host confirms it.
- **No device owns the clock.** Blind level is derived from elapsed
  server-corrected time, so the timer survives the host's phone dying.
- **Never report success before Firebase acknowledges the write.**
- **No animation is ever responsible for game state.** Effects fire *after* the
  write lands, never instead of it.
- **Functionality outranks decoration**, always.
- **Don't turn an undecided league rule into a software assumption.** Mark it
  `RULE NEEDS CONFIRMATION` and leave it alone.

## 8. Known limits — stated plainly

**The host PIN is not security.** It lives in the browser, so anyone who opens
devtools can bypass it. Its real job is preventing accidents at the table, and
at that it works. This cannot be fixed on a static site with no accounts. See
`SECURITY.md`.

**`/results` is append-only.** A record written there can never be edited or
deleted by the app — that's deliberate, so a finalized game can't be quietly
rewritten. The consequence is that junk written there is permanent, which is why
standings now ignore anything that isn't a real finalized tournament.

---

## 9. Work log

### 4 Sep — Event 2 on the calendar, and the calendar stopped being two places

Next game is **Tuesday 15 September, 8:30**. Braelinn runs every other week,
Tuesday or Thursday, and the dates land as they land -- so the app has to cope
with a short calendar rather than nag about it.

- `schedule` gains Event 2. That is the ONLY place a date is now entered:
  `BPL.currentGame()` already overwrites `nextGame.date`/`label` on every load,
  so the comment telling people to "roll it forward after every game night"
  was inviting exactly the drift it warned about. Rewritten to say the field
  is a seed and editing it does nothing.
- `BPL.upcoming()` filtered on `completed` alone, so a night nobody remembered
  to tick stayed in "What's Coming" forever. It now drops past dates too.
- Three tests had the calendar typed into them, which meant every new game
  night broke a test and taught nobody anything. They now derive their cases
  FROM `schedule`: first date, last date, and -- the one that matters on a
  real season -- **the morning after a game must roll to the next one**, which
  could not even be expressed while the calendar held a single event.

Verified at a simulated 4 Sep: hero reads "Tuesday, September 15 - cards roll
at 8:30 PM - Event 2", countdown 11 days, Sep 3 gone from What's Coming.


### 30 Aug — Larry Stewart and Gregory James Lee joined the roster

Roster is 36. Adding a player is purely additive: RSVPs, check-ins and results
are all keyed by the SHORT name, so a new row cannot touch an existing answer.
The two things that could go wrong are a duplicate short name (two people
would share one RSVP) and a character Firebase forbids in a key. Both are now
checked by `edge-test.js` on every run rather than by eye.

- `Larry` / Larry Stewart, `Greg` / Gregory James Lee. Not marked `reg:true`,
  so they sit behind "+ more on the invite list" until they're regulars.
- `roster-add-test.js` proves it: both appear on the sign-in screen and are
  findable by full name, every one of the other 34 RSVPs already on file reads
  back byte-identical after the change, the new two start with no answer, and
  both can sign in, RSVP, play a night, and land in the standings.
- Two tests had "34" typed into them. Both now derive the number from the
  roster -- the same lesson as the game date, the cache-buster and the rules
  file: a number kept in two places drifts the day it matters.


### 30 Aug — breaking tables, the buy-in cutoff, and a full dress rehearsal

Jacob: *"i would like there to be an easy way to redraw seats when converging
to two from three or one from two"*, *"after 300/600 is the first break and
buyin cutoff"*, and *"i just want to make sure that people can easily rsvp and
me or nate can easily confirm and then draw seats at 830"*.

- **Consolidation is a first-class control now**, in Master Control -> Seating.
  It reads "18 still in across 3 tables - that's 6.0 a table, they fit on 2"
  and offers a button per table count, with the recommendation highlighted.
  `Game.idealTables()` = ceil(alive / 9): nine, not ten, because a table
  filled to exactly ten has to break again after the next bust.
- **It only ever offers FEWER tables than are running.** Tournaments break
  tables, they never split them, and offering "4 tables" to nine survivors is
  an invitation to a mistake at 1am.
- A redraw **re-shuffles** the survivors rather than shunting them, so a
  consolidation is as random as the opening draw. Chips, top-ups and the clock
  are untouched.
- The queue prompt now fires when it is actually time (survivors fit on fewer)
  rather than at an arbitrary five-a-table, and names the number.
- **The buy-in cutoff now holds against a mis-tap.** The break after 300/600
  already closed the window for players; the HOST could still add a top-up at
  level 8 by accident. `addRebuy` refuses past the break and the existing
  "Add it anyway?" override carries it through when Nate means it.
- `UI.tab(name)` replaced three unguarded `querySelector(...).click()` calls.
  One of them threw mid-seat-draw on a page where the drawer had not been
  opened - after the write, before the felt repainted.

**DRESS REHEARSAL — `dress-rehearsal.js`.** Forty complete game nights, every
step a real click on the real page: a player signs in and taps their RSVP,
Nate signs in with the passcode, checks everyone in, removes the no-shows,
adds a walk-in, draws the seats, starts the clock, takes top-ups, walks the
clock past the break, plays it out busting at random, breaks tables as the
field shrinks, and finalizes. After each night it re-checks that nobody was
lost or seated twice, no busted player kept a seat, places run 1..N, the field
size matches, and the season standings moved by exactly the points awarded.

    40 nights, fields of 8-28
    56 consolidations, 120 top-ups, 40 post-break top-ups blocked, 13 walk-ins
    ALL 40 NIGHTS, EVERY INVARIANT HELD - no page errors


### 29 Aug — the app opens on a sign-in screen

Jacob: *"i kind of like the idea of an login page and you just select your name
... then there isnt a whole list of names ... they will see their options for
yes no or maybe"* and *"they should be able to click on in for next and be able
to see a list of who is in"*.

- **`index.html` opens on a full-screen sign-in.** Search box, the whole roster
  as tappable rows, hosts tagged. One tap and you're in; the phone remembers.
- **Jacob and Nate get a second step**: their name, then the host passcode.
  Wrong passcode signs nobody in and says so. "Skip - just playing tonight"
  signs them in as a plain player; Unlock is still offered later on the card.
  The check waits on `Admin.ready`, because the real passcode arrives from
  Firebase a beat after the page does and checking early would have told Nate
  he typed it wrong.
- **RSVP is now YOUR card**: avatar, name, three buttons (I'm in / Maybe /
  I'm out), Clear my answer, and the Master Control button for hosts. One card,
  not two stacked ones both headed "Nate".
- **The thirty-four-name list is folded away** behind "Show everyone" - still
  there, because Jacob and Nate do answer for the guy who texted.
- **"In For Next" is a button.** Tap it for the head count: who's in, who's a
  maybe, who's out, with a tick against anyone already checked in.
- **The Table bounces a stranger** to `index.html?next=game` and drops them back
  on The Table once they've signed in. One sign-in screen for the whole app.
- Caught in test, not on game night: `display:grid` beat the `[hidden]`
  attribute, so the gate stayed invisible-but-clickable over the whole page and
  swallowed every tap. `.signin[hidden]{display:none}`.
- `identity-test.js` retired, replaced by `login-test.js` (45 checks). Seven
  other suites needed an identity seeded before their first `game.html` load -
  the redirect is doing exactly what it should.


### 2026-08-29 — Bird's-eye table, a real simulator, and housekeeping

**Bird's-eye view.** Tap a table and see it from above: seats orbiting an oval
felt in dealt order, seat 1 at the bottom centre so it matches where you are
sitting. Tap your seat to update your count. It is a view, not a source of
truth — same state, same guarded write, same permissions.

Found a real bug building it: `Game.subscribe()` had no unsubscribe, so the
overlay kept repainting after being closed, forever. Fixed, with a test.

**Game-night simulator** (`gamenight-sim.js`). Plays whole nights through the
real page in a real browser, with the chaos that will actually happen: the
host's phone reloading mid-tournament, the clock left running an hour, late
entry after players have busted, rebuys for someone already marked out,
double-tapped eliminations, silly chip counts, host locking controls mid-hand.
Invariants re-checked after every action. **40 nights, 1,276 chaos events, no
failures.**

Proven to bite by mutation testing — restoring the stale-`bustAt` rebuy bug,
leaking chip counts into the permanent record, and assigning places absolutely
at bust time were each deliberately reintroduced and each caught.

**Housekeeping.** Repo moved out of OneDrive (syncing a `.git` folder mid-write
can corrupt it). The minified rules file had drifted from the documented one —
it was missing the results `type` validator — so it is now generated by
`make-rules.py` and renamed `FIREBASE-RULES-PASTE-THIS.json`, because two files
differing by `.min` is a trap. Pasting the wrong one fails with the unhelpful
"expected 'rules' property".

*Recurring lesson, now three for three: two copies of anything drift. The game
date, the cache-buster, the rules file. Generate it or check it — never keep
two by hand.*

### 2026-08-27 — At The Table (live seats, photos, chip counts)

Asked for: the WSOP circuit-app experience — see who's at your table, set your
own avatar, update your chip stack during play.

**Decisions taken** (Jacob, 27 Aug):
- A player edits **only their own** count; the host can correct anyone.
- Everyone sees **all stacks, in chips and big blinds**.
- Players are prompted **at breaks only** — never mid-hand.

**The honest part.** These counts are hearsay. The WSOP app has tournament
staff entering numbers; a home game has eight people who will forget. So every
count is shown with who reported it and how long ago, anything untouched for 30
minutes greys out, and **nothing in the app reads them back** — places, payouts
and standings still come from buy-ins, rebuys and bust order. There is a test
that asserts changing a stack cannot move the pot, the finish order, or the
field size.

**Reconciliation.** The app knows exactly how many chips *should* be in play:
buy-ins × 7,000 + rebuys × 6,000 + on-time bonuses × 500. Once every active
player has reported, it compares that to the reported total and says plainly
when the numbers have gone fictional. Deliberately silent until everyone has
reported — a partial total tells you nothing.

Also replaced the old Seats chart rather than adding below it. Two charts of the
same eight names on one page is the duplication that made the home page
unreadable.

Rules published 29 Aug. Verified both ways: the chip-count write that used to
return 401 now returns 200, and negative counts, absurd counts, unknown keys,
invalid statuses and malformed results are all still refused.

### 2026-08-20 — Visual pass + two real bugs

Prompted by: "there is nothing dynamic or cool about it, it's actually quite boring."

Fair. The app was one hue on flat black, and every screen showed zeros because
the season hadn't started. Standings was 34 rows of `T1 · 0 0 0 0`. The home page
was 68 near-identical rows — the RSVP list of 34 names, then the roster of the
same 34 names.

**Visual**
- Hero rebuilt: full date as headline, countdown sized like it matters, buy-in
  and rebuy as actual chips. Cut a "cards roll at 8:30" line that appeared four
  times on one screen.
- Introduced card red and a felt weave. A poker app with no red was missing half
  of poker.
- Pre-season standings state replaces the wall of zeros.
- Roster collapsed. Page height 13,438px → 6,848px.

**Bug 1 — hand-edited cache-buster.** `?v=2` had to be bumped by hand. Same class
of bug as the old hand-edited game date. Deploys now stamp the commit SHA.

**Bug 2 — junk in `/results` corrupted standings.** Since that node is
append-only, a stray record can never be removed, so it had to be made inert.
Standings now validate records. Proven: without the guard, a junk row took a
player from 900 points to **120,900**. Same fix caught a second bug — Firebase
returns `finish` as an object when keys aren't 0..n-1, which was silently
dropping entire games.

**Infrastructure**
- `deploy.yml` was in the repo root, not `.github/workflows/` — it had never run.
- Pages source switched from branch deploy to GitHub Actions.
- `.gitattributes` added; a one-line change had been showing as a 5,687-line diff.
- Local clone wired up so files are written directly. No more zip-and-drag.
- Host PIN changed off the default.

### 2026-08-19 — Surgical pass: scoring made future-proof

Added `LEAGUE.seasonScoring` (cumulative / bestN / bestPercentage / dropWorst)
**without deciding Season 7's policy.** Fixed a misleading points description.
Honest tie handling — genuinely tied players share a rank (T1, T1, 3) rather than
being separated alphabetically. Finalized games record `type` so the Season Final
can be treated differently later.

Fixed a rebuy bug: rebuying left a stale `bustAt`, creating a phantom finishing
place. Regression test proven to fail before the fix and pass after.

### 2026-08-19 — The recurring stale-site problem

**"Why does that app keep making it through a game and then the next RSVP is a
stale site?"** Root cause: `nextGame.date` was hand-edited every week. Replaced
with a schedule-derived auto-roll. Verified across a simulated season.

*The lesson, which cost two separate bugs: any value a human has to remember to
change is a bug waiting to happen. Derive it or stamp it automatically.*

### 2026-08-19 — Polish: sharing, PWA, mobile

Share previews showed page-specific titles because there were zero Open Graph
tags. Home-screen icons failed because `apple-touch-icon.png` 404'd and one 512
icon was doing double duty as maskable (Android cropped it). Both fixed.

### Earlier — Reliability rework and first build

RSVP separated from check-in. Host-confirmed eliminations. Recoverable timer.
Derived finishing places (store `bustAt`, compute against final field size) so
late entry can't create duplicate places — caught by the stress test. "Finalize
Game" replaced the manual post-game file edit.

---

## 10. Testing

`stress-test.js` runs 50 randomized tournaments plus targeted edge cases:
field sizes 3–21, random rebuys, late entries, ties, junk records, object-shaped
finish lists. Run it before any push that touches scoring or game state:

```
node stress-test.js
```

Every invariant must hold. When fixing a bug, **prove the test catches it** by
temporarily restoring the broken code and watching it fail.
