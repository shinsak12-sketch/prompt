/* 창립 42주년 프롬프터 v2 · 연속 스크롤 엔진 */
'use strict';
(() => {
const $ = id => document.getElementById(id);
const SRC = window.PROMPTER_SCRIPT;
const LS = { settings: 'prompter42:settings', edits: 'prompter42:edits', holds: 'prompter42:holds' };
const SPEED_VH = [1.0, 1.3, 1.6, 1.9, 2.2, 2.6, 3.0, 3.5, 4.0, 4.6]; // 단계 1~10, 단위 vh/s
const DEFAULTS = { level: 5, fontVh: 7, widthPct: 86, guidePct: 33, lineHeight: 1.45, gain: 2, fade: true, autoHold: true, hudPin: false, mirror: false, clicker: 'flow' };

/* ---------- 저장 ---------- */
const load = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v && typeof v === 'object' ? v : fb; } catch (_) { return fb; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
let settings = { ...DEFAULTS, ...load(LS.settings, {}) };
let edits = load(LS.edits, {});   // itemId -> text
let holds = load(LS.holds, {});   // cueId  -> bool
const textOf = it => edits[it.id] ?? it.text;
const holdOf = c => holds[c.id] ?? !!c.hold;

/* ---------- DOM ---------- */
const stage = $('stage'), mirror = $('mirror'), roll = $('roll');
const state = { y: 0, vel: 0, running: false, hold: null, tween: null, startY: 0, lastT: 0, elapsed: 0, endY: 1, blank: false, consumed: new Set(), idleTimer: 0, toastTimer: 0 };
let blocks = [];   // { el, kind, item?, cue?, index? }
let lineEls = [];  // 화자 대사 블록 순서대로

/* ---------- 렌더 ---------- */
function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
function render() {
  const frag = document.createDocumentFragment(); blocks = []; lineEls = [];
  const push = (node, meta) => { node.classList.add('blk'); frag.append(node); blocks.push({ el: node, ...meta }); };
  const cueNode = c => {
    const n = el('div', 'cue' + (holdOf(c) ? ' hold' : ''));
    if (holdOf(c)) n.append(el('span', 'badge', 'HOLD'));
    n.append(document.createTextNode(c.text)); n.dataset.cue = c.id; return n;
  };
  SRC.items.forEach((it, index) => {
    for (const b of it.before) {
      if (b.kind === 'heading') push(el('div', 'sec' + (b.text.startsWith('#') ? '' : ' sub'), b.text), { kind: 'sec', text: b.text });
      else push(cueNode(b), { kind: 'cue', cue: b });
    }
    const cls = SRC.speakers[it.speaker] || 'a';
    const n = el('div', 'line ' + cls); n.dataset.index = index;
    n.append(el('div', 'who', it.speaker), el('div', 'txt', textOf(it)));
    push(n, { kind: 'line', item: it, index }); lineEls.push(n);
  });
  for (const t of SRC.tail) push(t.kind === 'cue' ? cueNode(t) : el('div', 'sec', t.text), { kind: t.kind, cue: t });
  push(el('div', 'endmark', '— 대본 끝 —'), { kind: 'end' });
  roll.replaceChildren(frag);
  layout();
}
function guidePx() { return innerHeight * settings.guidePct / 100; }
function lineHeightPx() { return innerHeight * settings.fontVh / 100 * settings.lineHeight; }
function layout() {
  const endBlk = blocks[blocks.length - 1];
  state.endY = Math.max(1, endBlk.el.offsetTop - guidePx());
  // 진행 바 마커
  const m = $('progress').querySelector('.markers'); m.replaceChildren();
  for (const b of blocks) {
    if (b.kind === 'sec' && b.text.startsWith('#')) { const s = el('span'); s.style.left = (b.el.offsetTop - guidePx()) / state.endY * 100 + '%'; s.dataset.label = b.text; m.append(s); }
    else if (b.kind === 'cue' && holdOf(b.cue)) { const s = el('span', 'hold'); s.style.left = (b.el.offsetTop - guidePx()) / state.endY * 100 + '%'; s.dataset.label = 'HOLD'; m.append(s); }
  }
  setY(state.y); paintHud();
}
/* 읽기선에 걸린 위치를 (블록, 비율)로 기억 → 글자·폭 변경 후 복원 */
function anchor() {
  const docY = state.y + guidePx();
  for (const b of blocks) { const t = b.el.offsetTop, h = b.el.offsetHeight; if (docY < t + h) return { b, f: Math.max(0, (docY - t) / Math.max(1, h)) }; }
  return null;
}
function relayout(fn) { const a = anchor(); fn(); layout(); if (a) setY(a.b.el.offsetTop + a.f * a.b.el.offsetHeight - guidePx()); }

/* ---------- 설정 적용 ---------- */
function applySettings() {
  const r = document.documentElement.style;
  r.setProperty('--font', settings.fontVh + 'vh'); r.setProperty('--width', settings.widthPct + '%');
  r.setProperty('--guide', settings.guidePct + 'vh'); r.setProperty('--lh', settings.lineHeight);
  stage.classList.toggle('nofade', !settings.fade); stage.classList.toggle('hud-pin', settings.hudPin);
  mirror.classList.toggle('flip', settings.mirror); $('btn-mirror').classList.toggle('active', settings.mirror);
  $('speed-out').textContent = settings.level; $('hud-speed').querySelector('b').textContent = settings.level;
  $('font-out').textContent = settings.fontVh.toFixed(1);
  $('in-guide').value = settings.guidePct; $('guide-out').textContent = settings.guidePct;
  $('in-width').value = settings.widthPct; $('width-out').textContent = settings.widthPct;
  $('in-lh').value = settings.lineHeight; $('lh-out').textContent = settings.lineHeight.toFixed(2);
  $('in-gain').value = settings.gain; $('gain-out').textContent = settings.gain.toFixed(1);
  $('in-fade').checked = settings.fade; $('in-hold').checked = settings.autoHold; $('in-hud').checked = settings.hudPin; $('in-clicker').value = settings.clicker;
  save(LS.settings, settings);
}
function setSetting(key, val, reflow) { if (reflow) relayout(() => { settings[key] = val; applySettings(); }); else { settings[key] = val; applySettings(); } }
function speedPx() { return innerHeight * SPEED_VH[settings.level - 1] / 100; }

/* ---------- 엔진 ---------- */
function setY(y) { state.y = Math.min(state.endY, Math.max(0, y)); roll.style.transform = `translate3d(-50%, ${-state.y}px, 0)`; $('progress').querySelector('.fill').style.width = (state.y / state.endY * 100) + '%'; }
function frame(t) {
  const dt = Math.min(0.05, (t - (state.lastT || t)) / 1000); state.lastT = t;
  if (state.tween) {
    const tw = state.tween, p = Math.min(1, (t - tw.t0) / tw.dur), e = 1 - Math.pow(1 - p, 3);
    setY(tw.from + (tw.to - tw.from) * e);
    if (p >= 1) { state.tween = null; if (tw.then) tw.then(); }
  } else {
    const target = state.running ? speedPx() : 0;
    state.vel += (target - state.vel) * Math.min(1, dt / 0.22);   // 가감속
    if (Math.abs(state.vel) > 0.01 || state.running) {
      const prev = state.y; const next = prev + state.vel * dt;
      if (state.running) {
        state.elapsed += dt;
        const h = settings.autoHold && holdAhead(prev, next);
        if (h) { setY(h.thr); stop('hold', h); }
        else if (next >= state.endY) { setY(state.endY); stop('end'); }
        else setY(next);
      } else setY(next);
      paintHud();
    }
  }
  requestAnimationFrame(frame);
}
function holdAhead(prev, next) {
  for (const b of blocks) {
    if (b.kind !== 'cue' || !holdOf(b.cue) || state.consumed.has(b.cue.id)) continue;
    const thr = b.el.offsetTop - guidePx();
    if (prev < thr && next >= thr) return { thr, cue: b.cue, el: b.el };
  }
  return null;
}
function releaseConsumed() { for (const b of blocks) if (b.kind === 'cue' && state.consumed.has(b.cue.id) && state.y < b.el.offsetTop - guidePx() - lineHeightPx()) state.consumed.delete(b.cue.id); }
function run() {
  if (state.running) return;
  if (state.y >= state.endY - 1) { toast('대본 끝. Home으로 처음으로'); return; }
  if (state.hold) { state.consumed.add(state.hold.cue.id); state.hold = null; $('hold-badge').hidden = true; }
  state.running = true; state.startY = state.y; state.tween = null;
  wakeLock(true); paintState();
}
function stop(reason, h) {
  state.running = false; state.vel = 0;
  if (reason === 'hold') { state.hold = h; $('hold-badge').hidden = false; }
  if (reason === 'end') toast('대본 끝');
  paintState();
}
function toggle() { state.running ? stop('user') : run(); }
function tweenTo(to, dur, then) { const was = state.running; state.running = false; state.vel = 0; state.tween = { from: state.y, to: Math.min(state.endY, Math.max(0, to)), t0: performance.now(), dur, then: () => { releaseConsumed(); if (was) run(); then && then(); } }; paintState(); }
function nudge(dir) { tweenTo(state.y + dir * lineHeightPx(), 220); }
function jumpToBlock(b) { if (state.hold) { state.hold = null; $('hold-badge').hidden = true; } state.running = false; state.vel = 0; state.tween = { from: state.y, to: Math.min(state.endY, Math.max(0, b.el.offsetTop - guidePx())), t0: performance.now(), dur: 420, then: () => { releaseConsumed(); paintState(); } }; paintState(); }
function currentLineIdx() { const docY = state.y + guidePx() + 2; let idx = -1; lineEls.forEach((n, i) => { if (n.offsetTop <= docY) idx = i; }); return idx; }
function prevNextLine(dir) {
  const docY = state.y + guidePx();
  let target = null;
  if (dir > 0) target = lineEls.find(n => n.offsetTop > docY + 2);
  else { for (let i = lineEls.length - 1; i >= 0; i--) if (lineEls[i].offsetTop < docY - 2) { target = lineEls[i]; break; } }
  if (target) jumpToBlock({ el: target });
}
function goSection(i) { const sec = SRC.sections[i]; const b = sec && blocks.find(x => x.kind === 'sec' && x.text === sec.text); if (b) { jumpToBlock(b); toast(b.text); } }
function home() { state.consumed.clear(); if (state.hold) { state.hold = null; $('hold-badge').hidden = true; } state.running = false; state.elapsed = 0; tweenTo(0, 500); toast('대본 처음'); }

/* ---------- 카운트다운·블랭크·전체화면·미러 ---------- */
let cdTimer = 0;
function countdown() {
  if (state.running) return; clearInterval(cdTimer);
  const box = $('countdown'), num = box.querySelector('b'); let n = 3; num.textContent = n; box.hidden = false;
  cdTimer = setInterval(() => { n--; if (n <= 0) { clearInterval(cdTimer); box.hidden = true; run(); } else num.textContent = n; }, 1000);
}
function cancelCountdown() { if (!$('countdown').hidden) { clearInterval(cdTimer); $('countdown').hidden = true; } }
function blank(force) { state.blank = force ?? !state.blank; $('blank').hidden = !state.blank; $('btn-blank').classList.toggle('active', state.blank); if (state.blank && state.running) stop('user'); }
async function fullscreen() { try { document.fullscreenElement ? await document.exitFullscreen() : await document.documentElement.requestFullscreen(); } catch (_) { toast('전체화면은 F11로'); } }
let lock = null;
async function wakeLock(on) { try { if (on && !lock && 'wakeLock' in navigator) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => lock = null); } } catch (_) {} }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && state.running) wakeLock(true); });

