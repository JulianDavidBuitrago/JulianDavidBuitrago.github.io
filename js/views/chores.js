/* RACK 21 · Hogar: tareas diarias y frecuentes */
import { DB } from "../store.js";
import { today, esc, shortDate, lastNDays, addDays, sum } from "../utils.js";
import { ic, sectionHead, empty } from "../ui.js";
import { choreStatus, choreNextDue, choreLastDoneBefore, recurrenceLabel, choreDueOn, choreDoneOn } from "../logic.js";
import * as A from "../actions.js";

let tab = "pendientes";

export function render() {
  const t = today();
  const list = DB.data.chores.map((c) => ({ c, s: choreStatus(c) }));
  const late = list.filter((x) => x.s.key === "late");
  const todayL = list.filter((x) => x.s.key === "today");
  const done = list.filter((x) => x.s.key === "done");
  const week = lastNDays(7);
  const due7 = week.flatMap((d) => DB.data.chores.filter((c) => choreDueOn(c, d) || choreDoneOn(c, d)).map((c) => choreDoneOn(c, d)));
  const rate7 = due7.length ? Math.round((due7.filter(Boolean).length / due7.length) * 100) : 0;
  const minsLeft = sum([...late, ...todayL], (x) => x.c.minutes || 0);

  const order = { late: 0, today: 1, soon: 2, later: 3, done: 4 };
  let shown = list;
  if (tab === "pendientes") shown = list.filter((x) => ["late", "today"].includes(x.s.key));
  if (tab === "proximas") shown = list.filter((x) => ["soon", "later"].includes(x.s.key));
  if (tab === "hechas") shown = done;
  shown.sort((a, b) => order[a.s.key] - order[b.s.key] || choreNextDue(a.c).localeCompare(choreNextDue(b.c)));

  return `
  ${sectionHead("Hogar en orden", "Casa limpia, mente clara. Cada tarea se programa sola según su frecuencia.",
    `${!DB.data.chores.length ? `<button class="btn btn-ghost" data-action="seed">${ic("sparkles", "w-4 h-4")}Cargar tareas típicas</button>` : ""}
     <button class="btn btn-primary" data-action="chore:new">${ic("plus", "w-4 h-4")}Nueva tarea</button>`)}

  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
    ${kpi("alarm-clock", "Atrasadas", late.length, "text-rose-300")}
    ${kpi("calendar-check", "Para hoy", todayL.length, "text-amber-300")}
    ${kpi("circle-check", "Hechas hoy", done.length, "text-emerald-300")}
    ${kpi("timer", "Minutos pendientes", minsLeft, "text-cyan-300")}
  </div>

  <div class="card mb-6 reveal flex flex-col sm:flex-row sm:items-center gap-4">
    <div class="flex-1">
      <p class="text-sm text-slate-300">Cumplimiento del hogar · últimos 7 días</p>
      <div class="bar bar-lg mt-2"><span style="--w:${rate7}%"></span></div>
    </div>
    <p class="font-display text-3xl text-white" data-count="${rate7}" data-suffix="%">0%</p>
    <p class="text-xs text-slate-400 sm:max-w-[240px]">Consejo: haga primero la tarea más corta. El impulso de terminar algo arrastra a la siguiente.</p>
  </div>

  <div class="flex gap-2 mb-4 reveal overflow-x-auto no-scrollbar">
    ${tabBtn("pendientes", `Pendientes (${late.length + todayL.length})`)}
    ${tabBtn("proximas", "Próximas")}
    ${tabBtn("hechas", `Hechas hoy (${done.length})`)}
    ${tabBtn("todas", "Todas")}
  </div>

  ${!DB.data.chores.length ? empty("house", "Organice su casa en piloto automático",
      "Cree tareas con frecuencia (diaria, semanal, quincenal…) y RACK 21 le dirá cada día qué toca. Puede cargar 10 tareas típicas de una casa para empezar.",
      `<button class="btn btn-primary" data-action="seed">${ic("sparkles", "w-4 h-4")}Cargar tareas típicas</button>`)
    : shown.length ? `<div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">${shown.map(({ c, s }) => card(c, s, t)).join("")}</div>`
    : `<div class="card text-center py-10 reveal"><p class="text-4xl mb-2">✨</p><p class="text-white font-display">¡Todo al día en esta sección!</p><p class="text-slate-400 text-sm">Su casa se lo agradece.</p></div>`}`;
}

const kpi = (icon, label, v, color) => `<div class="card reveal !p-4"><div class="flex items-center gap-2 text-slate-400 text-xs mb-2">${ic(icon, "w-4 h-4 " + color)}${label}</div><p class="font-display text-3xl text-white" data-count="${v}">0</p></div>`;
const tabBtn = (id, label) => `<button class="chip ${tab === id ? "chip-on" : ""}" data-action="tab" data-id="${id}">${label}</button>`;

function card(c, s, t) {
  const last = choreLastDoneBefore(c, addDays(t, 1));
  const done = s.key === "done";
  return `<article class="card reveal chore-card chore-${s.key}">
    <div class="flex items-start gap-3">
      <button class="check check-lg ${done ? "is-on" : ""}" data-action="chore:toggle" data-id="${c.id}" aria-label="Marcar ${esc(c.name)}">${ic("check", "w-5 h-5")}</button>
      <div class="flex-1 min-w-0">
        <h3 class="text-white font-semibold ${done ? "line-through opacity-60" : ""}">${esc(c.name)}</h3>
        <p class="text-xs text-slate-400 mt-0.5">${ic("repeat", "w-3 h-3 inline -mt-0.5")} ${recurrenceLabel(c)} · ${c.minutes || "?"} min</p>
      </div>
      <span class="badge badge-${s.key}">${s.label}</span>
    </div>
    ${c.anchor ? `<p class="text-xs text-emerald-200/80 mt-3 flex items-center gap-1.5">${ic("anchor", "w-3.5 h-3.5")}Después de ${esc(c.anchor)}</p>` : ""}
    <div class="flex items-center justify-between mt-4 pt-3 border-t border-white/5 text-xs text-slate-500">
      <span>Última: ${last ? shortDate(last) : "nunca"} · Próxima: ${shortDate(choreNextDue(c))}</span>
      <div class="flex gap-1">
        <button class="icon-btn" data-action="edit" data-id="${c.id}" aria-label="Editar">${ic("pencil", "w-4 h-4")}</button>
        <button class="icon-btn hover:!text-rose-300" data-action="del" data-id="${c.id}" aria-label="Eliminar">${ic("trash-2", "w-4 h-4")}</button>
      </div>
    </div>
  </article>`;
}

export const actions = {
  tab: (d) => { tab = d.id; A.changed(); },
  seed: () => A.seedStarter({ habits: false, chores: true }),
  edit: (d) => A.choreForm(DB.data.chores.find((c) => c.id === d.id)),
  del: (d) => A.removeItem("chores", d.id, "esta tarea y su historial")
};
