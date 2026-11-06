const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
const D = Math.min(window.devicePixelRatio || 1, 2);
let W, H;

// second canvas for emojis (no smear trails)
const cv2 = document.createElement('canvas');
cv2.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;';
cv.after(cv2);
const ctx2 = cv2.getContext('2d');

function resize() {
  W = innerWidth; H = innerHeight;
  for (const c of [cv, cv2]) {
    c.width = W * D; c.height = H * D;
    c.style.width = W + 'px'; c.style.height = H + 'px';
  }
  ctx.setTransform(D, 0, 0, D, 0, 0);
  ctx2.setTransform(D, 0, 0, D, 0, 0);
}
addEventListener('resize', resize);
resize();

// ---------- state ----------
let state = 'menu';
let score = 0, combo = 0, timeLeft = 45;
let items = [], parts = [], nparts = [], glows = [];
let last = performance.now(), spawnT = 0, autoT = 0;
let hi = +localStorage.getItem('dd_hi') || 0;
let name = localStorage.getItem('dd_name') || '';
const urlName = new URLSearchParams(location.search).get('name');
if (urlName) name = urlName.slice(0, 16);
let litCount = 0;

const TYPES = [
  { e: '🧨', p: 1, w: 5, s: 'cracker' },
  { e: '🚀', p: 2, w: 3, s: 'rocket' },
  { e: '🎇', p: 3, w: 2, s: 'anar' },
  { e: '🪔', p: 5, w: 1, s: 'chime' },
  { e: '💧', p: -3, w: 2, s: 'splash' }
];
const TOTAL_W = TYPES.reduce((a, t) => a + t.w, 0);

// ---------- realistic cracker sound ----------
let ac = null, master = null, NB = null;

function audio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    const comp = ac.createDynamicsCompressor();
    master = ac.createGain();
    master.gain.value = 0.9;
    master.connect(comp);
    comp.connect(ac.destination);
    NB = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = NB.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function noise(t, dur, type, f0, f1, vol) {
  const s = ac.createBufferSource();
  s.buffer = NB;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur);
}

function thump(t, f0, f1, dur, vol) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur);
}

function bang(delay = 0, big = 1) {
  if (!audio()) return;
  const t = ac.currentTime + delay;
  noise(t, 0.05, 'highpass', 2500, 5000, 0.7 * big);        // sharp crack
  noise(t, 0.3 + 0.15 * big, 'lowpass', 6000, 250, 0.9);     // boom body
  thump(t, 170, 35, 0.28, 0.9 * big);                        // low thump
}

function smallPop(delay) {
  if (!audio()) return;
  const t = ac.currentTime + delay;
  noise(t, 0.07, 'highpass', 3000, 1500, 0.4);
  thump(t, 320, 80, 0.06, 0.3);
}

function sparkle(delay) {
  if (!audio()) return;
  const t = ac.currentTime + delay;
  noise(t, 0.04, 'highpass', 5000, 3000, 0.22);
}

function whistle(dur = 0.14) {
  if (!audio()) return;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(700, t);
  o.frequency.exponentialRampToValueAtTime(2200, t + dur);
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur);
}

function chime() {
  if (!audio()) return;
  const t = ac.currentTime;
  [880, 1320].forEach((fr, i) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = fr;
    g.gain.setValueAtTime(0.18 / (i + 1), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.5);
  });
}

function splash() {
  if (!audio()) return;
  const t = ac.currentTime;
  noise(t, 0.25, 'bandpass', 900, 300, 0.6);
  thump(t, 120, 50, 0.15, 0.4);
}

function playSound(kind) {
  switch (kind) {
    case 'cracker':
      bang(0, 1);
      smallPop(0.11); smallPop(0.18); smallPop(0.24);
      break;
    case 'rocket':
      whistle(0.14);
      bang(0.14, 1.2);
      for (let i = 0; i < 4; i++) sparkle(0.3 + i * 0.07);
      break;
    case 'anar':
      bang(0, 1.3);
      for (let i = 0; i < 10; i++) sparkle(0.1 + i * 0.06 + Math.random() * 0.03);
      break;
    case 'chime':
      chime();
      break;
    case 'splash':
      splash();
      break;
  }
}

// ---------- fireworks ----------
function burst(x, y, n = 40, hue = Math.random() * 360) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 1 + Math.random() * 5;
    parts.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 1,
      h: hue + Math.random() * 40,
      r: 1.5 + Math.random() * 2
    });
  }
}