/* ---------- HUD·컨트롤 표시 ---------- */
const fmt = s => { s = Math.max(0, Math.round(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
function paintState() {
  const st = $('hud-state'); st.className = 'state ' + (state.hold ? 'hold' : state.running ? 'running' : 'stopped');
  st.querySelector('b').textContent = state.hold ? 'HOLD' : state.running ? 'RUN' : 'STOP';
  const b = $('btn-toggle'); b.textContent = state.running ? '❚❚ 정지' : state.hold ? '▶ 재개' : state.y > 0 ? '▶ 재개' : '▶ 시작';
  b.classList.toggle('on', state.running); stage.classList.toggle('running', state.running);
  $('endcap').hidden = state.y < state.endY - 1;
  paintHud();
}
let hudTick = 0;
function paintHud() {
  const now = performance.now(); if (now - hudTick < 200) return; hudTick = now;
  $('hud-elapsed').textContent = fmt(state.elapsed);
  $('hud-remain').textContent = '−' + fmt((state.endY - state.y) / speedPx());
  const i = currentLineIdx(); const docY = state.y + guidePx() + 2; let sec = '';
  for (const b of blocks) { if (b.kind === 'sec' && b.text.startsWith('#') && b.el.offsetTop <= docY) sec = b.text; }
  $('hud-section').textContent = (sec || SRC.sections[0].text) + (i >= 0 ? ` · ${i + 1}/${SRC.items.length}` : '');
}
function wake() { stage.classList.remove('idle'); clearTimeout(state.idleTimer); state.idleTimer = setTimeout(() => stage.classList.add('idle'), 3000); }
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => t.hidden = true, 1800); }
function panel(id, open) { const p = $(id); const other = id === 'settings' ? 'help' : 'settings'; $(other).hidden = true; p.hidden = open ?? !p.hidden; }

/* ---------- 입력 ---------- */
stage.addEventListener('pointermove', wake);
stage.addEventListener('pointerdown', wake);
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $(b.dataset.close).hidden = true));
$('btn-toggle').onclick = toggle; $('btn-slower').onclick = () => setLevel(-1); $('btn-faster').onclick = () => setLevel(1);
$('btn-prev').onclick = () => prevNextLine(-1); $('btn-next').onclick = () => prevNextLine(1);
$('btn-back').onclick = () => { tweenTo(state.startY, 400); toast('재생 시작점'); };
$('btn-font-minus').onclick = () => setSetting('fontVh', Math.max(3, +(settings.fontVh - 0.5).toFixed(1)), true);
$('btn-font-plus').onclick = () => setSetting('fontVh', Math.min(14, +(settings.fontVh + 0.5).toFixed(1)), true);
$('btn-countdown').onclick = countdown; $('btn-blank').onclick = () => blank(); $('btn-mirror').onclick = () => setSetting('mirror', !settings.mirror);
$('btn-full').onclick = fullscreen; $('btn-settings').onclick = () => panel('settings'); $('btn-help').onclick = () => panel('help'); $('btn-edit').onclick = enterEdit;
$('btn-home').onclick = home; $('btn-reset-settings').onclick = () => relayout(() => { settings = { ...DEFAULTS }; applySettings(); });
$('in-guide').oninput = e => setSetting('guidePct', +e.target.value, true);
$('in-width').oninput = e => setSetting('widthPct', +e.target.value, true);
$('in-lh').oninput = e => setSetting('lineHeight', +e.target.value, true);
$('in-gain').oninput = e => setSetting('gain', +e.target.value);
$('in-fade').onchange = e => setSetting('fade', e.target.checked);
$('in-hold').onchange = e => setSetting('autoHold', e.target.checked);
$('in-hud').onchange = e => setSetting('hudPin', e.target.checked);
$('in-clicker').onchange = e => setSetting('clicker', e.target.value);
SRC.sections.forEach((s, i) => { const o = el('option', '', s.text); o.value = i; $('sel-section').append(o); });
$('sel-section').onchange = e => { if (e.target.value !== '') goSection(+e.target.value); e.target.value = ''; e.target.blur(); };
$('progress').addEventListener('click', e => { const r = e.currentTarget.getBoundingClientRect(); tweenTo((e.clientX - r.left) / r.width * state.endY, 400); });
function setLevel(d) { setSetting('level', Math.min(10, Math.max(1, settings.level + d))); toast('속도 ' + settings.level); }

