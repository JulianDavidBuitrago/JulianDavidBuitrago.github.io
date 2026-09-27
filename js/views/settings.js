/* RACK 21 · Ajustes: perfil, reto, coach IA y datos */
import { DB } from "../store.js";
import { APP } from "../config.js";
import { esc, today, shortDate } from "../utils.js";
import { ic, sectionHead, toast, confirmDialog } from "../ui.js";
import { aiSettings, saveAiSettings, askClaude } from "../coach.js";
import { challenge } from "../logic.js";
import * as A from "../actions.js";

export function render() {
  const p = DB.profile;
  const ai = aiSettings();
  const ch = challenge();
  return `
  ${sectionHead("Ajustes", "Personalice su experiencia, conecte el coach y administre sus datos.")}

  <div class="grid lg:grid-cols-2 gap-4 sm:gap-6">
    <form class="card reveal space-y-4" data-form="profile">
      <h2 class="card-title">${ic("user", "w-5 h-5 text-cyan-300")}Perfil e identidad</h2>
      <div><label class="label" for="p_name">Nombre</label><input id="p_name" name="name" class="input" value="${esc(p.name || DB.user?.displayName || "")}"></div>
      <div><label class="label" for="p_id">Identidad que construye</label><input id="p_id" name="identity" class="input" placeholder="Soy una persona saludable, ordenada y dueña de sus números" value="${esc(p.identity || "")}"></div>
      <div><label class="label" for="p_why">¿Por qué quiere cambiar?</label><textarea id="p_why" name="why" rows="2" class="input">${esc(p.why || "")}</textarea></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="label" for="p_ed">Meta diaria de ejercicio (min)</label><input id="p_ed" name="exerciseDaily" type="number" min="5" class="input" value="${p.exerciseDaily || 30}"></div>
        <div><label class="label" for="p_ew">Meta semanal (min)</label><input id="p_ew" name="exerciseWeekly" type="number" min="30" class="input" value="${p.exerciseWeekly || 180}"></div>
      </div>
      <button class="btn btn-primary" type="submit">${ic("save", "w-4 h-4")}Guardar perfil</button>
    </form>

    <div class="card reveal space-y-4">
      <h2 class="card-title">${ic("triangle", "w-5 h-5 text-emerald-300")}Reto de 21 días</h2>
      ${ch ? `<p class="text-sm text-slate-300">Inició el <strong class="text-white">${shortDate(ch.start)}</strong> y termina el <strong class="text-white">${shortDate(ch.end)}</strong>. Lleva <strong class="text-emerald-300">${ch.pocketed}</strong> bolas embocadas.</p>` : `<p class="text-sm text-slate-300">El reto aún no ha iniciado.</p>`}
      <div><label class="label" for="c_start">Fecha de inicio</label><input id="c_start" type="date" class="input" value="${p.challengeStart || today()}"></div>
      <div class="flex flex-wrap gap-2">
        <button class="btn btn-primary" data-action="challenge:set">${ic("calendar-days", "w-4 h-4")}${ch ? "Cambiar fecha" : "Iniciar reto"}</button>
        ${ch ? `<button class="btn btn-ghost" data-action="challenge:restart">${ic("rotate-ccw", "w-4 h-4")}Nuevo reto desde hoy</button>` : ""}
      </div>
      <p class="text-xs text-slate-500">La bola de cada día se emboca al superar el ${APP.dayGoal} % (hábitos 50 %, hogar 25 %, ejercicio 25 %). Reiniciar no borra su historial.</p>
    </div>

    <form class="card reveal space-y-4 lg:col-span-2" data-form="ai">
      <div class="flex flex-wrap justify-between gap-3 items-start">
        <h2 class="card-title">${ic("bot", "w-5 h-5 text-violet-300")}Coach IA · conexión con Claude</h2>
        <span class="text-[11px] text-slate-500">Esta configuración se guarda solo en este dispositivo.</span>
      </div>
      <div class="grid md:grid-cols-2 gap-4">
        <label class="mode-card ${ai.mode === "proxy" ? "mode-on" : ""}"><input type="radio" name="mode" value="proxy" ${ai.mode === "proxy" ? "checked" : ""} class="sr-only">
          <span class="flex items-center gap-2 text-white font-medium">${ic("shield-check", "w-4 h-4 text-emerald-300")}Proxy seguro (recomendado)</span>
          <span class="text-xs text-slate-400 mt-1 block">La API key vive como secreto en un Worker de Cloudflare (gratis). Ver <code>worker/claude-proxy.js</code> y el README.</span></label>
        <label class="mode-card ${ai.mode === "direct" ? "mode-on" : ""}"><input type="radio" name="mode" value="direct" ${ai.mode === "direct" ? "checked" : ""} class="sr-only">
          <span class="flex items-center gap-2 text-white font-medium">${ic("key-round", "w-4 h-4 text-amber-300")}Conexión directa</span>
          <span class="text-xs text-slate-400 mt-1 block">La app usa su API key desde este navegador. Práctico para uso personal; no la use en equipos compartidos.</span></label>
      </div>
      <div class="grid md:grid-cols-3 gap-4">
        <div data-show="proxy" class="${ai.mode === "proxy" ? "" : "hidden"} md:col-span-2"><label class="label" for="ai_url">URL del proxy</label><input id="ai_url" name="proxyUrl" class="input font-mono text-sm" placeholder="https://rack21-coach.su-usuario.workers.dev" value="${esc(ai.proxyUrl)}"></div>
        <div data-show="direct" class="${ai.mode === "direct" ? "" : "hidden"} md:col-span-2"><label class="label" for="ai_key">API key de Anthropic</label><input id="ai_key" name="apiKey" type="password" autocomplete="off" class="input font-mono text-sm" placeholder="sk-ant-…" value="${esc(ai.apiKey)}"></div>
        <div><label class="label" for="ai_model">Modelo</label><select id="ai_model" name="model" class="input">${APP.claudeModels.map((m) => `<option value="${m.id}" ${ai.model === m.id ? "selected" : ""}>${m.label}</option>`).join("")}</select></div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="btn btn-primary" type="submit">${ic("save", "w-4 h-4")}Guardar conexión</button>
        <button class="btn btn-ghost" type="button" data-action="ai:test">${ic("plug-zap", "w-4 h-4")}Probar conexión</button>
      </div>
    </form>

    <div class="card reveal space-y-4">
      <h2 class="card-title">${ic("database", "w-5 h-5 text-amber-300")}Sus datos</h2>
      <p class="text-sm text-slate-400">Modo: <strong class="text-white">${DB.mode === "firebase" ? "Firebase (nube, sincronizado)" : "Local (solo este navegador)"}</strong>. Registros: ${Object.values(DB.data).reduce((s, l) => s + l.length, 0).toLocaleString("es-CO")}.</p>
      <div class="flex flex-wrap gap-2">
        <button class="btn btn-ghost" data-action="export">${ic("download", "w-4 h-4")}Exportar copia (JSON)</button>
        <label class="btn btn-ghost cursor-pointer">${ic("upload", "w-4 h-4")}Importar copia<input type="file" accept="application/json" class="hidden" data-file="import"></label>
        <button class="btn btn-ghost" data-action="seed">${ic("sparkles", "w-4 h-4")}Cargar plan de arranque</button>
      </div>
    </div>

    <div class="card reveal space-y-4">
      <h2 class="card-title">${ic("shield", "w-5 h-5 text-slate-300")}Cuenta</h2>
      <p class="text-sm text-slate-400">Sesión iniciada como <strong class="text-white">${esc(DB.user?.email || "")}</strong></p>
      <button class="btn btn-danger" data-action="logout">${ic("log-out", "w-4 h-4")}Cerrar sesión</button>
    </div>
  </div>`;
}

