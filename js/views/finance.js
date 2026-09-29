/* RACK 21 · Finanzas personales y de negocios
   Pestañas: Movimientos · Deudas · Ahorro y previsión · Préstamos entre cuentas */
import { DB } from "../store.js";
import { today, esc, money, shortDate, addDays, toISO, diffDays } from "../utils.js";
import { ic, sectionHead, empty } from "../ui.js";
import { txFilter, totals, entityName, byEntity, byCategory } from "../logic.js";
import * as A from "../actions.js";
import * as F from "../fin.js";

const st = { tab: "movimientos", period: "mes", entity: "all", kind: "all", q: "" };

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

const TABS = [
  ["movimientos", "Movimientos", "receipt"],
  ["deudas", "Deudas", "landmark"],
  ["ahorro", "Ahorro y previsión", "piggy-bank"],
  ["prestamos", "Préstamos entre cuentas", "arrow-left-right"]
];

export function render() {
  const nw = F.netWorth();
  const actions = {
    movimientos: `<button class="btn btn-ghost" data-action="biz:new">${ic("building-2", "w-4 h-4")}Negocio</button>
      <button class="btn btn-income" data-action="tx:new" data-kind="ingreso">${ic("trending-up", "w-4 h-4")}Ingreso</button>
      <button class="btn btn-expense" data-action="tx:new" data-kind="gasto">${ic("trending-down", "w-4 h-4")}Gasto</button>`,
    deudas: `<button class="btn btn-primary" data-action="debt:new">${ic("plus", "w-4 h-4")}Registrar deuda</button>`,
    ahorro: `<button class="btn btn-primary" data-action="fund:new">${ic("plus", "w-4 h-4")}Nuevo rubro</button>`,
    prestamos: `<button class="btn btn-primary" data-action="loan:new">${ic("plus", "w-4 h-4")}Nuevo préstamo</button>`
  }[st.tab];

  return `
  ${sectionHead("Finanzas y negocios", "Cuentas, deudas, ahorro y préstamos entre sus negocios, todo en un solo lugar.", actions)}

  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
    ${kpi("Saldo en cuentas", nw.cash, nw.cash >= 0 ? "text-white" : "text-rose-300", "wallet")}
    ${kpi("Ahorro y previsión", nw.saved, "text-emerald-300", "piggy-bank")}
    ${kpi("Deudas pendientes", nw.debt, "text-rose-300", "landmark")}
    ${kpi("Patrimonio neto", nw.net, nw.net >= 0 ? "text-cyan-300" : "text-rose-300", "gem")}
  </div>

  <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-5 reveal" role="tablist">
    ${TABS.map(([id, l, icon]) => `<button role="tab" aria-selected="${st.tab === id}" class="chip ${st.tab === id ? "chip-on" : ""}" data-action="ftab" data-id="${id}">${ic(icon, "w-4 h-4")}${l}${id === "deudas" && DB.data.debts.length ? `<span class="chip-n">${DB.data.debts.filter((d) => !F.debtStatus(d).done).length}</span>` : ""}</button>`).join("")}
  </div>

  ${{ movimientos: movimientos, deudas: deudas, ahorro: ahorro, prestamos: prestamos }[st.tab]()}`;
}

