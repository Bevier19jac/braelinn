# Braelinn — session state, 16 Sep 2026 (~3am, Event 2 still being played)

## Status: NOTHING PUSHED. NOTHING ON YOUR MACHINE EXCEPT `data.js` (Wes).

Code changes below live only in the cloud session. Deliberate — the game was
live and a GitHub Pages redeploy mid-tournament reloads everyone's phone.

---

## 1. DONE AND LIVE — three surgical writes to tonight's Firebase data

Applied ~11:13pm via the browser, verified by reading back.

| What | Before | After |
|---|---|---|
| `live/2026-09-15/players/Jacob/bustAt` | 10:32:26 PM (confirm time) | **10:31:35 PM** (his own report) |
| `live/2026-09-15/highHand` | none | **Erik V — quads, "quad 10s, ace kicker"** |
| `live/2026-09-15/reports/-P1c2XWggSy010tBGvGh` | stale, still queued | cleared |

Resulting bust order (15 in the field):

    15th Joe C 9:42:43 · 14th Chris F 9:52:45 · 13th Erik V 10:14:01
    12th Jacob 10:31:35 · 11th Chris P 10:31:51 · 10th Matt T 10:51:10

Jacob now finishes **12th**, Pettis **11th** — correct. Was 11th/12th.

---

## 2. THE BUG, NAMED

Finishing places derive from `bustAt`. `confirmOut` stamped `bustAt` at the
moment the **host confirmed**, not when the player said they were out. So:

    10:31:35  Jacob taps "I'm out"       -> report filed, nothing recorded
    10:31:51  Nate marks Pettis out      -> Pettis stamped
    10:32:26  Nate confirms Jacob        -> Jacob stamped, AFTER Pettis

The host was a middleman who could only make the timestamp wrong.

---

## 3. CODE WRITTEN + TESTED, NOT PUSHED

**`game-state.js`**
- `Game._bustPatch(name, at, said)` — one shared write; `at` is when they were
  actually out, never when the app got round to it.
- `Game.selfOut(name, killer)` — **out is out**, no confirmation. Clears any
  queued report for them. Credits the bounty in the same write.
- `Game.confirmOut()` — now stamps from the **report's** `at` when one exists.
  A slow host can no longer reorder the table on either path.

**`game.html`**
- Both "I'm out" buttons call `selfOut`. Copy changed — it used to promise
  "nothing is recorded until they confirm", which is now false.
- Removed the "waiting on the host" state; you get your place immediately.
- **Master control high-hand panel** (`#hhCard`): pick player -> pick hand ->
  optional note. Host entry always wins (force). Also a Clear button.
- Guard made re-runnable and live-aware (below).

**`index.html`**
- `stillBeingPlayed()` + `applyCalendarGuard()` now re-runs on live/results.
  A game running past midnight no longer makes the front page announce the
  season is over. Written because that is exactly what happened tonight.

**`styles.css`** — `.hhcard` / `.hh-head` / `.hh-t`, matching the bounty card.

**`data.js`** — Wes added (roster 38, `reg: true`). Already on your machine.

### Tests
- **`outisout-test.js`** (new) — replays 15 Sep exactly; proves the tap alone
  records the place, stamped before Pettis; report path uses report time;
  mis-tap still cheap via Reinstate; host high-hand entry works.
- **`calendar-test.js`** (new) — guard fires when the season runs out, does
  NOT fire mid-game, returns once finalized, and a written result beats
  stale live rows.
- **`knockout-test.js` / `selfserve-test.js`** — updated; they asserted the
  old "wait for Nate" rule.

**22 green / 5 red.** The 5 red (door, home, login, player-flow, roster-add)
are red *only because the calendar is empty*. Proven: adding a temporary
future event turned all 5 green; it was then removed.

---

## 4. DO THIS IN THIS ORDER

1. **Finalize Event 2 as normal.**
2. **Then** tell me the Event 3 date. **Not before.**
   `BPL.currentGame()` picks the first scheduled date >= today. Adding
   Event 3 while tonight is unfinalized repoints `nextGame.date`, so
   `game-state.js` would switch to `live/<Event 3>` — a blank night — and
   tonight's game vanishes from master control mid-tournament.
3. Then I deliver the code, you run `push.bat`, and the 5 tests go green.

Every other week, Tue or Thu -> Event 3 is ~Tue 29 Sep or Thu 1 Oct.
**I have not guessed. Tell me the date.**

## 5. STILL OUTSTANDING FROM BEFORE
- Firebase rules may predate `outBy` / `highHand` / report `by`.
  `FIREBASE-RULES-PASTE-THIS.json` in the repo is current.
- Two commits from the smoke-test work are local and unpushed.
- Wes has no surname on file.
