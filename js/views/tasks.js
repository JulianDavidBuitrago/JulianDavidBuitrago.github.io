/* RACK 21 · Tareas: tarjetas o lista, orden manual (número o arrastrar),
   periodicidad (única, semanal, mensual…), actividades con % y temporizador */
import { DB } from "../store.js";
import { today, esc, shortDate, sum, uid } from "../utils.js";
import { ic, ball, sectionHead, empty, toast } from "../ui.js";
import { areaOf, taskState, durationLabel, durationMinutes, TASK_STATUS, isRecurring, taskRepeatLabel } from "../logic.js";
import * as A from "../actions.js";
import * as T from "../timer.js";

const pref = (k, d) => { try { return localStorage.getItem(`rack21:tasks:${k}`) || d; } catch { return d; } };
const setPref = (k, v) => { try { localStorage.setItem(`rack21:tasks:${k}`, v); } catch {} };
const st = { tab: "activas", q: "", view: pref("view", "lista"), sort: pref("sort", "manual") };
const expanded = new Set();
let focusTask = null; // mantiene el cursor en el campo tras agregar una actividad

export const itemsProgress = (t) => {
  const it = t.items || [];
  return it.length ? Math.round((it.filter((x) => x.done).length / it.length) * 100) : null;
};
const PRIO = { alta: ["Alta", "text-rose-300 border-rose-400/40 bg-rose-500/10"], media: ["Media", "text-amber-200 border-amber-300/30 bg-amber-400/10"], baja: ["Baja", "text-slate-300 border-slate-400/25 bg-slate-400/10"] };
const statusLabel = (v) => TASK_STATUS.find((s) => s.v === v)?.l || "Pendiente";
const byOrder = (a, b) => (Number(a.t.order) || 1e9) - (Number(b.t.order) || 1e9) || (a.t.createdAt || 0) - (b.t.createdAt || 0);

