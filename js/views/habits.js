/* RACK 21 · Hábitos atómicos (CRUD + anclas + seguimiento 21 días) */
import { DB } from "../store.js";
import { today, esc, lastNDays, DOW, shortDate } from "../utils.js";
import { ic, ball, sectionHead, empty } from "../ui.js";
import { AREAS, areaOf, habitScheduled, habitDone, habitStreak, habitRate, missedYesterday } from "../logic.js";
import * as A from "../actions.js";

let filter = "todas";

export function render() {
  const hs = DB.data.habits.filter((h) => filter === "todas" || h.area === filter);
  const days = lastNDays(21);
  const active = DB.data.habits.filter((h) => h.active !== false);

  return `
  ${sectionHead("Hábitos atómicos", "Pequeños cambios, resultados extraordinarios. Cada hábito vive enganchado a un ancla.",
    `${!DB.data.habits.length ? `<button class="btn btn-ghost" data-action="seed">${ic("sparkles", "w-4 h-4")}Plan de arranque</button>` : ""}
     <button class="btn btn-primary" data-action="habit:new">${ic("plus", "w-4 h-4")}Nuevo hábito</button>`)}

  <div class="card mb-6 reveal grid md:grid-cols-4 gap-4">
    ${law("eye", "1 · Obvio", "Hora y lugar definidos. El ancla dispara el hábito.")}
    ${law("sparkles", "2 · Atractivo", "Combínelo con algo que disfrute.")}
    ${law("feather", "3 · Sencillo", "Versión de 2 minutos para los días difíciles.")}
    ${law("trophy", "4 · Satisfactorio", "Recompensa inmediata y check en RACK 21.")}
  </div>

  <div class="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4 reveal">
    ${chip("todas", "Todas", active.length)}
    ${AREAS.map((a) => chip(a.id, a.label, DB.data.habits.filter((h) => h.area === a.id).length, a.ball)).join("")}
  </div>

  ${hs.length ? `<div class="grid md:grid-cols-2 gap-4 sm:gap-5">${hs.map((h) => card(h, days)).join("")}</div>` :
    empty("anchor", "Construya su primer hábito", "Use la fórmula del ancla: <em>“Después de [hábito actual], haré [nuevo hábito]”</em>. O cargue el plan de arranque con 7 hábitos diseñados para este reto.",
      `<div class="flex flex-wrap gap-2 justify-center"><button class="btn btn-primary" data-action="seed">${ic("sparkles", "w-4 h-4")}Cargar plan de arranque</button><button class="btn btn-ghost" data-action="habit:new">Crear hábito</button></div>`)}`;
}

const law = (icon, t, d) => `<div class="flex gap-3"><div class="w-9 h-9 shrink-0 rounded-xl bg-cyan-400/10 text-cyan-300 grid place-items-center">${ic(icon, "w-4 h-4")}</div><div><p class="text-white text-sm font-medium">${t}</p><p class="text-xs text-slate-400">${d}</p></div></div>`;

const chip = (id, label, n, b) => `<button class="chip ${filter === id ? "chip-on" : ""}" data-action="filter" data-id="${id}">${b ? ball(b, { size: 16 }) : ""}${label}<span class="chip-n">${n}</span></button>`;

