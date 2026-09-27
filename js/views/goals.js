/* RACK 21 · Metas por área de vida (laboral, académica, personal, financiera…) */
import { DB } from "../store.js";
import { today, esc, shortDate, diffDays } from "../utils.js";
import { ic, ball, sectionHead, empty, confetti, toast } from "../ui.js";
import { AREAS, areaOf } from "../logic.js";
import * as A from "../actions.js";

let filter = "todas";

export function render() {
  const gs = DB.data.goals.filter((g) => filter === "todas" || g.area === filter)
    .sort((a, b) => ({ activa: 0, pausada: 1, lograda: 2 }[a.status] - { activa: 0, pausada: 1, lograda: 2 }[b.status]) || (a.deadline || "9").localeCompare(b.deadline || "9"));
  const done = DB.data.goals.filter((g) => g.status === "lograda").length;

  return `
  ${sectionHead("Metas de vida", "Lo que quiere mejorar en cada área. Las metas dan dirección; los hábitos, el avance diario.",
    `<button class="btn btn-primary" data-action="goal:new">${ic("plus", "w-4 h-4")}Nueva meta</button>`)}

  <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
    ${AREAS.map((a) => {
      const list = DB.data.goals.filter((g) => g.area === a.id && g.status !== "pausada");
      const avg = list.length ? Math.round(list.reduce((s, g) => s + Number(g.progress || 0), 0) / list.length) : 0;
      return `<button class="card !p-3 text-left reveal area-tile ${filter === a.id ? "area-on" : ""}" data-action="filter" data-id="${a.id}" style="--accent:${a.color}">
        <div class="flex items-center gap-2 mb-2">${ball(a.ball, { size: 22 })}<span class="text-xs text-slate-300 truncate">${a.label}</span></div>
        <p class="font-display text-xl text-white">${avg}%</p><p class="text-[10px] text-slate-500">${list.length} ${list.length === 1 ? "meta" : "metas"}</p>
      </button>`;
    }).join("")}
  </div>

  <div class="flex items-center justify-between mb-4 reveal">
    <div class="flex gap-2">
      <button class="chip ${filter === "todas" ? "chip-on" : ""}" data-action="filter" data-id="todas">Todas <span class="chip-n">${DB.data.goals.length}</span></button>
      ${filter !== "todas" ? `<span class="chip chip-on">${areaOf(filter).label}</span>` : ""}
    </div>
    <p class="text-xs text-slate-400">${done} ${done === 1 ? "meta lograda" : "metas logradas"} 🏆</p>
  </div>

  ${gs.length ? `<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">${gs.map(card).join("")}</div>` :
    empty("target", "Defina qué quiere mejorar", "Cree metas en lo laboral, académico, personal y financiero. Para cada una, escriba su porqué y la siguiente acción concreta.",
      `<button class="btn btn-primary" data-action="goal:new" data-area="${filter === "todas" ? "personal" : filter}">${ic("plus", "w-4 h-4")}Crear meta</button>`)}`;
}

function card(g) {
  const a = areaOf(g.area);
  const left = g.deadline ? diffDays(g.deadline, today()) : null;
  const st = { activa: ["Activa", "badge-today"], lograda: ["Lograda", "badge-done"], pausada: ["Pausada", "badge-later"] }[g.status || "activa"];
  return `<article class="card reveal goal-card" style="--accent:${a.color}">
    <div class="flex items-start gap-3">
      ${ball(a.ball, { size: 32 })}
      <div class="flex-1 min-w-0"><h3 class="text-white font-semibold leading-snug">${esc(g.title)}</h3><p class="text-xs text-slate-400">${a.label}</p></div>
      <span class="badge ${st[1]}">${st[0]}</span>
    </div>
    ${g.why ? `<p class="text-sm text-slate-300 mt-3 italic">“${esc(g.why)}”</p>` : ""}
    <div class="mt-4">
      <div class="flex justify-between text-xs mb-1"><span class="text-slate-400">Avance</span><span class="font-mono text-white">${g.progress || 0}%</span></div>
      <div class="bar bar-lg"><span style="--w:${g.progress || 0}%"></span></div>
    </div>
    ${g.nextAction && g.status !== "lograda" ? `<p class="text-xs text-cyan-200 mt-3 flex gap-1.5">${ic("circle-arrow-right", "w-3.5 h-3.5 shrink-0 mt-0.5")}<span><strong>Siguiente paso:</strong> ${esc(g.nextAction)}</span></p>` : ""}
    <div class="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
      <span class="text-xs ${left !== null && left < 0 && g.status !== "lograda" ? "text-rose-300" : "text-slate-500"}">${g.deadline ? `${shortDate(g.deadline)} · ${left >= 0 ? `faltan ${left} días` : `vencida hace ${-left} días`}` : "Sin fecha límite"}</span>
      <div class="flex gap-1">
        ${g.status !== "lograda" ? `<button class="btn btn-sm btn-ghost" data-action="plus" data-id="${g.id}">+10%</button>` : ""}
        <button class="icon-btn" data-action="edit" data-id="${g.id}" aria-label="Editar">${ic("pencil", "w-4 h-4")}</button>
        <button class="icon-btn hover:!text-rose-300" data-action="del" data-id="${g.id}" aria-label="Eliminar">${ic("trash-2", "w-4 h-4")}</button>
      </div>
    </div>
  </article>`;
}

export const actions = {
  filter: (d) => { filter = filter === d.id ? "todas" : d.id; A.changed(); },
  "goal:new": (d) => A.goalForm(null, d.area || (filter === "todas" ? "personal" : filter)),
  edit: (d) => A.goalForm(DB.data.goals.find((g) => g.id === d.id)),
  del: (d) => A.removeItem("goals", d.id, "esta meta"),
  plus: async (d) => {
    const g = DB.data.goals.find((x) => x.id === d.id);
    const p = Math.min(100, Number(g.progress || 0) + 10);
    await DB.update("goals", g.id, { progress: p, status: p >= 100 ? "lograda" : g.status });
    if (p >= 100) { confetti(); toast("¡Meta lograda! Esto merece celebrarse."); }
    A.changed();
  }
};