// 무대 클릭: 진행 중 → 정지, 정지 중 대사 클릭 → 그 대사부터, 빈 곳 클릭 → 시작
mirror.addEventListener('click', e => {
  if (!$('settings').hidden || !$('help').hidden) { $('settings').hidden = $('help').hidden = true; return; }
  const line = e.target.closest('.line');
  if (state.running) return stop('user');
  if (line) { jumpToBlock({ el: line }); toast('여기부터'); } else toggle();
});
// 휠 = 넛지 (게인 적용). 진행 중에도 위치만 보정
mirror.addEventListener('wheel', e => { e.preventDefault(); wake(); state.tween = null; setY(state.y + e.deltaY * settings.gain * 0.5); releaseConsumed(); paintHud(); }, { passive: false });
stage.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('keydown', e => {
  if (document.body.dataset.mode === 'edit') { if (e.key === 'Escape') exitEdit(); return; }
  if (e.target.matches('input,select,textarea')) { if (e.key === 'Escape') { e.target.blur(); panel('settings', false); } return; }
  const k = e.key, mod = e.ctrlKey || e.metaKey || e.altKey;
  if (mod) return;
  const act = {
    ' ': toggle, 'Enter': toggle,
    'ArrowUp': () => e.shiftKey ? nudge(-1) : setLevel(1), 'ArrowDown': () => e.shiftKey ? nudge(1) : setLevel(-1),
    'ArrowLeft': () => prevNextLine(-1), 'ArrowRight': () => prevNextLine(1),
    'PageDown': () => settings.clicker === 'flow' ? toggle() : prevNextLine(1),
    'PageUp': () => settings.clicker === 'flow' ? nudge(-1) : prevNextLine(-1),
    'F5': () => { if (!state.running) run(); }, '.': () => blank(),
    'Backspace': () => { tweenTo(state.startY, 400); toast('재생 시작점'); },
    'Home': home, 'End': () => { state.running = false; tweenTo(state.endY, 500); },
    '+': () => $('btn-font-plus').click(), '=': () => $('btn-font-plus').click(), '-': () => $('btn-font-minus').click(),
    'Escape': () => { cancelCountdown(); if (state.running) stop('user'); panel('settings', false); $('help').hidden = true; },
    '?': () => panel('help'), '/': () => panel('help'),
  };
  const lower = k.length === 1 ? k.toLowerCase() : k;
  const letters = { c: countdown, b: () => blank(), f: fullscreen, m: () => setSetting('mirror', !settings.mirror), h: () => { setSetting('hudPin', !settings.hudPin); toast(settings.hudPin ? 'HUD 고정' : 'HUD 자동 숨김'); }, e: enterEdit };
  let fn = act[k] || letters[lower];
  if (!fn && /^[1-8]$/.test(k)) fn = () => goSection(+k - 1);
  if (!fn) return;
  e.preventDefault(); if (e.repeat && !['ArrowUp', 'ArrowDown', 'PageUp'].includes(k)) return;
  wake(); fn();
}, true);

