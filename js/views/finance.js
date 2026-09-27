/* RACK 21 · Finanzas personales y de negocios */
import { DB } from "../store.js";
import { today, esc, money, shortDate, addDays, toISO } from "../utils.js";
import { ic, sectionHead, empty } from "../ui.js";
import { txFilter, totals, entityName, byEntity, byCategory } from "../logic.js";
import * as A from "../actions.js";

const st = { period: "mes", entity: "all", kind: "all", q: "" };

export function periodRange(p) {
  const t = today(); const d = new Date();
  switch (p) {
    case "mes": return { from: `${t.slice(0, 7)}-01`, to: t, label: "este mes" };
    case "anterior": { const a = new Date(d.getFullYear(), d.getMonth() - 1, 1), b = new Date(d.getFullYear(), d.getMonth(), 0); return { from: toISO(a), to: toISO(b), label: "el mes anterior" }; }
    case "90": return { from: addDays(t, -89), to: t, label: "los últimos 90 días" };
    case "anio": return { from: `${t.slice(0, 4)}-01-01`, to: t, label: "este año" };
    default: return { from: "", to: "", label: "todo el historial" };
  }
}

export function render() {
  const r = periodRange(st.period);
  const all = txFilter({ from: r.from, to: r.to, entity: st.entity });
  const tt = totals(all);
  const list = all.filter((t) => st.kind === "all" || t.kind === st.kind)
    .filter((t) => !st.q || `${t.note} ${t.category} ${entityName(t.entity)}`.toLowerCase().includes(st.q.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  const ents = byEntity(txFilter({ from: r.from, to: r.to }));
  const monthNet = (id) => totals(txFilter({ from: `${today().slice(0, 7)}-01`, to: today(), entity: id })).net;
  const topCat = byCategory(all)[0];

  return `
  ${sectionHead("Finanzas y negocios", "Personal y cada negocio por separado. Lo que se registra, se puede mejorar.",
    `<button class="btn btn-ghost" data-action="biz:new">${ic("building-2", "w-4 h-4")}Nuevo negocio</button>
     <button class="btn btn-income" data-action="tx:new" data-kind="ingreso">${ic("trending-up", "w-4 h-4")}Ingreso</button>
     <button class="btn btn-expense" data-action="tx:new" data-kind="gasto">${ic("trending-down", "w-4 h-4")}Gasto</button>`)}

  <div class="card !p-3 mb-6 reveal flex flex-wrap gap-3 items-center">
    <label class="sr-only" for="fperiod">Periodo</label>
    <select id="fperiod" class="input !w-auto" data-change="period">
      ${[["mes", "Este mes"], ["anterior", "Mes anterior"], ["90", "Últimos 90 días"], ["anio", "Este año"], ["todo", "Todo"]].map(([v, l]) => `<option value="${v}" ${st.period === v ? "selected" : ""}>${l}</option>`).join("")}
    </select>
    <label class="sr-only" for="fent">Entidad</label>
    <select id="fent" class="input !w-auto" data-change="entity">
      <option value="all">Todo (personal + negocios)</option>
      <option value="personal" ${st.entity === "personal" ? "selected" : ""}>Solo personal</option>
      <option value="negocios" ${st.entity === "negocios" ? "selected" : ""}>Solo negocios</option>
      ${DB.data.businesses.map((b) => `<option value="${b.id}" ${st.entity === b.id ? "selected" : ""}>${esc(b.name)}</option>`).join("")}
    </select>
    <button class="link ml-auto" data-action="go" data-to="panel">${ic("chart-pie", "w-4 h-4")}Ver análisis en el Panel BI</button>
  </div>

  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
    ${kpi("Ingresos", tt.inc, "text-emerald-300", "trending-up")}
    ${kpi("Gastos", tt.exp, "text-orange-300", "trending-down")}
    ${kpi("Balance", tt.net, tt.net >= 0 ? "text-emerald-300" : "text-rose-300", "scale")}
    <div class="card reveal !p-4"><div class="flex items-center gap-2 text-slate-400 text-xs mb-2">${ic("percent", "w-4 h-4 text-cyan-300")}Margen</div>
      <p class="font-display text-2xl sm:text-3xl text-white">${tt.inc ? Math.round(tt.margin) : 0}%</p>
      <p class="text-[11px] text-slate-500 mt-1 truncate">${topCat ? `Mayor gasto: ${esc(topCat.k)}` : "Sin gastos en el periodo"}</p></div>
  </div>

  <h2 class="card-title mb-3 reveal">${ic("building-2", "w-5 h-5 text-cyan-300")}Mis negocios</h2>
  ${DB.data.businesses.length ? `<div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">${DB.data.businesses.map((b) => {
    const e = ents.find((x) => x.id === b.id) || { inc: 0, exp: 0, net: 0 };
    const goal = Number(b.monthlyGoal || 0), mn = monthNet(b.id);
    return `<article class="card reveal biz-card" style="--biz:${b.color || "#22d3ee"}">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0"><h3 class="text-white font-semibold text-lg truncate">${esc(b.name)}</h3><p class="text-xs text-slate-400">${esc(b.kind || "Negocio")}</p></div>
        <div class="flex gap-1 shrink-0">
          <button class="icon-btn" data-action="biz:edit" data-id="${b.id}" aria-label="Editar">${ic("pencil", "w-4 h-4")}</button>
          <button class="icon-btn hover:!text-rose-300" data-action="biz:del" data-id="${b.id}" aria-label="Eliminar">${ic("trash-2", "w-4 h-4")}</button>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-2 mt-4 text-center">
        <div class="mini"><span class="mini-l">Ingresos</span><span class="mini-v text-emerald-300 text-sm">${money(e.inc, true)}</span></div>
        <div class="mini"><span class="mini-l">Gastos</span><span class="mini-v text-orange-300 text-sm">${money(e.exp, true)}</span></div>
        <div class="mini"><span class="mini-l">Utilidad</span><span class="mini-v ${e.net >= 0 ? "text-white" : "text-rose-300"} text-sm">${money(e.net, true)}</span></div>
      </div>
      ${goal ? `<div class="mt-4"><div class="flex justify-between text-[11px] text-slate-400 mb-1"><span>Meta mensual de utilidad</span><span>${money(mn, true)} / ${money(goal, true)}</span></div><div class="bar"><span style="--w:${Math.max(0, Math.min(100, (mn / goal) * 100))}%"></span></div></div>` : ""}
      <div class="flex gap-2 mt-4">
        <button class="btn btn-sm btn-income flex-1" data-action="tx:new" data-kind="ingreso" data-entity="${b.id}">${ic("plus", "w-3.5 h-3.5")}Ingreso</button>
        <button class="btn btn-sm btn-expense flex-1" data-action="tx:new" data-kind="gasto" data-entity="${b.id}">${ic("minus", "w-3.5 h-3.5")}Gasto</button>
      </div>
    </article>`;
  }).join("")}</div>` : `<div class="card reveal mb-8 flex flex-col sm:flex-row items-center gap-4"><div class="w-12 h-12 rounded-2xl bg-cyan-400/10 text-cyan-300 grid place-items-center">${ic("building-2", "w-6 h-6")}</div><p class="text-slate-300 text-sm flex-1">Cree cada uno de sus negocios para ver ingresos, gastos y utilidad por separado, sin mezclarlos con sus finanzas personales.</p><button class="btn btn-primary" data-action="biz:new">${ic("plus", "w-4 h-4")}Crear negocio</button></div>`}

  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 reveal">
    <h2 class="card-title">${ic("receipt", "w-5 h-5 text-amber-300")}Movimientos <span class="text-slate-500 text-sm font-normal">(${list.length})</span></h2>
    <div class="flex gap-2">
      <select class="input !w-auto !py-2 text-sm" data-change="kind" aria-label="Tipo">
        <option value="all">Todos</option><option value="ingreso" ${st.kind === "ingreso" ? "selected" : ""}>Ingresos</option><option value="gasto" ${st.kind === "gasto" ? "selected" : ""}>Gastos</option>
      </select>
      <input class="input !py-2 text-sm" placeholder="Buscar…" value="${esc(st.q)}" data-input="q" aria-label="Buscar movimientos">
    </div>
  </div>
  ${list.length ? `<div class="card !p-0 overflow-hidden reveal"><ul class="divide-y divide-white/5">${list.slice(0, 200).map((t) => {
    const b = DB.data.businesses.find((x) => x.id === t.entity);
    return `<li class="tx-row">
      <div class="w-10 h-10 rounded-xl grid place-items-center shrink-0 ${t.kind === "ingreso" ? "bg-emerald-400/10 text-emerald-300" : "bg-orange-400/10 text-orange-300"}">${ic(t.kind === "ingreso" ? "arrow-down-left" : "arrow-up-right", "w-5 h-5")}</div>
      <div class="flex-1 min-w-0">
        <p class="text-white text-sm truncate">${esc(t.note || t.category)}</p>
        <p class="text-[11px] text-slate-500 truncate"><span class="inline-block w-2 h-2 rounded-full mr-1" style="background:${b?.color || "#94a3b8"}"></span>${esc(entityName(t.entity))} · ${esc(t.category)} · ${shortDate(t.date)}${t.method ? ` · ${esc(t.method)}` : ""}</p>
      </div>
      <p class="font-mono text-sm whitespace-nowrap ${t.kind === "ingreso" ? "text-emerald-300" : "text-orange-300"}">${t.kind === "ingreso" ? "+" : "−"}${money(t.amount)}</p>
      <div class="flex gap-0.5">
        <button class="icon-btn" data-action="tx:edit" data-id="${t.id}" aria-label="Editar">${ic("pencil", "w-4 h-4")}</button>
        <button class="icon-btn hover:!text-rose-300" data-action="tx:del" data-id="${t.id}" aria-label="Eliminar">${ic("trash-2", "w-4 h-4")}</button>
      </div>
    </li>`;
  }).join("")}</ul></div>` : empty("wallet", "Sin movimientos en este periodo", `Registre ingresos y gastos de ${r.label}. Consejo de hábito: ancle el registro a “cerrar caja” en cada negocio.`)}`;
}

const kpi = (label, v, color, icon) => `<div class="card reveal !p-4"><div class="flex items-center gap-2 text-slate-400 text-xs mb-2">${ic(icon, "w-4 h-4 " + color)}${label}</div><p class="font-display text-xl sm:text-2xl ${color} truncate" data-count="${Math.round(v)}" data-fmt="money">0</p></div>`;

export const actions = {
  "biz:new": () => A.businessForm(),
  "biz:edit": (d) => A.businessForm(DB.data.businesses.find((b) => b.id === d.id)),
  "biz:del": (d) => A.deleteBusiness(d.id),
  "tx:edit": (d) => A.txForm(DB.data.transactions.find((t) => t.id === d.id)),
  "tx:del": (d) => A.removeItem("transactions", d.id, "este movimiento")
};
export const changes = {
  period: (v) => { st.period = v; A.changed(); },
  entity: (v) => { st.entity = v; A.changed(); },
  kind: (v) => { st.kind = v; A.changed(); }
};
export const inputs = { q: (v) => { st.q = v; A.changed(); } };
