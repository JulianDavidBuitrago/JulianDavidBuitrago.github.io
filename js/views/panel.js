/* RACK 21 · Panel BI: estadísticas, evolución y trazabilidad del coach */
import { DB } from "../store.js";
import { APP } from "../config.js";
import { today, esc, money, lastNDays, shortDate, sum, monthLabel, dateRange, addDays, groupBy } from "../utils.js";
import { ic, sectionHead } from "../ui.js";
import { chart, axes, moneyTip, PALETTE, C } from "../charts.js";
import {
  dayScore, challenge, habitScheduled, habitDone, habitRate, minutesOn, txFilter, totals, byCategory, byMonth,
  byEntity, areaBalance, transformation, choreDueOn, choreDoneOn, level
} from "../logic.js";
import * as A from "../actions.js";

let range = "21";

function days() {
  const ch = challenge();
  if (range === "reto" && ch) return dateRange(ch.start, ch.end < today() ? ch.end : today());
  return lastNDays(Number(range === "reto" ? 21 : range));
}

export function sessions() {
  const g = groupBy(DB.data.chat.slice().sort((a, b) => a.ts - b.ts), (m) => m.session || "general");
  return Object.entries(g).map(([id, msgs]) => ({
    id, msgs, start: msgs[0].ts, end: msgs[msgs.length - 1].ts,
    title: (msgs.find((m) => m.role === "user")?.content || "Conversación").slice(0, 90),
    commitments: DB.data.commitments.filter((c) => c.session === id)
  })).sort((a, b) => b.end - a.end);
}

