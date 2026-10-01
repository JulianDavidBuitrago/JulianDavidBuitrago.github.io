/* =====================================================================
   RACK 21 · Temporizador regresivo por tarea
   Estado guardado en la tarea (se conserva al recargar o cambiar de equipo):
     timerTotal  segundos totales
     timerState  "idle" | "running" | "paused" | "done"
     timerEndsAt fecha (ms) en que termina, si está corriendo
     timerLeft   segundos restantes, si está en pausa
   ===================================================================== */
import { DB } from "./store.js";
import { esc } from "./utils.js";
import { durationMinutes } from "./logic.js";
import { ic, icons, toast, modal, closeModal } from "./ui.js";
import { changed } from "./actions.js";

const DEFAULT_MIN = 25; // pomodoro si la tarea no tiene duración
export const defaultSeconds = (t) => Math.round(Math.min(durationMinutes(t) || DEFAULT_MIN, 600) * 60);

export function timerInfo(t) {
  const total = Number(t.timerTotal) || defaultSeconds(t);
  const state = t.timerState || "idle";
  let left = total;
  if (state === "running") left = Math.max(0, Math.ceil((Number(t.timerEndsAt) - Date.now()) / 1000));
  else if (state === "paused") left = Number(t.timerLeft ?? total);
  else if (state === "done") left = 0;
  return { total, state, left, pct: total ? Math.min(100, ((total - left) / total) * 100) : 0 };
}

export function fmt(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

/* ------------------------------ Acciones ------------------------------- */
const find = (id) => DB.data.tasks.find((x) => x.id === id);

export async function start(id) {
  const t = find(id); if (!t) return;
  unlockAudio(); askNotify();
  const i = timerInfo(t);
  const left = i.state === "paused" ? i.left : i.state === "running" ? i.left : i.total;
  await DB.update("tasks", id, {
    timerTotal: i.total, timerState: "running", timerEndsAt: Date.now() + left * 1000, timerLeft: null,
    status: (t.status || "pendiente") === "pendiente" ? "en_progreso" : t.status
  });
  changed();
}
export async function pause(id) {
  const t = find(id); if (!t) return;
  const i = timerInfo(t);
  await DB.update("tasks", id, { timerState: "paused", timerLeft: i.left, timerEndsAt: null });
  changed();
}
export async function reset(id) {
  const t = find(id); if (!t) return;
  await DB.update("tasks", id, { timerState: "idle", timerLeft: null, timerEndsAt: null });
  changed();
}
export async function addMinutes(id, m = 5) {
  const t = find(id); if (!t) return;
  const i = timerInfo(t);
  const patch = { timerTotal: i.total + m * 60 };
  if (i.state === "running") patch.timerEndsAt = Number(t.timerEndsAt) + m * 60000;
  else if (i.state === "paused") patch.timerLeft = i.left + m * 60;
  else if (i.state === "done") Object.assign(patch, { timerState: "paused", timerLeft: m * 60, timerTotal: m * 60 });
  await DB.update("tasks", id, patch);
  changed();
}
export const toggle = (id) => (timerInfo(find(id) || {}).state === "running" ? pause(id) : start(id));

export function setForm(id) {
  const t = find(id); if (!t) return;
  const cur = Math.round(timerInfo(t).total / 60);
  const presets = [5, 10, 15, 25, 30, 45, 60, 90];
  const m = modal({
    title: "Configurar temporizador", size: "max-w-sm",
    body: `<p class="text-sm text-slate-400 mb-4">“${esc(t.title)}”</p>
      <div class="grid grid-cols-4 gap-2 mb-4">${presets.map((p) => `<button class="chip justify-center ${p === cur ? "chip-on" : ""}" data-min="${p}">${p} min</button>`).join("")}</div>
      <label class="label" for="tmMin">Minutos personalizados</label>
      <div class="flex gap-2"><input id="tmMin" type="number" min="1" max="600" class="input" value="${cur}">
      <button class="btn btn-primary shrink-0" id="tmOk">${ic("check", "w-4 h-4")}Aplicar</button></div>
      <label class="flex items-center gap-2 mt-4 text-sm text-slate-300 cursor-pointer"><input id="tmStart" type="checkbox" checked class="w-4 h-4 accent-cyan-400">Iniciar de inmediato</label>`
  });
  const apply = async (min) => {
    min = Math.max(1, Math.min(600, Math.round(Number(min) || 0)));
    const go = m.querySelector("#tmStart").checked;
    closeModal();
    await DB.update("tasks", id, { timerTotal: min * 60, timerState: "idle", timerLeft: null, timerEndsAt: null });
    if (go) await start(id); else changed();
  };
  m.querySelectorAll("[data-min]").forEach((b) => (b.onclick = () => apply(b.dataset.min)));
  m.querySelector("#tmOk").onclick = () => apply(m.querySelector("#tmMin").value);
  m.querySelector("#tmMin").addEventListener("keydown", (e) => { if (e.key === "Enter") apply(e.target.value); });
}

/* Control compacto reutilizable (tarjeta y lista) */
export function control(t, { compact = false } = {}) {
  const i = timerInfo(t);
  const running = i.state === "running", done = i.state === "done";
  return `<div class="timer ${compact ? "timer-compact" : ""} timer-${i.state}" data-timer-box="${t.id}">
    <button class="timer-play" data-action="timer:toggle" data-id="${t.id}" aria-label="${running ? "Pausar" : "Iniciar"} temporizador" title="${running ? "Pausar" : "Iniciar"}">${ic(running ? "pause" : done ? "rotate-ccw" : "play", "w-3.5 h-3.5")}</button>
    <button class="timer-time" data-action="timer:set" data-id="${t.id}" title="Configurar minutos"><span data-timer="${t.id}">${done ? "¡Listo!" : fmt(i.left)}</span></button>
    ${!compact ? `<div class="timer-bar"><span data-timer-bar="${t.id}" style="width:${i.pct}%"></span></div>
      ${i.state !== "idle" ? `<button class="timer-mini" data-action="timer:reset" data-id="${t.id}" title="Reiniciar" aria-label="Reiniciar">${ic("rotate-ccw", "w-3.5 h-3.5")}</button>` : ""}
      ${running || i.state === "paused" ? `<button class="timer-mini" data-action="timer:add" data-id="${t.id}" title="+5 minutos" aria-label="Sumar 5 minutos">+5</button>` : ""}` : ""}
  </div>`;
}

/* ------------------------- Reloj global y alarma ----------------------- */
let audioCtx = null;
function unlockAudio() {
  try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === "suspended") audioCtx.resume(); } catch {}
}
function beep() {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  [0, 0.35, 0.7, 1.4, 1.75, 2.1].forEach((d, i) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = "sine"; o.frequency.value = i % 3 === 2 ? 1175 : 880;
    g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.28);
    o.connect(g).connect(audioCtx.destination); o.start(t0 + d); o.stop(t0 + d + 0.3);
  });
}
function askNotify() { try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch {} }

