/* ============================================================================
   APP CORE — Braelinn Poker League
   ----------------------------------------------------------------------------
   Firebase Realtime Database wrapper + shared UI. Three things live here that
   the rest of the app depends on:

     1. LEAGUE SCOPING. Every path is written under /leagues/braelinn/... so a
        second league in the same Firebase project can never collide. (You
        should still give Braelinn its own project — this is belt-and-braces.)

     2. SERVER TIME. Phones disagree about what time it is, sometimes by
        minutes. Anything time-sensitive uses DB.now(), which is the local
        clock corrected by Firebase's own server-time offset, so every device
        computes the same answer.

     3. ACKNOWLEDGED WRITES. DB.save() does not resolve until Firebase has
        actually confirmed the write. Consequential actions use it so we never
        tell someone "done" when nothing was saved.

   If firebase-config.js still has PASTE_ placeholders the app falls back to
   LOCAL MODE: a localStorage store that syncs between tabs on one browser.
   Everything works, nothing leaves the device, and a banner says so.
   ========================================================================== */

(function () {
  "use strict";

  const LEAGUE_ID = "braelinn";
  const ROOT = "leagues/" + LEAGUE_ID;

  const CONFIGURED =
    typeof FIREBASE_CONFIG !== "undefined" &&
    FIREBASE_CONFIG.databaseURL &&
    FIREBASE_CONFIG.databaseURL.indexOf("PASTE_") === -1;

  /* ------------------------------------------------------------------ *
   * LOCAL MODE STORE                                                    *
   * ------------------------------------------------------------------ */
  const Local = {
    KEY: "bpl_local_db",
    listeners: {},
    channel: null,

    init() {
      try {
        this.channel = new BroadcastChannel("bpl_local_db");
        this.channel.onmessage = e => this._fire(e.data.path);
      } catch (_) {}
      window.addEventListener("storage", e => {
        if (e.key === this.KEY) Object.keys(this.listeners).forEach(p => this._fire(p));
      });
    },

    _all() {
      try { return JSON.parse(localStorage.getItem(this.KEY) || "{}"); }
      catch (_) { return {}; }
    },
    _save(o) { try { localStorage.setItem(this.KEY, JSON.stringify(o)); } catch (_) {} },

    _walk(obj, path, create) {
      const parts = path.split("/").filter(Boolean);
      let cur = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) {
          if (!create) return { parent: null, key: null };
          cur[parts[i]] = {};
        }
        cur = cur[parts[i]];
      }
      return { parent: cur, key: parts[parts.length - 1] };
    },

    get(path) {
      const { parent, key } = this._walk(this._all(), path, false);
      if (!parent) return null;
      return parent[key] === undefined ? null : parent[key];
    },

    set(path, value) {
      const all = this._all();
      const { parent, key } = this._walk(all, path, true);
      if (value === null) delete parent[key]; else parent[key] = value;
      this._save(all);
      this._broadcast(path);
    },

    update(path, patch) {
      const cur = this.get(path);
      const next = Object.assign({}, (cur && typeof cur === "object") ? cur : {}, patch);
      Object.keys(next).forEach(k => { if (next[k] === null) delete next[k]; });
      this.set(path, next);
    },

    push(path, value) {
      const id = "L" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
      this.set(path + "/" + id, value);
      return id;
    },

    on(path, cb) {
      (this.listeners[path] = this.listeners[path] || []).push(cb);
      cb(this.get(path));
    },

    _broadcast(path) {
      Object.keys(this.listeners).forEach(p => {
        if (p === path || path.indexOf(p + "/") === 0 || p.indexOf(path + "/") === 0) this._fire(p);
      });
      if (this.channel) { try { this.channel.postMessage({ path }); } catch (_) {} }
    },

    _fire(path) {
      const v = this.get(path);
      (this.listeners[path] || []).forEach(cb => { try { cb(v); } catch (e) { console.error(e); } });
    }
  };

  /* ------------------------------------------------------------------ *
   * DB                                                                  *
   * ------------------------------------------------------------------ */
  let db = null;
  let timeOffset = 0;      // ms to add to Date.now() to get server time
  let connected = true;    // local mode is always "connected"

  const connListeners = [];

  const DB = {
    mode: CONFIGURED ? "firebase" : "local",
    leagueId: LEAGUE_ID,

    /** Scope a relative path under this league. Absolute paths (starting ".")
        such as ".info/connected" are passed through untouched. */
    path(rel) {
      if (!rel) return ROOT;
      if (rel.charAt(0) === ".") return rel;
      return ROOT + "/" + rel.replace(/^\/+/, "");
    },

    init() {
      if (CONFIGURED) {
        try {
          firebase.initializeApp(FIREBASE_CONFIG);
          db = firebase.database();

          db.ref(".info/serverTimeOffset").on("value", s => {
            timeOffset = Number(s.val()) || 0;
          });

          db.ref(".info/connected").on("value", s => {
            const was = connected;
            connected = !!s.val();
            if (was !== connected) connListeners.forEach(f => f(connected));
          });
        } catch (e) {
          console.error("Firebase init failed — falling back to local mode:", e);
          DB.mode = "local";
          Local.init();
        }
      } else {
        Local.init();
      }
      return DB.mode;
    },

    /** Server-corrected timestamp. Use this for ANYTHING time-sensitive. */
    now() { return Date.now() + timeOffset; },

    isConnected() { return DB.mode === "local" ? true : connected; },
    onConnection(cb) { connListeners.push(cb); cb(DB.isConnected()); },

    on(rel, cb) {
      const p = DB.path(rel);
      if (DB.mode === "firebase") db.ref(p).on("value", s => cb(s.val()));
      else Local.on(p, cb);
    },

    get(rel) {
      const p = DB.path(rel);
      if (DB.mode === "firebase") return db.ref(p).once("value").then(s => s.val());
      return Promise.resolve(Local.get(p));
    },

    set(rel, value) {
      const p = DB.path(rel);
      if (DB.mode === "firebase") return db.ref(p).set(value);
      Local.set(p, value);
      return Promise.resolve();
    },

    update(rel, patch) {
      const p = DB.path(rel);
      if (DB.mode === "firebase") return db.ref(p).update(patch);
      Local.update(p, patch);
      return Promise.resolve();
    },

    /** Multi-path atomic update. Keys are league-relative paths. */
    multi(map) {
      const out = {};
      Object.keys(map).forEach(k => { out[DB.path(k)] = map[k]; });
      if (DB.mode === "firebase") return firebase.database().ref().update(out);
      Object.keys(map).forEach(k => Local.set(DB.path(k), map[k]));
      return Promise.resolve();
    },

    push(rel, value) {
      const p = DB.path(rel);
      if (DB.mode === "firebase") {
        const ref = db.ref(p).push();
        return ref.set(value).then(() => ref.key);
      }
      return Promise.resolve(Local.push(p, value));
    },

    /**
     * Consequential write. Shows "Saving…", resolves only once Firebase has
     * acknowledged, then shows "✓ Saved". Rejects (and says so) on failure.
     * Use this for anything that would hurt to silently lose.
     */
    save(label, work) {
      UI.saveState("saving", label);
      if (!DB.isConnected()) {
        UI.saveState("offline", label);
        UI.toast("Offline — " + label + " not saved. It'll go through when you reconnect.", "bad");
      }
      const p = (typeof work === "function") ? work() : work;
      return Promise.resolve(p).then(
        r => { UI.saveState("saved", label); return r; },
        e => {
          UI.saveState("error", label);
          UI.toast("Couldn't save: " + label, "bad");
          console.error(e);
          throw e;
        }
      );
    }
  };

  /* ------------------------------------------------------------------ *
   * ADMIN PIN                                                           *
   *                                                                     *
   * Read SECURITY.md before trusting this. Short version: the PIN stops *
   * accidents at a poker table. It is NOT protection against anyone who *
   * opens devtools, and it cannot be under a static site with no        *
   * accounts. Its job is preventing mistakes, and at that it works.     *
   * ------------------------------------------------------------------ */
  const Admin = {
    SESSION_KEY: "bpl_admin_ok",
    pin: (typeof DEFAULT_ADMIN_PIN !== "undefined" ? DEFAULT_ADMIN_PIN : "1234"),

    watch() {
      DB.on("config/pin", val => {
        if (val) Admin.pin = String(val);
        else DB.set("config/pin", Admin.pin);
      });
    },

    isUnlocked() { return sessionStorage.getItem(Admin.SESSION_KEY) === "1"; },

    unlock(entered) {
      const ok = String(entered).trim() === String(Admin.pin).trim();
      if (ok) {
        sessionStorage.setItem(Admin.SESSION_KEY, "1");
        window.dispatchEvent(new Event("bpl:adminchange"));
      }
      return ok;
    },

    lock() {
      sessionStorage.removeItem(Admin.SESSION_KEY);
      window.dispatchEvent(new Event("bpl:adminchange"));
    },

    require() {
      if (Admin.isUnlocked()) return true;
      const entered = window.prompt("Enter PIN:");
      if (entered === null) return false;
      if (Admin.unlock(entered)) { UI.toast("Host controls unlocked", "ok"); return true; }
      UI.toast("Wrong PIN", "bad");
      return false;
    }
  };

  /* ------------------------------------------------------------------ *
   * SHARED UI                                                           *
   * ------------------------------------------------------------------ */
  const UI = {
    nav(active) {
      const links = [
        { href: "index.html",     label: "Tonight",   icon: "♠" },
        { href: "game.html",      label: "The Table", icon: "⏱" },
        { href: "standings.html", label: "The Chase", icon: "🏆" },
        { href: "schedule.html",  label: "Calendar",  icon: "🗓" }
      ];
      return '<nav class="nav">' +
        '<a class="nav-brand" href="index.html"><span class="nav-suit">♠</span>' +
        '<span><strong>Braelinn</strong><small>Poker League</small></span></a>' +
        '<div class="nav-links">' +
        links.map(l => '<a href="' + l.href + '" class="' + (active === l.href ? "is-active" : "") +
          '"><span aria-hidden="true">' + l.icon + '</span>' + l.label + '</a>').join("") +
        '</div>' +
        '<div class="nav-status" id="navStatus"></div>' +
        '</nav>';
    },

    footer() {
      return '<footer class="footer">' +
        '<p>' + LEAGUE.name + ' · Season ' + LEAGUE.season + '</p>' +
        '<p class="footer-mode">Sync: <span id="syncMode"></span></p></footer>';
    },

    mount(active) {
      const nav = document.getElementById("nav");
      if (nav) nav.innerHTML = UI.nav(active);
      const foot = document.getElementById("footer");
      if (foot) foot.innerHTML = UI.footer();

      const mode = document.getElementById("syncMode");
      if (mode) {
        mode.textContent = DB.mode === "firebase" ? "Firebase (live, all devices)" : "Local only (this browser)";
        mode.className = DB.mode === "firebase" ? "pill pill-ok" : "pill pill-warn";
      }

      DB.onConnection(UI.renderConnection);
      if (DB.mode === "local") UI.localBanner();
    },

    /** ● LIVE / OFFLINE chip in the nav. */
    renderConnection(ok) {
      const el = document.getElementById("navStatus");
      if (!el) return;
      if (DB.mode === "local") {
        el.innerHTML = '<span class="conn conn-local">● LOCAL</span>';
        return;
      }
      el.innerHTML = ok
        ? '<span class="conn conn-live">● LIVE</span>'
        : '<span class="conn conn-off">● OFFLINE</span>';
    },

    /** Transient "Saving… / ✓ Saved" next to the connection chip. */
    saveState(state, label) {
      let el = document.getElementById("saveState");
      if (!el) {
        el = document.createElement("div");
        el.id = "saveState";
        el.className = "savestate";
        document.body.appendChild(el);
      }
      clearTimeout(el._t);
      el.dataset.state = state;
      el.textContent =
        state === "saving" ? "Saving…" :
        state === "saved"  ? "✓ Saved" :
        state === "offline" ? "Offline — queued" : "Save failed";
      el.classList.add("show");
      if (state !== "saving") el._t = setTimeout(() => el.classList.remove("show"), 1800);
    },

    localBanner() {
      if (document.getElementById("localBanner")) return;
      const d = document.createElement("div");
      d.id = "localBanner";
      d.className = "local-banner";
      d.innerHTML = '<strong>Local mode.</strong> Firebase isn\'t configured yet, so everything ' +
        'stays in this browser. Paste your config into <code>firebase-config.js</code> to sync ' +
        'across everyone\'s phones. <button type="button" aria-label="Dismiss">×</button>';
      d.querySelector("button").onclick = () => d.remove();
      document.body.prepend(d);
    },

    toast(msg, kind) {
      let t = document.getElementById("toast");
      if (!t) {
        t = document.createElement("div");
        t.id = "toast";
        t.className = "toast";
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.dataset.kind = kind || "info";
      t.classList.add("show");
      clearTimeout(t._timer);
      t._timer = setTimeout(() => t.classList.remove("show"), 2800);
    },

    avatar(player, size) {
      const cls = size ? "avatar avatar-" + size : "avatar";
      const p = typeof player === "string" ? (BPL.player(player) || { name: player }) : player;
      const src = Photos.get(p.name) || p.avatar;
      if (src) {
        return '<span class="' + cls + '"><img src="' + src + '" alt="" loading="lazy" ' +
          'onerror="this.parentNode.textContent=\'' + BPL.initials(p.name) + '\'"></span>';
      }
      return '<span class="' + cls + '" data-seed="' + ((p.name || "").length % 6) + '">' +
        BPL.initials(p.name) + '</span>';
    },

    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },

    tables(seats, count) {
      const n = Math.max(1, count || 1);
      const out = Array.from({ length: n }, () => []);
      seats.forEach((s, i) => out[i % n].push(s));
      return out;
    },

    esc(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    },

    /** Non-blocking confirm styled like the rest of the app. */
    confirm(question, detail, confirmLabel) {
      return new Promise(resolve => {
        const wrap = document.createElement("div");
        wrap.className = "sheet-wrap";
        wrap.innerHTML =
          '<div class="sheet"><h3>' + UI.esc(question) + '</h3>' +
          (detail ? '<p class="tiny muted">' + UI.esc(detail) + '</p>' : "") +
          '<div class="btn-grid"><button class="btn" data-no>Cancel</button>' +
          '<button class="btn btn-primary" data-yes>' + UI.esc(confirmLabel || "Confirm") + '</button></div></div>';
        document.body.appendChild(wrap);
        const done = v => { wrap.remove(); resolve(v); };
        wrap.querySelector("[data-yes]").onclick = () => done(true);
        wrap.querySelector("[data-no]").onclick = () => done(false);
        wrap.onclick = e => { if (e.target === wrap) done(false); };
      });
    },

    /**
     * "Where do I sit?" — the one thing a player needs in a loud room.
     * Deliberately huge: table and seat are readable from across the table
     * without anyone squinting at a phone. Uses the existing seat draw data;
     * no accounts, no extra Firebase paths.
     *
     * seats = { tables, order:[names] }  (exactly what the draw already writes)
     */
    seatLookup(seats, preferredName) {
      if (!seats || !Array.isArray(seats.order) || !seats.order.length) {
        UI.toast("No seat draw yet", "info");
        return Promise.resolve(null);
      }

      const tables = UI.tables(seats.order, seats.tables || 1);
      const find = name => {
        for (let t = 0; t < tables.length; t++) {
          const i = tables[t].indexOf(name);
          if (i !== -1) return { table: t + 1, seat: i + 1 };
        }
        return null;
      };

      const show = name => {
        const at = find(name);
        const wrap = document.createElement("div");
        wrap.className = "sheet-wrap seatfind";
        wrap.innerHTML = at
          ? '<div class="sheet seatcard">' +
              '<p class="sf-name">' + UI.esc(name) + '</p>' +
              '<div class="sf-grid">' +
                '<div><span class="sf-lab">Table</span><b class="sf-num">' + at.table + '</b></div>' +
                '<div><span class="sf-lab">Seat</span><b class="sf-num">' + at.seat + '</b></div>' +
              '</div>' +
              '<button class="btn btn-block mt" data-again>Someone else</button>' +
              '<button class="btn btn-primary btn-block mt" data-close>Got it</button>' +
            '</div>'
          : '<div class="sheet seatcard">' +
              '<p class="sf-name">' + UI.esc(name) + '</p>' +
              '<p class="sf-none">Not in this draw.</p>' +
              '<button class="btn btn-block mt" data-again>Look up someone else</button>' +
              '<button class="btn btn-primary btn-block mt" data-close>Close</button>' +
            '</div>';
        document.body.appendChild(wrap);
        const done = () => wrap.remove();
        wrap.querySelector("[data-close]").onclick = done;
        wrap.querySelector("[data-again]").onclick = () => { done(); ask(); };
        wrap.onclick = e => { if (e.target === wrap) done(); };
      };

      const ask = () => UI.pick("Who are you?",
        seats.order.map(n => ({ value: n, label: n }))).then(n => { if (n) {
          try { localStorage.setItem("bpl_me", n); } catch (_) {}
          show(n);
        } });

      let me = preferredName;
      if (!me) { try { me = localStorage.getItem("bpl_me"); } catch (_) {} }
      if (me && seats.order.indexOf(me) !== -1) show(me); else ask();
      return Promise.resolve(true);
    },

    /**
     * Share the league. Uses the native share sheet where available (phones),
     * falls back to copying the link. Always shares the ROOT url and the
     * league name, never the current page — one public identity.
     */
    share() {
      const data = {
        title: "Braelinn Poker League",
        text: "Season standings, RSVP, schedule and game-night hub for the Braelinn Poker League.",
        url: "https://bevier19jac.github.io/braelinn/"
      };
      if (navigator.share) {
        return navigator.share(data).catch(() => {});
      }
      if (navigator.clipboard) {
        return navigator.clipboard.writeText(data.url)
          .then(() => UI.toast("Link copied", "ok"))
          .catch(() => UI.toast(data.url, "info"));
      }
      UI.toast(data.url, "info");
      return Promise.resolve();
    },

    /** Simple single-choice picker sheet. items: [{value,label,sub}] */
    pick(title, items) {
      return new Promise(resolve => {
        const wrap = document.createElement("div");
        wrap.className = "sheet-wrap";
        wrap.innerHTML =
          '<div class="sheet"><h3>' + UI.esc(title) + '</h3>' +
          '<input class="inp mb" data-filter placeholder="Filter…" aria-label="Filter">' +
          '<div class="picklist" data-list>' +
          items.map(i => '<button class="pickrow" data-v="' + UI.esc(i.value) + '">' +
            '<b>' + UI.esc(i.label) + '</b>' +
            (i.sub ? '<small>' + UI.esc(i.sub) + '</small>' : "") + '</button>').join("") +
          '</div><button class="btn btn-block mt" data-no>Cancel</button></div>';
        document.body.appendChild(wrap);
        const done = v => { wrap.remove(); resolve(v); };
        wrap.querySelector("[data-no]").onclick = () => done(null);
        wrap.onclick = e => { if (e.target === wrap) done(null); };
        wrap.querySelectorAll(".pickrow").forEach(b =>
          b.onclick = () => done(b.dataset.v));
        const f = wrap.querySelector("[data-filter]");
        f.oninput = () => {
          const q = f.value.toLowerCase();
          wrap.querySelectorAll(".pickrow").forEach(b => {
            b.hidden = !!q && b.textContent.toLowerCase().indexOf(q) === -1;
          });
        };
        setTimeout(() => f.focus(), 50);
      });
    }
  };

  /* ------------------------------------------------------------------ *
   * PHOTOS — players upload their own, nobody collects anything.        *
   *                                                                     *
   * The picture is resized to 180x180 and re-encoded as a JPEG in the   *
   * browser before it ever leaves the phone, so a 4MB camera roll shot  *
   * becomes roughly 8KB. That's small enough to live directly in the    *
   * Realtime Database as a data URL — no Firebase Storage, no billing   *
   * plan upgrade, no separate upload service.                           *
   * ------------------------------------------------------------------ */
  const Photos = {
    SIZE: 180,
    QUALITY: 0.72,
    MAX_CHARS: 40000,        // ~30KB decoded. Rules reject anything larger.
    _map: {},
    _subs: [],

    watch() {
      DB.on("photos", v => {
        Photos._map = v || {};
        Photos._subs.forEach(f => { try { f(Photos._map); } catch (e) { console.error(e); } });
      });
    },

    onChange(fn) { Photos._subs.push(fn); },

    get(name) { return Photos._map[name] || null; },
    has(name) { return !!Photos._map[name]; },

    /** File -> square, centre-cropped, downscaled JPEG data URL. */
    process(file) {
      return new Promise((resolve, reject) => {
        if (!file || !/^image\//.test(file.type)) return reject(new Error("That's not an image"));
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Couldn't read that file"));
        reader.onload = () => {
          const img = new Image();
          img.onerror = () => reject(new Error("Couldn't open that image"));
          img.onload = () => {
            const S = Photos.SIZE;
            const c = document.createElement("canvas");
            c.width = S; c.height = S;
            const ctx = c.getContext("2d");
            /* Centre-crop to a square so nobody ends up stretched. */
            const side = Math.min(img.width, img.height);
            const sx = (img.width - side) / 2;
            const sy = (img.height - side) / 2;
            ctx.drawImage(img, sx, sy, side, side, 0, 0, S, S);

            let out = c.toDataURL("image/jpeg", Photos.QUALITY);
            let q = Photos.QUALITY;
            while (out.length > Photos.MAX_CHARS && q > 0.35) {
              q -= 0.1;
              out = c.toDataURL("image/jpeg", q);
            }
            if (out.length > Photos.MAX_CHARS) return reject(new Error("That image won't compress small enough"));
            resolve(out);
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    },

    save(name, dataUrl) {
      return DB.save("photo for " + name, () => DB.set("photos/" + name, dataUrl));
    },

    remove(name) {
      return DB.save("remove photo", () => DB.set("photos/" + name, null));
    },

    /** Opens the file picker, processes, saves. Resolves true on success. */
    upload(name) {
      return new Promise(resolve => {
        const inp = document.createElement("input");
        inp.type = "file";
        inp.accept = "image/*";
        inp.style.display = "none";
        document.body.appendChild(inp);
        inp.onchange = () => {
          const f = inp.files && inp.files[0];
          inp.remove();
          if (!f) return resolve(false);
          UI.toast("Shrinking your photo…", "info");
          Photos.process(f).then(
            url => Photos.save(name, url).then(() => {
              UI.toast("Photo saved — everyone sees it now", "ok");
              resolve(true);
            }, () => resolve(false)),
            err => { UI.toast(err.message, "bad"); resolve(false); }
          );
        };
        inp.click();
      });
    }
  };

  DB.init();
  Admin.watch();
  Photos.watch();

  window.DB = DB;
  window.Admin = Admin;
  window.UI = UI;
  window.Photos = Photos;
})();
