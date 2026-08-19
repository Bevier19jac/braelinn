# Future ideas — parked, not built

Things worth considering later. Nothing here is implemented, and none of it
should be built without deciding it's actually worth the complexity.

## League rules — for you and Nate, not for me

- **Season scoring.** Raw cumulative points reward attendance as much as skill.
  With 18 regulars from a 34-name list, someone who plays every night will beat
  someone who plays half and finishes better. Common fixes: best-N-of-M, drop
  worst result, attendance threshold to qualify for the final. **Deliberately
  not implemented** — it's a league rule, and it's much easier to set in August
  than to change in January.
- **Championship qualification.** How the season final is seeded.

## App features

- **Push notification when the seat draw lands.** Web Push works on modern
  phones without a backend for the simple case, but iOS requires the site to be
  installed to the home screen first. Moderate effort, real payoff on game night.
- **"Where do I sit?" quick view.** Player taps their name, gets table and seat
  in big type. Cheap; useful in a loud room.
- **Chip-count tracking.** Live stack sizes per player. Sounds great, is a lot
  of host data entry, and usually gets abandoned by week three. Only worth it if
  Nate actually wants to do it.
- **Season-long money ledger.** Who's up, who's down, across all games. Easy now
  that finalized results carry buy-ins, rebuys and winnings.
- **Head-to-head records.** Who busts whom. Would need the host to record the
  eliminator at bust time — one extra tap per elimination.
- **Export a season to CSV.** Trivial from the finalized results.

## Deliberately not recommended

- **Player accounts / real auth.** Breaks the "no accounts" constraint and adds
  a login step before every poker night. The shared PIN is the right call here.
- **Chat.** The players are in the same room.
- **Achievements and badges.** Fun for a week, clutter forever.
- **Live AI generation at runtime.** Poker night must not depend on an external
  service being up. Generate assets ahead of time or not at all.
