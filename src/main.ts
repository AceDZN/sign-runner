import '@fontsource/rubik/400.css';
import '@fontsource/rubik/700.css';
import '@fontsource/rubik/800.css';
import '@fontsource/rubik/900.css';
import '@fontsource/rubik/900-italic.css';
import '@fontsource/rubik/800-italic.css';
import './style.css';
import { LEVELS, Level, solutions } from './levels';
import { RunSim, Tempo, SimEvent, LearningEvent, CRASH_BEATS } from './sim';
import { opLabel, signed, expression } from './rules';
import { World } from './scene';
import { Hud } from './hud';
import { Audio } from './audio';
import { freshLevel } from './generator';

type Mode = 'title' | 'intro' | 'play' | 'paused' | 'results';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const STORE = 'sign-runner-progress-v1';
const LOG = 'sign-runner-learning-v1';
const STEP = 1 / 120;
const TEST = new URLSearchParams(location.search).has('test');

interface Progress { ranks: Record<number, string>; tempo: Tempo; reduced: boolean; muted: boolean; best: Record<number, number> }

function loadProgress(): Progress {
  const def: Progress = { ranks: {}, tempo: 'normal', reduced: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, muted: false, best: {} };
  try { return { ...def, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch { return def; }
}
function saveProgress(): void { try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch { /* storage may be blocked */ } }
function logLearning(events: LearningEvent[]): void {
  learningLog.push(...events);
  try {
    const prev = JSON.parse(localStorage.getItem(LOG) || '[]') as LearningEvent[];
    localStorage.setItem(LOG, JSON.stringify([...prev, ...events].slice(-800)));
  } catch { /* in-memory only */ }
}

const progress = loadProgress();
const learningLog: LearningEvent[] = [];
const canvas = $<HTMLCanvasElement>('game');
const world = new World(canvas);
const hud = new Hud();
const audio = new Audio();
audio.setMuted(progress.muted);
world.setReducedMotion(progress.reduced);
document.body.classList.toggle('reduced', progress.reduced);

let mode: Mode = 'title';
let levelIdx = 0;
let level: Level = LEVELS[0];
let fresh = false;
let sim = new RunSim(level, 'normal');
let acc = 0;
let ghostKey = false;
let ghostTouch = false;
let ghostButton = false;
let externalClock = false;
let doneTimer = -1;
let lastCrash: { result: number; tunnel: number; lines: string[] } | null = null;
let belowShown = false;
let fpsSamples: number[] = [];
let runLearningStart = 0;

// ------------------------------------------------------------------ setup
function resize(): void {
  const w = window.innerWidth, h = window.innerHeight;
  world.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); $('glLost').hidden = false; if (mode === 'play') pause(); });
canvas.addEventListener('webglcontextrestored', () => { $('glLost').hidden = true; });

void document.fonts.load('900 80px Rubik').then(() => document.fonts.load('900 italic 80px Rubik')).finally(() => {
  world.buildLevel(level, sim.layout);
  void world.loadModels('./models/').then(() => world.buildLevel(level, sim.layout));
});

function buildTitle(): void {
  const grid = $('levelGrid');
  grid.innerHTML = '';
  LEVELS.forEach((L, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `lvl${L.skin === 'ice' ? ' ice' : ''}`;
    const rank = progress.ranks[L.id];
    b.innerHTML = `<span>שלב ${L.id} · ${L.name}</span><small>${L.subtitle}</small><span class="rk">${rank ? `דירוג ${rank}` : L.skin === 'ice' ? 'שלב העברה' : ''}</span>`;
    b.addEventListener('click', () => { audio.unlock(); openIntro(i, false); });
    grid.appendChild(b);
  });
  for (const btn of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-tempo]'))) {
    btn.classList.toggle('on', btn.dataset.tempo === progress.tempo);
    btn.onclick = () => { progress.tempo = btn.dataset.tempo as Tempo; saveProgress(); buildTitle(); };
  }
  $<HTMLInputElement>('reducedMotion').checked = progress.reduced;
  $<HTMLInputElement>('muteOpt').checked = progress.muted;
}
$<HTMLInputElement>('reducedMotion').addEventListener('change', (e) => {
  progress.reduced = (e.target as HTMLInputElement).checked;
  world.setReducedMotion(progress.reduced);
  document.body.classList.toggle('reduced', progress.reduced);
  saveProgress();
});
$<HTMLInputElement>('muteOpt').addEventListener('change', (e) => setMuted((e.target as HTMLInputElement).checked));

