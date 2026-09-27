/* RACK 21 · Tareas únicas con fecha de finalización */
import { DB } from "../store.js";
import { today, esc, shortDate, sum } from "../utils.js";
import { ic, ball, sectionHead, empty } from "../ui.js";
import { areaOf, taskState, durationLabel, durationMinutes, TASK_STATUS } from "../logic.js";
import * as A from "../actions.js";

const st = { tab: "activas", q: "" };
const PRIO = { alta: ["Alta", "text-rose-300 border-rose-400/40 bg-rose-500/10"], media: ["Media", "text-amber-200 border-amber-300/30 bg-amber-400/10"], baja: ["Baja", "text-slate-300 border-slate-400/25 bg-slate-400/10"] };
const statusLabel = (v) => TASK_STATUS.find((s) => s.v === v)?.l || "Pendiente";

export function render() {
  const all = DB.data.tasks.map((t) => ({ t, s: taskState(t) }));
  const active = all.filter((x) => x.s.key !== "done");
  const late = all.filter((x) => x.s.key === "late");
  const month = today().slice(0, 7);
  const doneMonth = all.filter((x) => x.s.key === "done" && x.t.completedAt && new Date(x.t.completedAt).toISOString().slice(0, 7) === month);
  const pendingMin = sum(active, (x) => durationMinutes(x.t));

  let list = all;
  if (st.tab === "activas") list = active;
  if (st.tab === "vencidas") list = late;
  if (st.tab === "completadas") list = all.filter((x) => x.s.key === "done");
  if (st.q) list = list.filter((x) => `${x.t.title} ${x.t.description || ""}`.toLowerCase().includes(st.q.toLowerCase()));

  const order = { late: 0, today: 1, soon: 2, later: 3, done: 4 };
  const pr = { alta: 0, media: 1, baja: 2 };
  list.sort((a, b) => order[a.s.key] - order[b.s.key] || (a.t.dueDate || "9").localeCompare(b.t.dueDate || "9") || (pr[a.t.priority] ?? 1) - (pr[b.t.priority] ?? 1));
  if (st.tab === "completadas") list.sort((a, b) => (b.t.completedAt || 0) - (a.t.completedAt || 0));

  const groups = [
    ["late", "Vencidas", "text-rose-300"], ["today", "Para hoy", "text-amber-300"],
    ["soon", "Próximos 7 días", "text-cyan-300"], ["later", "Más adelante", "text-slate-300"], ["done", "Completadas", "text-emerald-300"]
  ];

  return `
  ${sectionHead("Tareas", "Pendientes que se hacen una sola vez, con fecha de finalización. Márquelas y táchelas al terminar.",
    `<button class="btn btn-primary" data-action="task:new">${ic("plus", "w-4 h-4")}Nueva tarea</button>`)}

  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
    ${kpi("list-todo", "Activas", active.length, "text-cyan-300")}
    ${kpi("alarm-clock", "Vencidas", late.length, "text-rose-300")}
    ${kpi("circle-check", "Completadas este mes", doneMonth.length, "text-emerald-300")}
    ${kpi("timer", "Horas pendientes", Math.round(pendingMin / 6) / 10, "text-amber-300")}
  </div>

  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 reveal">
    <div class="flex gap-2 overflow-x-auto no-scrollbar">
      ${tab("activas", `Activas (${active.length})`)}${tab("vencidas", `Vencidas (${late.length})`)}${tab("completadas", "Completadas")}${tab("todas", "Todas")}
    </div>
    <input class="input sm:!w-64 !py-2 text-sm" placeholder="Buscar tarea…" value="${esc(st.q)}" data-input="q" aria-label="Buscar tareas">
  </div>

  ${!DB.data.tasks.length ? empty("list-checks", "Sin tareas pendientes", "Agregue lo que debe hacer una sola vez: trámites, pagos, compras, citas o entregas. Cada tarea lleva fecha de finalización, duración y estado.",
      `<button class="btn btn-primary" data-action="task:new">${ic("plus", "w-4 h-4")}Crear tarea</button>`)
    : list.length ? groups.map(([k, label, color]) => {
        const g = list.filter((x) => x.s.key === k);
        if (!g.length) return "";
        return `<section class="mb-6 reveal"><h2 class="text-xs uppercase tracking-[.2em] ${color} mb-3 flex items-center gap-2">${label}<span class="chip-n text-slate-300">${g.length}</span></h2>
          <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">${g.map(({ t, s }) => card(t, s)).join("")}</div></section>`;
      }).join("")
    : `<div class="card text-center py-10 reveal"><p class="text-4xl mb-2">✨</p><p class="text-white font-display">Nada por aquí</p><p class="text-slate-400 text-sm">No hay tareas en esta vista.</p></div>`}`;
}

const kpi = (icon, label, v, color) => `<div class="card reveal !p-4"><div class="flex items-center gap-2 text-slate-400 text-xs mb-2">${ic(icon, "w-4 h-4 " + color)}${label}</div><p class="font-display text-3xl text-white">${v.toLocaleString("es-CO")}</p></div>`;
const tab = (id, label) => `<button class="chip ${st.tab === id ? "chip-on" : ""}" data-action="tab" data-id="${id}">${label}</button>`;

function card(t, s) {
  const a = areaOf(t.area);
  const done = s.key === "done";
  const p = PRIO[t.priority] || PRIO.media;
  return `<article class="card reveal task-card task-${s.key}" style="--accent:${a.color}">
    <div class="flex items-start gap-3">
      <button class="check check-lg ${done ? "is-on" : ""}" data-action="task:toggle" data-id="${t.id}" aria-label="${done ? "Marcar como pendiente" : "Marcar como completada"}">${ic("check", "w-5 h-5")}</button>
      <div class="flex-1 min-w-0">
        <h3 class="font-semibold leading-snug ${done ? "line-through decoration-2 decoration-emerald-400/70 text-slate-500" : "text-white"}">${esc(t.title)}</h3>
        <p class="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">${ball(a.ball, { size: 14 })}${a.label}</p>
      </div>
      <span class="badge ${p[1]}">${p[0]}</span>
    </div>
    ${t.description ? `<p class="text-sm mt-3 ${done ? "text-slate-500 line-through" : "text-slate-300"}">${esc(t.description)}</p>` : ""}
    <div class="grid grid-cols-2 gap-2 mt-4">
      <div class="mini"><span class="mini-l">Finaliza</span><span class="text-sm text-white">${t.dueDate ? shortDate(t.dueDate) : "—"}</span></div>
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

export const actions = {
  tab: (d) => { st.tab = d.id; A.changed(); },
  "task:cycle": (d) => A.cycleTaskStatus(d.id),
  edit: (d) => A.taskForm(DB.data.tasks.find((t) => t.id === d.id)),
  del: (d) => A.removeItem("tasks", d.id, "esta tarea")
};
export const inputs = { q: (v) => { st.q = v; A.changed(); } };