// name made of light particles
let nameCache = { key: '', pts: [], tw: 0, th: 0 };

function buildName() {
  const txt = (name || 'DIWALI').toUpperCase();
  const key = txt + '|' + W;
  if (nameCache.key === key) return nameCache;
  const fs = Math.max(22, Math.min(64, Math.floor((W * 0.88) / Math.max(txt.length * 0.7, 1))));
  const oc = document.createElement('canvas');
  const o = oc.getContext('2d');
  o.font = '900 ' + fs + 'px sans-serif';
  const tw = Math.ceil(o.measureText(txt).width) + 12;
  const th = Math.ceil(fs * 1.3);
  oc.width = tw; oc.height = th;
  o.font = '900 ' + fs + 'px sans-serif';
  o.textBaseline = 'middle';
  o.fillStyle = '#fff';
  o.fillText(txt, 6, th / 2);
  const data = o.getImageData(0, 0, tw, th).data;
  const step = Math.max(3, Math.round(fs / 14));
  const pts = [];
  for (let yy = 0; yy < th; yy += step) {
    for (let xx = 0; xx < tw; xx += step) {
      if (data[(yy * tw + xx) * 4 + 3] > 128) pts.push([xx - tw / 2, yy - th / 2, xx / tw]);
    }
  }
  nameCache = { key, pts, tw, th };
  return nameCache;
}

function nameBurst(x, y, hue) {
  if (nparts.length > 1800) return;
  const c = buildName();
  const cx = Math.min(Math.max(x, c.tw / 2 + 8), W - c.tw / 2 - 8);
  const cy = Math.min(Math.max(y, c.th / 2 + 90), H - c.th / 2 - 20);
  for (const p of c.pts) {
    nparts.push({
      sx: x, sy: y,
      tx: cx + p[0], ty: cy + p[1],
      h: hue + p[2] * 70,
      r: 2.4,
      t: 0
    });
  }
  glows.push({ x: cx, y: cy, r: Math.max(c.tw, c.th) * 0.85, l: 1, h: hue });
  glows.push({ x, y, r: 130, l: 1, h: hue });
}

function finale() {
  for (let i = 0; i < 8; i++) {
    setTimeout(() => {
      burst(Math.random() * W, Math.random() * H * 0.6, 70);
      bang(0, 1);
    }, i * 220);
  }
  setTimeout(() => nameBurst(W / 2, H * 0.25, 40), 300);
}

// ---------- items ----------
function pick() {
  let r = Math.random() * TOTAL_W;
  for (const t of TYPES) { r -= t.w; if (r <= 0) return t; }
  return TYPES[0];
}

function spawn() {
  const t = pick();
  const size = 46 + Math.random() * 16;
  const speed = 1.6 + (45 - timeLeft) * 0.05 + Math.random() * 1.4;
  items.push({
    t, size,
    x: size + Math.random() * (W - size * 2),
    y: -size,
    vy: speed,
    vx: (Math.random() - 0.5) * 0.8
  });
}

// ---------- game flow ----------
function startGame() {
  audio();
  score = 0; combo = 0; timeLeft = 45; items = []; spawnT = 0;
  state = 'play';
  $('menu').classList.add('hidden');
  $('over').classList.add('hidden');
  $('hud').classList.remove('hidden');
  updateHud();
}

function endGame() {
  state = 'over';
  items = [];
  if (score > hi) { hi = score; localStorage.setItem('dd_hi', hi); }
  $('hud').classList.add('hidden');
  $('fscore').textContent = score;
  $('fhi').textContent = hi;
  $('fmsg').textContent = (name ? name + ', ' : '') + (score >= 80 ? 'Patakha Master! 🔥' : score >= 40 ? 'Badhiya khela! 🎉' : 'Aur try karo! 🪔');
  $('over').classList.remove('hidden');
  finale();
}

function updateHud() {
  $('score').textContent = score;
  $('time').textContent = Math.max(0, Math.ceil(timeLeft));
  $('combo').textContent = combo >= 5 ? 'x' + (1 + Math.floor(combo / 5)) + ' 🔥' : '';
}

