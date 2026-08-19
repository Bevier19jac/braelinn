# Braelinn Poker League — Setup

Everything is built. Three things stand between you and a live app:
**Firebase → GitHub → tell Nate the PIN.** About 20 minutes total.

The app already runs *right now* with no setup — just open `index.html`. It'll
show a yellow "local mode" banner because RSVPs stay in your browser instead of
syncing to everyone's phones. Firebase is what turns that on.

---

## 1 · Firebase (10 min) — this is the "keys" part

You need a **new, dedicated** Firebase project for this app — don't point it at
an existing one. Same Google account is fine; the free Spark tier covers this
easily.

### 1a. Create the project

1. Go to **https://console.firebase.google.com**
2. Click **Create a project** (or "Add project")
3. Name it: `braelinn-poker-league`
4. **Turn OFF Google Analytics** — you don't need it, and it adds steps
5. Click **Create project**, wait, then **Continue**

### 1b. Create the Realtime Database

> Careful: Firebase has *two* databases. You want **Realtime Database**, NOT
> "Firestore". The app will not work with Firestore.

1. Left sidebar → **Build** → **Realtime Database**
2. Click **Create Database**
3. Location: **United States (us-central1)**
4. Security rules: pick **Start in test mode** → **Enable**

### 1c. Set the rules

Test mode expires after 30 days and would silently break the app mid-season.
Fix it now.

1. In Realtime Database, click the **Rules** tab
2. Replace everything with exactly this:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

3. Click **Publish**

Better still: the full rules are in **`firebase-rules.json`** in this folder —
copy that file's contents instead of the snippet above. It adds append-only
protection for finalized results and shape validation on every path.
Read `SECURITY.md` for what those rules do and don't protect.

**What this means:** anyone with the database URL can read and write. That's
fine for a private league where the URL isn't posted publicly — but it does mean
the data isn't secret. Don't put anything in there you'd mind a stranger seeing.

### 1d. Register the web app and grab the config

1. Click the **⚙ gear** (top left, next to "Project Overview") → **Project settings**
2. Scroll down to **Your apps**
3. Click the **`</>`** (web) icon
4. App nickname: `Braelinn Web` — leave "Also set up Firebase Hosting" **unchecked**
5. Click **Register app**
6. You'll see a code block with `const firebaseConfig = { ... }` — **that's the keys**

### 1e. Paste it in

Open **`firebase-config.js`** in the Website folder. Replace the placeholder
values with the ones Firebase just showed you:

```javascript
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",
  authDomain:        "braelinn-poker-league.firebaseapp.com",
  databaseURL:       "https://braelinn-poker-league-default-rtdb.firebaseio.com",
  projectId:         "braelinn-poker-league",
  storageBucket:     "braelinn-poker-league.appspot.com",
  messagingSenderId: "1234567890",
  appId:             "1:1234567890:web:abc123"
};
```

**The one that matters most is `databaseURL`.** If Firebase's snippet doesn't
show a `databaseURL` line, copy it off the Realtime Database page — it's the
URL printed at the top of the data view.

> These keys ship to the browser and are **public by design**. They are not
> secrets and it's fine that they're in the repo. Security comes from the rules
> above, not from hiding these.

### 1f. Check it worked

Open `index.html`. The yellow banner should be gone, and the footer should read
**Sync: Firebase (live, all devices)**. Tap an RSVP chip, then refresh — if it
sticks, you're done here.

---

## 2 · The PIN — Nate's access

The PIN gates the seat draw on the home page and all host controls on Game Night.
**Nate is the host of this league, so the PIN is his.**

- The app writes a default PIN of **`1234`** to Firebase the first time it runs.
- Change it: Firebase Console → Realtime Database → **Data** tab → expand
  `adminSettings` → click the value next to `pin` → type the new one → Enter.
- Or change `DEFAULT_ADMIN_PIN` in `firebase-config.js` **before** first run.

Then text Nate the PIN and the site link. On his phone: unlock once and it stays
unlocked until he closes the tab.

**What Nate can do with it:**

| Where | Control |
|---|---|
| Home | Randomize seats, clear draw |
| Game Night → Host | Start / pause the clock, level up/down, +1 min, reset |
| Game Night → Host | **Redraw Seats** — reseats only players still alive |
| Game Night → Host | Load players from RSVP, mark anyone out, crown a winner |

You can hand the PIN to more than one person — there's only one PIN, no accounts.

---

## 3 · GitHub Pages (10 min)

1. Go to **https://github.com/new**
2. Repository name: **`braelinn`** (keeps the URL short enough to text people)
3. **Public** (Pages is free on public repos), no README, no .gitignore
4. Click **Create repository**

