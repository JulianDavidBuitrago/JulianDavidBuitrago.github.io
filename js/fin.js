/* =====================================================================
   RACK 21 · Finanzas avanzadas
   - Deudas con interés (simple sobre capital o cuota fija) y proyección
   - Rubros de ahorro / previsión dinámicos (aportes y retiros)
   - Préstamos internos entre cuentas (Personal y negocios) con abonos
   Colecciones: debts, funds, loans, transfers
     transfers: { date, from, to, amount, kind, refId, note }
       from/to: "personal" | idNegocio | "fund:<id>"
       kind: "aporte" | "retiro" | "prestamo" | "abono"
   ===================================================================== */
import { DB } from "./store.js";
import { today, esc, money, shortDate, parseISO, toISO, sum, uid } from "./utils.js";
import { formModal, modal, closeModal, confirmDialog, toast, ic, confetti } from "./ui.js";
import { totals, entityName } from "./logic.js";
import { changed } from "./actions.js";

/* ------------------------------ Cuentas ------------------------------- */
export const accounts = () => [{ id: "personal", name: "Personal", color: "#94a3b8" }, ...DB.data.businesses.map((b) => ({ id: b.id, name: b.name, color: b.color || "#22d3ee" }))];
const accOpts = () => accounts().map((a) => ({ v: a.id, l: a.name }));
export const accountName = (id) => (String(id).startsWith("fund:") ? `Rubro: ${DB.data.funds.find((f) => `fund:${f.id}` === id)?.name || "eliminado"}` : entityName(id));

/* Saldo disponible por cuenta = ingresos − gastos + entradas internas − salidas internas */
export function accountBalance(id) {
  const t = totals(DB.data.transactions.filter((x) => (x.entity || "personal") === id));
  const tin = sum(DB.data.transfers.filter((x) => x.to === id), (x) => x.amount);
  const tout = sum(DB.data.transfers.filter((x) => x.from === id), (x) => x.amount);
  return t.net + tin - tout;
}

/* ------------------------------- Fondos ------------------------------- */
export const FUND_KINDS = [
  { v: "ahorro", l: "Ahorro", icon: "piggy-bank" },
  { v: "prevision", l: "Previsión / emergencias", icon: "shield-check" },
  { v: "inversion", l: "Inversión", icon: "trending-up" },
  { v: "meta", l: "Meta de compra", icon: "target" },
  { v: "impuestos", l: "Impuestos / obligaciones", icon: "landmark" }
];
export const fundKind = (v) => FUND_KINDS.find((k) => k.v === v) || FUND_KINDS[0];
export const fundBalance = (f) => sum(DB.data.transfers.filter((x) => x.to === `fund:${f.id}`), (x) => x.amount) - sum(DB.data.transfers.filter((x) => x.from === `fund:${f.id}`), (x) => x.amount);
export const fundMoves = (f) => DB.data.transfers.filter((x) => x.to === `fund:${f.id}` || x.from === `fund:${f.id}`).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));

const FUND_COLORS = ["#34d399", "#22d3ee", "#f5c518", "#a78bfa", "#f07c1b", "#ec4899", "#2f6fdf", "#94a3b8"];

export function fundForm(f = null) {
  formModal({
    title: f ? "Editar rubro" : "Nuevo rubro de ahorro o previsión",
    values: f || { kind: "ahorro", color: FUND_COLORS[0] },
    fields: [
      { name: "name", label: "Nombre del rubro", required: true, placeholder: "Ej.: Fondo de emergencia, Vacaciones, Prima de diciembre" },
      { name: "kind", label: "Tipo", type: "select", options: FUND_KINDS.map((k) => ({ v: k.v, l: k.l })), col: "half" },
      { name: "goal", label: "Meta (opcional)", type: "money", col: "half" },
      { name: "targetDate", label: "Fecha objetivo (opcional)", type: "date", col: "half" },
      { name: "monthly", label: "Aporte mensual sugerido", type: "money", col: "half" },
      { name: "color", label: "Color", type: "color", options: FUND_COLORS },
      { name: "note", label: "Notas", type: "textarea", rows: 2 }
    ],
    onSubmit: async (v) => {
      if (f) await DB.update("funds", f.id, v); else await DB.add("funds", v);
      toast(f ? "Rubro actualizado" : "Rubro creado. ¡Pague primero a su yo del futuro!");
      changed();
    }
  });
}