export function mount(root) {
  root.querySelector('[data-form="profile"]')?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    f.exerciseDaily = Number(f.exerciseDaily) || 30; f.exerciseWeekly = Number(f.exerciseWeekly) || 180;
    await DB.saveProfile(f);
    toast("Perfil guardado. ¡Así se habla!");
    A.changed();
  });
  const aiForm = root.querySelector('[data-form="ai"]');
  aiForm?.querySelectorAll('[name="mode"]').forEach((r) => r.addEventListener("change", () => {
    aiForm.querySelectorAll(".mode-card").forEach((c) => c.classList.toggle("mode-on", c.querySelector("input").checked));
    aiForm.querySelectorAll("[data-show]").forEach((el) => el.classList.toggle("hidden", el.dataset.show !== r.value));
  }));
  aiForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveAiSettings(Object.fromEntries(new FormData(aiForm)));
    toast("Conexión del coach guardada");
  });
  root.querySelector('[data-file="import"]')?.addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { await DB.importJSON(JSON.parse(await file.text())); toast("Copia importada correctamente"); A.changed(); }
    catch (err) { toast(err.message || "No se pudo importar", "error"); }
  });
}

export const actions = {
  "challenge:set": async () => { await A.startChallenge(document.getElementById("c_start").value || today()); },
  "challenge:restart": async () => { if (await confirmDialog("¿Iniciar un nuevo reto de 21 días desde hoy? Su historial se conserva.", { ok: "Iniciar", danger: false })) A.startChallenge(today()); },
  "ai:test": async (_d, el) => {
    const f = el.closest("form"); saveAiSettings(Object.fromEntries(new FormData(f)));
    el.disabled = true; el.lastChild.textContent = "Probando…";
    try { const r = await askClaude([{ role: "user", content: "Responda solo: 'Conexión exitosa' y un saludo de una línea." }]); toast(`✔ ${r.text.split("\n")[0].slice(0, 90)}`); }
    catch (e) { toast(e.message, "error"); }
    finally { el.disabled = false; el.lastChild.textContent = "Probar conexión"; }
  },
  export: () => {
    const blob = new Blob([DB.exportJSON()], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `rack21-copia-${today()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  seed: async () => { if (await confirmDialog("Se agregarán 7 hábitos con ancla y 10 tareas típicas del hogar. ¿Continuar?", { ok: "Cargar", danger: false })) { await A.seedStarter(); toast("Plan de arranque cargado"); } },
  logout: () => DB.signOut()
};