const finishing = new Set();
async function finish(t) {
  if (finishing.has(t.id)) return;
  finishing.add(t.id);
  try {
    await DB.update("tasks", t.id, { timerState: "done", timerLeft: 0, timerEndsAt: null });
    beep();
    try { navigator.vibrate?.([400, 150, 400, 150, 400]); } catch {}
    toast(`⏰ ¡Tiempo cumplido! “${t.title}”. ¿La completó o necesita 5 minutos más?`, "info");
    try { if ("Notification" in window && Notification.permission === "granted" && document.hidden) new Notification("RACK 21 · Tiempo cumplido", { body: t.title, icon: "assets/icon.svg" }); } catch {}
    const old = document.title; let n = 0;
    const iv = setInterval(() => { document.title = n++ % 2 ? old : "⏰ ¡Tiempo!"; if (n > 9) { clearInterval(iv); document.title = old; } }, 800);
    changed();
  } finally { setTimeout(() => finishing.delete(t.id), 3000); }
}

function tick() {
  if (!DB.user || !DB.data?.tasks) return;
  const running = DB.data.tasks.filter((t) => t.timerState === "running");
  for (const t of running) if (Number(t.timerEndsAt) <= Date.now() && !DB.readOnly) finish(t);
  document.querySelectorAll("[data-timer]").forEach((el) => {
    const t = find(el.dataset.timer); if (!t) return;
    const i = timerInfo(t);
    el.textContent = i.state === "done" ? "¡Listo!" : fmt(i.left);
  });
  document.querySelectorAll("[data-timer-bar]").forEach((el) => {
    const t = find(el.dataset.timerBar); if (t) el.style.width = `${timerInfo(t).pct}%`;
  });
  paintDock();
}

/* Barra flotante visible en todas las secciones mientras haya temporizadores activos */
let dockSig = "";
function paintDock() {
  let dock = document.getElementById("timerDock");
  const act = DB.readOnly ? [] : DB.data.tasks.filter((t) => t.timerState === "running" || t.timerState === "paused");
  const onTasks = location.hash.startsWith("#/tareas");
  const sig = act.map((t) => `${t.id}:${t.timerState}`).join("|") + (onTasks ? "T" : "");
  if (!act.length || onTasks) { dock?.remove(); dockSig = ""; return; }
  if (!dock) { dock = document.createElement("div"); dock.id = "timerDock"; document.body.appendChild(dock); }
  if (sig !== dockSig) {
    dockSig = sig;
    dock.innerHTML = act.slice(0, 3).map((t) => {
      const i = timerInfo(t);
      return `<div class="dock-item ${i.state === "running" ? "is-running" : ""}">
        <button class="timer-play" data-action="timer:toggle" data-id="${t.id}" aria-label="${i.state === "running" ? "Pausar" : "Reanudar"}">${ic(i.state === "running" ? "pause" : "play", "w-3.5 h-3.5")}</button>
        <a href="#/tareas" class="min-w-0 flex-1"><span class="block text-[11px] text-slate-400 truncate">${esc(t.title)}</span>
        <span class="block font-mono text-white text-sm" data-timer="${t.id}">${fmt(i.left)}</span></a>
      </div>`;
    }).join("");
    icons();
  }
  dock.querySelectorAll("[data-timer]").forEach((el) => { const t = find(el.dataset.timer); if (t) el.textContent = fmt(timerInfo(t).left); });
}

let started = false;
export function startClock() {
  if (started) return;
  started = true;
  setInterval(tick, 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
}
