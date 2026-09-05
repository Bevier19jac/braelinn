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

### 5 Sep — Matt McCoy on the roster

Roster is 37. Short name is **"Matt M"** — "Matt" alone would collide with Matt
Therriault, and the short name is the database key every RSVP, check-in and
result is filed under. Marked `reg: true`, so he sits in the default RSVP list
rather than behind "+ more on the invite list".

Also fixed while in there: the RSVP list showed regulars and anyone who had
answered, but NOT anyone who had actually played. Greg played on the 3rd and
was still hiding behind the "more" toggle. It now includes anyone with a
finished game, so "active" maintains itself.


### 5 Sep — knockouts, head-to-heads, and the story of the night

Jacob pushed back on the AI answer: *"so you dont think adding a layer of ai
would make the app fun in a way?"* He was right and I was wrong. I had answered
whether AI should RUN the tournament — it shouldn't, Nate has to audit every
number at 1am — and treated "fun" as the same question. It isn't. Fun is
exactly where a model belongs, because when it's wrong nothing breaks.

**Knockouts.** Confirming a bust now asks who did it — a picker of whoever is
still in, skippable, because a bust nobody saw clearly is still a bust and a
wrong name is worse than no name. It is the one fact the app can never derive,
and it is only knowable in the ten seconds after it happens.

The same answer credits the bounty when the busted player is carrying one, so
the host is never asked twice about one hand. `outBy` lands on the player and
on the permanent record; reinstating clears it.

**Head-to-heads.** `BPL.knockouts()` builds who-busted-whom across every
finalized game. The players page shows a nemesis ("Nemesis: Syd ×3") and who
you own — only at two or more, because being busted by somebody once is not a
rivalry, it's a Thursday. Results shows "out to <name>" under each finisher.

**The recap.** `LEAGUE.recaps`, keyed by date, rendered on each game in
Results. Written BETWEEN games from the finalized record, shipped as content
in the repo — a recap that fails has to fail on a Tuesday, not while twenty
people are waiting to be seated. No API key, no proxy, nothing new that can
break on game night. Event 1 is written; the 15th gets one after it's played.

The honest limit, worth saying: the Sept 3 recap could only say "Nate went out
first", because that night has no knockout data. From the 15th it can say who
busted whom, and it gets much better.

Firebase rules: `outBy` on a player and on a finish row. Needs republishing.

Tests: `knockout-test.js` — the question at the bust, skipping, the bounty
credited by the same answer, reinstating clearing it, the record carrying it,
head-to-heads, the players page, and the recap rendering. `dress-rehearsal.js`
now names a killer on ~80% of busts and checks no knockout ever names the
victim themselves or somebody who did not play.

Verified: 20 complete nights — 273 knockouts recorded, 14 bounties (now
credited by the same answer that records the bust), 30 self check-ins, 29
consolidations, money reconciled every night, no page errors.


### 5 Sep — the door, and the money the way Nate says it

Two asks from Jacob. Also asked about an AI layer; he pulled it himself —
*"if it makes it more confusing than never mind"* — so nothing was built. The
app stays deterministic.

**Self check-in.** RSVP is unchanged. On the night you tap "I'm here" and you
are in the field immediately — no host tap, no queue, because the queue is the
thing this replaces and Nate is counting chips at that moment. The entry
records `inBy`, so he can see which rows he did not make himself, and a
check-in after the clock has started is flagged late on its own.

**And the player says when they paid.** Jacob was explicit: *"instead of nate
try to figure out who paid once or twice the player should be able to do
that."* What you OWE is derived — buy-in plus any top-up, so a top-up puts you
back in debt automatically. What you have PAID is a number, stored as a TOTAL
rather than a delta, so a double-tap or a retry can never double-count. Nate
gets a board: collected vs owed, the short list of who hasn't paid, one tap to
settle anyone who handed over cash without touching their phone.

**Money in dollars, not percentages.** *"it would be nice if nate could just
say i want the kitty to be 120$, first place gets 200 and pay out to 4 people
and the rest could just be automated."* Three boxes in Master Control: kitty $,
1st gets $, places paid. Everything below 1st is derived — `BPL.payoutPlan`
shapes the tail on the league's own split curve, scales it to what's left,
rounds every place to $10, and pushes the drift into 2nd so the table sums to
the pot exactly. The percentage controls stay underneath as the fallback.

It REFUSES a plan it cannot pay honestly, and says which number to change:
"2nd would get as much as 1st", "that leaves a place on $0", "first place is
more than the pot". `setPrizePlan` validates against tonight's actual pot
before storing, and `finalize()` refuses rather than writing a table that
doesn't add up. A payout list that doesn't balance is worse than none.

Firebase rules: `paid`/`paidAt`/`paidBy`/`inBy` on a player, and
`kittyAmount`/`firstPrize`/`places` under config/money. Needs republishing.

