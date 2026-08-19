/* ============================================================================
   FX — Braelinn's poker visual language
   ----------------------------------------------------------------------------
   Suits, chips, card backs, deal animations, winner reveals.

   THE RULE THIS FILE OBEYS
   ------------------------
   Nothing in here is ever responsible for game state. Every effect is called
   AFTER Firebase has acknowledged a write, is fire-and-forget, and cannot
   delay or block a host action. If every function here threw, the tournament
   would still run correctly — you'd just have a plainer-looking app.

   Everything is hand-drawn SVG built from the same CSS custom properties as
   the rest of the app, so it's a few KB total, stays crisp on any screen, and
   recolours with the theme instead of drifting out of sync with it.
   ========================================================================== */

(function () {
  "use strict";

  const REDUCED = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const BRASS = "#d9ab52", BRASS_HI = "#f0c979", INK = "#0a1c14";

  /* ------------------------------------------------------------------ *
   * SUITS                                                               *
   * ------------------------------------------------------------------ */
  const SUIT_PATHS = {
    spade: "M12 2C12 2 4 8.5 4 13.2 4 16 6 17.8 8.3 17.8c1.2 0 2.2-.5 2.9-1.3-.2 2-.9 3.6-2.2 4.5h6c-1.3-.9-2-2.5-2.2-4.5.7.8 1.7 1.3 2.9 1.3C18 17.8 20 16 20 13.2 20 8.5 12 2 12 2z",
    heart: "M12 21s-8-5.2-8-10.4C4 7.6 6.2 5.5 8.9 5.5c1.5 0 2.5.7 3.1 1.6.6-.9 1.6-1.6 3.1-1.6 2.7 0 4.9 2.1 4.9 5.1C20 15.8 12 21 12 21z",
    diamond: "M12 2l7 10-7 10-7-10z",
    club: "M12 2.5a3.6 3.6 0 00-2.6 6.1A3.6 3.6 0 105.9 15c.9 0 1.7-.3 2.3-.9-.2 2.9-1 5.2-2.4 6.4h12.4c-1.4-1.2-2.2-3.5-2.4-6.4.6.6 1.4.9 2.3.9a3.6 3.6 0 10-3.5-6.4A3.6 3.6 0 0012 2.5z"
  };

  const SUITS = ["spade", "heart", "diamond", "club"];

  function suit(name, cls) {
    return '<svg class="suit ' + (cls || "") + ' suit-' + name + '" viewBox="0 0 24 24" ' +
      'aria-hidden="true"><path d="' + SUIT_PATHS[name] + '"/></svg>';
  }

  /** Deterministic suit for a name, so a player always gets the same one. */
  function suitFor(str) {
    let h = 0;
    for (let i = 0; i < (str || "").length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return SUITS[Math.abs(h) % 4];
  }

  /* ------------------------------------------------------------------ *
   * CARD BACK — the house pattern. Art-deco lattice, brass on near-black.
   * Drawn once, reused everywhere as an SVG data URI.                   *
   * ------------------------------------------------------------------ */
  function cardBackSvg() {
    let lattice = "";
    for (let i = -6; i <= 14; i++) {
      lattice += '<path d="M' + (i * 14) + ' 0 L' + (i * 14 + 120) + ' 168" />' +
                 '<path d="M' + (i * 14) + ' 168 L' + (i * 14 + 120) + ' 0" />';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 168" width="120" height="168">' +
      '<defs><clipPath id="c"><rect x="0" y="0" width="120" height="168" rx="9"/></clipPath></defs>' +
      '<rect width="120" height="168" rx="9" fill="#08170f"/>' +
      '<g clip-path="url(#c)" stroke="' + BRASS + '" stroke-width="0.6" opacity="0.28" fill="none">' +
      lattice + '</g>' +
      '<rect x="5.5" y="5.5" width="109" height="157" rx="6" fill="none" stroke="' + BRASS + '" stroke-width="1.2" opacity="0.85"/>' +
      '<rect x="9" y="9" width="102" height="150" rx="4" fill="none" stroke="' + BRASS + '" stroke-width="0.5" opacity="0.5"/>' +
      '<g transform="translate(60 84)">' +
      '<path d="M0 -30 L22 0 L0 30 L-22 0 Z" fill="#08170f" stroke="' + BRASS + '" stroke-width="1.2"/>' +
      '<path d="M0 -21 L15 0 L0 21 L-15 0 Z" fill="none" stroke="' + BRASS + '" stroke-width="0.5" opacity="0.6"/>' +
      '<g transform="translate(-7 -7) scale(0.58)" fill="' + BRASS_HI + '">' +
      '<path d="' + SUIT_PATHS.spade + '"/></g></g>' +
      '</svg>';
  }

  const CARD_BACK_URI = "data:image/svg+xml;base64," + btoa(cardBackSvg());

  /* ------------------------------------------------------------------ *
   * CHIP — used for RSVP states, counts, the pot.                       *
   * ------------------------------------------------------------------ */
  function chipSvg(color, glyph) {
    let notches = "";
    for (let i = 0; i < 8; i++) {
      notches += '<rect x="30" y="1.5" width="8" height="9" rx="1.5" fill="' + color +
        '" transform="rotate(' + (i * 45) + ' 34 34)"/>';
    }
    return '<svg viewBox="0 0 68 68" class="chipimg" aria-hidden="true">' +
      '<circle cx="34" cy="34" r="32.5" fill="#0c1f16" stroke="' + color + '" stroke-width="2"/>' +
      notches +
      '<circle cx="34" cy="34" r="23" fill="none" stroke="' + color + '" stroke-width="1" opacity=".55"/>' +
      '<circle cx="34" cy="34" r="19" fill="' + color + '" opacity=".13"/>' +
      (glyph ? '<g transform="translate(22 22) scale(1)" fill="' + color + '">' +
        '<path d="' + SUIT_PATHS[glyph] + '"/></g>' : "") +
      '</svg>';
  }

  /* ------------------------------------------------------------------ *
   * EFFECTS                                                             *
   * ------------------------------------------------------------------ */

  /** Quick press feedback — scale + ripple. Costs nothing, reads instantly. */
  function press(el) {
    if (!el || REDUCED) return;
    el.classList.remove("fx-press");
    void el.offsetWidth;
    el.classList.add("fx-press");
  }

  /** Flash a container when live data changed underneath the user. */
  function ping(el) {
    if (!el || REDUCED) return;
    el.classList.remove("fx-ping");
    void el.offsetWidth;
    el.classList.add("fx-ping");
    setTimeout(() => el.classList.remove("fx-ping"), 900);
  }

  /**
   * Seat draw. Deals face-down cards across the table, then flips each to
   * reveal a name. Purely presentational — the seating data is already
   * written and correct before this is ever called.
   */
  function dealSeats(container, onDone) {
    if (!container) { if (onDone) onDone(); return; }
    if (REDUCED) { if (onDone) onDone(); return; }

    const seats = Array.from(container.querySelectorAll(".seat"));
    if (!seats.length) { if (onDone) onDone(); return; }

    seats.forEach((s, i) => {
      s.classList.add("fx-dealt");
      s.style.setProperty("--d", (i * 55) + "ms");
    });
    setTimeout(() => {
      seats.forEach(s => { s.classList.remove("fx-dealt"); s.style.removeProperty("--d"); });
      if (onDone) onDone();
    }, 400 + seats.length * 55);
  }

  /** A shuffling overlay while the draw resolves. Short by design. */
  function shuffle(ms) {
    if (REDUCED) return Promise.resolve();
    return new Promise(resolve => {
      const el = document.createElement("div");
      el.className = "fx-shuffle";
      el.innerHTML = '<div class="fx-deck">' +
        [0, 1, 2, 3, 4].map(i =>
          '<img class="fx-card" style="--i:' + i + '" src="' + CARD_BACK_URI + '" alt="">').join("") +
        '</div><p>Shuffling up…</p>';
      document.body.appendChild(el);
      setTimeout(() => { el.classList.add("out"); setTimeout(() => { el.remove(); resolve(); }, 220); }, ms || 900);
    });
  }

  /**
   * Elimination acknowledgment. Deliberately understated — busting out is
   * already a bad moment; this marks progress, it doesn't gloat.
   */
  function eliminated(name, place) {
    const el = document.createElement("div");
    el.className = "fx-bust";
    el.innerHTML = suit(suitFor(name), "big") +
      '<span><strong>' + escapeHtml(name) + '</strong>' +
      '<small>' + (place ? ordinal(place) + " place" : "out") + '</small></span>';
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("in"));
    setTimeout(() => { el.classList.remove("in"); setTimeout(() => el.remove(), 320); }, 2100);
  }

  /** Blind level change — a clear, brief signal that the game just got harder. */
  function levelUp(text, isBreak) {
    const el = document.createElement("div");
    el.className = "fx-level" + (isBreak ? " brk" : "");
    el.innerHTML = '<span class="lab">' + (isBreak ? "Break" : "Blinds Up") + '</span>' +
      '<span class="val">' + escapeHtml(text) + '</span>';
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("in"));
    setTimeout(() => { el.classList.remove("in"); setTimeout(() => el.remove(), 400); }, 2600);
  }

  /**
   * Winner reveal. The one moment worth being loud about. Suits rain, the
   * name lands, the numbers settle. Tap or wait — it dismisses either way,
   * and the result was already saved before this appeared.
   */
  function winner(record) {
    const el = document.createElement("div");
    el.className = "fx-win";

    let confetti = "";
    if (!REDUCED) {
      for (let i = 0; i < 28; i++) {
        const s = SUITS[i % 4];
        confetti += '<i class="fx-conf" style="--x:' + (Math.random() * 100).toFixed(1) +
          '%;--dl:' + (Math.random() * 900).toFixed(0) + 'ms;--rt:' +
          (Math.random() * 720 - 360).toFixed(0) + 'deg;--dur:' +
          (2200 + Math.random() * 1600).toFixed(0) + 'ms">' + suit(s) + '</i>';
      }
    }

    el.innerHTML = confetti +
      '<div class="fx-wincard">' +
      '<div class="fx-winsuits">' + SUITS.map(s => suit(s)).join("") + '</div>' +
      '<p class="fx-winlab">Winner</p>' +
      '<h2>' + escapeHtml(record.winner) + '</h2>' +
      '<p class="fx-winleague">' + escapeHtml(LEAGUE.name) + ' · Season ' + record.season + '</p>' +
      '<div class="fx-winstats">' +
        '<div><span>' + BPL.money(record.pot) + '</span><small>Pot</small></div>' +
        '<div><span>' + record.field + '</span><small>Players</small></div>' +
        '<div><span>' + BPL.chips((record.finish[0] || {}).points || 0) + '</span><small>Points</small></div>' +
      '</div>' +
      '<button class="btn btn-primary btn-block mt">Done</button>' +
      '</div>';

    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("in"));

    const close = () => { el.classList.remove("in"); setTimeout(() => el.remove(), 340); };
    el.querySelector("button").onclick = close;
    el.onclick = e => { if (e.target === el) close(); };
    setTimeout(close, 9000);
  }

  /* ------------------------------------------------------------------ *
   * HELPERS                                                             *
   * ------------------------------------------------------------------ */
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /** Global press feedback for anything tappable. One listener, whole app. */
  document.addEventListener("pointerdown", e => {
    const t = e.target.closest(".btn, .chip, .pickrow, .trk-row, .pcard, .nav-links a");
    if (t) press(t);
  }, { passive: true });

  window.FX = {
    suit: suit,
    suitFor: suitFor,
    suits: SUITS,
    chip: chipSvg,
    cardBack: CARD_BACK_URI,
    press: press,
    ping: ping,
    shuffle: shuffle,
    dealSeats: dealSeats,
    eliminated: eliminated,
    levelUp: levelUp,
    winner: winner,
    reduced: REDUCED
  };
})();
