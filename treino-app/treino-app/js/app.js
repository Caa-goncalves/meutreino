import { db, uid, exportBackup, importBackup } from './db.js';
import { seedIfEmpty, DAY_NAMES } from './seed.js';

const appEl = document.getElementById('app');
const navEl = document.getElementById('bottom-nav');

let restInterval = null;
let audioCtx = null;

// ---------------- utils ----------------

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

function todayWeekday() {
  return new Date().getDay(); // 0 = domingo ... 6 = sábado
}

function formatDateBR(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function parseRepsFloor(repsStr) {
  const m = String(repsStr || '').match(/\d+/);
  return m ? m[0] : '';
}

function toast(msg) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

function confirmAction(msg) {
  return window.confirm(msg);
}

// ---------------- router ----------------

const routes = {
  home: renderHome,
  workout: renderWorkout,
  exerciseEditor: renderExerciseEditor,
  history: renderHistory,
  exerciseEvolution: renderExerciseEvolution,
  settings: renderSettings,
  dayEditor: renderDayEditor,
  workoutManager: renderWorkoutManager
};

function parseHash() {
  const hash = window.location.hash.slice(1) || '/';
  const parts = hash.split('/').filter(Boolean);
  return parts;
}

async function router() {
  const parts = parseHash();
  updateNav(parts[0]);
  window.scrollTo(0, 0);

  if (parts.length === 0) return routes.home();
  if (parts[0] === 'treino' && parts[1]) return routes.workout(parts[1]);
  if (parts[0] === 'exercicio') return routes.exerciseEditor(parts[1], parts[2]);
  if (parts[0] === 'historico') return routes.history();
  if (parts[0] === 'evolucao' && parts[1]) return routes.exerciseEvolution(parts[1]);
  if (parts[0] === 'config') return routes.settings();
  if (parts[0] === 'dias') return routes.dayEditor();
  if (parts[0] === 'treinos') return routes.workoutManager();
  return routes.home();
}

function updateNav(section) {
  const map = { '': 'home', undefined: 'home', historico: 'history', config: 'settings' };
  const active = ['treino', 'exercicio', 'dias', 'treinos'].includes(section) ? 'home' :
    (map[section] || section);
  navEl.querySelectorAll('.nav-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.nav === active);
  });
}

window.addEventListener('hashchange', router);

// ---------------- HOME ----------------

async function renderHome() {
  const [days, workouts] = await Promise.all([
    db.getAll(db.STORES.days),
    db.getAll(db.STORES.workouts)
  ]);
  days.sort((a, b) => a.id - b.id);
  const workoutMap = Object.fromEntries(workouts.map((w) => [w.id, w]));
  const today = todayWeekday();

  const cards = days.map((day) => {
    const isToday = day.id === today;
    if (day.type === 'rest') {
      return `<div class="day-card is-rest ${isToday ? 'today' : ''}">
        <div class="day-info">
          <span class="day-name">${day.name}</span>
          <span class="rest-label">Descanso</span>
        </div>
      </div>`;
    }
    const w = workoutMap[day.workoutId];
    const name = w ? w.name : 'Treino não definido';
    return `<a href="#/treino/${day.workoutId || ''}" class="day-card ${isToday ? 'today' : ''}" ${!day.workoutId ? 'style="pointer-events:none;opacity:.5"' : ''}>
      <div class="day-info">
        <span class="day-name">${day.name}</span>
        <span class="workout-name">${escapeHtml(name)}</span>
      </div>
      <span class="chevron">›</span>
    </a>`;
  }).join('');

  appEl.innerHTML = `
    <div class="topbar">
      <div>
        <span class="eyebrow">Sua semana</span>
        <h1>Treinos</h1>
      </div>
      <button class="icon-btn" style="margin-left:auto" data-action="go" data-href="#/dias">✏️</button>
    </div>
    <div class="screen">
      <div class="days-grid">${cards}</div>
      <button class="btn btn-secondary btn-block" data-action="go" data-href="#/treinos" style="margin-top:6px">
        Gerenciar treinos (A, B, C...)
      </button>
    </div>
  `;
}

// ---------------- DAY EDITOR ----------------