export function render() {
  const all = DB.data.tasks.map((t) => ({ t, s: taskState(t) }));
  const active = all.filter((x) => x.s.key !== "done");
  const late = all.filter((x) => x.s.key === "late");
  const month = today().slice(0, 7);
  const doneMonth = all.filter((x) => x.s.key === "done" && x.t.completedAt && new Date(x.t.completedAt).toISOString().slice(0, 7) === month).length
    + sum(DB.data.tasks, (t) => (t.completions || []).filter((c) => c.date.slice(0, 7) === month).length);
  const pendingMin = sum(active, (x) => durationMinutes(x.t));

  let list = all;
  if (st.tab === "activas") list = active;
  if (st.tab === "vencidas") list = late;
  if (st.tab === "periodicas") list = all.filter((x) => isRecurring(x.t));
  if (st.tab === "completadas") list = all.filter((x) => x.s.key === "done");
  if (st.q) list = list.filter((x) => `${x.t.title} ${x.t.description || ""} ${(x.t.items || []).map((i) => i.text).join(" ")}`.toLowerCase().includes(st.q.toLowerCase()));

  const manual = st.sort === "manual";
  const keyOrder = { late: 0, today: 1, soon: 2, later: 3, done: 4 };
  const pr = { alta: 0, media: 1, baja: 2 };
  if (manual) list.sort(byOrder);
  else list.sort((a, b) => keyOrder[a.s.key] - keyOrder[b.s.key] || (a.t.dueDate || "9").localeCompare(b.t.dueDate || "9") || (pr[a.t.priority] ?? 1) - (pr[b.t.priority] ?? 1));
  if (st.tab === "completadas" && !manual) list.sort((a, b) => (b.t.completedAt || 0) - (a.t.completedAt || 0));

  const groups = [
    ["late", "Vencidas", "text-rose-300"], ["today", "Para hoy", "text-amber-300"],
    ["soon", "Próximos 7 días", "text-cyan-300"], ["later", "Más adelante", "text-slate-300"], ["done", "Completadas", "text-emerald-300"]
  ];
  const body = (items) => st.view === "lista"
    ? `<ol class="task-list" ${manual ? 'data-sortable="list"' : ""}>${items.map((x, i) => row(x.t, x.s, i + 1, manual)).join("")}</ol>`
    : `<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4" ${manual ? 'data-sortable="grid"' : ""}>${items.map((x, i) => card(x.t, x.s, i + 1, manual)).join("")}</div>`;

  return `
  ${sectionHead("Tareas", "Ordénelas a su gusto, póngales temporizador y periodicidad. Márquelas y táchelas al terminar.",
    `<button class="btn btn-primary" data-action="task:new">${ic("plus", "w-4 h-4")}Nueva tarea</button>`)}

  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
    ${kpi("list-todo", "Activas", active.length, "text-cyan-300")}
    ${kpi("alarm-clock", "Vencidas", late.length, "text-rose-300")}
    ${kpi("circle-check", "Cumplidas este mes", doneMonth, "text-emerald-300")}
    ${kpi("timer", "Horas pendientes", Math.round(pendingMin / 6) / 10, "text-amber-300")}
  </div>

  <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 reveal">
    <div class="flex gap-2 overflow-x-auto no-scrollbar">
      ${tab("activas", `Activas (${active.length})`)}${tab("vencidas", `Vencidas (${late.length})`)}${tab("periodicas", "Periódicas")}${tab("completadas", "Completadas")}${tab("todas", "Todas")}
    </div>
    <div class="grid grid-cols-2 sm:flex gap-2 items-center">
      <div class="seg grid grid-cols-2" role="group" aria-label="Vista">
        <button class="${st.view === "lista" ? "seg-on" : ""}" data-action="view" data-id="lista" title="Vista de lista">${ic("list", "w-3.5 h-3.5")}Lista</button>
        <button class="${st.view === "tarjetas" ? "seg-on" : ""}" data-action="view" data-id="tarjetas" title="Vista de tarjetas">${ic("layout-grid", "w-3.5 h-3.5")}Tarjetas</button>
      </div>
      <div class="seg grid grid-cols-2" role="group" aria-label="Orden">
        <button class="${manual ? "seg-on" : ""}" data-action="sort" data-id="manual" title="Su propio orden">${ic("grip-vertical", "w-3.5 h-3.5")}Mi orden</button>
        <button class="${!manual ? "seg-on" : ""}" data-action="sort" data-id="fecha" title="Por fecha">${ic("calendar-days", "w-3.5 h-3.5")}Fecha</button>
      </div>
      <input class="input col-span-2 sm:!w-56 !py-2 text-sm" placeholder="Buscar tarea…" value="${esc(st.q)}" data-input="q" aria-label="Buscar tareas">
    </div>
  </div>
  ${manual && list.length > 1 ? `<p class="text-xs text-slate-500 mb-3 reveal ro-hide">${ic("grip-vertical", "w-3.5 h-3.5 inline")} Arrastre desde el asa o escriba el número de posición para reordenar.</p>` : ""}

  ${!DB.data.tasks.length ? empty("list-checks", "Sin tareas pendientes", "Agregue trámites, pagos, compras, citas o entregas. Cada tarea puede ser única o repetirse cada semana o cada mes, y tener actividades, duración y temporizador.",
      `<button class="btn btn-primary" data-action="task:new">${ic("plus", "w-4 h-4")}Crear tarea</button>`)
    : !list.length ? `<div class="card text-center py-10 reveal"><p class="text-4xl mb-2">✨</p><p class="text-white font-display">Nada por aquí</p><p class="text-slate-400 text-sm">No hay tareas en esta vista.</p></div>`
    : manual ? body(list)
    : groups.map(([k, label, color]) => {
        const g = list.filter((x) => x.s.key === k);
        return g.length ? `<section class="mb-6 reveal"><h2 class="text-xs uppercase tracking-[.2em] ${color} mb-3 flex items-center gap-2">${label}<span class="chip-n text-slate-300">${g.length}</span></h2>${body(g)}</section>` : "";
      }).join("")}`;
}

const kpi = (icon, label, v, color) => `<div class="card reveal !p-4"><div class="flex items-center gap-2 text-slate-400 text-xs mb-2">${ic(icon, "w-4 h-4 " + color)}${label}</div><p class="font-display text-3xl text-white">${v.toLocaleString("es-CO")}</p></div>`;
const tab = (id, label) => `<button class="chip ${st.tab === id ? "chip-on" : ""}" data-action="tab" data-id="${id}">${label}</button>`;
const handle = (t) => `<button class="drag-handle" data-drag="${t.id}" aria-label="Arrastrar para reordenar" title="Arrastrar">${ic("grip-vertical", "w-4 h-4")}</button>`;
const posInput = (t, n) => `<input class="pos-num" type="number" min="1" inputmode="numeric" value="${n}" data-pos="${t.id}" aria-label="Posición de ${esc(t.title)}" title="Escriba la posición y presione Enter">`;
const repeatBadge = (t) => (isRecurring(t) ? `<span class="badge badge-soon normal-case tracking-normal">${ic("repeat", "w-3 h-3 mr-1")}${esc(taskRepeatLabel(t))}</span>` : "");

