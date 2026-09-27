/* RACK 21 · Coach IA (chat con Claude + trazabilidad) */
import { DB } from "../store.js";
import { esc, md, uid, firstName, today } from "../utils.js";
import { ic, toast } from "../ui.js";
import { askClaude, aiReady, aiSettings, extractCommitments, QUICK_PROMPTS } from "../coach.js";
import { sessions } from "./panel.js";
import * as A from "../actions.js";

let current = sessionStorage.getItem("rack21:session") || null;
let busy = false;

const msgsOf = (s) => DB.data.chat.filter((m) => (m.session || "general") === s).sort((a, b) => a.ts - b.ts);

export function render() {
  const ss = sessions();
  if (!current) current = ss[0]?.id || null;
  const msgs = current ? msgsOf(current) : [];
  const name = firstName(DB.profile.name || DB.user?.displayName) || "campeón";
  const ready = aiReady();

  return `
  <div class="grid lg:grid-cols-[280px_1fr] gap-4 sm:gap-6 h-[calc(100dvh-9.5rem)] lg:h-[calc(100dvh-6rem)] min-h-[520px]">
    <aside class="card !p-3 hidden lg:flex flex-col reveal">
      <button class="btn btn-primary w-full mb-3" data-action="new">${ic("message-square-plus", "w-4 h-4")}Nueva conversación</button>
      <p class="text-[11px] uppercase tracking-widest text-slate-500 px-2 mb-2">Historial</p>
      <div class="flex-1 overflow-y-auto space-y-1 pr-1">
        ${ss.length ? ss.map((s) => `<button class="session ${s.id === current ? "session-on" : ""}" data-action="open" data-id="${esc(s.id)}">
          <span class="block text-sm truncate">${esc(s.title)}</span>
          <span class="block text-[10px] text-slate-500">${new Date(s.end).toLocaleDateString("es-CO", { day: "numeric", month: "short" })} · ${s.msgs.length} mensajes</span></button>`).join("")
        : `<p class="text-xs text-slate-500 px-2">Sus conversaciones quedarán guardadas aquí y en el Panel BI.</p>`}
      </div>
    </aside>

    <section class="card !p-0 flex flex-col overflow-hidden reveal">
      <header class="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-white/5">
        <div class="coach-avatar">${ic("bot", "w-5 h-5")}</div>
        <div class="flex-1 min-w-0"><h1 class="text-white font-display tracking-wide text-sm sm:text-base truncate">Coach RACK 21</h1>
          <p class="text-[11px] ${ready ? "text-emerald-300" : "text-amber-300"} flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full ${ready ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}"></span><span class="truncate">${ready ? `Conectado a Claude<span class="hidden sm:inline"> · lee sus datos en tiempo real</span>` : "Sin configurar"}</span></p></div>
        <button class="btn btn-sm btn-ghost lg:hidden" data-action="new" aria-label="Nueva conversación">${ic("message-square-plus", "w-4 h-4")}</button>
        ${ss.length ? `<select class="input !w-28 !py-1.5 text-xs lg:hidden" data-change="session" aria-label="Historial">${ss.map((s) => `<option value="${esc(s.id)}" ${s.id === current ? "selected" : ""}>${esc(s.title.slice(0, 30))}</option>`).join("")}</select>` : ""}
      </header>

      <div id="chatScroll" class="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
        ${!ready ? `<div class="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm text-amber-100">
          ${ic("plug", "w-4 h-4 inline mr-1")}Para activar el coach, configure la conexión con Claude en <button class="link" data-action="go" data-to="ajustes">Ajustes → Coach IA</button>.</div>` : ""}
        ${msgs.length ? msgs.map(bubble).join("") : `
          <div class="text-center py-6">
            <div class="coach-avatar coach-avatar-lg mx-auto mb-4">${ic("bot", "w-8 h-8")}</div>
            <h2 class="font-display text-xl text-white mb-2">Hola, ${esc(name)}. ¿En qué tiro trabajamos hoy?</h2>
            <p class="text-slate-400 text-sm max-w-md mx-auto">Conozco sus hábitos, su casa, sus entrenamientos y los números de sus negocios. Pregúnteme lo que quiera y le propondré acciones concretas.</p>
          </div>
          <div class="grid sm:grid-cols-2 gap-2 max-w-2xl mx-auto">${QUICK_PROMPTS.map((p) => `<button class="prompt-chip" data-action="quick" data-text="${esc(p)}">${ic("sparkles", "w-3.5 h-3.5 shrink-0 text-cyan-300")}<span>${esc(p)}</span></button>`).join("")}</div>`}
        ${busy ? `<div class="bubble bubble-ai typing"><span></span><span></span><span></span></div>` : ""}
      </div>

      <form id="chatForm" class="border-t border-white/5 p-3 sm:p-4 flex gap-2 items-end">
        <label for="chatInput" class="sr-only">Mensaje para el coach</label>
        <textarea id="chatInput" rows="1" class="input resize-none max-h-40 flex-1" placeholder="Escriba su pregunta… (Enter para enviar)" ${busy ? "disabled" : ""}></textarea>
        <button class="btn btn-primary !px-4 h-[46px]" type="submit" ${busy ? "disabled" : ""} aria-label="Enviar">${ic("send", "w-4 h-4")}</button>
      </form>
    </section>
  </div>`;
}