async function renderDayEditor() {
  const [days, workouts] = await Promise.all([
    db.getAll(db.STORES.days),
    db.getAll(db.STORES.workouts)
  ]);
  days.sort((a, b) => a.id - b.id);

  const rows = days.map((day) => `
    <div class="settings-row" style="flex-direction:column;align-items:stretch;gap:10px">
      <div class="label" style="font-weight:700">${day.name}</div>
      <div class="field-row" style="margin:0">
        <div class="field" style="margin:0">
          <select data-day="${day.id}" data-role="type">
            <option value="rest" ${day.type === 'rest' ? 'selected' : ''}>Descanso</option>
            <option value="workout" ${day.type === 'workout' ? 'selected' : ''}>Treino</option>
          </select>
        </div>
        <div class="field" style="margin:0">
          <select data-day="${day.id}" data-role="workout" ${day.type === 'rest' ? 'disabled' : ''}>
            <option value="">Selecionar treino</option>
            ${workouts.map((w) => `<option value="${w.id}" ${day.workoutId === w.id ? 'selected' : ''}>${escapeHtml(w.name)}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
  `).join('');

  appEl.innerHTML = `
    <div class="topbar">
      <button class="back-btn" data-action="go" data-href="#/">←</button>
      <div><span class="eyebrow">Configurar</span><h1>Dias da semana</h1></div>
    </div>
    <div class="screen">
      ${rows}
      <p style="color:var(--text-faint);font-size:.82rem;margin-top:14px">
        As alterações são salvas automaticamente. Crie ou renomeie treinos em "Gerenciar treinos".
      </p>
    </div>
  `;

  appEl.querySelectorAll('select[data-role="type"]').forEach((sel) => {
    sel.addEventListener('change', async () => {
      const dayId = Number(sel.dataset.day);
      const day = await db.get(db.STORES.days, dayId);
      day.type = sel.value;
      if (sel.value === 'rest') day.workoutId = null;
      await db.put(db.STORES.days, day);
      renderDayEditor();
    });
  });
  appEl.querySelectorAll('select[data-role="workout"]').forEach((sel) => {
    sel.addEventListener('change', async () => {
      const dayId = Number(sel.dataset.day);
      const day = await db.get(db.STORES.days, dayId);
      day.workoutId = sel.value || null;
      await db.put(db.STORES.days, day);
    });
  });
}

// ---------------- WORKOUT MANAGER (rename/add/remove workouts) ----------------

async function renderWorkoutManager() {
  const workouts = await db.getAll(db.STORES.workouts);
  workouts.sort((a, b) => a.order - b.order);

  const rows = workouts.map((w) => `
    <div class="exercise-list-item">
      <input data-wid="${w.id}" data-role="rename" value="${escapeHtml(w.name)}" style="background:transparent;border:none;font-weight:700;font-size:1rem;flex:1;padding:6px 0" />
      <button class="icon-btn" data-action="delete-workout" data-id="${w.id}">🗑️</button>
    </div>
  `).join('');

  appEl.innerHTML = `
    <div class="topbar">
      <button class="back-btn" data-action="go" data-href="#/">←</button>
      <div><span class="eyebrow">Configurar</span><h1>Treinos</h1></div>
    </div>
    <div class="screen">
      ${rows || '<p style="color:var(--text-faint)">Nenhum treino ainda.</p>'}
      <button class="btn btn-secondary btn-block" data-action="add-workout" style="margin-top:14px">+ Novo treino</button>
    </div>
  `;

  appEl.querySelectorAll('input[data-role="rename"]').forEach((inp) => {
    inp.addEventListener('change', async () => {
      const w = await db.get(db.STORES.workouts, inp.dataset.wid);
      w.name = inp.value.trim() || w.name;
      await db.put(db.STORES.workouts, w);
      toast('Nome atualizado');
    });
  });

  appEl.querySelectorAll('[data-action="delete-workout"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirmAction('Excluir este treino e todos os seus exercícios? O histórico já registrado é mantido.')) return;
      const wid = btn.dataset.id;
      const exercises = await db.getAllByIndex(db.STORES.exercises, 'workoutId', wid);
      await Promise.all(exercises.map((e) => db.delete(db.STORES.exercises, e.id)));
      await db.delete(db.STORES.workouts, wid);
      const days = await db.getAll(db.STORES.days);
      await Promise.all(days.filter((d) => d.workoutId === wid).map((d) => {
        d.type = 'rest'; d.workoutId = null;
        return db.put(db.STORES.days, d);
      }));
      renderWorkoutManager();
    });
  });

  const addBtn = appEl.querySelector('[data-action="add-workout"]');
  addBtn.addEventListener('click', async () => {
    const name = window.prompt('Nome do novo treino (ex: Treino E)');
    if (!name) return;
    const all = await db.getAll(db.STORES.workouts);
    await db.put(db.STORES.workouts, { id: uid('workout'), name: name.trim(), order: all.length });
    renderWorkoutManager();
  });
}

// ---------------- WORKOUT (treino do dia) ----------------

async function renderWorkout(workoutId) {
  const [workout, exercises] = await Promise.all([
    db.get(db.STORES.workouts, workoutId),
    db.getAllByIndex(db.STORES.exercises, 'workoutId', workoutId)
  ]);
  if (!workout) { window.location.hash = '#/'; return; }
  exercises.sort((a, b) => a.order - b.order);
  const date = todayISO();

  const cardsHtml = await Promise.all(exercises.map((ex) => renderExerciseCard(ex, date)));

  appEl.innerHTML = `
    <div class="topbar">
      <button class="back-btn" data-action="go" data-href="#/">←</button>
      <div>
        <span class="eyebrow">${formatDateBR(date)}</span>
        <h1>${escapeHtml(workout.name)}</h1>
      </div>
    </div>
    <div class="screen" id="exercise-list">
      ${cardsHtml.join('') || `<div class="empty-state"><span class="emoji">🗂️</span>Nenhum exercício neste treino ainda.<br>Toque no botão + para adicionar.</div>`}
    </div>
    <button class="fab" data-action="go" data-href="#/exercicio/${workoutId}/novo">+</button>
  `;

  bindWorkoutEvents(workoutId, date);
}

async function buildDefaultLog(ex, date) {
  const prevWeights = await getPreviousWeights(ex.id, date);
  const defaultReps = parseRepsFloor(ex.reps);
  return {
    id: `${ex.id}_${date}`, exerciseId: ex.id, date,
    exerciseNameSnapshot: ex.name,
    sets: Array.from({ length: ex.sets }, (_, i) => ({
      n: i + 1,
      weight: prevWeights[i] ?? '',
      reps: defaultReps,
      completed: false
    })),
    notes: ex.notes || ''
  };
}

async function renderExerciseCard(ex, date) {
  const logId = `${ex.id}_${date}`;
  let log = await db.get(db.STORES.logs, logId);

  if (!log) {
    log = await buildDefaultLog(ex, date);
  }

  const prevWeights = await getPreviousWeights(ex.id, date);
  const allDone = log.sets.length > 0 && log.sets.every((s) => s.completed);

  const setsHtml = log.sets.map((s) => `
    <div class="set-row ${s.completed ? 'done' : ''}">
      <button class="set-check ${s.completed ? 'checked' : ''}" data-action="toggle-set" data-log="${log.id}" data-exercise="${ex.id}" data-set="${s.n}">
        ${s.completed ? '✓' : ''}
      </button>
      <span class="set-label">Série ${s.n}</span>
      <div class="set-inputs">
        <div class="set-input-group">
          <input type="number" inputmode="decimal" placeholder="${prevWeights[s.n - 1] || '–'}" value="${s.weight}" data-action="set-weight" data-log="${log.id}" data-exercise="${ex.id}" data-set="${s.n}">
          <span class="unit">kg</span>
        </div>
        <div class="set-input-group">
          <input type="number" inputmode="numeric" value="${s.reps}" data-action="set-reps" data-log="${log.id}" data-exercise="${ex.id}" data-set="${s.n}">
          <span class="unit">reps</span>
        </div>
      </div>
    </div>
  `).join('');

  return `
    <div class="exercise-card ${allDone ? 'all-done' : ''}" data-exercise-id="${ex.id}">
      <div class="exercise-head">
        <div class="exercise-image">${ex.image && ex.image.startsWith('http') ? `<img src="${ex.image}" alt="">` : (ex.image || '🏋️')}</div>
        <div>
          <div class="exercise-title">${escapeHtml(ex.name)}</div>
          ${(() => {
            const nonEmpty = prevWeights.filter((w) => w !== '' && w != null);
            const lastLoadHtml = nonEmpty.length ? ` · <span class="prev-load">último: ${nonEmpty.join('/')} kg</span>` : '';
            return `<div class="exercise-meta">${ex.sets} séries × ${escapeHtml(ex.reps || '-')}${lastLoadHtml}</div>`;
          })()}
        </div>
        <div class="exercise-actions">
          <button class="icon-btn" data-action="move-up" data-exercise="${ex.id}" title="Mover para cima">↑</button>
          <button class="icon-btn" data-action="move-down" data-exercise="${ex.id}" title="Mover para baixo">↓</button>
          <a class="icon-btn" href="#/evolucao/${ex.id}">📈</a>
          <a class="icon-btn" href="#/exercicio/${ex.workoutId}/${ex.id}">✏️</a>
        </div>
      </div>
      ${setsHtml}
      <textarea class="notes-field" rows="1" placeholder="Observações (ex: pegada aberta, banco a 30°)" data-action="set-notes" data-log="${log.id}" data-exercise="${ex.id}">${escapeHtml(log.notes || '')}</textarea>
      <button class="rest-trigger" data-action="open-timer" data-seconds="${ex.restSeconds || 60}">⏱ Descansar ${ex.restSeconds || 60}s</button>
    </div>
  `;
}

// Retorna um array alinhado por índice de série com o peso da última vez que
// este exercício foi feito (vazio '' onde não houver registro), para pré-preencher os campos.
async function getPreviousWeights(exerciseId, beforeDate) {
  const logs = await db.getAllByIndex(db.STORES.logs, 'exerciseId', exerciseId);
  const prior = logs
    .filter((l) => l.date < beforeDate && l.sets.some((s) => s.completed))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  if (!prior.length) return [];
  return prior[0].sets.map((s) => (s.completed && s.weight !== '' && s.weight != null ? s.weight : ''));
}

function bindWorkoutEvents(workoutId, date) {
  const list = document.getElementById('exercise-list');
  if (!list) return;

  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="toggle-set"]');
    if (!btn) return;
    const log = await db.get(db.STORES.logs, btn.dataset.log) || await ensureLogExists(btn.dataset.log, btn.dataset.exercise, date);
    const set = log.sets.find((s) => s.n === Number(btn.dataset.set));
    set.completed = !set.completed;
    await db.put(db.STORES.logs, log);
    renderWorkout(workoutId);
  });

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="open-timer"]');
    if (!btn) return;
    openTimer(Number(btn.dataset.seconds));
  });

  list.addEventListener('change', async (e) => {
    const el = e.target;
    if (el.dataset.action === 'set-weight' || el.dataset.action === 'set-reps') {
      const log = await db.get(db.STORES.logs, el.dataset.log) || await ensureLogExists(el.dataset.log, el.dataset.exercise, date);
      const set = log.sets.find((s) => s.n === Number(el.dataset.set));
      if (el.dataset.action === 'set-weight') set.weight = el.value === '' ? '' : Number(el.value);
      if (el.dataset.action === 'set-reps') set.reps = el.value === '' ? '' : Number(el.value);
      await db.put(db.STORES.logs, log);
    }
    if (el.dataset.action === 'set-notes') {
      const log = await db.get(db.STORES.logs, el.dataset.log) || await ensureLogExists(el.dataset.log, el.dataset.exercise, date);
      log.notes = el.value;
      await db.put(db.STORES.logs, log);
    }
  });
}

async function ensureLogExists(logId, exerciseId, date) {
  const ex = await db.get(db.STORES.exercises, exerciseId);
  const log = ex ? await buildDefaultLog(ex, date) : {
    id: logId, exerciseId, date, exerciseNameSnapshot: '',
    sets: Array.from({ length: 3 }, (_, i) => ({ n: i + 1, weight: '', reps: '', completed: false })),
    notes: ''
  };
  log.id = logId;
  await db.put(db.STORES.logs, log);
  return log;
}

// ---------------- TIMER ----------------

function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.4);
  } catch (err) { /* áudio indisponível, tudo bem */ }
}

async function openTimer(initialSeconds) {
  // Garante que não haja outro cronômetro sobreposto
  clearInterval(restInterval);
  document.querySelectorAll('.timer-overlay').forEach((o) => o.remove());

  const settings = await db.get(db.STORES.settings, 'app') || { soundEnabled: true };
  const presets = [30, 45, 60, 90, 120];
  let total = initialSeconds || 60;
  let remaining = total;
  let running = true;

  const overlay = document.createElement('div');
  overlay.className = 'timer-overlay';
  overlay.innerHTML = `
    <div class="timer-ring-wrap">
      <svg viewBox="0 0 120 120">
        <circle class="timer-ring-bg" cx="60" cy="60" r="52"></circle>
        <circle class="timer-ring-fg" cx="60" cy="60" r="52" id="ring-fg"></circle>
      </svg>
      <div class="timer-time" id="timer-time">${remaining}s</div>
    </div>
    <div class="timer-label">Descanso</div>
    <div class="timer-controls">
      <button class="timer-adjust" id="t-minus">−15s</button>
      <button class="btn btn-primary" id="t-toggle" style="min-width:110px">Pausar</button>
      <button class="timer-adjust" id="t-plus">+15s</button>
    </div>
    <div class="timer-presets">
      ${presets.map((p) => `<button class="timer-preset ${p === total ? 'active' : ''}" data-preset="${p}">${p}s</button>`).join('')}
      <button class="timer-preset" id="t-custom">Personalizado</button>
    </div>
    <button class="btn btn-ghost" id="t-close" style="margin-top:24px">Fechar</button>
  `;
  document.body.appendChild(overlay);

  const ringFg = overlay.querySelector('#ring-fg');
  const circumference = 2 * Math.PI * 52;
  ringFg.style.strokeDasharray = `${circumference}`;
  const timeEl = overlay.querySelector('#timer-time');

  function updateRing() {
    const frac = Math.max(0, remaining / total);
    ringFg.style.strokeDashoffset = `${circumference * (1 - frac)}`;
    timeEl.textContent = `${Math.max(0, remaining)}s`;
  }
  updateRing();

  function tick() {
    if (!running) return;
    remaining -= 1;
    updateRing();
    if (remaining <= 0) {
      clearInterval(restInterval);
      running = false;
      overlay.classList.add('timer-done-flash');
      if (settings.soundEnabled !== false) beep();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      overlay.querySelector('#t-toggle').textContent = 'Concluído';
    }
  }
  restInterval = setInterval(tick, 1000);

  overlay.querySelector('#t-toggle').addEventListener('click', () => {
    running = !running;
    overlay.querySelector('#t-toggle').textContent = running ? 'Pausar' : 'Continuar';
  });
  overlay.querySelector('#t-minus').addEventListener('click', () => { remaining = Math.max(0, remaining - 15); total = Math.max(total, remaining); updateRing(); });
  overlay.querySelector('#t-plus').addEventListener('click', () => { remaining += 15; total = Math.max(total, remaining); updateRing(); });
  overlay.querySelectorAll('[data-preset]').forEach((b) => {
    b.addEventListener('click', () => {
      total = Number(b.dataset.preset); remaining = total; running = true;
      overlay.querySelector('#t-toggle').textContent = 'Pausar';
      overlay.classList.remove('timer-done-flash');
      overlay.querySelectorAll('.timer-preset').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      updateRing();
    });
  });
  overlay.querySelector('#t-custom').addEventListener('click', () => {
    const v = window.prompt('Tempo de descanso personalizado (segundos)', String(total));
    const n = Number(v);
    if (n > 0) {
      total = n; remaining = n; running = true;
      overlay.querySelector('#t-toggle').textContent = 'Pausar';
      overlay.classList.remove('timer-done-flash');
      updateRing();
    }
  });
  overlay.querySelector('#t-close').addEventListener('click', () => {
    clearInterval(restInterval);
    overlay.remove();
  });
}

// ---------------- EXERCISE EDITOR ----------------

async function renderExerciseEditor(workoutId, exerciseId) {
  const isNew = !exerciseId || exerciseId === 'novo';
  const [workouts, existing] = await Promise.all([
    db.getAll(db.STORES.workouts),
    isNew ? null : db.get(db.STORES.exercises, exerciseId)
  ]);
  const ex = existing || {
    id: uid('ex'), workoutId, order: 999, name: '', nameEn: '', muscleGroup: '',
    equipment: '', instructions: '', image: '🏋️', sets: 3, reps: '10-12', restSeconds: 60, notes: ''
  };

  appEl.innerHTML = `
    <div class="topbar">
      <button class="back-btn" data-action="go" data-href="#/treino/${ex.workoutId}">←</button>
      <div><span class="eyebrow">${isNew ? 'Novo' : 'Editar'}</span><h1>${isNew ? 'Adicionar exercício' : 'Editar exercício'}</h1></div>
    </div>
    <div class="screen">
      <form id="ex-form">
        <div class="field">
          <label>Nome (exibido no app)</label>
          <input name="name" required value="${escapeHtml(ex.name)}" placeholder="Ex: Elevação pélvica">
        </div>
        <div class="field">
          <label>Nome em inglês (opcional, referência interna)</label>
          <input name="nameEn" value="${escapeHtml(ex.nameEn || '')}" placeholder="Ex: Hip Thrust">
        </div>
        <div class="field-row">
          <div class="field">
            <label>Grupo muscular</label>
            <input name="muscleGroup" value="${escapeHtml(ex.muscleGroup || '')}" placeholder="Ex: Glúteos">
          </div>
          <div class="field">
            <label>Ícone / imagem</label>
            <input name="image" value="${escapeHtml(ex.image || '')}" placeholder="🏋️ ou URL da imagem">
          </div>
        </div>
        <div class="field">
          <label>Equipamento utilizado</label>
          <input name="equipment" value="${escapeHtml(ex.equipment || '')}" placeholder="Ex: Barra, halteres, máquina X">
        </div>
        <div class="field-row">
          <div class="field">
            <label>Séries</label>
            <input name="sets" type="number" min="1" value="${ex.sets}">
          </div>
          <div class="field">
            <label>Repetições</label>
            <input name="reps" value="${escapeHtml(ex.reps || '')}" placeholder="Ex: 10-12">
          </div>
          <div class="field">
            <label>Descanso (s)</label>
            <input name="restSeconds" type="number" min="0" step="5" value="${ex.restSeconds}">
          </div>
        </div>
        <div class="field">
          <label>Instruções</label>
          <textarea name="instructions" rows="3" placeholder="Como executar o movimento">${escapeHtml(ex.instructions || '')}</textarea>
        </div>
        <div class="field">
          <label>Observação padrão</label>
          <textarea name="notes" rows="2" placeholder="Ex: movimento controlado">${escapeHtml(ex.notes || '')}</textarea>
        </div>
        <div class="field">
          <label>Treino (dia)</label>
          <select name="workoutId">
            ${workouts.map((w) => `<option value="${w.id}" ${ex.workoutId === w.id ? 'selected' : ''}>${escapeHtml(w.name)}</option>`).join('')}
          </select>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Salvar</button>
        ${!isNew ? `<button type="button" id="del-ex" class="btn btn-danger btn-block" style="margin-top:10px">Remover exercício</button>` : ''}
      </form>
    </div>
  `;

  document.getElementById('ex-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const updated = {
      ...ex,
      name: fd.get('name').trim(),
      nameEn: fd.get('nameEn').trim(),
      muscleGroup: fd.get('muscleGroup').trim(),
      image: fd.get('image').trim() || '🏋️',
      equipment: fd.get('equipment').trim(),
      sets: Math.max(1, Number(fd.get('sets')) || 1),
      reps: fd.get('reps').trim(),
      restSeconds: Math.max(0, Number(fd.get('restSeconds')) || 60),
      instructions: fd.get('instructions').trim(),
      notes: fd.get('notes').trim(),
      workoutId: fd.get('workoutId')
    };
    if (isNew) {
      const siblings = await db.getAllByIndex(db.STORES.exercises, 'workoutId', updated.workoutId);
      updated.order = siblings.length;
    }
    await db.put(db.STORES.exercises, updated);
    window.location.hash = `#/treino/${updated.workoutId}`;
  });

  const delBtn = document.getElementById('del-ex');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      if (!confirmAction('Remover este exercício? O histórico já registrado será mantido.')) return;
      await db.delete(db.STORES.exercises, ex.id);
      window.location.hash = `#/treino/${ex.workoutId}`;
    });
  }
}