function checklist(t) {
  const it = t.items || [];
  const p = itemsProgress(t);
  return `<div class="checklist mt-4">
    ${it.length ? `<div class="flex items-center justify-between text-[11px] mb-1.5">
        <span class="text-slate-400 uppercase tracking-wider">Actividades ${it.filter((x) => x.done).length}/${it.length}</span>
        <span class="font-mono ${p === 100 ? "text-emerald-300" : "text-cyan-300"}">${p} %</span></div>
      <div class="bar mb-2"><span style="--w:${p}%"></span></div>
      <ul class="space-y-1">${it.map((x, i) => `<li class="item-row group">
        <button class="sub-check ${x.done ? "is-on" : ""}" data-action="item:toggle" data-id="${t.id}" data-item="${x.id}" aria-label="${x.done ? "Desmarcar" : "Marcar"} actividad">${ic("check", "w-3 h-3")}</button>
        <span class="flex-1 min-w-0 text-sm break-words ${x.done ? "line-through text-slate-500" : "text-slate-200"}"><span class="text-slate-500 font-mono text-xs mr-1">${i + 1}.</span>${esc(x.text)}</span>
        <button class="item-del" data-action="item:del" data-id="${t.id}" data-item="${x.id}" aria-label="Quitar actividad">${ic("x", "w-3.5 h-3.5")}</button>
      </li>`).join("")}</ul>` : ""}
    <form class="add-item flex gap-2 mt-2" data-task="${t.id}">
      <input name="item" class="input !py-1.5 text-sm min-w-0" placeholder="${it.length ? "Agregar otra actividad…" : "Agregar actividad o paso…"}" aria-label="Nueva actividad" autocomplete="off" maxlength="200">
      <button class="btn btn-sm btn-ghost shrink-0" type="submit" aria-label="Agregar">${ic("plus", "w-4 h-4")}</button>
    </form>
  </div>`;
}

/* ------------------------------ Vista lista ---------------------------- */
function row(t, s, n, manual) {
  const a = areaOf(t.area);
  const done = s.key === "done";
  const p = PRIO[t.priority] || PRIO.media;
  const prog = itemsProgress(t);
  const open = expanded.has(t.id);
  return `<li class="task-row task-${s.key} ${open ? "is-open" : ""}" data-row="${t.id}" style="--accent:${a.color}">
    <div class="task-row-main">
      ${manual ? `<div class="flex items-center gap-1 shrink-0 ro-hide">${handle(t)}${posInput(t, n)}</div>` : ""}
      <button class="check ${done ? "is-on" : ""}" data-action="task:toggle" data-id="${t.id}" aria-label="${done ? "Marcar como pendiente" : "Completar"}">${ic("check", "w-4 h-4")}</button>
      <button class="flex-1 min-w-0 text-left" data-action="expand" data-id="${t.id}" aria-expanded="${open}">
        <span class="flex items-center gap-2"><span class="text-sm font-medium truncate ${done ? "line-through text-slate-500" : "text-white"}">${esc(t.title)}</span>${prog !== null ? `<span class="text-[10px] font-mono ${prog === 100 ? "text-emerald-300" : "text-cyan-300"}">${prog}%</span>` : ""}</span>
        <span class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 mt-0.5">
          <span class="flex items-center gap-1">${ball(a.ball, { size: 12 })}${a.label}</span>
          <span class="${s.key === "late" ? "text-rose-300" : s.key === "today" ? "text-amber-300" : ""}">${t.dueDate ? shortDate(t.dueDate) : "Sin fecha"} · ${s.label}</span>
          ${durationLabel(t) ? `<span>${durationLabel(t)}</span>` : ""}
          ${isRecurring(t) ? `<span class="text-cyan-300/90">${ic("repeat", "w-3 h-3 inline")} ${esc(taskRepeatLabel(t))}</span>` : ""}
        </span>
        ${prog !== null ? `<span class="block h-1 rounded-full bg-white/5 mt-1.5 overflow-hidden"><span class="block h-full bg-gradient-to-r from-emerald-400 to-cyan-400" style="width:${prog}%"></span></span>` : ""}
      </button>
      <div class="task-row-side">
        <span class="badge ${p[1]} hidden sm:inline-flex">${p[0]}</span>
        ${!done ? T.control(t, { compact: true }) : ""}
        <button class="icon-btn !w-8" data-action="expand" data-id="${t.id}" aria-label="Ver detalle">${ic(open ? "chevron-up" : "chevron-down", "w-4 h-4")}</button>
      </div>
    </div>
    ${open ? `<div class="task-row-detail">
      ${t.description ? `<p class="text-sm text-slate-300 mb-2">${esc(t.description)}</p>` : ""}
      <div class="flex flex-wrap items-center gap-2">
        <button class="status-pill status-${t.status || "pendiente"}" data-action="task:cycle" data-id="${t.id}">${statusLabel(t.status)}</button>
        <span class="badge ${p[1]} sm:hidden">${p[0]}</span>${repeatBadge(t)}
        ${t.completions?.length ? `<span class="text-[11px] text-slate-500">Cumplida ${t.completions.length} ${t.completions.length === 1 ? "vez" : "veces"} · última ${shortDate(t.completions[t.completions.length - 1].date)}</span>` : ""}
        <span class="flex-1"></span>
        <button class="icon-btn" data-action="edit" data-id="${t.id}" aria-label="Editar">${ic("pencil", "w-4 h-4")}</button>
        <button class="icon-btn hover:!text-rose-300" data-action="del" data-id="${t.id}" aria-label="Eliminar">${ic("trash-2", "w-4 h-4")}</button>
      </div>
      ${!done ? `<div class="mt-3">${T.control(t)}</div>` : ""}
      ${checklist(t)}
    </div>` : ""}
  </li>`;
}