export function fundMoveForm(f, kind = "aporte") {
  const bal = fundBalance(f);
  formModal({
    title: kind === "aporte" ? `Aportar a “${f.name}”` : `Retirar de “${f.name}”`,
    intro: `<p class="text-sm text-slate-400 mb-4">Saldo actual del rubro: <strong class="text-white">${money(bal)}</strong>. ${kind === "aporte" ? "El dinero sale de la cuenta que elija." : "El dinero vuelve a la cuenta que elija."}</p>`,
    values: { date: today(), account: "personal" },
    fields: [
      { name: "amount", label: "Valor", type: "money", required: true, col: "half" },
      { name: "date", label: "Fecha", type: "date", required: true, col: "half" },
      { name: "account", label: kind === "aporte" ? "Sale de la cuenta" : "Entra a la cuenta", type: "select", options: accOpts() },
      { name: "note", label: "Nota", placeholder: "Opcional" }
    ],
    onSubmit: async (v) => {
      if (kind === "retiro" && v.amount > bal) throw new Error(`El retiro supera el saldo del rubro (${money(bal)})`);
      const fund = `fund:${f.id}`;
      await DB.add("transfers", { kind, date: v.date, amount: v.amount, note: v.note, refId: f.id, from: kind === "aporte" ? v.account : fund, to: kind === "aporte" ? fund : v.account });
      const nb = fundBalance(f);
      if (kind === "aporte" && f.goal && nb >= f.goal && bal < f.goal) { confetti(); toast(`¡Meta de “${f.name}” alcanzada!`); }
      else toast(kind === "aporte" ? "Aporte registrado. Así se construye tranquilidad." : "Retiro registrado");
      changed();
    }
  });
}

export function fundDetail(f) {
  const moves = fundMoves(f);
  modal({
    title: f.name, size: "max-w-2xl",
    body: `<div class="grid grid-cols-2 gap-3 mb-4">
        <div class="mini"><span class="mini-l">Saldo</span><span class="mini-v text-emerald-300">${money(fundBalance(f))}</span></div>
        <div class="mini"><span class="mini-l">Meta</span><span class="mini-v text-white">${f.goal ? money(f.goal) : "—"}</span></div></div>
      ${moves.length ? `<ul class="divide-y divide-white/5 rounded-xl border border-white/10">${moves.map((m) => {
        const inn = m.to === `fund:${f.id}`;
        return `<li class="flex items-center gap-3 px-3 py-2.5 text-sm">
          <span class="${inn ? "text-emerald-300" : "text-orange-300"}">${ic(inn ? "arrow-down-left" : "arrow-up-right", "w-4 h-4")}</span>
          <div class="flex-1 min-w-0"><p class="text-white">${inn ? "Aporte" : "Retiro"} · ${esc(accountName(inn ? m.from : m.to))}</p><p class="text-[11px] text-slate-500 truncate">${shortDate(m.date)}${m.note ? ` · ${esc(m.note)}` : ""}</p></div>
          <span class="font-mono ${inn ? "text-emerald-300" : "text-orange-300"}">${inn ? "+" : "−"}${money(m.amount)}</span>
          <button class="icon-btn ro-hide" data-action="move:del" data-id="${m.id}" aria-label="Eliminar movimiento">${ic("trash-2", "w-4 h-4")}</button></li>`;
      }).join("")}</ul>` : `<p class="text-sm text-slate-400">Aún no hay aportes en este rubro.</p>`}`
  });
}

/* ------------------------------- Deudas ------------------------------- */
export const monthlyRate = (d) => {
  const r = Number(d.rate || 0) / 100;
  return d.ratePeriod === "anual" ? Math.pow(1 + r, 1 / 12) - 1 : r;
};
const addMonths = (iso, n) => { const x = parseISO(iso); const day = x.getDate(); x.setMonth(x.getMonth() + n); if (x.getDate() < day) x.setDate(0); return toISO(x); };

/* Tabla de amortización proyectada desde el inicio */
export function schedule(d) {
  const P = Number(d.principal || 0), n = Math.max(1, Number(d.months || 1)), r = monthlyRate(d);
  const rows = []; let bal = P;
  const cuotaFija = d.method === "frances" ? (r ? (P * r) / (1 - Math.pow(1 + r, -n)) : P / n) : P / n + P * r;
  for (let i = 1; i <= n; i++) {
    const interest = d.method === "frances" ? bal * r : P * r;
    let capital = d.method === "frances" ? cuotaFija - interest : P / n;
    if (i === n) capital = bal;
    bal = Math.max(0, bal - capital);
    rows.push({ n: i, date: addMonths(d.startDate || today(), i), cuota: capital + interest, interest, capital, balance: bal });
  }
  return { rows, cuota: cuotaFija, totalInterest: sum(rows, (x) => x.interest), total: sum(rows, (x) => x.cuota), end: rows[rows.length - 1]?.date };
}

