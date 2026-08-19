# Security review — Braelinn Poker League

You asked to be told plainly rather than reassured. Here it is.

---

## The headline

**The host PIN is not security. It is an accident guard.**

It is checked in JavaScript running on the player's own phone. Anyone who opens
their browser's developer tools can bypass it in about ten seconds. That is not
a bug in how it was written — it is the unavoidable consequence of a static site
with no accounts. There is nowhere to check a password that the user doesn't
control.

Two specific things make it weaker than it looks:

1. **The PIN was stored in the database in plaintext** at a world-readable path.
   Anyone who could reach the database could simply read it.
2. **The database URL ships inside your public GitHub repo**, in
   `firebase-config.js`. So the address isn't secret either.

With the original `".read": true, ".write": true` rules, that combination meant
anyone who found the repo could read every RSVP and overwrite any result.

## What that actually risks

Be proportionate about this. The realistic threat to a private poker league is
not a hacker. It's:

- someone's thumb hitting a button in their pocket
- a curious player poking at the app mid-game
- a browser tab left open on a page that writes on load
- an accidental double-tap wiping a result

Every one of those is now handled. A determined adversary who wants to vandalize
your league standings is not, and cannot be, under these constraints.

---

## What I changed

### 1. Players can no longer touch tournament state

This was the real vulnerability, and it had nothing to do with the PIN.

**Before:** tapping any row in the player list fired a confirm dialog and wrote
an elimination straight to the database — for *any* player, not just yourself.
`I Win` crowned a winner instantly, no host involvement.

**Now:** a player device can write exactly one thing — a row under `reports/`,
which is a note, not state. Finishing positions and the winner change only when
the host confirms. A mis-tap costs nothing and is dismissed with one button.

This is the single biggest improvement in the whole pass, and it holds even
though the PIN is bypassable — because the *app* simply never offers a player a
path to authoritative state.

### 2. Finalized results are append-only — enforced by the server

```json
".write": "!data.exists() && newData.exists()"
```

A finalized game can be created once and then **never edited or deleted** through
the app. Firebase enforces this on its own servers; no amount of devtools
fiddling gets around it. Since the season standings derive entirely from these
records, protecting them protects the season.

To correct a genuinely wrong result you edit it by hand in the Firebase Console.
Deliberately awkward — that's the point.

### 3. Shape validation everywhere

Every writable path now validates types and ranges. An RSVP must be exactly
`in`, `maybe`, or `out`. Rebuys must be a number from 0 to 20. Unknown fields are
rejected outright. This stops malformed writes from corrupting a live game,
which is a far more likely failure than malice.

### 4. Scoped to this league

Everything lives under `/leagues/braelinn/`. Nothing outside that subtree is
readable or writable at all — the root rules are `false`. Another league in the
same Firebase project is structurally unable to collide with this one.

### 5. The PIN is validated, not trusted

The rules require the PIN to be a 4–12 character string, so it can't be blanked
or replaced with junk. That's the limit of what's enforceable.

---

## Recommended: turn on Anonymous Authentication

Ten seconds of setup, invisible to players, no signup, no accounts.

1. Firebase Console → **Build** → **Authentication** → **Get started**
2. **Sign-in method** → **Anonymous** → Enable → Save

Then in `firebase-rules.json`, change the league's read/write lines from `true`
to `"auth != null"` and republish.

**What this buys you:** random internet traffic that stumbles across your
database URL can no longer read or write anything.

**What it does not buy you:** it still cannot tell your players apart from each
other, or from the host. It raises the floor; it does not solve the problem.

---

## The limitation I cannot solve

**Under a static site with no accounts, host-only writes cannot be enforced.**

Real enforcement needs a secret the client never sees, checked somewhere the
user doesn't control. The options all break one of your constraints:

| Approach | Why it's out |
|---|---|
| Cloud Functions verify the PIN | Requires the paid Blaze plan |
| Firebase Auth with real accounts | You explicitly ruled out accounts |
| Custom claims on an auth token | Needs a server to mint tokens |
| Hash the PIN in the rules | The hash is world-readable too — pure obfuscation |

I'd rather say this outright than ship something that feels safe and isn't.

**My honest read:** for a private league among people who know each other, the
current setup is proportionate. The things that would actually have hurt you —
players corrupting live state, and results being overwritten — are now genuinely
fixed. If Braelinn ever needs real access control, the honest answer is that it
needs a backend, and that's a different project.

---

## Do this now

- [ ] Publish `firebase-rules.json` (Console → Realtime Database → Rules)
- [ ] **Change the PIN from `1234`.** Config → Realtime Database → Data →
      `leagues/braelinn/config/pin`
- [ ] Turn on Anonymous Auth and flip the read/write lines to `"auth != null"`
- [ ] Don't post the site URL anywhere public — it's the only thing keeping
      strangers away from the database

## Do NOT do this

- Don't put anything genuinely sensitive in the database — real names beyond
  what's already there, phone numbers, addresses, payment details. Assume
  everything in there is readable by anyone who finds the URL.
- Don't reuse the PIN anywhere else. It's a door code for a poker game, and it
  is stored in a place people can read.