// ---------------- HISTORY ----------------

async function renderHistory() {
  const logs = await db.getAll(db.STORES.logs);
  const withData = logs.filter((l) => l.sets.some((s) => s.completed || (s.weight !== '' && s.weight != null)));
  withData.sort((a, b) => (a.date < b.date ? 1 : -1));

  const byDate = {};
  withData.forEach((l) => {
    byDate[l.date] = byDate[l.date] || [];
    byDate[l.date].push(l);
  });

  const dates = Object.keys(byDate).sort((a, b) => (a < b ? 1 : -1));

  const itemsHtml = dates.map((date) => {
    const rows = byDate[date].map((l) => {
      const doneSets = l.sets.filter((s) => s.completed);
      const summary = doneSets.length
        ? doneSets.map((s) => `${s.weight || 0}kg×${s.reps || '-'}`).join(', ')
        : 'não concluído';
      return `<div class="history-ex-row"><strong>${escapeHtml(l.exerciseNameSnapshot || '')}</strong><span>${summary}</span></div>`;
    }).join('');
    return `<div class="history-item"><div class="history-date">${formatDateBR(date)}</div>${rows}</div>`;
  }).join('');

  const exercises = await db.getAll(db.STORES.exercises);

  appEl.innerHTML = `
    <div class="topbar">
      <div><span class="eyebrow">Progresso</span><h1>Histórico</h1></div>
    </div>
    <div class="screen">
      <div class="field">
        <label>Ver evolução de um exercício</label>
        <select id="evolution-select">
          <option value="">Selecionar exercício</option>
          ${exercises.map((e) => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('')}
        </select>
      </div>
      ${itemsHtml || `<div class="empty-state"><span class="emoji">📋</span>Nenhum treino registrado ainda.<br>Comece um treino para ver seu histórico aqui.</div>`}
    </div>
  `;

  appEl.querySelector('#evolution-select').addEventListener('change', (e) => {
    if (e.target.value) window.location.hash = `#/evolucao/${e.target.value}`;
  });
}