function setMuted(m: boolean): void {
  progress.muted = m;
  audio.setMuted(m);
  $('muteBtn').textContent = m ? '🔇' : '🔊';
  $('muteBtn').setAttribute('aria-label', m ? 'הפעלת צלילים' : 'השתקה');
  $<HTMLInputElement>('muteOpt').checked = m;
  saveProgress();
}
setMuted(progress.muted);

function showScreen(id: 'title' | 'intro' | 'results' | 'paused' | null): void {
  for (const s of ['title', 'intro', 'results', 'paused']) $(s).hidden = s !== id;
}

// ------------------------------------------------------------------ flow
function newSim(): void {
  sim = new RunSim(level, progress.tempo);
  acc = 0;
  doneTimer = -1;
  lastCrash = null;
  belowShown = level.start < 0;
  world.buildLevel(level, sim.layout);
  world.onRespawn(sim.value);
  hud.setTheme(level.skin === 'ice');
  hud.resetTrail(sim.value);
  hud.hideCrash();
  hud.setLevel(level.id, level.name, level.segments.length, 0);
  audio.resetMusic(0);
  runLearningStart = learningLog.length;
}

function openIntro(i: number, useFresh: boolean): void {
  levelIdx = i;
  fresh = useFresh;
  level = useFresh ? freshLevel(LEVELS[i], Date.now() % 100000) : LEVELS[i];
  mode = 'intro';
  newSim();
  $('introNum').textContent = `שלב ${level.id}${useFresh ? ' · תרגילים חדשים' : ''}`;
  $('introName').textContent = level.name;
  $('introSub').textContent = level.subtitle;
  $('introRule').textContent = level.rule;
  $('introEx').textContent = level.example;
  const notes: string[] = [];
  if (level.id === 1) notes.push('המספר שלכם הוא הגובה שלכם. הסרגל משמאל הוא ציר המספרים. עברו בשער שמביא אתכם בדיוק לגובה החריץ במנהרה.');
  if (level.segments.some((s) => s.rows.length === 2)) notes.push(level.id === 5 ? 'כאן יש שתי שורות שערים לפני כל מנהרה. בחרו מסלול בכל שורה.' : 'שימו לב: בחלק מהמנהרות יש שתי שורות שערים לפני החריץ.');
  if (level.ghost) notes.push('תקועים? החזיקו Shift או את כפתור רוח הרפאים כדי לראות לאן כל שער מביא, אבל המכפיל יורד ל־×1.');
  else notes.push('בלי רוח רפאים. הקצב מהיר יותר. מעלות צלזיוס: מתחת ל־0 קפוא.');
  $('introNote').textContent = notes.join(' ');
  const links = $('introLinks');
  links.innerHTML = '';
  links.append('לשיעור ב־Workbook: ');
  for (const url of level.modules) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = MODULE_NAMES[url.split('/').pop() ?? ''] ?? url;
    links.append(a);
  }
  hud.show(false);
  showScreen('intro');
  $('goBtn').focus();
}

const MODULE_NAMES: Record<string, string> = {
  'number-line-expanded': 'ציר המספרים המורחב',
  'opposite-numbers': 'מספרים נגדיים',
  'adding-directed': 'חיבור מספרים מכוונים',
  'subtracting-directed': 'חיסור מספרים מכוונים',
  'multiplying-directed': 'כפל מספרים מכוונים',
  'dividing-directed': 'חילוק מספרים מכוונים',
  'order-of-ops-directed': 'סדר פעולות',
  'negative-base-powers': 'חזקות בבסיס שלילי',
};

function startRun(): void {
  audio.unlock();
  mode = 'play';
  showScreen(null);
  hud.show(true);
  $('ghostBtn').classList.toggle('locked', !level.ghost);
  hud.banner(`שלב ${level.id}`, level.name);
  canvas.focus();
}

function pause(): void {
  if (mode !== 'play') return;
  mode = 'paused';
  audio.suspend();
  showScreen('paused');
  $('resumeBtn').focus();
}
function resume(): void {
  if (mode !== 'paused') return;
  mode = 'play';
  audio.resume();
  showScreen(null);
}