function card(h, days) {
  const a = areaOf(h.area);
  const t = today();
  const done = habitDone(h, t);
  const sched = habitScheduled(h, t);
  const streak = habitStreak(h);
  const rate = habitRate(h, days);
  const paused = h.active === false;
  return `
  <article class="card reveal habit-card ${paused ? "opacity-60" : ""}" style="--accent:${a.color}">
    <div class="flex items-start gap-3">
      ${ball(a.ball, { size: 38 })}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <h3 class="text-white font-semibold text-lg leading-tight">${esc(h.name)}</h3>
          ${paused ? `<span class="badge badge-later">En pausa</span>` : ""}
          ${!paused && !done && missedYesterday(h) ? `<span class="badge badge-late">Nunca falle dos veces</span>` : ""}
        </div>
        <p class="text-xs text-slate-400 mt-0.5">${a.label}${h.time ? ` · ${h.time}` : ""}${h.place ? ` · ${esc(h.place)}` : ""}</p>
      </div>
      ${sched && !paused ? `<button class="check check-lg ${done ? "is-on" : ""}" data-action="habit:toggle" data-id="${h.id}" aria-label="Marcar hoy">${ic("check", "w-5 h-5")}</button>` : ""}
    </div>

    <div class="anchor-box mt-4">
      <p class="text-[11px] uppercase tracking-widest text-emerald-300/80 mb-1 flex items-center gap-1">${ic("anchor", "w-3 h-3")}Ancla</p>
      <p class="text-sm text-slate-100">Después de <strong class="text-white">${esc(h.anchor || "…")}</strong>, <strong class="text-emerald-300">${esc((h.name || "").toLowerCase())}</strong>.</p>
      ${h.identity ? `<p class="text-xs text-slate-400 mt-1 italic">“${esc(h.identity)}”</p>` : ""}
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-xs">
      ${h.bundle ? `<div class="law-pill">${ic("sparkles", "w-3 h-3")}<span>${esc(h.bundle)}</span></div>` : ""}
      ${h.twoMin ? `<div class="law-pill">${ic("feather", "w-3 h-3")}<span>${esc(h.twoMin)}</span></div>` : ""}
      ${h.reward ? `<div class="law-pill">${ic("trophy", "w-3 h-3")}<span>${esc(h.reward)}</span></div>` : ""}
    </div>

    <div class="mt-4">
      <div class="flex justify-between text-[11px] text-slate-500 mb-1.5"><span>Últimos 21 días</span><span>${rate === null ? "—" : `${Math.round(rate)} % cumplido`}</span></div>
      <div class="heat-strip">${days.map((d) => {
        const s = habitScheduled(h, d), ok = habitDone(h, d);
        return `<button class="heat ${!s ? "heat-off" : ok ? "heat-on" : d === t ? "heat-today" : "heat-miss"}" title="${shortDate(d)} · ${!s ? "no programado" : ok ? "cumplido" : "pendiente"}" ${s ? `data-action="habit:toggle" data-id="${h.id}" data-date="${d}"` : "disabled"}></button>`;
      }).join("")}</div>
    </div>

    <div class="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
      <div class="flex items-center gap-3 text-xs text-slate-400">
        <span class="streak">${ic("flame", "w-3.5 h-3.5")}${streak} ${streak === 1 ? "día" : "días"}</span>
        <span>${(h.days?.length && h.days.length < 7) ? h.days.map((d) => DOW[d]).join(" ") : "Todos los días"}</span>
      </div>
      <div class="flex gap-1">
        <button class="icon-btn" data-action="edit" data-id="${h.id}" title="Editar" aria-label="Editar">${ic("pencil", "w-4 h-4")}</button>
        <button class="icon-btn" data-action="pause" data-id="${h.id}" title="${paused ? "Activar" : "Pausar"}" aria-label="${paused ? "Activar" : "Pausar"}">${ic(paused ? "play" : "pause", "w-4 h-4")}</button>
        <button class="icon-btn hover:!text-rose-300" data-action="del" data-id="${h.id}" title="Eliminar" aria-label="Eliminar">${ic("trash-2", "w-4 h-4")}</button>
      </div>
    </div>
  </article>`;
}

export const actions = {
  filter: (d) => { filter = d.id; A.changed(); },
  seed: () => A.seedStarter({ habits: true, chores: !DB.data.chores.length }),
  edit: (d) => A.habitForm(DB.data.habits.find((h) => h.id === d.id)),
  pause: async (d) => { const h = DB.data.habits.find((x) => x.id === d.id); await DB.update("habits", d.id, { active: h.active === false }); A.changed(); },
  del: (d) => A.removeItem("habits", d.id, "este hábito y su historial")
};