/* ----------------------------- Movimientos ----------------------------- */
function movimientos() {
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
  <div class="card !p-3 mb-5 reveal grid grid-cols-1 sm:flex sm:flex-wrap gap-3 sm:items-center">
    <label class="sr-only" for="fperiod">Periodo</label>
    <select id="fperiod" class="input sm:!w-auto" data-change="period">
      ${[["mes", "Este mes"], ["anterior", "Mes anterior"], ["90", "Últimos 90 días"], ["anio", "Este año"], ["todo", "Todo"]].map(([v, l]) => `<option value="${v}" ${st.period === v ? "selected" : ""}>${l}</option>`).join("")}
    </select>
    <label class="sr-only" for="fent">Cuenta</label>
    <select id="fent" class="input sm:!w-auto sm:max-w-[280px]" data-change="entity">
      <option value="all">Todas las cuentas</option>
      <option value="personal" ${st.entity === "personal" ? "selected" : ""}>Solo personal</option>
      <option value="negocios" ${st.entity === "negocios" ? "selected" : ""}>Solo negocios</option>
      ${DB.data.businesses.map((b) => `<option value="${b.id}" ${st.entity === b.id ? "selected" : ""}>${esc(b.name)}</option>`).join("")}
    </select>
    <button class="link sm:ml-auto justify-center" data-action="go" data-to="panel">${ic("chart-pie", "w-4 h-4")}Análisis en el Panel BI</button>
  </div>

  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
    ${kpi("Ingresos", tt.inc, "text-emerald-300", "trending-up")}
    ${kpi("Gastos", tt.exp, "text-orange-300", "trending-down")}
    ${kpi("Balance", tt.net, tt.net >= 0 ? "text-emerald-300" : "text-rose-300", "scale")}
    <div class="card reveal !p-4"><div class="flex items-center gap-2 text-slate-400 text-xs mb-2">${ic("percent", "w-4 h-4 text-cyan-300")}Margen</div>
      <p class="font-display text-xl sm:text-2xl text-white">${tt.inc ? Math.round(tt.margin) : 0}%</p>
      <p class="text-[11px] text-slate-500 mt-1 truncate">${topCat ? `Mayor gasto: ${esc(topCat.k)}` : "Sin gastos en el periodo"}</p></div>
  </div>

  <h2 class="card-title mb-3 reveal">${ic("wallet", "w-5 h-5 text-cyan-300")}Cuentas</h2>
  <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
    ${accountCard({ id: "personal", name: "Personal", kind: "Finanzas personales", color: "#94a3b8" }, ents, null)}
    ${DB.data.businesses.map((b) => accountCard({ id: b.id, name: b.name, kind: b.kind || "Negocio", color: b.color || "#22d3ee", biz: b }, ents, monthNet)).join("")}
    ${!DB.data.businesses.length ? `<div class="card reveal flex flex-col items-center justify-center text-center gap-3"><p class="text-slate-300 text-sm">Cree cada negocio para separar sus números de los personales.</p><button class="btn btn-primary" data-action="biz:new">${ic("plus", "w-4 h-4")}Crear negocio</button></div>` : ""}
  </div>

  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 reveal">
    <h2 class="card-title">${ic("receipt", "w-5 h-5 text-amber-300")}Movimientos <span class="text-slate-500 text-sm font-normal">(${list.length})</span></h2>
    <div class="grid grid-cols-[auto_1fr] sm:flex gap-2 min-w-0">
      <select class="input !w-auto !py-2 text-sm" data-change="kind" aria-label="Tipo">
        <option value="all">Todos</option><option value="ingreso" ${st.kind === "ingreso" ? "selected" : ""}>Ingresos</option><option value="gasto" ${st.kind === "gasto" ? "selected" : ""}>Gastos</option>
      </select>
      <input class="input !py-2 text-sm min-w-0 sm:!w-56" placeholder="Buscar…" value="${esc(st.q)}" data-input="q" aria-label="Buscar movimientos">
    </div>
  </div>
  ${list.length ? `<div class="card !p-0 overflow-hidden reveal"><ul class="divide-y divide-white/5">${list.slice(0, 200).map(txRow).join("")}</ul></div>`
    : empty("wallet", "Sin movimientos en este periodo", `Registre ingresos y gastos de ${r.label}. Consejo de hábito: ancle el registro a “cerrar caja” en cada negocio.`)}`;
}

function accountCard(a, ents, monthNet) {
  const e = ents.find((x) => x.id === a.id) || { inc: 0, exp: 0, net: 0 };
  const bal = F.accountBalance(a.id);
  const goal = Number(a.biz?.monthlyGoal || 0), mn = monthNet ? monthNet(a.id) : 0;
  return `<article class="card reveal biz-card" style="--biz:${a.color}">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0"><h3 class="text-white font-semibold text-lg truncate">${esc(a.name)}</h3><p class="text-xs text-slate-400 truncate">${esc(a.kind)}</p></div>
      ${a.biz ? `<div class="flex gap-1 shrink-0">
        <button class="icon-btn" data-action="biz:edit" data-id="${a.id}" aria-label="Editar">${ic("pencil", "w-4 h-4")}</button>
        <button class="icon-btn hover:!text-rose-300" data-action="biz:del" data-id="${a.id}" aria-label="Eliminar">${ic("trash-2", "w-4 h-4")}</button></div>` : ""}
    </div>
    <div class="mt-3 flex items-baseline justify-between gap-2"><span class="text-[11px] uppercase tracking-wider text-slate-500">Saldo disponible</span><span class="font-mono text-lg ${bal >= 0 ? "text-white" : "text-rose-300"}">${money(bal)}</span></div>
    <div class="grid grid-cols-3 gap-2 mt-3 text-center">
      <div class="mini !p-2"><span class="mini-l">Ingresos</span><span class="mini-v text-emerald-300 text-sm">${money(e.inc, true)}</span></div>
      <div class="mini !p-2"><span class="mini-l">Gastos</span><span class="mini-v text-orange-300 text-sm">${money(e.exp, true)}</span></div>
      <div class="mini !p-2"><span class="mini-l">Utilidad</span><span class="mini-v ${e.net >= 0 ? "text-white" : "text-rose-300"} text-sm">${money(e.net, true)}</span></div>
    </div>
    ${goal ? `<div class="mt-4"><div class="flex justify-between text-[11px] text-slate-400 mb-1"><span>Meta mensual de utilidad</span><span>${money(mn, true)} / ${money(goal, true)}</span></div><div class="bar"><span style="--w:${Math.max(0, Math.min(100, (mn / goal) * 100))}%"></span></div></div>` : ""}
    <div class="flex gap-2 mt-4">
      <button class="btn btn-sm btn-income flex-1" data-action="tx:new" data-kind="ingreso" data-entity="${a.id}">${ic("plus", "w-3.5 h-3.5")}Ingreso</button>
      <button class="btn btn-sm btn-expense flex-1" data-action="tx:new" data-kind="gasto" data-entity="${a.id}">${ic("minus", "w-3.5 h-3.5")}Gasto</button>
    </div>
  </article>`;
}

function txRow(t) {
  const b = DB.data.businesses.find((x) => x.id === t.entity);
  return `<li class="tx-row">
    <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl grid place-items-center shrink-0 ${t.kind === "ingreso" ? "bg-emerald-400/10 text-emerald-300" : "bg-orange-400/10 text-orange-300"}">${ic(t.kind === "ingreso" ? "arrow-down-left" : "arrow-up-right", "w-5 h-5")}</div>
    <div class="flex-1 min-w-0">
      <div class="flex items-baseline justify-between gap-2">
        <p class="text-white text-sm truncate">${esc(t.note || t.category)}</p>
        <p class="font-mono text-sm whitespace-nowrap ${t.kind === "ingreso" ? "text-emerald-300" : "text-orange-300"}">${t.kind === "ingreso" ? "+" : "−"}${money(t.amount)}</p>
      </div>
      <p class="text-[11px] text-slate-500 truncate"><span class="inline-block w-2 h-2 rounded-full mr-1" style="background:${b?.color || "#94a3b8"}"></span>${esc(entityName(t.entity))} · ${esc(t.category)} · ${shortDate(t.date)}${t.method ? ` · ${esc(t.method)}` : ""}</p>
    </div>
    <div class="flex shrink-0 -mr-1">
      <button class="icon-btn !w-8" data-action="tx:edit" data-id="${t.id}" aria-label="Editar">${ic("pencil", "w-4 h-4")}</button>
      <button class="icon-btn !w-8 hover:!text-rose-300" data-action="tx:del" data-id="${t.id}" aria-label="Eliminar">${ic("trash-2", "w-4 h-4")}</button>
    </div>
  </li>`;
}

/* ------------------------------- Deudas -------------------------------- */
function deudas() {
  const list = DB.data.debts.map((d) => ({ d, s: F.debtStatus(d) })).sort((a, b) => a.s.done - b.s.done || (a.s.next?.date || "9").localeCompare(b.s.next?.date || "9"));
  if (!list.length) return empty("landmark", "Sin deudas registradas", "Registre cada crédito o préstamo con su capital, tasa de interés y plazo. RACK 21 le proyecta las cuotas, los intereses totales y la fecha en que quedará libre.",
    `<button class="btn btn-primary" data-action="debt:new">${ic("plus", "w-4 h-4")}Registrar deuda</button>`);
  const act = list.filter((x) => !x.s.done);
  const monthly = act.reduce((a, x) => a + (x.s.next?.cuota || 0), 0);
  const interestLeft = act.reduce((a, x) => a + x.s.sc.rows.slice((x.d.payments || []).length).reduce((b, r) => b + r.interest, 0), 0);
  return `
  <div class="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-5">
    ${kpi("Cuotas del próximo mes", monthly, "text-white", "calendar-clock")}
    ${kpi("Intereses por pagar", interestLeft, "text-orange-300", "percent")}
    <div class="card reveal !p-4 col-span-2 lg:col-span-1"><div class="flex items-center gap-2 text-slate-400 text-xs mb-2">${ic("lightbulb", "w-4 h-4 text-amber-300")}Consejo del coach</div>
      <p class="text-xs text-slate-300 leading-relaxed">${act.length > 1 ? "Método avalancha: abone extra a la deuda con la tasa más alta; ahorrará más intereses." : "Cada abono extra a capital reduce los intereses futuros. ¿Puede sumar un poco este mes?"}</p></div>
  </div>
  <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">${list.map(({ d, s }) => {
    const days = s.next ? diffDays(s.next.date, today()) : null;
    return `<article class="card reveal debt-card ${s.done ? "opacity-70" : s.late ? "!border-rose-400/40" : ""}">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0"><h3 class="text-white font-semibold truncate">${esc(d.name)}</h3>
          <p class="text-xs text-slate-400 truncate">${esc(d.creditor || "Acreedor sin nombre")} · ${esc(entityName(d.entity))}</p></div>
        <span class="badge ${s.done ? "badge-done" : s.late ? "badge-late" : "badge-soon"}">${s.done ? "Pagada" : s.late ? "Cuota vencida" : `${d.rate}% ${d.ratePeriod === "anual" ? "E.A." : "mes"}`}</span>
      </div>
      <div class="mt-4 flex items-baseline justify-between"><span class="text-[11px] uppercase tracking-wider text-slate-500">Saldo de capital</span><span class="font-mono text-lg text-rose-300">${money(s.balance)}</span></div>
      <div class="mt-2"><div class="flex justify-between text-[11px] text-slate-400 mb-1"><span>Pagado ${Math.round(s.progress)} %</span><span>de ${money(d.principal, true)}</span></div><div class="bar"><span style="--w:${s.progress}%"></span></div></div>
      <div class="grid grid-cols-2 gap-2 mt-4">
        <div class="mini !p-2"><span class="mini-l">Cuota</span><span class="mini-v text-white text-sm">${money(s.sc.cuota)}</span></div>
        <div class="mini !p-2"><span class="mini-l">Próximo pago</span><span class="mini-v text-sm ${s.late ? "text-rose-300" : "text-white"}">${s.next && !s.done ? `${shortDate(s.next.date)}${days !== null && days >= 0 ? ` · ${days} d` : ""}` : "—"}</span></div>
      </div>
      <p class="text-[11px] text-slate-500 mt-3">${(d.payments || []).length}/${d.months} cuotas · ${d.method === "frances" ? "cuota fija" : "interés sobre capital bruto"} · termina ${s.sc.end ? shortDate(s.sc.end) : "—"}</p>
      <div class="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
        ${!s.done ? `<button class="btn btn-sm btn-primary flex-1" data-action="debt:pay" data-id="${d.id}">${ic("hand-coins", "w-3.5 h-3.5")}Registrar pago</button>` : ""}
        <button class="btn btn-sm btn-ghost flex-1" data-action="debt:view" data-id="${d.id}">${ic("table", "w-3.5 h-3.5")}Proyección</button>
        <button class="icon-btn" data-action="debt:edit" data-id="${d.id}" aria-label="Editar">${ic("pencil", "w-4 h-4")}</button>
        <button class="icon-btn hover:!text-rose-300" data-action="debt:del" data-id="${d.id}" aria-label="Eliminar">${ic("trash-2", "w-4 h-4")}</button>
      </div>
    </article>`;
  }).join("")}</div>`;
}

/* -------------------------- Ahorro y previsión ------------------------- */
function ahorro() {
  if (!DB.data.funds.length) return empty("piggy-bank", "Cree sus rubros de ahorro y previsión",
    "Separe dinero para lo importante: fondo de emergencias, primas, impuestos, vacaciones o una compra. Cada rubro tiene su meta, y usted aporta o retira desde cualquiera de sus cuentas.",
    `<button class="btn btn-primary" data-action="fund:new">${ic("plus", "w-4 h-4")}Crear rubro</button>`);
  return `<div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">${DB.data.funds.map((f) => {
    const bal = F.fundBalance(f), k = F.fundKind(f.kind);
    const p = f.goal ? Math.min(100, (bal / f.goal) * 100) : null;
    const left = f.targetDate ? diffDays(f.targetDate, today()) : null;
    const need = f.goal && left > 0 ? Math.max(0, (f.goal - bal) / Math.max(1, left / 30)) : null;
    return `<article class="card reveal biz-card" style="--biz:${f.color || "#34d399"}">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl grid place-items-center shrink-0" style="background:color-mix(in srgb, ${f.color || "#34d399"} 18%, transparent);color:${f.color || "#34d399"}">${ic(k.icon, "w-5 h-5")}</div>
        <div class="flex-1 min-w-0"><h3 class="text-white font-semibold truncate">${esc(f.name)}</h3><p class="text-xs text-slate-400">${k.l}</p></div>
        <div class="flex gap-1 shrink-0">
          <button class="icon-btn" data-action="fund:edit" data-id="${f.id}" aria-label="Editar">${ic("pencil", "w-4 h-4")}</button>
          <button class="icon-btn hover:!text-rose-300" data-action="fund:del" data-id="${f.id}" aria-label="Eliminar">${ic("trash-2", "w-4 h-4")}</button></div>
      </div>
      <p class="font-display text-2xl text-white mt-4">${money(bal)}</p>
      ${p !== null ? `<div class="mt-2"><div class="flex justify-between text-[11px] text-slate-400 mb-1"><span>${Math.round(p)} % de la meta</span><span>${money(f.goal, true)}</span></div><div class="bar"><span style="--w:${p}%"></span></div></div>` : `<p class="text-[11px] text-slate-500 mt-1">Sin meta definida</p>`}
      <p class="text-[11px] text-slate-400 mt-3">${f.targetDate ? `Objetivo: ${shortDate(f.targetDate)}${need ? ` · aporte ${money(need, true)}/mes para llegar` : ""}` : f.monthly ? `Aporte sugerido: ${money(f.monthly)}/mes` : ""}</p>
      <div class="flex gap-2 mt-4 pt-3 border-t border-white/5">
        <button class="btn btn-sm btn-income flex-1" data-action="fund:in" data-id="${f.id}">${ic("plus", "w-3.5 h-3.5")}Aportar</button>
        <button class="btn btn-sm btn-expense flex-1" data-action="fund:out" data-id="${f.id}">${ic("minus", "w-3.5 h-3.5")}Retirar</button>
        <button class="icon-btn" data-action="fund:view" data-id="${f.id}" aria-label="Ver movimientos">${ic("history", "w-4 h-4")}</button>
      </div>
    </article>`;
  }).join("")}</div>`;
}

/* ------------------------ Préstamos entre cuentas ---------------------- */
function prestamos() {
  const accs = F.accounts();
  const bal = `<div class="card reveal mb-5"><h3 class="card-title text-base mb-3">${ic("wallet", "w-4 h-4 text-cyan-300")}Saldo disponible por cuenta</h3>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">${accs.map((a) => { const b = F.accountBalance(a.id); return `<div class="mini"><span class="mini-l truncate flex items-center gap-1"><i class="inline-block w-2 h-2 rounded-full" style="background:${a.color}"></i>${esc(a.name)}</span><span class="mini-v text-sm ${b >= 0 ? "text-white" : "text-rose-300"}">${money(b, true)}</span></div>`; }).join("")}</div></div>`;
  if (!DB.data.loans.length) return bal + empty("arrow-left-right", "Sin préstamos entre cuentas",
    accs.length < 2 ? "Primero cree al menos un negocio en la pestaña Movimientos. Luego podrá prestar dinero entre sus cuentas y llevar el control de los abonos." : "¿Un negocio le prestó a otro, o usted sacó de un negocio para algo personal? Regístrelo como préstamo y lleve el control de los abonos hasta saldarlo.",
    accs.length >= 2 ? `<button class="btn btn-primary" data-action="loan:new">${ic("plus", "w-4 h-4")}Registrar préstamo</button>` : "");
  const list = DB.data.loans.map((l) => ({ l, s: F.loanStatus(l) })).sort((a, b) => a.s.done - b.s.done || b.l.date.localeCompare(a.l.date));
  return bal + `<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">${list.map(({ l, s }) => `
    <article class="card reveal ${s.done ? "opacity-70" : s.late ? "!border-rose-400/40" : ""}">
      <div class="flex items-center gap-2 text-sm">
        <span class="px-2 py-1 rounded-lg bg-white/5 text-white truncate max-w-[40%]">${esc(entityName(l.from))}</span>
        ${ic("arrow-right", "w-4 h-4 text-cyan-300 shrink-0")}
        <span class="px-2 py-1 rounded-lg bg-white/5 text-white truncate max-w-[40%]">${esc(entityName(l.to))}</span>
        <span class="ml-auto badge ${s.done ? "badge-done" : s.late ? "badge-late" : "badge-later"}">${s.done ? "Pagado" : s.late ? "Vencido" : "Pendiente"}</span>
      </div>
      ${l.note ? `<p class="text-xs text-slate-400 mt-2 truncate">${esc(l.note)}</p>` : ""}
      <div class="mt-4 flex items-baseline justify-between"><span class="text-[11px] uppercase tracking-wider text-slate-500">Pendiente</span><span class="font-mono text-lg ${s.done ? "text-emerald-300" : "text-white"}">${money(s.balance)}</span></div>
      <div class="mt-2"><div class="flex justify-between text-[11px] text-slate-400 mb-1"><span>Abonado ${Math.round(s.progress)} %</span><span>de ${money(l.amount, true)}</span></div><div class="bar"><span style="--w:${s.progress}%"></span></div></div>
      <p class="text-[11px] text-slate-500 mt-3">Prestado el ${shortDate(l.date)}${l.dueDate ? ` · pagar antes del ${shortDate(l.dueDate)}` : ""}</p>
      <div class="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
        ${!s.done ? `<button class="btn btn-sm btn-primary flex-1" data-action="loan:pay" data-id="${l.id}">${ic("hand-coins", "w-3.5 h-3.5")}Abonar</button>` : ""}
        <button class="btn btn-sm btn-ghost flex-1" data-action="loan:view" data-id="${l.id}">${ic("history", "w-3.5 h-3.5")}Abonos</button>
        <button class="icon-btn" data-action="loan:edit" data-id="${l.id}" aria-label="Editar">${ic("pencil", "w-4 h-4")}</button>
        <button class="icon-btn hover:!text-rose-300" data-action="loan:del" data-id="${l.id}" aria-label="Eliminar">${ic("trash-2", "w-4 h-4")}</button>
      </div>
    </article>`).join("")}</div>`;
}