export function render() {
  const ds = days();
  const scores = ds.map(dayScore);
  const valid = scores.filter((s) => s.score !== null);
  const avg = valid.length ? Math.round(sum(valid, (s) => s.score) / valid.length) : 0;
  const good = valid.filter((s) => s.score >= APP.dayGoal).length;
  const hTot = sum(scores, (s) => s.habits.total), hDone = sum(scores, (s) => s.habits.done);
  const cTot = sum(scores, (s) => s.chores.total), cDone = sum(scores, (s) => s.chores.done);
  const mins = sum(ds, minutesOn);
  const tt = totals(txFilter({ from: ds[0], to: ds[ds.length - 1] }));
  const com = DB.data.commitments, comDone = com.filter((c) => c.done).length;
  const ss = sessions();
  const tr = transformation();
  const ch = challenge();
  const lv = level();

  return `
  ${sectionHead("Panel BI", "Su vida en datos: evolución diaria, finanzas, ejercicio, hogar y trazabilidad del coach.",
    `<div class="seg" role="tablist" aria-label="Periodo">${[["7", "7 d"], ["21", "21 d"], ["30", "30 d"], ["90", "90 d"], ...(ch ? [["reto", "Reto"]] : [])].map(([v, l]) =>
      `<button role="tab" aria-selected="${range === v}" class="${range === v ? "seg-on" : ""}" data-action="range" data-id="${v}">${l}</button>`).join("")}</div>`)}

  <div class="grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-8 gap-3 mb-6">
    ${kpi("gauge", "Puntaje promedio", `${avg}%`, avg >= APP.dayGoal ? "good" : "")}
    ${kpi("circle-dot", `Días ≥ ${APP.dayGoal}%`, `${good}/${ds.length}`)}
    ${kpi("repeat", "Hábitos", hTot ? `${Math.round((hDone / hTot) * 100)}%` : "—")}
    ${kpi("house", "Hogar", cTot ? `${Math.round((cDone / cTot) * 100)}%` : "—")}
    ${kpi("dumbbell", "Ejercicio", `${mins} min`)}
    ${kpi("trending-up", "Ingresos", money(tt.inc, true))}
    ${kpi("trending-down", "Gastos", money(tt.exp, true))}
    ${kpi("scale", "Balance", money(tt.net, true), tt.net >= 0 ? "good" : "bad")}
  </div>

  <div class="grid xl:grid-cols-3 gap-4 sm:gap-6 mb-6">
    <div class="card reveal xl:col-span-2">
      <div class="flex justify-between items-start mb-1"><h2 class="card-title">${ic("activity", "w-5 h-5 text-cyan-300")}Puntaje diario</h2><span class="text-xs text-slate-500">Línea punteada: meta ${APP.dayGoal}%</span></div>
      <p class="text-xs text-slate-400 mb-4">Promedio ponderado de hábitos (50 %), hogar (25 %) y ejercicio (25 %).</p>
      <div class="h-64"><canvas id="cScore" role="img" aria-label="Puntaje diario"></canvas></div>
      <details class="mt-3 text-xs"><summary class="cursor-pointer text-slate-400 hover:text-white">Ver tabla de datos</summary>
        <div class="overflow-x-auto mt-2"><table class="data-table"><thead><tr><th>Fecha</th><th>Puntaje</th><th>Hábitos</th><th>Hogar</th><th>Ejercicio</th></tr></thead><tbody>
        ${scores.slice().reverse().map((s) => `<tr><td>${shortDate(s.date)}</td><td>${s.score ?? "—"}${s.score !== null ? "%" : ""}</td><td>${s.habits.done}/${s.habits.total}</td><td>${s.chores.done}/${s.chores.total}</td><td>${s.exercise.minutes} min</td></tr>`).join("")}
        </tbody></table></div></details>
    </div>
    <div class="card reveal">
      <h2 class="card-title mb-1">${ic("radar", "w-5 h-5 text-violet-300")}Equilibrio de vida</h2>
      <p class="text-xs text-slate-400 mb-2">Índice 0–100 por área (hábitos, metas, hogar, ejercicio y finanzas).</p>
      <div class="h-72"><canvas id="cRadar" role="img" aria-label="Equilibrio por área"></canvas></div>
    </div>
  </div>

  ${tr ? `<div class="card reveal mb-6 felt relative overflow-hidden">
    <div class="absolute inset-0 felt-glow pointer-events-none"></div>
    <div class="relative">
      <div class="flex flex-wrap justify-between gap-3 items-start mb-4">
        <div><h2 class="card-title">${ic("trophy", "w-5 h-5 text-amber-300")}Informe de transformación · 21 días</h2>
        <p class="text-xs text-emerald-100/70 mt-1">Semana 1 vs semana 3 del reto. ${ch.finished ? "¡Reto completado!" : `Hoy va en el día ${Math.min(ch.dayNum, 21)}.`} Bolas embocadas: <strong class="text-white">${ch.pocketed}/21</strong> · Nivel: <strong class="text-white">${lv.name}</strong></p></div>
      </div>
      <div class="overflow-x-auto"><table class="data-table data-table-lg">
        <thead><tr><th>Indicador</th><th>Semana 1</th><th>Semana 2</th><th>Semana 3</th><th>Cambio S1→S3</th></tr></thead>
        <tbody>
          ${trRow("Puntaje promedio", tr, "score", (v) => `${v}%`)}
          ${trRow("Hábitos cumplidos", tr, "habits")}
          ${trRow("Tareas del hogar", tr, "chores")}
          ${trRow("Minutos de ejercicio", tr, "minutes")}
          ${trRow("Balance financiero", tr, "net", (v) => money(v, true))}
        </tbody></table></div>
    </div>
  </div>` : ""}

  <div class="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
    <div class="card reveal">
      <h2 class="card-title mb-4">${ic("chart-column", "w-5 h-5 text-emerald-300")}Ingresos vs. gastos · 6 meses</h2>
      <div class="h-64"><canvas id="cMonths" role="img" aria-label="Ingresos y gastos por mes"></canvas></div>
    </div>
    <div class="card reveal">
      <h2 class="card-title mb-4">${ic("building-2", "w-5 h-5 text-cyan-300")}Utilidad por negocio · periodo</h2>
      <div class="h-64"><canvas id="cEntity" role="img" aria-label="Utilidad por entidad"></canvas></div>
    </div>
    <div class="card reveal">
      <h2 class="card-title mb-4">${ic("chart-pie", "w-5 h-5 text-orange-300")}¿En qué se va el dinero?</h2>
      <div class="h-64"><canvas id="cCat" role="img" aria-label="Gastos por categoría"></canvas></div>
    </div>
    <div class="card reveal">
      <div class="flex flex-wrap justify-between gap-2 mb-4"><h2 class="card-title">${ic("dumbbell", "w-5 h-5 text-cyan-300")}Minutos de ejercicio por día</h2><span class="text-xs text-slate-400 flex items-center gap-3"><span class="flex items-center gap-1"><i class="inline-block w-2.5 h-2.5 rounded-sm" style="background:#199e70"></i>Meta diaria cumplida</span><span class="flex items-center gap-1"><i class="inline-block w-2.5 h-2.5 rounded-sm" style="background:#3987e5"></i>Por debajo</span></span></div>
      <div class="h-64"><canvas id="cEx" role="img" aria-label="Minutos de ejercicio"></canvas></div>
    </div>
  </div>

  <div class="card reveal mb-6">
    <h2 class="card-title mb-1">${ic("grid-3x3", "w-5 h-5 text-emerald-300")}Mapa de calor de hábitos</h2>
    <p class="text-xs text-slate-400 mb-4">Verde: cumplido · Rojo tenue: no cumplido · Vacío: no programado. Últimos ${Math.min(ds.length, 21)} días del periodo.</p>
    ${heatmap(ds.slice(-21))}
  </div>

  <div class="grid lg:grid-cols-5 gap-4 sm:gap-6">
    <div class="card reveal lg:col-span-3">
      <div class="flex justify-between items-center mb-4">
        <h2 class="card-title">${ic("history", "w-5 h-5 text-cyan-300")}Trazabilidad del coach IA</h2>
        <span class="text-xs text-slate-500">${ss.length} conversaciones · ${DB.data.chat.length} mensajes</span>
      </div>
      ${ss.length ? `<ol class="timeline">${ss.slice(0, 12).map((s) => `
        <li>
          <button class="timeline-item" data-action="open-session" data-id="${esc(s.id)}">
            <div class="flex justify-between gap-3"><p class="text-white text-sm font-medium line-clamp-2 text-left">${esc(s.title)}</p><span class="text-[11px] text-slate-500 whitespace-nowrap">${new Date(s.start).toLocaleDateString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></div>
            <p class="text-[11px] text-slate-400 mt-1 text-left">${s.msgs.length} mensajes · ${s.commitments.length} compromisos (${s.commitments.filter((c) => c.done).length} cumplidos)</p>
          </button>
        </li>`).join("")}</ol>` : `<p class="text-slate-400 text-sm">Aún no hay conversaciones. Cada consulta al coach quedará registrada aquí con sus compromisos.</p>`}
    </div>
    <div class="card reveal lg:col-span-2">
      <div class="flex justify-between items-center mb-4">
        <h2 class="card-title">${ic("handshake", "w-5 h-5 text-amber-300")}Compromisos</h2>
        <span class="text-xs font-mono text-amber-300">${comDone}/${com.length}</span>
      </div>
      ${com.length ? `<div class="bar mb-4"><span style="--w:${(comDone / com.length) * 100}%"></span></div>
        <ul class="space-y-2 max-h-80 overflow-y-auto pr-1">${com.slice().sort((a, b) => a.done - b.done || b.createdAt - a.createdAt).map((c) => `
        <li class="row"><button class="check ${c.done ? "is-on" : ""}" data-action="commit:toggle" data-id="${c.id}" aria-label="Cambiar estado">${ic("check", "w-4 h-4")}</button>
        <p class="flex-1 text-sm ${c.done ? "line-through text-slate-500" : "text-slate-200"}">${esc(c.text)}</p>
        <button class="icon-btn" data-action="commit:del" data-id="${c.id}" aria-label="Eliminar">${ic("x", "w-3.5 h-3.5")}</button></li>`).join("")}</ul>`
      : `<p class="text-slate-400 text-sm">Los compromisos sugeridos por el coach que usted guarde aparecerán aquí con su estado de cumplimiento.</p>`}
    </div>
  </div>`;
}