async function renderExerciseEvolution(exerciseId) {
  const ex = await db.get(db.STORES.exercises, exerciseId);
  const logs = await db.getAllByIndex(db.STORES.logs, 'exerciseId', exerciseId);
  const points = logs
    .filter((l) => l.sets.some((s) => s.completed))
    .map((l) => {
      const doneWeights = l.sets.filter((s) => s.completed).map((s) => Number(s.weight) || 0);
      return { date: l.date, maxWeight: Math.max(...doneWeights) };
    })
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  let chartSvg = '';
  if (points.length >= 2) {
    const w = 600, h = 200, pad = 30;
    const weights = points.map((p) => p.maxWeight);
    const minW = Math.min(...weights), maxW = Math.max(...weights);
    const range = maxW - minW || 1;
    const stepX = (w - pad * 2) / (points.length - 1);
    const coords = points.map((p, i) => {
      const x = pad + i * stepX;
      const y = h - pad - ((p.maxWeight - minW) / range) * (h - pad * 2);
      return [x, y];
    });
    const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' ');
    const dots = coords.map((c) => `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="4" fill="var(--accent)"></circle>`).join('');
    chartSvg = `<div class="chart-wrap"><svg viewBox="0 0 ${w} ${h}">
      <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></path>
      ${dots}
    </svg></div>`;
  }

  const listHtml = points.slice().reverse().map((p) => `
    <div class="evolution-chip"><span>${formatDateBR(p.date)}</span><strong style="font-family:var(--font-mono)">${p.maxWeight} kg</strong></div>
  `).join('');

  appEl.innerHTML = `
    <div class="topbar">
      <button class="back-btn" data-action="go" data-href="#/historico">←</button>
      <div><span class="eyebrow">Evolução</span><h1>${escapeHtml(ex ? ex.name : 'Exercício')}</h1></div>
    </div>
    <div class="screen">
      ${chartSvg}
      ${listHtml || `<div class="empty-state"><span class="emoji">📈</span>Ainda não há registros concluídos para este exercício.</div>`}
    </div>
  `;
}