const kpi = (label, v, color, icon) => `<div class="card reveal !p-4 min-w-0"><div class="flex items-center gap-2 text-slate-400 text-xs mb-2">${ic(icon, "w-4 h-4 shrink-0 " + color)}<span class="truncate">${label}</span></div><p class="font-display text-lg sm:text-2xl ${color} truncate" data-count="${Math.round(v)}" data-fmt="money">0</p></div>`;

const find = (col, id) => DB.data[col].find((x) => x.id === id);
export const actions = {
  ftab: (d) => { st.tab = d.id; A.changed(); },
  "biz:new": () => A.businessForm(),
  "biz:edit": (d) => A.businessForm(find("businesses", d.id)),
  "biz:del": (d) => A.deleteBusiness(d.id),
  "tx:edit": (d) => A.txForm(find("transactions", d.id)),
  "tx:del": (d) => A.removeItem("transactions", d.id, "este movimiento"),
  "debt:new": () => F.debtForm(),
  "debt:edit": (d) => F.debtForm(find("debts", d.id)),
  "debt:del": (d) => F.deleteDebt(d.id),
  "debt:pay": (d) => F.debtPayForm(find("debts", d.id)),
  "debt:view": (d) => F.debtDetail(find("debts", d.id)),
  "debt:paydel": (d) => F.deleteDebtPayment(d.id, d.pay),
  "fund:new": () => F.fundForm(),
  "fund:edit": (d) => F.fundForm(find("funds", d.id)),
  "fund:del": (d) => F.deleteFund(d.id),
  "fund:in": (d) => F.fundMoveForm(find("funds", d.id), "aporte"),
  "fund:out": (d) => F.fundMoveForm(find("funds", d.id), "retiro"),
  "fund:view": (d) => F.fundDetail(find("funds", d.id)),
  "loan:new": () => F.loanForm(),
  "loan:edit": (d) => F.loanForm(find("loans", d.id)),
  "loan:del": (d) => F.deleteLoan(d.id),
  "loan:pay": (d) => F.loanPayForm(find("loans", d.id)),
  "loan:view": (d) => F.loanDetail(find("loans", d.id)),
  "move:del": (d) => F.deleteMove(d.id)
};
export const changes = {
  period: (v) => { st.period = v; A.changed(); },
  entity: (v) => { st.entity = v; A.changed(); },
  kind: (v) => { st.kind = v; A.changed(); }
};
export const inputs = { q: (v) => { st.q = v; A.changed(); } };
