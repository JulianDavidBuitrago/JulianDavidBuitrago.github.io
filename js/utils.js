/* RACK 21 · Utilidades */
import { APP } from "./config.js";

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ------------------------------- Fechas -------------------------------- */
export const toISO = (d) => {
  const x = new Date(d);
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${x.getFullYear()}-${m}-${day}`;
};
export const today = () => toISO(new Date());
export const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
export const diffDays = (a, b) => Math.round((parseISO(a) - parseISO(b)) / 86400000);
export const dateRange = (from, to) => {
  const out = []; let d = from;
  while (d <= to) { out.push(d); d = addDays(d, 1); }
  return out;
};
export const lastNDays = (n, end = today()) => dateRange(addDays(end, -(n - 1)), end);
export const weekday = (iso) => parseISO(iso).getDay(); // 0 domingo
export const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const shortDate = (iso) => { const d = parseISO(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const longDate = (iso = today()) =>
  parseISO(iso).toLocaleDateString(APP.locale, { weekday: "long", day: "numeric", month: "long" });
export const monthKey = (iso) => iso.slice(0, 7);
export const monthLabel = (key) => { const [y, m] = key.split("-"); return `${MONTHS[+m - 1]} ${y.slice(2)}`; };
export const hour = () => new Date().getHours();

/* ------------------------------- Formatos ------------------------------ */
export const money = (n, compact = false) =>
  new Intl.NumberFormat(APP.locale, {
    style: "currency", currency: APP.currency, maximumFractionDigits: 0,
    notation: compact && Math.abs(n) >= 1e6 ? "compact" : "standard"
  }).format(n || 0);
export const num = (n, d = 0) => new Intl.NumberFormat(APP.locale, { maximumFractionDigits: d }).format(n || 0);
export const pct = (n) => `${Math.round(n || 0)}%`;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Markdown mínimo y seguro para las respuestas del coach */
export function md(text) {
  const lines = esc(text).split("\n");
  let html = "", list = null;
  const inline = (s) => s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  let table = null;
  const closeTable = () => {
    if (!table) return;
    const rows = table.filter((r) => !/^\s*\|?\s*:?-{2,}/.test(r)).map((r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim())));
    html += `<div class="tbl"><table><thead><tr>${rows[0].map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.slice(1).map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    table = null;
  };
  for (const raw of lines) {
    const l = raw.trimEnd();
    let m;
    if (/^\s*\|.*\|\s*$/.test(l)) { close(); (table ||= []).push(l); continue; }
    closeTable();
    if ((m = l.match(/^\s*[-•*]\s+(.*)/))) { if (list !== "ul") { close(); html += "<ul>"; list = "ul"; } html += `<li>${inline(m[1])}</li>`; continue; }
    if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== "ol") { close(); html += "<ol>"; list = "ol"; } html += `<li>${inline(m[1])}</li>`; continue; }
    close();
    if ((m = l.match(/^#{1,4}\s+(.*)/))) { html += `<h4>${inline(m[1])}</h4>`; continue; }
    if (l.trim() === "") continue;
    html += `<p>${inline(l)}</p>`;
  }
  close(); closeTable();
  return html;
}

export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
export const groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] ||= []).push(x); return m; }, {});
export const firstName = (n) => (n || "").trim().split(/\s+/)[0] || "";