Then, in a terminal in the `Website` folder:

The repo is already initialized with a first commit, so you only need to
connect it and push:

```bash
git remote add origin https://github.com/Bevier19jac/braelinn.git
git push -u origin main
```

Then turn Pages on:

1. Repo → **Settings** → **Pages**
2. **Source:** select **GitHub Actions** (not "Deploy from a branch")
3. Wait ~60 seconds. Your URL: **https://bevier19jac.github.io/braelinn/**

After this, **double-click `push.bat`** any time you edit `data.js` — it commits
and pushes for you, and the site updates in about a minute.

### Optional — ElevenLabs voice

Only if you want spoken announcements. Repo → **Settings** → **Secrets and
variables** → **Actions** → **New repository secret** → name it `EL_KEY`, paste
your key. The workflow injects it at deploy time. Never commit the key itself.

---

## 4 · Weekly rhythm

Everything you touch week to week is in **`data.js`**.

**Before each game:**
- Roll `nextGame.date` forward to the next event date
- Update the `announcements` text

> The date in `nextGame.date` decides which Firebase node the RSVPs and seat
> draw read from (`rsvp_2026_09_03`, `seats_2026_09_03`, …). Rolling it forward
> gives you a clean slate automatically — last week's RSVPs don't carry over.

**After each game:**
- Fill in `lastGame` (winner, pot, results array)
- Bump each player's `events`, `points`, `wins`, `cashes`, `avgPlace`
- Set that event's `completed: true` in `schedule`

Then double-click `push.bat`.

### Game night order of operations

1. Everyone RSVPs on the home page (or Nate taps it for them)
2. Nate draws seats on the home page
3. Open **Game Night** → Host → **Load players from RSVP**
4. Host → **Start** the clock
5. As people bust, they tap **I'm Out** (or Nate marks them out)
6. At the break: Host → **Redraw Seats** — busted players are already excluded
7. Payouts tab → **Use live player count** → read off the numbers

---

## 5 · Still to confirm with Nate

**Confirmed and already in:**

- [x] $30 buy-in → 7,000 chips
- [x] $30 rebuy → 6,000 chips
- [x] 500 bonus chips for arriving on time
- [x] Blinds start 50/100, 20-minute levels
- [x] Cards roll at **8:30 PM**
- [x] Game 1 = Thursday, September 3

**Still open** — search `data.js` for `TODO`:

- [ ] **Season kitty.** Set to **0%** — the whole pot pays out tonight, nothing
      skimmed. If Braelinn does run a season-end championship pot, ask Nate what
      percentage and either change `kittyPct` in `data.js` or just type it into
      the Payouts tab on game night.
- [ ] **How deep the blind structure goes.** Levels 1–4 follow from what you
      confirmed. Levels 5+ — where antes kick in, where the levels shorten to
      15 min, and where the two breaks land — are still my guess.
- [ ] **Points formula.** Currently place × 300. Confirm that's how Braelinn
      actually scores.
- [ ] **Event 2 onward.** Only Game 1 is in. Add each date to the `schedule`
      array in `data.js` as they're set — there's a commented template right
      under Event 1 showing the exact line to copy. Until then the app just
      says "more dates coming" rather than inventing any.
- [ ] **Which of the 34 are Season 7 regulars.** I marked the 18 who were
      "Going" to the Season 6 Final — set `reg: true` / `false` to adjust.

> Note: the roster came off the **Season 6 Final** invite. That event's timing
> was specific to the final — regular league nights run 8:30, so none of the
> final's schedule details are in the app.

---

## 6 · Adding player photos

Drop 200×200 PNGs into the `avatars/` folder, then point each player at theirs
in `data.js`:

```javascript
{ name: "Nate", fullName: "Nate Woods", avatar: "avatars/nate.png", ... }
```

Leave `avatar: ""` and the app draws a colored initials disc instead — which
already looks fine, so this is purely optional.

---

## Files

| File | What it is |
|---|---|
| `index.html` | Home — hero, RSVP, seat draw, standings preview, roster |
| `game.html` | Game Night — blind timer, player tracker, payouts, host controls |
| `standings.html` | Full season table, sortable, plus last-game results |
| `schedule.html` | Season schedule, game details, blind structure |
| **`data.js`** | **The only file you edit week to week** |
| `firebase-config.js` | Your Firebase keys (paste them here) |
| `app-core.js` | Firebase wrapper, PIN gate, shared UI. Don't edit. |
| `styles.css` | All styling |
| `voice-config.js` | Placeholder; overwritten at deploy with the EL_KEY secret |
| `push.bat` | Double-click to publish |