const kpi = (icon, label, v, tone = "") => `<div class="card reveal !p-4 kpi ${tone ? `kpi-${tone}` : ""}"><div class="flex items-center gap-1.5 text-slate-400 text-[11px] mb-2">${ic(icon, "w-3.5 h-3.5")}${label}</div><p class="font-display text-lg sm:text-xl text-white truncate">${v}</p></div>`;

function trRow(label, tr, k, f = (v) => v.toLocaleString("es-CO")) {
  const d = tr.w3.days ? tr.w3[k] - tr.w1[k] : null;
  const cls = d === null ? "text-slate-500" : d > 0 ? "text-emerald-300" : d < 0 ? "text-rose-300" : "text-slate-400";
  return `<tr><td class="text-slate-300">${label}</td><td>${f(tr.w1[k])}</td><td>${tr.w2.days ? f(tr.w2[k]) : "—"}</td><td>${tr.w3.days ? f(tr.w3[k]) : "—"}</td>
    <td class="${cls} font-semibold">${d === null ? "En curso" : `${d > 0 ? "▲ +" : d < 0 ? "▼ " : ""}${f(d)}`}</td></tr>`;
}

function heatmap(ds) {
  const hs = DB.data.habits.filter((h) => h.active !== false);
  if (!hs.length) return `<p class="text-slate-400 text-sm">Cree hábitos para ver su mapa de calor.</p>`;
  return `<div class="overflow-x-auto"><table class="heatmap"><thead><tr><th></th>${ds.map((d) => `<th title="${d}">${Number(d.slice(8))}</th>`).join("")}<th>%</th></tr></thead><tbody>
    ${hs.map((h) => `<tr><td class="text-left pr-3 text-slate-300 whitespace-nowrap max-w-[180px] truncate">${esc(h.name)}</td>${ds.map((d) => {
      const s = habitScheduled(h, d), ok = s && habitDone(h, d);
      return `<td><span class="hm ${!s ? "hm-off" : ok ? "hm-on" : "hm-miss"}" title="${esc(h.name)} · ${shortDate(d)}: ${!s ? "no programado" : ok ? "cumplido" : "no cumplido"}"></span></td>`;
    }).join("")}<td class="font-mono text-white pl-2">${Math.round(habitRate(h, ds) ?? 0)}</td></tr>`).join("")}
  </tbody></table></div>`;
}