window.addEventListener('resize', () => relayout(() => {}));
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

/* ---------- 편집 모드 ---------- */
function enterEdit() {
  if (state.running) stop('user');
  if (!confirm('편집 모드로 전환할까요?\n촬영 중이면 취소하세요.')) return;
  cancelCountdown(); document.body.dataset.mode = 'edit'; $('editor').hidden = false; buildEditor(); location.hash = 'edit';
}
function exitEdit() { document.body.dataset.mode = 'show'; $('editor').hidden = true; if (location.hash) history.replaceState(null, '', location.pathname); relayout(render); wake(); toast('촬영 모드'); }
function buildEditor() {
  $('ed-meta').textContent = `${SRC.items.length}개 대사 · 원본 ${SRC.sourceName} · 수정 ${Object.keys(edits).length}건`;
  const list = $('ed-list'); list.replaceChildren();
  const cueRow = c => {
    const row = el('div', 'ed-cue'); row.append(el('span', 'k', c.kind === 'cue' ? 'CUE' : 'SEC'), el('span', '', c.text));
    const lab = el('label'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = holdOf(c);
    cb.onchange = () => { holds[c.id] = cb.checked; save(LS.holds, holds); };
    lab.append(cb, document.createTextNode('HOLD')); row.append(lab); return row;
  };
  SRC.items.forEach((it, i) => {
    for (const b of it.before) { if (b.kind === 'heading') list.append(el('div', 'ed-sec', b.text)); else list.append(cueRow(b)); }
    const row = el('div', 'ed-item ' + (SRC.speakers[it.speaker] || 'a') + (edits[it.id] != null ? ' changed' : ''));
    const who = el('div', 'who', it.speaker); who.append(el('small', '', `${i + 1} / ${SRC.items.length}`)); row.append(who);
    const ta = el('textarea'); ta.value = textOf(it); ta.rows = 1; ta.id = 'ta-' + it.id;
    const fit = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; };
    ta.oninput = () => { const v = ta.value.replace(/\r\n?/g, '\n'); if (v === it.text) delete edits[it.id]; else edits[it.id] = v; save(LS.edits, edits); row.classList.toggle('changed', edits[it.id] != null); fit(); $('ed-meta').textContent = $('ed-meta').textContent.replace(/수정 \d+건/, `수정 ${Object.keys(edits).length}건`); };
    row.append(ta); requestAnimationFrame(fit);
    const tools = el('div', 'tools'); const rb = el('button', '', '원문으로'); rb.onclick = () => { ta.value = it.text; ta.dispatchEvent(new Event('input')); }; tools.append(rb); row.append(tools);
    list.append(row);
  });
  for (const t of SRC.tail) list.append(cueRow(t));
}
$('ed-done').onclick = exitEdit;
$('ed-restore').onclick = () => { if (confirm('모든 수정과 HOLD 설정을 원본으로 되돌릴까요?')) { edits = {}; holds = {}; save(LS.edits, edits); save(LS.holds, holds); buildEditor(); } };
$('ed-export').onclick = () => {
  const blob = new Blob([JSON.stringify({ sourceHash: SRC.sourceHash, edits, holds, exportedAt: new Date().toISOString() }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '프롬프터_수정본.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};
$('ed-import').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try { const j = JSON.parse(await f.text()); if (j.sourceHash && j.sourceHash !== SRC.sourceHash && !confirm('다른 대본에서 내보낸 파일입니다. 그래도 적용할까요?')) return;
    edits = j.edits && typeof j.edits === 'object' ? j.edits : {}; holds = j.holds && typeof j.holds === 'object' ? j.holds : {}; save(LS.edits, edits); save(LS.holds, holds); buildEditor(); }
  catch (_) { alert('JSON 파일을 읽을 수 없습니다.'); }
  e.target.value = '';
};

/* ---------- 시작 ---------- */
applySettings(); render(); paintState(); wake();
requestAnimationFrame(t => { state.lastT = t; frame(t); });
if (location.hash === '#edit') { document.body.dataset.mode = 'edit'; $('editor').hidden = false; buildEditor(); }
})();