// ---------- input ----------
cv.addEventListener('pointerdown', e => {
  audio();
  const x = e.clientX, y = e.clientY;
  if (state === 'play') {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (Math.hypot(x - it.x, y - it.y) < it.size * 0.85) {
        const p = it.t.p;
        if (p > 0) {
          const hue = Math.random() * 360;
          score += p * (1 + Math.floor(combo / 5));
          combo++;
          burst(it.x, it.y, 30 + p * 10, hue);
          nameBurst(it.x, it.y, hue);
          playSound(it.t.s);
        } else {
          score = Math.max(0, score + p);
          combo = 0;
          burst(it.x, it.y, 14, 200);
          playSound(it.t.s);
        }
        items.splice(i, 1);
        updateHud();
        return;
      }
    }
    combo = 0;
    updateHud();
  } else {
    const hue = Math.random() * 360;
    burst(x, y, 50, hue);
    glows.push({ x, y, r: 110, l: 1, h: hue });
    bang(0, 1);
  }
});

$('start').addEventListener('click', () => {
  name = $('name').value.trim();
  localStorage.setItem('dd_name', name);
  startGame();
});
$('again').addEventListener('click', startGame);

$('name').addEventListener('input', () => {
  const n = $('name').value.trim();
  $('greet').textContent = n ? 'Happy Diwali, ' + n + '! 🎆' : 'Happy Diwali!';
});

document.querySelectorAll('.diya').forEach(d => {
  d.addEventListener('click', e => {
    e.stopPropagation();
    audio();
    d.classList.toggle('lit');
    litCount = document.querySelectorAll('.diya.lit').length;
    const r = d.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top, 20, 40);
    chime();
    if (litCount === 5) {
      name = $('name').value.trim();
      finale();
      $('greet').textContent = 'Shubh Deepawali' + (name ? ', ' + name : '') + '! 🪔✨';
    }
  });
});

// ---------- loop ----------
function loop(t) {
  const dt = Math.min((t - last) / 16.67, 3);
  last = t;

  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(10,5,25,0.28)';
  ctx.fillRect(0, 0, W, H);

  if (state === 'play') {
    timeLeft -= dt / 60;
    spawnT -= dt;
    if (spawnT <= 0) {
      spawn();
      spawnT = Math.max(14, 40 - (45 - timeLeft) * 0.6);
    }
    updateHud();
    if (timeLeft <= 0) endGame();
  } else {
    autoT -= dt;
    if (autoT <= 0) {
      burst(Math.random() * W, Math.random() * H * 0.6, 50);
      autoT = 30 + Math.random() * 40;
    }
  }

  // items (own canvas, cleared each frame)
  ctx2.clearRect(0, 0, W, H);
  ctx2.textAlign = 'center';
  ctx2.textBaseline = 'middle';
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    it.y += it.vy * dt;
    it.x += it.vx * dt;
    if (it.y > H + it.size) { items.splice(i, 1); continue; }
    ctx2.font = it.size + 'px serif';
    ctx2.fillText(it.t.e, it.x, it.y);
  }

  ctx.globalCompositeOperation = 'lighter';

  // light glows
  for (let i = glows.length - 1; i >= 0; i--) {
    const g = glows[i];
    g.l -= 0.018 * dt;
    if (g.l <= 0) { glows.splice(i, 1); continue; }
    const rg = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
    rg.addColorStop(0, 'hsla(' + g.h + ',100%,65%,' + (g.l * 0.55) + ')');
    rg.addColorStop(1, 'hsla(' + g.h + ',100%,50%,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2);
  }

  // burst particles
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.vy += 0.06 * dt;
    p.vx *= 0.99;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= 0.016 * dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    ctx.fillStyle = 'hsla(' + p.h + ',100%,60%,' + p.life + ')';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // name particles: fly out into the name, hold, then fade
  for (let i = nparts.length - 1; i >= 0; i--) {
    const p = nparts[i];
    p.t += dt / 60;
    let k = Math.min(p.t / 0.7, 1);
    k = 1 - Math.pow(1 - k, 3);
    const x = p.sx + (p.tx - p.sx) * k;
    let y = p.sy + (p.ty - p.sy) * k;
    let a = 1;
    if (p.t > 1.8) {
      const f = (p.t - 1.8) / 0.9;
      if (f >= 1) { nparts.splice(i, 1); continue; }
      a = 1 - f;
      y += f * f * 30;
    }
    ctx.fillStyle = 'hsla(' + p.h + ',100%,' + (60 + Math.random() * 25) + '%,' + a + ')';
    ctx.fillRect(x - 1.2, y - 1.2, p.r, p.r);
  }

  requestAnimationFrame(loop);
}

// ---------- init ----------
$('name').value = name;
$('hi').textContent = hi;
if (name) $('greet').textContent = 'Happy Diwali, ' + name + '! 🎆';
requestAnimationFrame(loop);