export function debtStatus(d) {
  const paidCap = sum(d.payments || [], (p) => p.capital);
  const paidInt = sum(d.payments || [], (p) => p.interest);
  const balance = Math.max(0, Number(d.principal || 0) - paidCap);
  const sc = schedule(d);
  const next = sc.rows[(d.payments || []).length] || null;
  const late = next && next.date < today() && balance > 0;
  return { paidCap, paidInt, balance, progress: d.principal ? (paidCap / d.principal) * 100 : 0, next, late, sc, done: balance <= 0.5 };
}

export function debtForm(d = null) {
  const m = formModal({
    title: d ? "Editar deuda" : "Registrar deuda",
    size: "max-w-2xl",
    intro: `<div id="debtPreview" class="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 mb-5 text-sm"></div>`,
    values: d || { entity: "personal", ratePeriod: "mensual", method: "simple", startDate: today(), months: 12 },
    fields: [
      { name: "name", label: "Nombre de la deuda", required: true, placeholder: "Ej.: Préstamo moto, Crédito banco, Préstamo a Don Jorge" },
      { name: "creditor", label: "Acreedor (a quién le debe)", placeholder: "Banco, persona, cooperativa…", col: "half" },
      { name: "entity", label: "¿De qué cuenta es la deuda?", type: "select", options: accOpts(), col: "half" },
      { name: "principal", label: "Capital prestado (bruto)", type: "money", required: true, col: "half" },
      { name: "months", label: "Plazo (meses)", type: "number", min: 1, required: true, col: "half" },
      { name: "rate", label: "Tasa de interés (%)", type: "number", min: 0, step: "any", required: true, col: "half" },
      { name: "ratePeriod", label: "La tasa es…", type: "select", options: [{ v: "mensual", l: "Mensual (ej.: 2 % mes)" }, { v: "anual", l: "Efectiva anual (E.A.)" }], col: "half" },
      { name: "method", label: "Cómo se cobra el interés", type: "select", options: [{ v: "simple", l: "Sobre el capital bruto (interés fijo cada mes)" }, { v: "frances", l: "Sobre el saldo (cuota fija, sistema bancario)" }] },
      { name: "startDate", label: "Fecha del desembolso", type: "date", required: true, col: "half" },
      { name: "note", label: "Notas", placeholder: "Opcional", col: "half" }
    ],
    onSubmit: async (v) => {
      v.months = Math.round(v.months);
      if (d) await DB.update("debts", d.id, v); else await DB.add("debts", { ...v, payments: [] });
      toast(d ? "Deuda actualizada" : "Deuda registrada. Conocerla es el primer paso para saldarla.");
      changed();
    }
  });
  const f = m.querySelector("form");
  const read = () => ({
    principal: Number((f.principal.value || "").replace(/\D/g, "")), months: Number(f.months.value), rate: Number(f.rate.value),
    ratePeriod: f.ratePeriod.value, method: f.method.value, startDate: f.startDate.value || today()
  });
  const paint = () => {
    const x = read(); const box = m.querySelector("#debtPreview");
    if (!x.principal || !x.months) { box.innerHTML = `<p class="text-slate-400">Complete capital, plazo y tasa para ver la proyección de pagos.</p>`; return; }
    const s = schedule(x);
    box.innerHTML = `<p class="text-[11px] uppercase tracking-widest text-cyan-300 mb-2">Proyección</p>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div><p class="text-[11px] text-slate-400">${x.method === "frances" ? "Cuota fija" : "Cuota mensual"}</p><p class="font-mono text-white">${money(s.cuota)}</p></div>
        <div><p class="text-[11px] text-slate-400">Intereses totales</p><p class="font-mono text-orange-300">${money(s.totalInterest)}</p></div>
        <div><p class="text-[11px] text-slate-400">Total a pagar</p><p class="font-mono text-white">${money(s.total)}</p></div>
        <div><p class="text-[11px] text-slate-400">Termina</p><p class="font-mono text-white">${s.end ? shortDate(s.end) : "—"}</p></div>
      </div>
      <p class="text-[11px] text-slate-500 mt-2">Tasa mensual equivalente: ${(monthlyRate(x) * 100).toFixed(2)} %</p>`;
  };
  f.addEventListener("input", paint); f.addEventListener("change", paint); paint();
}