function finishLevel(): void {
  mode = 'results';
  const runEvents = learningLog.slice(runLearningStart);
  const firstUnaided = runEvents.filter((e) => e.firstUnaided && e.outcome === 'pass').length;
  const rank = sim.rank;
  const order = ['C', 'B', 'A', 'S'];
  const prev = progress.ranks[level.id];
  if (!fresh && (!prev || order.indexOf(rank) > order.indexOf(prev))) progress.ranks[level.id] = rank;
  progress.best[level.id] = Math.max(progress.best[level.id] ?? 0, sim.score);
  saveProgress();
  $('resEyebrow').textContent = `שלב ${level.id} · ${level.name}${fresh ? ' · תרגילים חדשים' : ''}`;
  $('resRank').textContent = rank;
  $('resScore').textContent = sim.score.toLocaleString('en-US');
  $('resCombo').textContent = String(sim.bestCombo);
  $('resCrashes').textContent = String(sim.crashes);
  $('resHints').textContent = String(sim.hints);
  $('resFirst').textContent = `${firstUnaided}/${level.segments.length}`;
  const notes: Record<string, string> = {
    S: 'מושלם! בלי התנגשויות ובלי רוח רפאים.',
    A: 'כמעט מושלם. עוד ריצה ל־S?',
    B: 'עברתם! שימו לב לסימנים ונסו שוב לדירוג גבוה יותר.',
    C: 'עברתם את כל המנהרות. ריצה נוספת תהיה חלקה יותר.',
  };
  $('resNote').textContent = notes[rank];
  const hasNext = levelIdx < LEVELS.length - 1;
  $('nextBtn').textContent = hasNext ? 'לשלב הבא' : 'סיימתם את כל השלבים! לתפריט';
  hud.show(false);
  showScreen('results');
  audio.fanfare();
  $('nextBtn').focus();
}

$('goBtn').addEventListener('click', startRun);
$('backBtn1').addEventListener('click', toTitle);
$('backBtn2').addEventListener('click', toTitle);
$('quitBtn').addEventListener('click', toTitle);
$('resumeBtn').addEventListener('click', resume);
$('restartBtn').addEventListener('click', () => { audio.resume(); openIntro(levelIdx, fresh); startRun(); });
$('retryBtn').addEventListener('click', () => { openIntro(levelIdx, fresh); });
$('freshBtn').addEventListener('click', () => { openIntro(levelIdx, true); });
$('nextBtn').addEventListener('click', () => { if (levelIdx < LEVELS.length - 1) openIntro(levelIdx + 1, false); else toTitle(); });
$('pauseBtn').addEventListener('click', () => (mode === 'play' ? pause() : resume()));
$('muteBtn').addEventListener('click', () => setMuted(!progress.muted));

function toTitle(): void {
  mode = 'title';
  level = LEVELS[0];
  levelIdx = 0;
  fresh = false;
  audio.suspend();
  sim = new RunSim(level, 'normal');
  world.buildLevel(level, sim.layout);
  world.onRespawn(sim.value);
  hud.show(false);
  buildTitle();
  showScreen('title');
}

// ------------------------------------------------------------------ input
function lane(delta: number): void {
  if (mode !== 'play' || sim.phase !== 'run') return;
  const before = sim.lane;
  sim.moveLane(delta);
  if (sim.lane !== before) audio.lane();
}

