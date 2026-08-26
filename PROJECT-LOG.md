# Braelinn Poker League — Project Log

**Live:** https://bevier19jac.github.io/braelinn/
**Last updated:** 2026-08-20

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
| Local clone | `C:\Users\bevie\Desktop\braellin\braelinn` |
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