export function debtPayForm(d) {
  const s = debtStatus(d);
  const r = monthlyRate(d);
  const interest = Math.round(d.method === "frances" ? s.balance * r : Number(d.principal) * r);
  const suggested = Math.round(Math.min(s.next ? s.next.cuota : s.balance + interest, s.balance + interest));
  const m = formModal({
    title: `Pago · ${d.name}`,
    intro: `<p class="text-sm text-slate-400 mb-4">Saldo de capital: <strong class="text-white">${money(s.balance)}</strong>${s.next ? ` · Cuota ${s.next.n} programada para el ${shortDate(s.next.date)}` : ""}.</p>`,
    values: { date: today(), amount: suggested, interest, expense: true },
    fields: [
      { name: "amount", label: "Valor pagado", type: "money", required: true, col: "half" },
      { name: "date", label: "Fecha", type: "date", required: true, col: "half" },
      { name: "interest", label: "De ese valor, intereses", type: "money", col: "half", hint: "Se calcula solo; ajústelo si el acreedor liquidó distinto." },
      { name: "note", label: "Nota", placeholder: "Opcional", col: "half" },
      { name: "expense", type: "checkbox", text: `Registrar también como gasto de “${entityName(d.entity)}” (categoría Deudas)` }
    ],
    onSubmit: async (v) => {
      const intr = Math.min(v.interest || 0, v.amount);
      const capital = Math.min(v.amount - intr, s.balance);
      const p = { id: uid(), date: v.date, amount: v.amount, interest: intr, capital, note: v.note };
      if (v.expense) {
        const tx = await DB.add("transactions", { kind: "gasto", amount: v.amount, entity: d.entity || "personal", category: "Deudas", date: v.date, note: `Pago ${d.name}`, method: "Transferencia", debtId: d.id });
        p.txId = tx.id;
      }
      await DB.update("debts", d.id, { payments: [...(d.payments || []), p] });
      const ns = debtStatus(DB.data.debts.find((x) => x.id === d.id));
      if (ns.done) { confetti(); toast(`¡Deuda “${d.name}” saldada! Un peso menos en la espalda.`); }
      else toast(`Pago registrado. Abono a capital: ${money(capital)}`);
      changed();
    }
  });
  return m;
}

export function debtDetail(d) {
  const s = debtStatus(d);
  const paidN = (d.payments || []).length;
  modal({
    title: d.name, size: "max-w-3xl",
    body: `<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div class="mini"><span class="mini-l">Saldo capital</span><span class="mini-v text-rose-300">${money(s.balance)}</span></div>
        <div class="mini"><span class="mini-l">Cuota</span><span class="mini-v text-white">${money(s.sc.cuota)}</span></div>
        <div class="mini"><span class="mini-l">Intereses pagados</span><span class="mini-v text-orange-300">${money(s.paidInt)}</span></div>
        <div class="mini"><span class="mini-l">Intereses proyectados</span><span class="mini-v text-white">${money(s.sc.totalInterest)}</span></div>
      </div>
      <p class="text-xs text-slate-400 mb-3">${d.method === "frances" ? "Cuota fija: el interés se calcula sobre el saldo pendiente." : "Interés fijo sobre el capital bruto cada mes."} Tasa ${d.rate}% ${d.ratePeriod === "anual" ? "E.A." : "mensual"} · ${d.months} meses · Acreedor: ${esc(d.creditor || "—")}</p>
      <h4 class="text-sm font-semibold text-white mb-2">Proyección de pagos</h4>
      <div class="overflow-x-auto rounded-xl border border-white/10 mb-5"><table class="data-table min-w-[520px]">
        <thead><tr><th>#</th><th>Fecha</th><th>Cuota</th><th>Interés</th><th>Capital</th><th>Saldo</th></tr></thead>
        <tbody>${s.sc.rows.map((r) => `<tr class="${r.n <= paidN ? "opacity-50" : r.n === paidN + 1 ? "bg-cyan-400/10" : ""}"><td>${r.n <= paidN ? "✓" : r.n}</td><td>${shortDate(r.date)}</td><td>${money(r.cuota)}</td><td>${money(r.interest)}</td><td>${money(r.capital)}</td><td>${money(r.balance)}</td></tr>`).join("")}</tbody>
      </table></div>
      <h4 class="text-sm font-semibold text-white mb-2">Pagos realizados (${paidN})</h4>
      ${paidN ? `<ul class="divide-y divide-white/5 rounded-xl border border-white/10">${d.payments.slice().reverse().map((p) => `<li class="flex items-center gap-3 px-3 py-2.5 text-sm">
        <div class="flex-1 min-w-0"><p class="text-white">${shortDate(p.date)} · <span class="font-mono">${money(p.amount)}</span></p><p class="text-[11px] text-slate-500">Capital ${money(p.capital)} · Interés ${money(p.interest)}${p.note ? ` · ${esc(p.note)}` : ""}</p></div>
        <button class="icon-btn ro-hide" data-action="debt:paydel" data-id="${d.id}" data-pay="${p.id}" aria-label="Eliminar pago">${ic("trash-2", "w-4 h-4")}</button></li>`).join("")}</ul>` : `<p class="text-sm text-slate-400">Aún no hay pagos registrados.</p>`}`
  });
}