window.addEventListener('keydown', (e) => {
  if (e.repeat && !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const k = e.key.toLowerCase();
  if (mode === 'intro' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); startRun(); return; }
  if (mode === 'play') {
    if (k === 'arrowleft' || k === 'a' || k === 'ש') { lane(-1); e.preventDefault(); }
    else if (k === 'arrowright' || k === 'd' || k === 'ג') { lane(1); e.preventDefault(); }
    else if (e.key === 'Shift') ghostKey = true;
    else if (k === 'p' || k === 'escape' || k === 'פ') pause();
    else if (k === 'm' || k === 'צ') setMuted(!progress.muted);
  } else if (mode === 'paused' && (k === 'p' || k === 'escape' || k === 'פ')) resume();
});
window.addEventListener('keyup', (e) => { if (e.key === 'Shift') ghostKey = false; });
window.addEventListener('blur', () => { ghostKey = false; ghostTouch = false; ghostButton = false; if (mode === 'play' && !TEST) pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play' && !TEST) pause(); });

// touch / mouse on the play field: swipe or tap a side; two fingers = ghost
let downX = 0, downY = 0, downId = -1;
const field = $('lanesTouch');
field.style.pointerEvents = 'auto';
field.addEventListener('pointerdown', (e) => {
  if (mode !== 'play') return;
  audio.unlock();
  downX = e.clientX; downY = e.clientY; downId = e.pointerId;
});
field.addEventListener('pointerup', (e) => {
  if (mode !== 'play' || e.pointerId !== downId || ghostTouch) return;
  const dx = e.clientX - downX, dy = e.clientY - downY;
  if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) lane(dx < 0 ? -1 : 1);
  else if (Math.abs(dx) < 14 && Math.abs(dy) < 14) lane(e.clientX < window.innerWidth / 2 ? -1 : 1);
  downId = -1;
});
field.addEventListener('touchstart', (e) => { if (e.touches.length >= 2) { ghostTouch = true; downId = -1; } }, { passive: true });
field.addEventListener('touchend', (e) => { if (e.touches.length < 2) ghostTouch = false; }, { passive: true });
field.addEventListener('touchcancel', () => { ghostTouch = false; }, { passive: true });
const gb = $('ghostBtn');
gb.addEventListener('pointerdown', (e) => { e.preventDefault(); ghostButton = true; gb.setPointerCapture(e.pointerId); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) gb.addEventListener(ev, () => { ghostButton = false; });

// ------------------------------------------------------------------ events
function handle(e: SimEvent): void {
  switch (e.type) {
    case 'gate':
      world.onGate(e.seg, e.row, e.choice.lane, e.choice.from, e.choice.to);
      audio.gate(e.choice.from, e.choice.to);
      hud.pushTrail(e.choice.to);
      if (mode === 'play' && e.choice.to < 0 && e.choice.from >= 0 && !belowShown && level.skin === 'sea') {
        belowShown = true;
        hud.banner('מתחת לקו המים!', 'מספר שלילי = מתחת לאפס');
      }
      if ((e.choice.to < 0) !== (e.choice.from < 0)) audio.splash();
      break;
    case 'pass':
      world.onPass(e.seg);
      audio.pass(e.combo);
      if (e.combo > 0 && e.combo % 4 === 0 && !e.hinted) hud.banner(`רצף ${e.combo}!`, `מכפיל ×${e.multiplier}`);
      if (e.hinted) hud.banner('עברתם בעזרת רוח רפאים', 'המכפיל חזר ל־×1');
      break;
    case 'crash': {
      world.onCrash(e.seg);
      audio.crash();
      hud.showCrash(e.explanation);
      try { navigator.vibrate?.(90); } catch { /* not supported */ }
      lastCrash = { result: e.value, tunnel: e.tunnel, lines: e.explanation.steps.map((s) => expression(s.from, s.op)) };
      break;
    }
    case 'respawn':
      world.onRespawn(e.value);
      audio.respawn();
      hud.hideCrash();
      hud.resetTrail(e.value);
      break;
    case 'hint':
      audio.hint();
      break;
    case 'checkpoint':
      hud.setLevel(level.id, level.name, level.segments.length, e.seg);
      if (level.segments[e.seg].rows.length === 2 && (level.segments[e.seg - 1]?.rows.length ?? 1) === 1) hud.banner('שתי שורות שערים!', 'בחרו מסלול בכל שורה');
      break;
    case 'done':
      world.onDone();
      hud.setLevel(level.id, level.name, level.segments.length, level.segments.length);
      doneTimer = 1.6;
      break;
  }
}

// ------------------------------------------------------------------ loop
function demoLane(): number {
  const sol = solutions(sim.starts[sim.seg], sim.segment)[0];
  return sol.lanes[Math.min(sim.row, sol.lanes.length - 1)];
}

function currentGhost(): number[] | null {
  return mode === 'play' && level.ghost && sim.ghostHeld ? sim.ghostPreview() : null;
}

function tick(dt: number, render: boolean): void {
  const playing = mode === 'play';
  const demo = mode === 'title' || mode === 'intro' && false;
  if (playing || demo) {
    if (demo) {
      if (sim.phase === 'run') sim.setLane(demoLane());
      if (sim.phase === 'done') { sim = new RunSim(level, 'normal'); world.buildLevel(level, sim.layout); world.onRespawn(sim.value); }
    }
    sim.setGhost(playing && (ghostKey || ghostTouch || ghostButton));
    acc += dt;
    while (acc >= STEP) {
      sim.step(STEP);
      acc -= STEP;
      const evs = sim.drainEvents();
      if (playing) {
        for (const e of evs) handle(e);
        if (sim.learning.length) logLearning(sim.learning.splice(0));
      } else {
        for (const e of evs) {
          if (e.type === 'gate') world.onGate(e.seg, e.row, e.choice.lane, e.choice.from, e.choice.to);
          if (e.type === 'pass') world.onPass(e.seg);
        }
        sim.learning.length = 0;
      }
    }
    if (playing && doneTimer > 0) {
      doneTimer -= dt;
      if (doneTimer <= 0) finishLevel();
    }
  }
  const pdt = mode === 'paused' ? 0 : dt;
  const ghost = currentGhost();
  $('ghostBtn').classList.toggle('active', !!ghost);
  world.update(pdt, sim, ghost, render);
  if (playing || mode === 'paused') {
    hud.updateRuler(sim.value, sim.phase === 'done' ? sim.value : sim.segment.tunnel, pdt);
    const a = world.readoutAnchor(window.innerWidth, window.innerHeight);
    const minX = window.innerWidth < 760 ? 160 : 260;
    hud.setReadout(sim.value, Math.max(minX, a.x), a.y, a.visible);
    hud.setStats(sim.score, sim.multiplier, sim.combo);
    if (sim.phase === 'crash') hud.setCrashCount(Math.ceil(sim.crashTimer / sim.beat) - 0);
    const under = Math.min(1, Math.max(0, -world.camera.position.y / 3));
    audio.setUnder(under, level.skin === 'ice');
    if (playing) audio.tickMusic(sim.t / sim.beat, sim.beat, Math.min(1, sim.combo / 4));
  }
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === 'play') {
    fpsSamples.push(dt);
    if (fpsSamples.length >= 180) {
      const avg = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;
      if (1 / avg < 38 && world.bloomOn) { world.bloomOn = false; console.info('Sign Runner: bloom off for frame rate'); }
      fpsSamples = [];
    }
  }
  if (!externalClock) tick(dt, true);
  else world.update(0, sim, currentGhost(), true);
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ test hooks
function renderGameToText(): string {
  const seg = sim.segment;
  const rowsLeft = sim.phase === 'done' ? [] : seg.rows.slice(sim.row).map((row, i) => ({
    rowIndex: sim.row + i,
    distance_m: +(sim.layout[sim.seg].rowZ[sim.row + i] - sim.z).toFixed(1),
    lanes: row.map((op, ln) => ({ lane: ln, gate: opLabel(op) })),
  }));
  const data = {
    coords: 'lanes 0=left,1=center,2=right on screen; altitude = value × 1.2 m (y up, 0 = waterline); runner moves forward',
    mode,
    level: { id: level.id, name: level.name, skin: level.skin, ghostAllowed: level.ghost, fresh, segments: level.segments.length },
    tempo: progress.tempo,
    bpm: sim.bpm,
    phase: sim.phase,
    value: sim.value,
    valueText: level.skin === 'ice' ? `${signed(sim.value)}°C` : signed(sim.value),
    lane: sim.lane,
    segment: sim.seg + 1,
    attempt: sim.attempt,
    checkpointValue: sim.starts[sim.seg],
    tunnel: sim.phase === 'done' ? null : { height: seg.tunnel, distance_m: +(sim.layout[sim.seg].tunnelZ - sim.z).toFixed(1) },
    gatesAhead: rowsLeft,
    ghostHeld: sim.ghostHeld && level.ghost,
    ghostPreview: sim.ghostHeld && level.ghost ? sim.ghostPreview() : null,
    hintUsedThisAttempt: sim.hintThisAttempt,
    combo: sim.combo,
    multiplier: sim.multiplier,
    score: sim.score,
    crashes: sim.crashes,
    hints: sim.hints,
    crashRespawnIn_s: sim.phase === 'crash' ? +sim.crashTimer.toFixed(2) : null,
    lastCrash,
    rank: sim.phase === 'done' ? sim.rank : null,
    models: world.modelsReady,
    learningEvents: learningLog.length,
  };
  return JSON.stringify(data);
}

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (ms: number) => void;
    __signRunner: { learning: () => LearningEvent[]; crashBeats: number; start: (levelIndex: number, fresh?: boolean) => void };
  }
}
window.render_game_to_text = renderGameToText;
window.advanceTime = (ms: number) => {
  externalClock = true;
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i++) tick(1 / 60, i === steps - 1);
};
window.__signRunner = { learning: () => learningLog.slice(), crashBeats: CRASH_BEATS, start: (i, f = false) => { openIntro(i, f); startRun(); } };

if (TEST) (window as unknown as { __world: World }).__world = world;
buildTitle();
showScreen('title');
requestAnimationFrame(frame);