Tests: `door-test.js` — self check-in, self-payment, a top-up re-opening the
debt, double-payment not double-counting, the host's owed board, the $120/$200/
four-places plan end to end, and the refusals. `dress-rehearsal.js` now sends
three players in through the door on alternate nights and reconciles
paid + outstanding = charged = gross after every night.

Verified: 20 complete nights — 30 self check-ins, 29 consolidations, 60
top-ups, 20 post-break attempts blocked, 13 bounties, money reconciled every
night, no page errors.


### 5 Sep — standings were still scoring an old game under the retired formula

Jacob, after the first real game night: *"at least the standings are wrong
cause those ITM should have an extra 100 points."* He was right, and it was my
mistake.

`finalize()` computes each row's points and writes the NUMBER into the
permanent record. `aggregate()` then summed those stored numbers. So the
in-the-money bonus, which went live after 3 Sep was already in the books,
could never reach that night — the standings kept scoring it under the formula
that existed when it was finalized.

Worse, the comment in `points` had been claiming for weeks that "standings
recompute from history the moment it changes -- raw results are never
rewritten, so switching it on later costs nothing." That was aspirational. It
described the design, not the code.

**Fix: `BPL.scoreOf(game, row)`.** Standings now recompute every row from the
facts the record stores — place, field size, and whether they cashed — under
TODAY's rules. A game record is a permanent statement of what HAPPENED; what
that is worth is a league rule, and league rules change. The record is never
rewritten; only the arithmetic over it moves. Falls back to the stored number
when a record is too old or odd to recompute from (no field size), because a
stale total beats a zero.

This makes the placeBonus switch, and any future scoring change, genuinely
retroactive and genuinely free — which is what the file had been promising.

Also fixed: four hard-coded point totals in `stress-test.js` that only passed
because the formula hadn't changed since they were typed. Same lesson as the
game date, the cache-buster, the rules file and the roster count — a number
kept in two places drifts the day it matters.


### 4 Sep — money rules: $10 rounding, the kitty line, the bounty, ITM points

Six rules from Jacob, all confirmed league policy.

**Rounding.** Payouts and the kitty both land on a $10 note (`BPL.round10`).
Rounding to tens can push a small last paid place to $0 — which would list
somebody as in the money for nothing, and now that cashing is worth points, a
$0 cash would be worth points too. Those places are dropped and their share
rolls up, so every paid place is genuinely paid. The remainder still goes to
1st, so the table sums to the pot exactly.

**In the money = +100 points.** Tied to CASHING, not to a place number — three
places pay some nights, six others, so a place-indexed bonus would be wrong
half the time. `BPL.pointsFor(place, field, itm)`. Checked across every field
from 2 to 40 that the bonus can never let a worse finish outscore a better one
(it can't: places are 300 apart).

**The bounty.** $20 off the top of the night's pot, riding on the last game's
winner. Whoever knocks them out takes it. Consecutive wins stack it — $40
back-to-back, $60 for three. Entirely DERIVED from the finalized results
(`BPL.bountyOn`): who the champion is and how long the streak runs are facts
about games already played, and a fact kept in two places drifts.

Three decisions worth writing down:

- **The one thing the app cannot derive is who knocked them out**, so it asks
  — once, at the moment it happens, with a picker of everyone who played. The
  action queue chases it, and `finalize()` REFUSES while a charged bounty is
  uncredited. Quietly writing the record would lose $20 of somebody's money.
- **If the champion doesn't turn up, nothing comes off the pot.** Caught by
  the rehearsal, not by reading: charging the room for a bounty nobody can
  win takes $20 off everyone's payout, hands it to no one, and then blocks
  finalizing forever because the target can never bust.
- **If the champion wins outright, they keep their own bounty.** Nobody
  knocked them out; there is nowhere else for it to go. Flagged to Jacob.

**Players can mark themselves out.** The top-up was already self-serve. "I'm
out" was NOT — it lived in `renderMe()`, which returns immediately because the
panel it draws into no longer exists on that page. A player had no way to
report busting at all. Now it is on their own seat sheet, below the chip count
and the top-up, and it still sends a REPORT the host confirms, so a mis-tap at
the table costs nobody a finishing place.

**The money is shown line by line** — Collected → season kitty → bounty →
playing for — in Master Control live and on each result. Printing only the
total is how a night ends in an argument.

Firebase rules: new `live/<id>/bounty` node and `bounty` on a finish row.
Needs republishing.

Tests: `money-test.js` (rounding across every field 2–40 × 4 rebuy counts × 5
kitty percentages, the ITM bonus, the streak), `bounty-test.js` (the whole arc
through the real page, including the champion winning outright and the
champion not turning up), `selfserve-test.js` (a player's own top-up and
bust). `stress-test.js` and `dress-rehearsal.js` gained money-balance checks
and had three hard-coded point formulas replaced.

Verified: 30 complete nights through the real UI — 39 consolidations, 90
top-ups, 30 post-break attempts blocked, 10 walk-ins, 18 bounties collected —
every invariant held, no page errors. Plus 400 simulated tournaments and 12
chaos nights.


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