export async function deleteDebtPayment(debtId, payId) {
  const d = DB.data.debts.find((x) => x.id === debtId);
  const p = d?.payments?.find((x) => x.id === payId);
  if (!p || !(await confirmDialog("¿Eliminar este pago? También se eliminará el gasto asociado, si existe."))) return;
  if (p.txId && DB.data.transactions.some((t) => t.id === p.txId)) await DB.remove("transactions", p.txId);
  await DB.update("debts", debtId, { payments: d.payments.filter((x) => x.id !== payId) });
  toast("Pago eliminado", "info"); changed();
}

export async function deleteDebt(id) {
  const d = DB.data.debts.find((x) => x.id === id);
  if (!(await confirmDialog(`¿Eliminar la deuda “${d.name}”? Los gastos ya registrados en Finanzas se conservan.`))) return;
  await DB.remove("debts", id); toast("Deuda eliminada", "info"); changed();
}

/* --------------------------- Préstamos internos ------------------------ */
export function loanStatus(l) {
  const paid = sum(DB.data.transfers.filter((x) => x.kind === "abono" && x.refId === l.id), (x) => x.amount);
  const balance = Math.max(0, Number(l.amount || 0) - paid);
  return { paid, balance, progress: l.amount ? (paid / l.amount) * 100 : 0, done: balance <= 0.5, late: l.dueDate && l.dueDate < today() && balance > 0.5 };
}

export function loanForm(l = null) {
  if (accounts().length < 2) { toast("Cree al menos un negocio para prestar entre cuentas", "error"); return; }
  formModal({
    title: l ? "Editar préstamo interno" : "Préstamo entre cuentas",
    intro: `<p class="text-sm text-slate-400 mb-4">Mueva dinero de una cuenta a otra como préstamo (por ejemplo, de un negocio a lo personal). No cuenta como ingreso ni gasto, pero sí afecta el saldo de cada cuenta hasta que se pague.</p>`,
    values: l || { from: DB.data.businesses[0]?.id || "personal", to: "personal", date: today() },
    fields: [
      { name: "from", label: "Presta (sale de)", type: "select", options: accOpts(), col: "half" },
      { name: "to", label: "Recibe (entra a)", type: "select", options: accOpts(), col: "half" },
      { name: "amount", label: "Valor prestado", type: "money", required: true, col: "half" },
      { name: "date", label: "Fecha", type: "date", required: true, col: "half" },
      { name: "dueDate", label: "Fecha límite de pago (opcional)", type: "date", col: "half" },
      { name: "note", label: "Motivo", placeholder: "Ej.: Compra de inventario", col: "half" }
    ],
    onSubmit: async (v) => {
      if (v.from === v.to) throw new Error("La cuenta que presta y la que recibe deben ser distintas");
      if (l) {
        await DB.update("loans", l.id, v);
        const tr = DB.data.transfers.find((x) => x.kind === "prestamo" && x.refId === l.id);
        if (tr) await DB.update("transfers", tr.id, { from: v.from, to: v.to, amount: v.amount, date: v.date, note: v.note });
      } else {
        const rec = await DB.add("loans", v);
        await DB.add("transfers", { kind: "prestamo", refId: rec.id, from: v.from, to: v.to, amount: v.amount, date: v.date, note: v.note });
      }
      toast(l ? "Préstamo actualizado" : `Préstamo registrado: ${entityName(v.from)} → ${entityName(v.to)}`);
      changed();
    }
  });
}