/* ---------------------------- Vista tarjetas --------------------------- */
function card(t, s, n, manual) {
  const a = areaOf(t.area);
  const done = s.key === "done";
  const p = PRIO[t.priority] || PRIO.media;
  return `<article class="card reveal task-card task-${s.key}" data-row="${t.id}" style="--accent:${a.color}">
    ${manual ? `<div class="flex items-center gap-1 -mt-1 mb-2 ro-hide">${handle(t)}${posInput(t, n)}<span class="text-[10px] uppercase tracking-widest text-slate-500 ml-1">Posición</span></div>` : ""}
    <div class="flex items-start gap-3">
      <button class="check check-lg ${done ? "is-on" : ""}" data-action="task:toggle" data-id="${t.id}" aria-label="${done ? "Marcar como pendiente" : "Marcar como completada"}">${ic("check", "w-5 h-5")}</button>
      <div class="flex-1 min-w-0">
        <h3 class="font-semibold leading-snug ${done ? "line-through decoration-2 decoration-emerald-400/70 text-slate-500" : "text-white"}">${esc(t.title)}</h3>
        <p class="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">${ball(a.ball, { size: 14 })}${a.label}</p>
      </div>
      <span class="badge ${p[1]}">${p[0]}</span>
    </div>
    ${isRecurring(t) ? `<div class="mt-2">${repeatBadge(t)}</div>` : ""}
    ${t.description ? `<p class="text-sm mt-3 ${done ? "text-slate-500 line-through" : "text-slate-300"}">${esc(t.description)}</p>` : ""}
    ${!done ? `<div class="mt-4">${T.control(t)}</div>` : ""}
    ${checklist(t)}
    <div class="grid grid-cols-2 gap-2 mt-4">
      <div class="mini"><span class="mini-l">${isRecurring(t) ? "Próxima vez" : "Finaliza"}</span><span class="text-sm text-white">${t.dueDate ? shortDate(t.dueDate) : "—"}</span></div>
      <div class="mini"><span class="mini-l">Duración</span><span class="text-sm text-white">${durationLabel(t) || "—"}</span></div>
    </div>
    <div class="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-white/5">
      <div class="flex items-center gap-2 min-w-0">
        <button class="status-pill status-${t.status || "pendiente"}" data-action="task:cycle" data-id="${t.id}" title="Cambiar estado">${ic(t.status === "completada" ? "circle-check" : t.status === "en_progreso" ? "loader" : "circle", "w-3.5 h-3.5")}${statusLabel(t.status)}</button>
        <span class="badge badge-${s.key}">${s.label}</span>
      </div>
      <div class="flex gap-1 shrink-0">
        <button class="icon-btn" data-action="edit" data-id="${t.id}" aria-label="Editar">${ic("pencil", "w-4 h-4")}</button>
        <button class="icon-btn hover:!text-rose-300" data-action="del" data-id="${t.id}" aria-label="Eliminar">${ic("trash-2", "w-4 h-4")}</button>
      </div>
    </div>
  </article>`;
}

/* Recalcula el estado según el avance de las actividades */
async function saveItems(t, items) {
  const all = items.length && items.every((x) => x.done);
  const any = items.some((x) => x.done);
  if (all && t.status !== "completada") return A.completeTask(t, { items });
  let status = t.status || "pendiente";
  if (status === "completada" && !all) status = "en_progreso";
  else if (any && status === "pendiente") status = "en_progreso";
  await DB.update("tasks", t.id, { items, status, completedAt: status === "completada" ? t.completedAt : null });
}