function bubble(m) {
  if (m.role === "user") return `<div class="flex justify-end"><div class="bubble bubble-user">${esc(m.content).replace(/\n/g, "<br>")}</div></div>`;
  const items = extractCommitments(m.content);
  const saved = DB.data.commitments.filter((c) => c.msgId === m.id).map((c) => c.text);
  return `<div class="flex gap-3"><div class="coach-avatar shrink-0 hidden sm:grid">${ic("bot", "w-4 h-4")}</div>
    <div class="bubble bubble-ai ${m.error ? "bubble-error" : ""}">
      <div class="prose-chat">${md(m.content)}</div>
      ${items.length ? `<div class="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-2">${items.map((t) => saved.includes(t)
        ? `<span class="commit-chip commit-saved">${ic("check", "w-3.5 h-3.5")}${esc(t)}</span>`
        : `<button class="commit-chip" data-action="commit" data-msg="${m.id}" data-text="${esc(t)}">${ic("plus", "w-3.5 h-3.5")}${esc(t)}</button>`).join("")}</div>` : ""}
      <p class="text-[10px] text-slate-500 mt-2">${new Date(m.ts).toLocaleString("es-CO", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}${m.model ? ` · ${esc(m.model)}` : ""}</p>
    </div></div>`;
}

async function send(text) {
  text = (text || "").trim();
  if (!text || busy) return;
  if (!aiReady()) { toast("Configure primero el coach en Ajustes → Coach IA", "error"); return; }
  if (!current) current = uid();
  sessionStorage.setItem("rack21:session", current);
  await DB.add("chat", { session: current, role: "user", content: text, ts: Date.now() });
  busy = true; A.changed();
  try {
    const history = msgsOf(current).filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
    const r = await askClaude(history);
    await DB.add("chat", { session: current, role: "assistant", content: r.text, ts: Date.now(), model: r.model, tokens: (r.usage?.input_tokens || 0) + (r.usage?.output_tokens || 0) });
  } catch (e) {
    await DB.add("chat", { session: current, role: "assistant", content: `⚠️ ${e.message}`, ts: Date.now(), error: true });
  } finally { busy = false; A.changed(); }
}

export function mount(root) {
  const sc = root.querySelector("#chatScroll");
  if (sc) sc.scrollTop = sc.scrollHeight;
  const form = root.querySelector("#chatForm"), input = root.querySelector("#chatInput");
  if (!form) return;
  const grow = () => { input.style.height = "auto"; input.style.height = Math.min(160, input.scrollHeight) + "px"; };
  input.addEventListener("input", grow);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener("submit", (e) => { e.preventDefault(); const v = input.value; input.value = ""; send(v); });
  if (!busy && window.innerWidth > 1024) input.focus();
}

export const actions = {
  new: () => { current = uid(); sessionStorage.setItem("rack21:session", current); A.changed(); },
  open: (d) => { current = d.id; sessionStorage.setItem("rack21:session", current); A.changed(); },
  quick: (d) => send(d.text),
  commit: async (d) => {
    await DB.add("commitments", { text: d.text, source: "coach", session: current, msgId: d.msg, date: today(), done: false });
    toast("Compromiso guardado. ¡Palabra dada, palabra cumplida!");
    A.changed();
  }
};
export const changes = { session: (v) => actions.open({ id: v }) };
