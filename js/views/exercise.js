/* RACK 21 · Ejercicio */
import { DB } from "../store.js";
import { today, esc, shortDate, lastNDays, sum, DOW, weekday, groupBy } from "../utils.js";
import { ic, sectionHead, empty, ring } from "../ui.js";
import { minutesOn, weeklyExerciseTarget, dailyExerciseTarget, WORKOUT_TYPES } from "../logic.js";
import * as A from "../actions.js";

export function render() {
  const d7 = lastNDays(7), d28 = lastNDays(28);
  const week = sum(d7, minutesOn), target = weeklyExerciseTarget();
  const sessions7 = DB.data.workouts.filter((w) => w.date >= d7[0]).length;
  const activeDays = d28.filter((d) => minutesOn(d) > 0).length;
  let streak = 0; for (const d of lastNDays(60).reverse()) { if (minutesOn(d) > 0) streak++; else if (d !== today()) break; }
  const max = Math.max(dailyExerciseTarget(), ...d7.map(minutesOn));
  const byType = Object.entries(groupBy(DB.data.workouts.filter((w) => w.date >= d28[0]), (w) => w.type)).map(([k, v]) => ({ k, m: sum(v, (w) => w.minutes) })).sort((a, b) => b.m - a.m);
  const list = DB.data.workouts.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));

  return `
  ${sectionHead("Ejercicio", "Cuerpo fuerte, pulso firme. Cada minuto cuenta para su bola del día.",
    `<button class="btn btn-primary" data-action="workout:new">${ic("plus", "w-4 h-4")}Registrar entrenamiento</button>`)}

  <div class="grid lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
    <div class="card reveal flex items-center gap-6">
      ${ring((week / target) * 100, { size: 130, label: "%", sub: "meta semanal" })}
      <div class="space-y-2">
        <p class="text-slate-400 text-sm">Últimos 7 días</p>
        <p class="font-display text-3xl text-white"><span data-count="${week}">0</span><span class="text-base text-slate-400"> / ${target} min</span></p>
        <p class="text-xs text-slate-500">${week >= target ? "¡Meta cumplida! Usted es de los que cumplen." : `Le faltan ${target - week} min. ¿Una sesión de ${Math.min(45, target - week)} min hoy?`}</p>
      </div>
    </div>
    <div class="card reveal lg:col-span-2">
      <div class="flex justify-between items-center mb-4"><h2 class="card-title">${ic("activity", "w-5 h-5 text-cyan-300")}Minutos por día</h2><span class="text-xs text-slate-500">Meta diaria: ${dailyExerciseTarget()} min</span></div>
      <div class="flex items-end gap-2 sm:gap-4 h-40" role="img" aria-label="Minutos de ejercicio de los últimos 7 días">
        ${d7.map((d) => { const m = minutesOn(d); return `<div class="flex-1 flex flex-col items-center gap-2 h-full justify-end group" title="${shortDate(d)}: ${m} min">
          <span class="text-[11px] font-mono ${m ? "text-white" : "text-slate-600"}">${m}</span>
          <div class="w-full max-w-[44px] rounded-t-md bar-col ${m >= dailyExerciseTarget() ? "bar-col-ok" : ""}" style="--h:${Math.max(2, (m / max) * 100)}%"></div>
          <span class="text-[11px] ${d === today() ? "text-cyan-300 font-semibold" : "text-slate-500"}">${DOW[weekday(d)]}</span></div>`; }).join("")}
      </div>
    </div>
  </div>

  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
    ${kpi("zap", "Sesiones (7 d)", sessions7)}
    ${kpi("flame", "Días seguidos activo", streak)}
    ${kpi("calendar-days", "Días activos (28 d)", activeDays)}
    ${kpi("clock", "Minutos (28 d)", sum(d28, minutesOn))}
  </div>

  ${byType.length ? `<div class="card reveal mb-6"><h2 class="card-title mb-4">${ic("chart-bar", "w-5 h-5 text-amber-300")}Mezcla de actividades · 28 días</h2>
    <div class="space-y-3">${byType.map((x) => `<div><div class="flex justify-between text-sm mb-1"><span class="text-slate-300">${esc(x.k)}${x.k === "Billar" ? " 🎱" : ""}</span><span class="font-mono text-white">${x.m} min</span></div><div class="bar"><span style="--w:${(x.m / byType[0].m) * 100}%"></span></div></div>`).join("")}</div>
    ${!byType.some((x) => x.k === "Fuerza") ? `<p class="text-xs text-cyan-200/80 mt-4">Idea del coach: dos sesiones cortas de fuerza por semana (espalda y core) mejoran la estabilidad del tiro en el billar. ¿Se anima?</p>` : ""}
  </div>` : ""}

  <h2 class="card-title mb-3 reveal">${ic("history", "w-5 h-5 text-emerald-300")}Historial</h2>
  ${list.length ? `<div class="card !p-0 overflow-hidden reveal"><ul class="divide-y divide-white/5">${list.slice(0, 100).map((w) => `
    <li class="tx-row">
      <div class="w-10 h-10 rounded-xl grid place-items-center shrink-0 bg-cyan-400/10 text-cyan-300">${ic(w.type === "Billar" ? "circle-dot" : w.type === "Cardio" || w.type === "Caminata" ? "footprints" : w.type === "Bicicleta" ? "bike" : "dumbbell", "w-5 h-5")}</div>
      <div class="flex-1 min-w-0"><p class="text-white text-sm">${esc(w.type)} · <span class="font-mono">${w.minutes} min</span></p>
        <p class="text-[11px] text-slate-500 truncate">${shortDate(w.date)} · Intensidad ${"●".repeat(w.intensity || 0)}${"○".repeat(5 - (w.intensity || 0))}${w.notes ? ` · ${esc(w.notes)}` : ""}</p></div>
      <div class="flex gap-0.5">
        <button class="icon-btn" data-action="edit" data-id="${w.id}" aria-label="Editar">${ic("pencil", "w-4 h-4")}</button>
        <button class="icon-btn hover:!text-rose-300" data-action="del" data-id="${w.id}" aria-label="Eliminar">${ic("trash-2", "w-4 h-4")}</button>
      </div>
    </li>`).join("")}</ul></div>` : empty("dumbbell", "Registre su primer entrenamiento", "Caminar, entrenar fuerza o una buena sesión de billar: todo movimiento suma. Empiece con la versión de 2 minutos: ponerse la ropa de entrenamiento.",
      `<button class="btn btn-primary" data-action="workout:new">${ic("plus", "w-4 h-4")}Registrar</button>`)}`;
}

const kpi = (icon, label, v) => `<div class="card reveal !p-4"><div class="flex items-center gap-2 text-slate-400 text-xs mb-2">${ic(icon, "w-4 h-4 text-cyan-300")}${label}</div><p class="font-display text-3xl text-white" data-count="${v}">0</p></div>`;

export const actions = {
  edit: (d) => A.workoutForm(DB.data.workouts.find((w) => w.id === d.id)),
  del: (d) => A.removeItem("workouts", d.id, "este entrenamiento")
};