/* ------------------------- Arrastrar para ordenar ---------------------- */
function enableDrag(root) {
  const box = root.querySelector("[data-sortable]");
  if (!box || DB.readOnly) return;
  const isGrid = box.dataset.sortable === "grid";
  const ids = () => [...box.querySelectorAll(":scope > [data-row]")].map((el) => el.dataset.row);
  const renumber = () => box.querySelectorAll(":scope > [data-row]").forEach((el, i) => { const inp = el.querySelector(".pos-num"); if (inp) inp.value = i + 1; });

  box.addEventListener("pointerdown", (e) => {
    const h = e.target.closest(".drag-handle");
    if (!h) return;
    const item = h.closest("[data-row]");
    e.preventDefault();
    const before = ids().join();
    item.classList.add("dragging");
    document.body.classList.add("is-dragging");
    let scrollIv = null, lastY = e.clientY;
    const scroller = () => { if (lastY < 90) window.scrollBy(0, -14); else if (lastY > window.innerHeight - 120) window.scrollBy(0, 14); };
    scrollIv = setInterval(scroller, 16);
    const move = (ev) => {
      lastY = ev.clientY;
      const x = ev.clientX, y = ev.clientY;
      for (const el of box.querySelectorAll(":scope > [data-row]")) {
        if (el === item) continue;
        const r = el.getBoundingClientRect();
        if (y < r.top || y > r.bottom || x < r.left || x > r.right) continue;
        const putBefore = isGrid ? x < r.left + r.width / 2 : y < r.top + r.height / 2;
        box.insertBefore(item, putBefore ? el : el.nextSibling);
        renumber();
        break;
      }
    };
    let ended = false;
    const up = async () => {
      if (ended) return; ended = true;
      clearInterval(scrollIv);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      item.classList.remove("dragging");
      document.body.classList.remove("is-dragging");
      const now = ids();
      if (now.join() !== before) { await A.reorderTasks(now); toast("Orden actualizado"); }
    };
    // Se escucha en el documento: al mover la fila en el DOM el navegador libera la captura del puntero
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  });

  /* Escribir la posición: Enter o salir del campo */
  const applyPos = async (inp) => {
    const list = ids();
    const from = list.indexOf(inp.dataset.pos);
    let to = Math.round(Number(inp.value)) - 1;
    if (Number.isNaN(to)) return renumber();
    to = Math.max(0, Math.min(list.length - 1, to));
    if (to === from) return renumber();
    list.splice(to, 0, list.splice(from, 1)[0]);
    await A.reorderTasks(list);
    toast(`Movida a la posición ${to + 1}`);
  };
  box.querySelectorAll(".pos-num").forEach((inp) => {
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } });
    inp.addEventListener("change", () => applyPos(inp));
    inp.addEventListener("focus", () => inp.select());
  });
}

export function mount(root) {
  root.onsubmit = async (e) => {
    const f = e.target.closest(".add-item");
    if (!f) return;
    e.preventDefault();
    const text = f.item.value.trim();
    if (!text) return;
    const t = DB.data.tasks.find((x) => x.id === f.dataset.task);
    if (!t) return;
    focusTask = t.id;
    try { await saveItems(t, [...(t.items || []), { id: uid(), text, done: false }]); A.changed(); }
    catch (err) { toast(err.message, "error"); }
  };
  enableDrag(root);
  if (focusTask) {
    const inp = root.querySelector(`.add-item[data-task="${focusTask}"] input`);
    focusTask = null;
    if (inp) inp.focus({ preventScroll: true });
  }
}

export const actions = {
  tab: (d) => { st.tab = d.id; A.changed(); },
  view: (d) => { st.view = d.id; setPref("view", d.id); A.changed(); },
  sort: (d) => { st.sort = d.id; setPref("sort", d.id); A.changed(); },
  expand: (d) => { expanded.has(d.id) ? expanded.delete(d.id) : expanded.add(d.id); A.changed(); },
  "item:toggle": async (d) => {
    const t = DB.data.tasks.find((x) => x.id === d.id);
    await saveItems(t, (t.items || []).map((x) => (x.id === d.item ? { ...x, done: !x.done } : x)));
    A.changed();
  },
  "item:del": async (d) => {
    const t = DB.data.tasks.find((x) => x.id === d.id);
    await saveItems(t, (t.items || []).filter((x) => x.id !== d.item));
    A.changed();
  },
  "task:cycle": (d) => A.cycleTaskStatus(d.id),
  edit: (d) => A.taskForm(DB.data.tasks.find((t) => t.id === d.id)),
  del: (d) => A.removeItem("tasks", d.id, "esta tarea")
};
export const inputs = { q: (v) => { st.q = v; A.changed(); } };
