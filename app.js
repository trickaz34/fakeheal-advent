(() => {
  "use strict";

  const CFG = window.ADVENT_CONFIG;
  const REWARDS = window.ADVENT_REWARDS;
  const DAYS = 24;
  const DAY_MS = 86400000;
  const STORAGE_KEY = `fakeheal-advent-${CFG.year}-opened`;

  // Ordre d'affichage des cases dans la grille (mélangé comme un vrai calendrier).
  const LAYOUT = [7, 18, 3, 1, 11, 15, 9, 21, 5, 13, 20, 2, 16, 24, 10, 23, 6, 14, 19, 4, 22, 8, 17, 12];
  const BIG_DAYS = new Set([1, 24]);

  const RARITY_LABEL = {
    uncommon: "Inhabituel",
    rare: "Rare",
    epic: "Épique",
    legendary: "Légendaire",
  };

  const ICONS = {
    sub: '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.6 6.6-.8z"/>',
    game: '<path d="M6.5 7.5h11a4.5 4.5 0 0 1 4.5 4.5v3a3 3 0 0 1-5.4 1.8L15 15H9l-1.6 1.8A3 3 0 0 1 2 15v-3a4.5 4.5 0 0 1 4.5-4.5z"/><path d="M7 10.5v3.5M5.25 12.25h3.5"/><path d="M15.5 11.5h.01M18 13h.01"/>',
    giftcard: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6.5 15h5"/>',
    vip: '<path d="M3 18.5h18l-1.6-10-4.6 4.2L12 5.5l-2.8 7.2-4.6-4.2z"/><path d="M5 21h14"/>',
    coaching: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
    goodies: '<path d="M5 8h14l-1 13H6z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/>',
    wow: '<circle cx="12" cy="12" r="9"/><path d="M12 6.5v11M15 9h-4.2a1.8 1.8 0 0 0 0 3.6h2.4a1.8 1.8 0 0 1 0 3.6H9"/>',
    emote: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2.2 4 2.2 4-2.2 4-2.2M9 9.5h.01M15 9.5h.01"/>',
    mystery: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1 1-1.1 1.7v.7M12 17h.01"/>',
  };
  const LOCK_SVG = '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  const BOW_SVG = '<svg class="bow" viewBox="0 0 64 32" aria-hidden="true"><path d="M32 16C22 2 6 4 8 14s16 8 24 2zM32 16c10-14 26-12 24-2s-16 8-24 2z"/><circle cx="32" cy="16" r="4.5"/></svg>';

  const icon = (type) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[type] || ICONS.mystery}</svg>`;
  const $ = (sel) => document.querySelector(sel);
  const systemReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Répartition des récompenses (tirée une fois, déterministe) ----------

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(list, seed) {
    const rand = mulberry32(seed);
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  const rewardByDay = {};
  shuffled(REWARDS, CFG.seed).slice(0, DAYS).forEach((reward, i) => { rewardByDay[i + 1] = reward; });

  // ---------- Réglages du mode test ----------
  // Activé par Ctrl+Maj+D, ou par ?dev / ?date=AAAA-MM-JJ dans l'adresse. Mémorisé dans le navigateur.

  const DEV_KEY = "fakeheal-advent-dev";
  const DEV_DEFAULTS = { active: false, date: "", unlockAll: false, forceMotion: true, replay: true, collapsed: false };

  const dev = (() => {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(DEV_KEY)) || {}; } catch { /* stockage indisponible */ }
    return { ...DEV_DEFAULTS, ...saved };
  })();
  function saveDev() {
    try { localStorage.setItem(DEV_KEY, JSON.stringify(dev)); } catch { /* stockage indisponible */ }
  }

  const params = new URLSearchParams(location.search);
  if (params.has("dev")) dev.active = true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(params.get("date") || "")) {
    dev.active = true;
    dev.date = params.get("date");
  }
  saveDev();

  // Animations coupées si le système le demande, sauf si le mode test les force.
  const motionOff = () => systemReduceMotion && !(dev.active && dev.forceMotion);

  // ---------- Temps (avec date simulée en mode test) ----------

  let timeOffset = 0;
  function applyDevDate() {
    timeOffset = 0;
    if (!dev.active || !dev.date) return;
    const [y, m, d] = dev.date.split("-").map(Number);
    const real = new Date();
    const simulated = new Date(y, m - 1, d, real.getHours(), real.getMinutes(), real.getSeconds());
    timeOffset = simulated.getTime() - real.getTime();
  }
  applyDevDate();

  const now = () => new Date(Date.now() + timeOffset);
  const unlockDate = (day) => new Date(CFG.year, 11, day, 0, 0, 0);
  const isUnlocked = (day) => (dev.active && dev.unlockAll) || now() >= unlockDate(day);
  const todayDay = () => {
    const n = now();
    return n.getFullYear() === CFG.year && n.getMonth() === 11 && n.getDate() <= DAYS ? n.getDate() : null;
  };

  // ---------- Persistance des cases ouvertes ----------

  function loadOpened() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  }
  function saveOpened() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...opened])); } catch { /* stockage indisponible */ }
  }
  const opened = loadOpened();

  // ---------- Grille ----------

  const grid = $("#grid");
  const cells = {};

  LAYOUT.forEach((day, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gift" + (BIG_DAYS.has(day) ? " is-big" : "");
    btn.dataset.day = day;
    btn.style.animationDelay = `${i * 45}ms`;
    btn.innerHTML = `
      <span class="gift-frame"><span class="gift-face">
        <span class="ribbon ribbon-v"></span><span class="ribbon ribbon-h"></span>
        ${BOW_SVG}
        <span class="gift-num">${day}</span>
        <span class="gift-badge">Aujourd'hui</span>
        <span class="gift-lock">${LOCK_SVG}<span class="gift-lock-txt"></span></span>
        <span class="gift-reward"><span class="gift-reward-icon"></span><span class="gift-reward-title"></span></span>
      </span></span>`;
    btn.addEventListener("click", () => onGiftClick(day));
    grid.appendChild(btn);
    cells[day] = btn;
  });

  function updateCells() {
    const today = todayDay();
    for (let day = 1; day <= DAYS; day++) {
      const el = cells[day];
      const reward = rewardByDay[day];
      const isOpen = opened.has(day);
      const ready = !isOpen && isUnlocked(day);
      const locked = !isOpen && !ready;

      el.classList.toggle("is-opened", isOpen);
      el.classList.toggle("is-ready", ready);
      el.classList.toggle("is-locked", locked);
      el.classList.toggle("is-today", ready && day === today);

      if (isOpen) {
        el.dataset.rarity = reward.rarity;
        el.querySelector(".gift-reward-icon").innerHTML = icon(reward.type);
        el.querySelector(".gift-reward-title").textContent = reward.title;
        el.setAttribute("aria-label", `Jour ${day}, ouverte : ${reward.title}`);
      } else {
        delete el.dataset.rarity;
        if (locked) {
          const days = Math.ceil((unlockDate(day) - now()) / DAY_MS);
          el.querySelector(".gift-lock-txt").textContent = `J-${days}`;
          el.setAttribute("aria-label", `Jour ${day}, verrouillée jusqu'au ${day} décembre`);
        } else {
          el.setAttribute("aria-label", `Jour ${day}, prête à ouvrir`);
        }
      }
    }

    $("#opened-count").textContent = opened.size;
    $("#progress-bar").style.width = `${(opened.size / DAYS) * 100}%`;
  }

  // ---------- Compte à rebours ----------

  let lastDateKey = "";

  function tick() {
    const n = now();
    let next = null;
    for (let day = 1; day <= DAYS; day++) {
      if (unlockDate(day) > n) { next = day; break; }
    }

    const label = $("#countdown-label");
    const out = $("#countdown");
    if (next === null) {
      label.textContent = "Calendrier";
      out.textContent = "Joyeux Noël";
    } else {
      label.textContent = next === 1 ? "Ouverture du calendrier" : `Case ${next} dans`;
      const ms = unlockDate(next) - n;
      const d = Math.floor(ms / DAY_MS);
      const h = Math.floor((ms % DAY_MS) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      const pad = (v) => String(v).padStart(2, "0");
      out.textContent = (d > 0 ? `${d}j ` : "") + `${pad(h)}:${pad(m)}:${pad(s)}`;
    }

    // Passage à minuit : une case se débloque et les J-x changent.
    const dateKey = n.toDateString();
    if (dateKey !== lastDateKey) {
      lastDateKey = dateKey;
      updateCells();
    }
  }

  // ---------- Clic sur une case ----------

  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2600);
  }

  function onGiftClick(day) {
    if (opened.has(day)) return showReveal(day, dev.active && dev.replay);
    if (isUnlocked(day)) return showReveal(day, true);

    const el = cells[day];
    el.classList.remove("is-denied");
    void el.offsetWidth;
    el.classList.add("is-denied");
    const days = Math.ceil((unlockDate(day) - now()) / DAY_MS);
    toast(`Patience ! La case ${day} s'ouvre le ${day} décembre (dans ${days} jour${days > 1 ? "s" : ""}).`);
  }

  // ---------- Révélation ----------

  const reveal = $("#reveal");
  const stage = reveal.querySelector(".reveal-stage");
  const PHASES = ["is-entering", "is-waiting", "is-shaking", "is-bursting", "is-revealed"];
  let timers = [];
  let canClose = false;
  let lastFocus = null;

  function setPhase(phase) {
    reveal.classList.remove(...PHASES);
    if (phase) reveal.classList.add(phase);
  }

  // Durées de la séquence (ms) — à garder en phase avec style.css.
  const T_ENTER = 550;          // le cadeau apparaît
  const T_WIGGLE_CYCLE = 1800;  // un cycle « immobile puis gigote » (animation idle-wiggle)
  const T_WIGGLE_AT = 0.72;     // moment du cycle où il gigote (72 %)
  const T_CHARGE = 700;         // tremblement après le clic, avant l'explosion
  const T_BURST = 550;          // explosion avant l'arrivée de la carte

  const bigGift = $("#big-gift");
  let pending = null;           // ouverture en attente du clic sur le cadeau
  let jingleTimers = [];

  function stopJingle() {
    jingleTimers.forEach((id) => { clearTimeout(id); clearInterval(id); });
    jingleTimers = [];
  }

  // Grelots calés sur le moment où le cadeau gigote.
  function startJingle() {
    stopJingle();
    jingleTimers.push(setTimeout(() => {
      window.XmasSfx.jingle();
      jingleTimers.push(setInterval(() => window.XmasSfx.jingle(), T_WIGGLE_CYCLE));
    }, T_WIGGLE_CYCLE * T_WIGGLE_AT));
  }

  // animate : présenter le cadeau à ouvrir (sinon, on affiche directement la carte).
  // sample : récompense d'aperçu (mode test), qui ne touche pas à l'état des cases.
  function showReveal(day, animate, sample = null) {
    const reward = sample || rewardByDay[day];
    lastFocus = document.activeElement;
    stage.dataset.rarity = reward.rarity;
    $("#big-num").textContent = sample ? "?" : day;
    $("#card-day").textContent = sample ? "Aperçu · mode test" : `Jour ${day} · ${day} décembre`;
    $("#card-icon").innerHTML = icon(reward.type);
    $("#card-rarity").textContent = RARITY_LABEL[reward.rarity] || "";
    $("#card-title").textContent = reward.title;
    $("#card-detail").textContent = reward.detail;

    reveal.hidden = false;
    document.body.style.overflow = "hidden";
    timers.forEach(clearTimeout);
    timers = [];
    stopJingle();

    if (!animate) {
      pending = null;
      finishReveal();
      return;
    }

    // Étape 1 : le cadeau fermé se présente et attend un clic (on peut encore annuler).
    pending = { day, sample, reward };
    canClose = true;
    window.XmasMusic.duck(true);
    window.XmasSfx.appear();

    if (motionOff()) {
      setPhase("is-waiting");
    } else {
      setPhase("is-entering");
      timers.push(setTimeout(() => {
        setPhase("is-waiting");
        startJingle();
      }, T_ENTER));
    }
    bigGift.focus({ preventScroll: true });
  }

  // Étape 2 : clic sur le cadeau → il tremble, explose, puis la carte arrive.
  function openGift() {
    if (!pending) return;
    const { day, sample, reward } = pending;
    pending = null;
    canClose = false;
    stopJingle();
    timers.forEach(clearTimeout);
    timers = [];

    const commit = () => {
      if (!sample && !opened.has(day)) markOpened(day);
    };

    if (motionOff()) {
      commit();
      window.XmasSfx.burst(reward.rarity);
      finishReveal();
      return;
    }

    setPhase("is-shaking");
    window.XmasSfx.charge(T_CHARGE / 1000);
    timers.push(setTimeout(() => {
      setPhase("is-bursting");
      commit();
      burst(reward.rarity);
      window.XmasSfx.burst(reward.rarity);
    }, T_CHARGE));
    timers.push(setTimeout(finishReveal, T_CHARGE + T_BURST));
  }

  function finishReveal() {
    setPhase("is-revealed");
    canClose = true;
    $("#card-close").focus({ preventScroll: true });
  }

  bigGift.addEventListener("click", openGift);

  function markOpened(day) {
    opened.add(day);
    saveOpened();
    updateCells();
  }

  // Fermer avant d'avoir cliqué sur le cadeau annule : la case reste fermée.
  function closeReveal() {
    if (!canClose) return;
    pending = null;
    stopJingle();
    timers.forEach(clearTimeout);
    timers = [];
    reveal.hidden = true;
    setPhase(null);
    window.XmasMusic.duck(false);
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }

  reveal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeReveal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !reveal.hidden) closeReveal();
  });

  // ---------- Particules de l'ouverture ----------

  const fx = $("#fx");
  const fxCtx = fx.getContext("2d");
  let particles = [];
  let fxRunning = false;

  const RARITY_COLORS = {
    uncommon: "#1eff00",
    rare: "#2f8cff",
    epic: "#a335ee",
    legendary: "#ff8000",
  };

  // Neige et particules sont des lueurs floues : une résolution 1:1 suffit et
  // divise le travail par 4 sur un écran haute densité.
  function sizeCanvas(canvas, ctx) {
    const dpr = 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Lueurs pré-dessinées (une par couleur) : chaque particule n'est plus qu'un drawImage,
  // au lieu d'un shadowBlur recalculé par particule et par image.
  const glowSprites = {};
  function glowSprite(color, shape) {
    const key = color + shape;
    if (glowSprites[key]) return glowSprites[key];
    const size = 64;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const mid = size / 2;
    const halo = g.createRadialGradient(mid, mid, 0, mid, mid, mid);
    halo.addColorStop(0, color);
    halo.addColorStop(0.35, color + "66");
    halo.addColorStop(1, color + "00");
    g.fillStyle = halo;
    g.fillRect(0, 0, size, size);
    g.fillStyle = "#ffffff";
    if (shape === "plus") {
      const s = size * 0.42;
      const t = s / 3;
      g.fillRect(mid - t / 2, mid - s / 2, t, s);
      g.fillRect(mid - s / 2, mid - t / 2, s, t);
    } else {
      g.beginPath();
      g.arc(mid, mid, size * 0.08, 0, Math.PI * 2);
      g.fill();
    }
    glowSprites[key] = c;
    return c;
  }

  function burst(rarity) {
    sizeCanvas(fx, fxCtx);
    const cx = innerWidth / 2;
    const cy = innerHeight / 2;
    const colors = ["#00f0e0", "#00c8f0", "#ffffff", "#c45cff", RARITY_COLORS[rarity] || "#00f0e0"];
    const count = rarity === "legendary" ? 170 : 120;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 9;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 1.5 + Math.random() * 3.5,
        life: 0,
        max: 50 + Math.random() * 50,
        sprite: glowSprite(colors[(Math.random() * colors.length) | 0], "spark"),
        shape: "spark",
      });
    }
    // Croix de soin qui montent doucement, clin d'oeil au heal.
    for (let i = 0; i < 26; i++) {
      particles.push({
        x: cx + (Math.random() - 0.5) * 260,
        y: cy + 40 + Math.random() * 120,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -1 - Math.random() * 1.8,
        size: 5 + Math.random() * 7,
        life: 0,
        max: 90 + Math.random() * 60,
        sprite: glowSprite(Math.random() < 0.7 ? "#00f0e0" : "#7dffb0", "plus"),
        shape: "plus",
      });
    }

    if (!fxRunning) {
      fxRunning = true;
      requestAnimationFrame(stepFx);
    }
  }

  function stepFx() {
    fxCtx.clearRect(0, 0, innerWidth, innerHeight);
    fxCtx.globalCompositeOperation = "lighter";

    particles = particles.filter((p) => p.life < p.max);
    for (const p of particles) {
      p.life++;
      p.x += p.vx;
      p.y += p.vy;
      if (p.shape === "spark") {
        p.vx *= 0.96;
        p.vy = p.vy * 0.96 + 0.12;
      }
      const alpha = 1 - p.life / p.max;
      fxCtx.globalAlpha = alpha;
      // taille du sprite (halo compris) : la croix y occupe 42 %, le point central 16 %
      const d = p.shape === "plus" ? p.size * 2.4 : p.size * (0.4 + alpha * 0.6) * 10;
      fxCtx.drawImage(p.sprite, p.x - d / 2, p.y - d / 2, d, d);
    }
    fxCtx.globalAlpha = 1;

    if (particles.length) {
      requestAnimationFrame(stepFx);
    } else {
      fxRunning = false;
      fxCtx.clearRect(0, 0, innerWidth, innerHeight);
    }
  }

  // ---------- Neige néon ----------

  // 3 couches (loin / milieu / près). Chaque couche est une image de flocons dessinée une
  // seule fois, répétée verticalement, que le CSS fait glisser : aucun calcul par image.
  const SNOW_LAYERS = [
    { share: 0.5,  rMin: 1.5, rMax: 3.5 },
    { share: 0.35, rMin: 3,   rMax: 5.5 },
    { share: 0.15, rMin: 5,   rMax: 8 },
  ];

  function makeSprite(color) {
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.25, color);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    return c;
  }
  const sprites = [
    makeSprite("rgba(200,240,255,0.7)"),
    makeSprite("rgba(0,240,224,0.6)"),
    makeSprite("rgba(196,92,255,0.5)"),
  ];

  let snowUrls = [];

  function buildSnow() {
    const w = innerWidth;
    const h = innerHeight;
    const total = Math.round(Math.min(140, (w * h) / 11000));
    const layers = document.querySelectorAll("#snow .snow-fall");

    snowUrls.forEach((u) => URL.revokeObjectURL(u));
    snowUrls = [];

    SNOW_LAYERS.forEach((cfg, i) => {
      const tile = document.createElement("canvas");
      tile.width = w;
      tile.height = h;
      const g = tile.getContext("2d");
      const count = Math.round(total * cfg.share);
      for (let n = 0; n < count; n++) {
        const r = cfg.rMin + Math.random() * (cfg.rMax - cfg.rMin);
        const s = r * 2;
        const x = Math.random() * w;
        const y = Math.random() * h;
        const sprite = sprites[Math.random() < 0.6 ? 0 : Math.random() < 0.7 ? 1 : 2];
        // dessiné aussi décalé d'une hauteur pour que la répétition verticale soit sans couture
        g.drawImage(sprite, x - s / 2, y - s / 2, s, s);
        if (y < s) g.drawImage(sprite, x - s / 2, y + h - s / 2, s, s);
        if (y > h - s) g.drawImage(sprite, x - s / 2, y - h - s / 2, s, s);
      }
      tile.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        snowUrls.push(url);
        layers[i].style.backgroundImage = `url(${url})`;
        layers[i].style.backgroundSize = `${w}px ${h}px`;
      });
    });
  }

  // ---------- Guirlande ----------

  function buildGarland() {
    const svg = $("#garland");
    const w = innerWidth;
    const h = 70;
    const span = w < 600 ? 160 : 240;
    const loops = Math.max(2, Math.round(w / span));
    const seg = w / loops;
    const colors = ["#00f0e0", "#c45cff", "#ffffff", "#2f8cff"];
    // une ampoule sur 4 dans chaque groupe : 4 animations au total, quel que soit le nombre d'ampoules
    const groups = ["", "", "", ""];
    let path = `M0 4`;
    let k = 0;
    for (let i = 0; i < loops; i++) {
      const x0 = i * seg;
      path += ` Q${x0 + seg / 2} ${h - 16} ${x0 + seg} 4`;
      for (let j = 1; j <= 5; j++) {
        const t = j / 6;
        const x = ((1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * (x0 + seg / 2) + t * t * (x0 + seg)).toFixed(1);
        const y = ((1 - t) * (1 - t) * 4 + 2 * (1 - t) * t * (h - 16) + t * t * 4 + 4).toFixed(1);
        const color = colors[k % colors.length];
        groups[k % 4] +=
          `<circle cx="${x}" cy="${y}" r="9" fill="url(#halo${k % colors.length})"/>` +
          `<circle cx="${x}" cy="${y}" r="3.4" fill="${color}"/>`;
        k++;
      }
    }
    const halos = colors.map((c, i) =>
      `<radialGradient id="halo${i}"><stop offset="0" stop-color="${c}" stop-opacity="0.7"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`
    ).join("");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.innerHTML = `<defs>${halos}</defs><path class="wire" d="${path}"/>` +
      groups.map((g) => `<g class="bulbs">${g}</g>`).join("");
  }

  // ---------- Mode test ----------

  const devbar = $("#devbar");
  const devInputs = {
    date: $("#dev-date"),
    unlockAll: $("#dev-unlock"),
    forceMotion: $("#dev-motion"),
    replay: $("#dev-replay"),
  };

  // Réapplique tous les réglages du mode test, sans recharger la page.
  function applyDev() {
    saveDev();
    devbar.hidden = !dev.active;
    devbar.classList.toggle("is-collapsed", dev.collapsed);
    $("#dev-collapse").textContent = dev.collapsed ? "Ouvrir" : "Réduire";
    $("#dev-collapse").setAttribute("aria-expanded", String(!dev.collapsed));
    document.documentElement.classList.toggle("force-motion", dev.active && dev.forceMotion);

    devInputs.date.value = dev.date;
    devInputs.unlockAll.checked = dev.unlockAll;
    devInputs.forceMotion.checked = dev.forceMotion;
    devInputs.replay.checked = dev.replay;
    $("#dev-motion-hint").hidden = !systemReduceMotion;

    applyDevDate();
    lastDateKey = "";
    tick();
    updateCells();
  }

  devInputs.date.addEventListener("change", () => { dev.date = devInputs.date.value; applyDev(); });
  $("#dev-today").addEventListener("click", () => { dev.date = ""; applyDev(); });
  for (const key of ["unlockAll", "forceMotion", "replay"]) {
    devInputs[key].addEventListener("change", () => { dev[key] = devInputs[key].checked; applyDev(); });
  }
  $("#dev-collapse").addEventListener("click", () => { dev.collapsed = !dev.collapsed; applyDev(); });
  $("#dev-exit").addEventListener("click", () => {
    dev.active = false;
    applyDev();
    toast("Mode test désactivé. Ctrl + Maj + D ou 5 clics sur le logo pour le rouvrir.");
  });
  $("#dev-reset").addEventListener("click", () => {
    opened.clear();
    saveOpened();
    updateCells();
    toast("Toutes les cases sont refermées.");
  });
  devbar.querySelectorAll("[data-preview]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const rarity = btn.dataset.preview;
      const sample = REWARDS.find((r) => r.rarity === rarity) || { type: "mystery", title: "Récompense", detail: "", rarity };
      showReveal(0, true, sample);
    });
  });

  function toggleDev() {
    dev.active = !dev.active;
    applyDev();
    toast(dev.active ? "Mode test activé." : "Mode test désactivé.");
  }

  // Ctrl+Maj+D (écouté en phase de capture pour passer avant le reste)
  addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === "KeyD") {
      e.preventDefault();
      toggleDev();
    }
  }, true);

  // 5 clics rapides sur le logo : marche aussi là où le raccourci clavier est pris
  // par le navigateur ou par OBS.
  let logoClicks = [];
  $(".logo-wrap").addEventListener("click", () => {
    const t = Date.now();
    logoClicks = logoClicks.filter((c) => t - c < 3000);
    logoClicks.push(t);
    if (logoClicks.length >= 5) {
      logoClicks = [];
      toggleDev();
    }
  });

  // ---------- Musique ----------

  const MUSIC_KEY = "fakeheal-advent-music";
  const musicBtn = $("#music-btn");

  function setMusicUi(on) {
    musicBtn.classList.toggle("is-on", on);
    musicBtn.setAttribute("aria-pressed", String(on));
    $("#music-label").textContent = on ? "Musique on" : "Musique";
  }
  function saveMusicPref(on) {
    try { localStorage.setItem(MUSIC_KEY, on ? "on" : "off"); } catch { /* stockage indisponible */ }
  }

  musicBtn.addEventListener("click", async () => {
    if (window.XmasMusic.isPlaying()) {
      window.XmasMusic.stop();
      setMusicUi(false);
      saveMusicPref(false);
    } else {
      const ok = await window.XmasMusic.start();
      setMusicUi(ok);
      saveMusicPref(ok);
    }
  });

  // Volume : curseur 0-100, courbe au carré pour que le bas du curseur reste fin à l'oreille.
  const VOLUME_KEY = "fakeheal-advent-volume";
  const volumeInput = $("#music-volume");

  function applyVolume(value) {
    volumeInput.value = value;
    volumeInput.style.setProperty("--fill", `${value}%`);
    const gain = Math.pow(value / 100, 2);
    window.XmasMusic.setVolume(gain);
    window.XmasSfx.setVolume(Math.min(1, gain * 1.2));   // effets un poil devant la musique
  }

  let savedVolume = null;
  try { savedVolume = localStorage.getItem(VOLUME_KEY); } catch { /* stockage indisponible */ }
  applyVolume(savedVolume !== null && !isNaN(savedVolume) ? Number(savedVolume) : 70);

  volumeInput.addEventListener("input", () => applyVolume(Number(volumeInput.value)));
  volumeInput.addEventListener("change", () => {
    try { localStorage.setItem(VOLUME_KEY, volumeInput.value); } catch { /* stockage indisponible */ }
  });

  // Si la musique était active à la dernière visite, on la relance.
  // Les navigateurs exigent une interaction : on tente tout de suite (OBS l'autorise),
  // sinon on attend le premier clic ou la première touche.
  let musicPref = null;
  try { musicPref = localStorage.getItem(MUSIC_KEY); } catch { /* stockage indisponible */ }
  if (musicPref === "on") {
    window.XmasMusic.start().then((ok) => {
      if (ok) return setMusicUi(true);
      const resume = async (e) => {
        removeEventListener("pointerdown", resume);
        removeEventListener("keydown", resume);
        // un clic sur le bouton musique est déjà géré par le bouton lui-même
        if (e.target.closest && e.target.closest("#music-btn")) return;
        setMusicUi(await window.XmasMusic.start());
      };
      addEventListener("pointerdown", resume);
      addEventListener("keydown", resume);
    });
  }

  // ---------- Démarrage ----------

  $("#year").textContent = CFG.year;
  buildGarland();
  buildSnow();
  applyDev();   // affiche le panneau si besoin et lance le premier tick
  setInterval(tick, 1000);

  let resizeTimer = null;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      buildGarland();
      buildSnow();
    }, 150);
  });
})();