export function loanPayForm(l) {
  const s = loanStatus(l);
  formModal({
    title: "Registrar abono",
    intro: `<p class="text-sm text-slate-400 mb-4"><strong class="text-white">${esc(entityName(l.to))}</strong> le devuelve a <strong class="text-white">${esc(entityName(l.from))}</strong>. Saldo pendiente: <strong class="text-white">${money(s.balance)}</strong>.</p>`,
    values: { date: today(), amount: s.balance },
    fields: [
      { name: "amount", label: "Valor del abono", type: "money", required: true, col: "half" },
      { name: "date", label: "Fecha", type: "date", required: true, col: "half" },
      { name: "note", label: "Nota", placeholder: "Opcional" }
    ],
    onSubmit: async (v) => {
      if (v.amount > s.balance + 0.5) throw new Error(`El abono supera el saldo pendiente (${money(s.balance)})`);
      await DB.add("transfers", { kind: "abono", refId: l.id, from: l.to, to: l.from, amount: v.amount, date: v.date, note: v.note });
      const ns = loanStatus(l);
      toast(ns.done ? "¡Préstamo interno pagado por completo!" : "Abono registrado");
      if (ns.done) confetti();
      changed();
    }
  });
}

export function loanDetail(l) {
  const ab = DB.data.transfers.filter((x) => x.kind === "abono" && x.refId === l.id).sort((a, b) => b.date.localeCompare(a.date));
  const s = loanStatus(l);
  modal({
    title: `${entityName(l.from)} → ${entityName(l.to)}`,
    body: `<div class="grid grid-cols-3 gap-3 mb-4">
        <div class="mini"><span class="mini-l">Prestado</span><span class="mini-v text-white">${money(l.amount, true)}</span></div>
        <div class="mini"><span class="mini-l">Abonado</span><span class="mini-v text-emerald-300">${money(s.paid, true)}</span></div>
        <div class="mini"><span class="mini-l">Pendiente</span><span class="mini-v text-rose-300">${money(s.balance, true)}</span></div></div>
      ${ab.length ? `<ul class="divide-y divide-white/5 rounded-xl border border-white/10">${ab.map((x) => `<li class="flex items-center gap-3 px-3 py-2.5 text-sm">
        <div class="flex-1"><p class="text-white">${shortDate(x.date)} · <span class="font-mono">${money(x.amount)}</span></p>${x.note ? `<p class="text-[11px] text-slate-500">${esc(x.note)}</p>` : ""}</div>
        <button class="icon-btn ro-hide" data-action="move:del" data-id="${x.id}" aria-label="Eliminar abono">${ic("trash-2", "w-4 h-4")}</button></li>`).join("")}</ul>` : `<p class="text-sm text-slate-400">Sin abonos todavía.</p>`}`
  });
}

export async function deleteLoan(id) {
  if (!(await confirmDialog("¿Eliminar este préstamo interno y todos sus abonos? Los saldos de las cuentas se recalcularán."))) return;
  await DB.removeWhere("transfers", (x) => x.refId === id && (x.kind === "prestamo" || x.kind === "abono"));
  await DB.remove("loans", id); toast("Préstamo eliminado", "info"); changed();
}

export async function deleteFund(id) {
  const f = DB.data.funds.find((x) => x.id === id);
  const bal = fundBalance(f);
  if (!(await confirmDialog(bal > 0 ? `El rubro tiene ${money(bal)}. Al eliminarlo se borran sus movimientos y el dinero vuelve a figurar en las cuentas de origen. ¿Continuar?` : `¿Eliminar el rubro “${f.name}”?`))) return;
  await DB.removeWhere("transfers", (x) => x.to === `fund:${id}` || x.from === `fund:${id}`);
  await DB.remove("funds", id); toast("Rubro eliminado", "info"); changed();
}

export async function deleteMove(id) {
  if (!(await confirmDialog("¿Eliminar este movimiento?"))) return;
  await DB.remove("transfers", id); closeModal(); toast("Movimiento eliminado", "info"); changed();
}

/* ------------------------------ Resúmenes ------------------------------ */
export function netWorth() {
  const cash = sum(accounts(), (a) => accountBalance(a.id));
  const saved = sum(DB.data.funds, fundBalance);
  const debt = sum(DB.data.debts, (d) => debtStatus(d).balance);
  return { cash, saved, debt, net: cash + saved - debt };
}