// ---------------- SETTINGS ----------------

async function renderSettings() {
  const settings = await db.get(db.STORES.settings, 'app') || { soundEnabled: true, defaultRestSeconds: 60, theme: 'dark' };

  appEl.innerHTML = `
    <div class="topbar"><div><span class="eyebrow">Ajustes</span><h1>Configurações</h1></div></div>
    <div class="screen">

      <div class="settings-group">
        <h3>Organização</h3>
        <a href="#/dias" class="settings-row"><span class="label">Dias da semana</span><span class="chevron">›</span></a>
        <a href="#/treinos" class="settings-row"><span class="label">Treinos (nomes)</span><span class="chevron">›</span></a>
      </div>

      <div class="settings-group">
        <h3>Treino</h3>
        <div class="settings-row">
          <div><div class="label">Som ao terminar descanso</div></div>
          <button class="switch ${settings.soundEnabled !== false ? 'on' : ''}" id="toggle-sound"></button>
        </div>
        <div class="settings-row">
          <div class="label">Descanso padrão (novos exercícios)</div>
          <input type="number" id="default-rest" value="${settings.defaultRestSeconds ?? 60}" style="width:70px;background:var(--surface-2);border:none;border-radius:8px;padding:8px;text-align:center">
        </div>
        <div class="settings-row">
          <div><div class="label">Modo claro</div></div>
          <button class="switch ${settings.theme === 'light' ? 'on' : ''}" id="toggle-theme"></button>
        </div>
      </div>

      <div class="settings-group">
        <h3>Dados</h3>
        <button class="btn btn-secondary btn-block" id="btn-export" style="margin-bottom:10px">⬇️ Exportar backup (JSON)</button>
        <button class="btn btn-secondary btn-block" id="btn-import" style="margin-bottom:10px">⬆️ Importar backup</button>
        <input type="file" id="import-file" accept="application/json" style="display:none">
        <button class="btn btn-danger btn-block" id="btn-clear-history" style="margin-bottom:10px">Limpar histórico</button>
        <button class="btn btn-danger btn-block" id="btn-clear-examples">Remover exercícios de exemplo</button>
      </div>

      <div class="settings-group">
        <h3>Sobre</h3>
        <p style="color:var(--text-faint);font-size:.82rem;line-height:1.5">
          Aplicativo pessoal de treino. Todos os dados ficam salvos apenas neste dispositivo/navegador,
          sem servidor e sem contas. Use "Exportar backup" regularmente para não perder seus dados.
        </p>
      </div>
    </div>
  `;

  appEl.querySelector('#toggle-sound').addEventListener('click', async () => {
    settings.soundEnabled = settings.soundEnabled === false;
    await db.put(db.STORES.settings, settings);
    renderSettings();
  });

  appEl.querySelector('#toggle-theme').addEventListener('click', async () => {
    settings.theme = settings.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', settings.theme);
    await db.put(db.STORES.settings, settings);
    renderSettings();
  });

  appEl.querySelector('#default-rest').addEventListener('change', async (e) => {
    settings.defaultRestSeconds = Math.max(0, Number(e.target.value) || 60);
    await db.put(db.STORES.settings, settings);
    toast('Descanso padrão atualizado');
  });

  appEl.querySelector('#btn-export').addEventListener('click', async () => {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-treino-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Backup exportado');
  });

  const fileInput = appEl.querySelector('#import-file');
  appEl.querySelector('#btn-import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!confirmAction('Importar este backup vai substituir todos os dados atuais. Continuar?')) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await importBackup(json);
      toast('Backup importado com sucesso');
      window.location.hash = '#/';
      router();
    } catch (err) {
      alert('Não foi possível importar este arquivo: ' + err.message);
    }
  });

  appEl.querySelector('#btn-clear-history').addEventListener('click', async () => {
    if (!confirmAction('Isso vai apagar todo o histórico de cargas e repetições. Os treinos e exercícios continuam intactos. Confirmar?')) return;
    await db.clear(db.STORES.logs);
    toast('Histórico limpo');
  });

  appEl.querySelector('#btn-clear-examples').addEventListener('click', async () => {
    const all = await db.getAll(db.STORES.exercises);
    const examples = all.filter((e) => (e.name || '').includes('(EXEMPLO)'));
    if (!examples.length) { toast('Nenhum exercício de exemplo encontrado'); return; }
    if (!confirmAction(`Remover ${examples.length} exercício(s) de exemplo?`)) return;
    await Promise.all(examples.map((e) => db.delete(db.STORES.exercises, e.id)));
    toast('Exemplos removidos');
  });
}

// ---------------- global click delegation for data-action="go" ----------------

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="go"]');
  if (btn) window.location.hash = btn.dataset.href;
});

// ---------------- init ----------------

async function init() {
  await seedIfEmpty();
  const settings = await db.get(db.STORES.settings, 'app');
  if (settings && settings.theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
  await router();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init();