export function mount() {
  const ds = days();
  const scores = ds.map(dayScore);
  const labels = ds.map(shortDate);

  chart("cScore", {
    type: "line",
    data: { labels, datasets: [
      { label: "Puntaje", data: scores.map((s) => s.score), borderColor: C.line, borderWidth: 2, tension: .35, pointRadius: ds.length > 40 ? 0 : 4, pointHoverRadius: 7, pointBackgroundColor: C.line, pointBorderColor: C.surface, pointBorderWidth: 2, spanGaps: true,
        fill: true, backgroundColor: (ctx) => { const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 260); g.addColorStop(0, "rgba(34,211,238,.28)"); g.addColorStop(1, "rgba(34,211,238,0)"); return g; } },
      { label: "Meta", data: ds.map(() => APP.dayGoal), borderColor: "rgba(250,178,25,.7)", borderDash: [6, 6], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0, fill: false }
    ] },
    options: { interaction: { mode: "index", intersect: false }, scales: axes({ max: 100 }), plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y ?? "—"}%` } } } }
  });

  const bal = areaBalance(ds.slice(-21));
  chart("cRadar", {
    type: "radar",
    data: { labels: bal.map((a) => a.label), datasets: [{ label: "Índice", data: bal.map((a) => a.value), borderColor: "#9085e9", backgroundColor: "rgba(144,133,233,.22)", borderWidth: 2, pointBackgroundColor: bal.map((a) => a.color), pointBorderColor: C.surface, pointRadius: 5, pointHoverRadius: 8 }] },
    options: { plugins: { legend: { display: false } }, scales: { r: { min: 0, max: 100, ticks: { display: false, stepSize: 25 }, grid: { color: C.grid }, angleLines: { color: C.grid }, pointLabels: { color: C.text, font: { size: 11 } } } } }
  });

  const months = byMonth(DB.data.transactions, 6);
  chart("cMonths", {
    type: "bar",
    data: { labels: months.map((m) => monthLabel(m.k)), datasets: [
      { label: "Ingresos", data: months.map((m) => m.inc), backgroundColor: C.income, borderRadius: 4, borderSkipped: "bottom", maxBarThickness: 26 },
      { label: "Gastos", data: months.map((m) => m.exp), backgroundColor: C.expense, borderRadius: 4, borderSkipped: "bottom", maxBarThickness: 26 }
    ] },
    options: { interaction: { mode: "index", intersect: false }, scales: axes({ money: true }), plugins: { tooltip: moneyTip, legend: { position: "top", align: "end" } } }
  });

  const list = txFilter({ from: ds[0], to: ds[ds.length - 1] });
  const ents = byEntity(list).filter((e) => e.inc || e.exp);
  chart("cEntity", {
    type: "bar",
    data: { labels: ents.length ? ents.map((e) => e.name) : ["Sin datos"], datasets: [{ label: "Utilidad", data: ents.length ? ents.map((e) => e.net) : [0],
      backgroundColor: ents.map((e) => e.net >= 0 ? (DB.data.businesses.find((b) => b.id === e.id)?.color || "#3987e5") : "#e66767"), borderRadius: 4, maxBarThickness: 28 }] },
    options: { indexAxis: "y", scales: { x: { grid: { color: C.grid }, border: { display: false }, ticks: { callback: (v) => new Intl.NumberFormat("es-CO", { notation: "compact" }).format(v) } }, y: { grid: { display: false } } }, plugins: { legend: { display: false }, tooltip: moneyTip } }
  });

  let cats = byCategory(list);
  if (cats.length > 7) cats = [...cats.slice(0, 6), { k: "Otros", v: sum(cats.slice(6), (c) => c.v) }];
  chart("cCat", {
    type: "doughnut",
    data: { labels: cats.length ? cats.map((c) => c.k) : ["Sin gastos"], datasets: [{ data: cats.length ? cats.map((c) => c.v) : [1],
      backgroundColor: cats.length ? cats.map((c, i) => c.k === "Otros" ? "#64748b" : PALETTE[i]) : ["#1e293b"], borderColor: C.surface, borderWidth: 2, hoverOffset: 8 }] },
    options: { cutout: "66%", plugins: { legend: { position: "right", labels: { color: C.text, padding: 10, font: { size: 11 } } }, tooltip: cats.length ? moneyTip : { enabled: false } } }
  });

  chart("cEx", {
    type: "bar",
    data: { labels, datasets: [{ label: "Minutos", data: ds.map(minutesOn), backgroundColor: ds.map((d) => minutesOn(d) >= Number(DB.profile.exerciseDaily || 30) ? "#199e70" : "#3987e5"), borderRadius: 4, borderSkipped: "bottom", maxBarThickness: 22 }] },
    options: { scales: axes(), plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.parsed.y} min` } } } }
  });
}

export const actions = {
  range: (d) => { range = d.id; A.changed(); },
  "open-session": (d) => { sessionStorage.setItem("rack21:open", d.id); location.hash = "#/coach"; },
  "commit:del": (d) => A.removeItem("commitments", d.id, "este compromiso")
};
