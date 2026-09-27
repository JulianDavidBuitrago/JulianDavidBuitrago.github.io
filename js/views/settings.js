/* RACK 21 · Ajustes: perfil, reto, coach IA y datos */
import { DB, SHARE_MODULES } from "../store.js";
import { APP } from "../config.js";
import { esc, today, shortDate } from "../utils.js";
import { ic, sectionHead, toast, confirmDialog, modal, closeModal } from "../ui.js";
import { aiSettings, saveAiSettings, askClaude } from "../coach.js";
import { challenge } from "../logic.js";
import * as A from "../actions.js";

let myShares = null;
const modLabel = (id) => SHARE_MODULES.find((m) => m.id === id)?.label.replace(/ \(.*\)/, "") || id;

function renderViewer() {
  const sh = DB.share;
  return `
  ${sectionHead("Ajustes", "Está consultando una cuenta compartida en modo de solo lectura.")}
  <div class="grid lg:grid-cols-2 gap-4 sm:gap-6">
    <div class="card reveal space-y-4">
      <h2 class="card-title">${ic("eye", "w-5 h-5 text-violet-300")}Acceso de solo lectura</h2>
      <p class="text-sm text-slate-300">Cuenta de <strong class="text-white">${esc(sh.ownerName)}</strong>. Puede consultar la información, pero no crear, editar ni eliminar registros.</p>
      <div><p class="label">Módulos habilitados por el administrador</p>
        <div class="flex flex-wrap gap-2">${sh.modules.map((m) => `<span class="chip chip-on">${modLabel(m)}</span>`).join("")}</div></div>
      <button class="btn btn-ghost" data-action="account">${ic("repeat", "w-4 h-4")}Cambiar de cuenta</button>
    </div>
    <div class="card reveal space-y-4">
      <h2 class="card-title">${ic("shield", "w-5 h-5 text-slate-300")}Mi sesión</h2>
      <p class="text-sm text-slate-400">Sesión iniciada como <strong class="text-white">${esc(DB.user?.email || "")}</strong></p>
      <button class="btn btn-danger" data-action="logout">${ic("log-out", "w-4 h-4")}Cerrar sesión</button>
    </div>
  </div>`;
}

const appUrl = () => location.origin + location.pathname;
function inviteText(x) {
  return `Hola 👋 Te compartí mi cuenta de RACK 21 en modo solo lectura.\n\n1. Entra a: ${appUrl()}\n2. Inicia sesión con este correo: ${x.viewerEmail}\n   (con "Continuar con Google" o creando una cuenta con ese correo)\n3. Si creas la cuenta con contraseña, abre el correo de verificación que te llega y luego pulsa "Ya verifiqué mi correo" (también está en Ajustes).\n\nAl entrar verás mi información con una franja morada de "Solo lectura".`;
}
function inviteModal(x) {
  const txt = inviteText(x);
  const m = modal({
    title: "Invitar a la persona",
    body: `<p class="text-sm text-slate-300 mb-3">RACK 21 no envía correos de invitación. Envíele este mensaje por el medio que prefiera:</p>
      <pre class="whitespace-pre-wrap text-xs text-slate-200 bg-black/30 border border-white/10 rounded-xl p-3 mb-4 font-sans">${esc(txt)}</pre>
      <div class="grid sm:grid-cols-3 gap-2">
        <a class="btn btn-primary" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(txt)}">${ic("message-circle", "w-4 h-4")}WhatsApp</a>
        <a class="btn btn-ghost" href="mailto:${esc(x.viewerEmail)}?subject=${encodeURIComponent("Acceso de solo lectura a RACK 21")}&body=${encodeURIComponent(txt)}">${ic("mail", "w-4 h-4")}Correo</a>
        <button class="btn btn-ghost" id="copyInvite">${ic("copy", "w-4 h-4")}Copiar</button>
      </div>`
  });
  m.querySelector("#copyInvite").onclick = async () => {
    try { await navigator.clipboard.writeText(txt); toast("Mensaje copiado"); } catch { toast("No se pudo copiar; seleccione el texto manualmente", "error"); }
  };
}

function sharedWithMeHTML() {
  const list = DB.sharedWithMe || [];
  let warn = "";
  if (DB.mode === "firebase" && !DB.user.emailVerified) warn = `<div class="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-sm text-amber-100 space-y-3">
      <p>${ic("mail-warning", "w-4 h-4 inline mr-1")}Su correo <strong>${esc(DB.user.email)}</strong> aún no está verificado. Por seguridad, las cuentas que le compartan no aparecerán hasta que lo verifique.</p>
      <div class="flex flex-wrap gap-2"><button class="btn btn-sm btn-primary" data-action="verify:send">${ic("send", "w-3.5 h-3.5")}Enviarme el correo de verificación</button>
      <button class="btn btn-sm btn-ghost" data-action="verify:check">${ic("refresh-cw", "w-3.5 h-3.5")}Ya verifiqué mi correo</button></div>
      <p class="text-xs text-amber-200/70">Revise también las carpetas Spam y Promociones.</p></div>`;
  else if (DB.shareStatus === "error") warn = DB.shareDiag === "rules"
    ? `<div class="rounded-xl border border-rose-400/30 bg-rose-500/5 p-3 text-sm text-rose-100 space-y-2">${ic("circle-alert", "w-4 h-4 inline mr-1")}<strong>Firebase está usando reglas antiguas</strong> (${esc(DB.shareError || "permisos")}).
        <p class="text-xs text-rose-100/80">En Firebase → Firestore Database → Reglas, reemplace todo por el contenido de <code>firestore.rules</code> y pulse <strong>Publicar</strong>. Espere un minuto y recargue.</p></div>`
    : `<div class="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-sm text-amber-100 space-y-3">${ic("circle-alert", "w-4 h-4 inline mr-1")}Su sesión todavía no refleja la verificación del correo (${esc(DB.shareError || "permisos")}).
        <div class="flex flex-wrap gap-2"><button class="btn btn-sm btn-primary" data-action="logout">${ic("log-out", "w-3.5 h-3.5")}Cerrar sesión y volver a entrar</button></div></div>`;
  return `${warn}
    ${list.length ? `<ul class="space-y-2">${list.map((x) => `<li class="row"><div class="w-9 h-9 rounded-xl bg-violet-400/10 text-violet-300 grid place-items-center shrink-0">${ic("eye", "w-4 h-4")}</div>
      <div class="flex-1 min-w-0"><p class="text-sm text-white truncate">${esc(x.ownerName)}</p><p class="text-[11px] text-slate-500">${(x.modules || []).length} módulos habilitados</p></div>
      <button class="btn btn-sm btn-ghost" data-action="switch" data-owner="${esc(x.ownerUid)}">${ic("log-in", "w-3.5 h-3.5")}Ver</button></li>`).join("")}</ul>`
    : !warn ? `<p class="text-sm text-slate-400">Nadie le ha compartido una cuenta con el correo <strong class="text-slate-200">${esc(DB.user.email)}</strong>.</p>` : ""}`;
}

function sharesHTML() {
  if (myShares === null) return `<p class="text-sm text-slate-500">Cargando accesos…</p>`;
  if (!myShares.length) return `<p class="text-sm text-slate-400">Aún no ha compartido su cuenta con nadie.</p>`;
  return `<ul class="space-y-2">${myShares.map((x) => `
    <li class="row !items-start">
      <div class="w-9 h-9 rounded-xl bg-violet-400/10 text-violet-300 grid place-items-center shrink-0">${ic("eye", "w-4 h-4")}</div>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-white truncate">${esc(x.viewerEmail)}</p>
        ${x.note ? `<p class="text-[11px] text-slate-400">${esc(x.note)}</p>` : ""}
        <div class="flex flex-wrap gap-1 mt-1.5">${(x.modules || []).map((m) => `<span class="chip-n !px-2 !py-0.5 text-[10px] text-slate-300">${modLabel(m)}</span>`).join("")}</div>
      </div>
      <button class="icon-btn !text-emerald-300" data-action="share:invite" data-id="${esc(x.id)}" aria-label="Invitar" title="Enviar invitación">${ic("send", "w-4 h-4")}</button>
      <button class="icon-btn" data-action="share:edit" data-id="${esc(x.id)}" aria-label="Editar acceso">${ic("pencil", "w-4 h-4")}</button>
      <button class="icon-btn hover:!text-rose-300" data-action="share:del" data-id="${esc(x.id)}" aria-label="Quitar acceso">${ic("trash-2", "w-4 h-4")}</button>
    </li>`).join("")}</ul>`;
}

function shareForm(x = null) {
  const sel = x?.modules || ["inicio", "habitos", "hogar", "tareas", "ejercicio", "metas", "panel"];
  const m = modal({
    title: x ? "Editar acceso de solo lectura" : "Compartir en modo solo lectura",
    size: "max-w-xl",
    body: `<form id="shareForm" class="space-y-4">
      <div><label class="label" for="sh_email">Correo de la persona <span class="text-rose-400">*</span></label>
        <input id="sh_email" name="email" type="email" class="input" required value="${esc(x?.viewerEmail || "")}" ${x ? "readonly" : ""} placeholder="persona@correo.com"></div>
      <div><label class="label" for="sh_note">Nota (opcional)</label><input id="sh_note" name="note" class="input" value="${esc(x?.note || "")}" placeholder="Ej.: Contadora, entrenador, pareja…"></div>
      <div><p class="label">Módulos que podrá ver</p>
        <div class="grid sm:grid-cols-2 gap-2">${SHARE_MODULES.map((mm) => `
          <label class="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 cursor-pointer hover:border-cyan-400/40">
            <input type="checkbox" name="mod" value="${mm.id}" ${sel.includes(mm.id) ? "checked" : ""} class="w-4 h-4 accent-cyan-400">
            <span class="text-sm text-slate-200">${mm.label}</span></label>`).join("")}</div>
        <p class="text-xs text-slate-500 mt-2">Inicio y Panel BI muestran solo la información de los módulos que habilite.</p></div>
      <div class="flex gap-3 justify-end pt-2"><button type="button" class="btn btn-ghost" data-close>Cancelar</button>
        <button type="submit" class="btn btn-primary">${ic("check", "w-4 h-4")}${x ? "Guardar cambios" : "Conceder acceso"}</button></div>
    </form>`
  });
  m.querySelector("[type=button][data-close]").onclick = closeModal;
  m.querySelector("#shareForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const mods = f.getAll("mod");
    if (!mods.length) return toast("Seleccione al menos un módulo", "error");
    try {
      await DB.saveShare(f.get("email"), mods, f.get("note"));
      closeModal();
      toast(x ? "Acceso actualizado" : "Acceso concedido. Ahora envíele la invitación.");
      myShares = await DB.listMyShares(); A.changed();
      if (!x) { const nx = myShares.find((y) => y.viewerEmail === String(f.get("email")).trim().toLowerCase()); if (nx) inviteModal(nx); }
    } catch (err) { toast(err.message || "No se pudo guardar", "error"); }
  });
}

export function render() {
  if (DB.readOnly) return renderViewer();
  const p = DB.profile;
  const ai = aiSettings();
  const ch = challenge();
  return `
  ${sectionHead("Ajustes", "Personalice su experiencia, conecte el coach y administre sus datos.")}

  <div class="grid lg:grid-cols-2 gap-4 sm:gap-6">
    <div class="card reveal space-y-4 lg:col-span-2">
      <h2 class="card-title">${ic("inbox", "w-5 h-5 text-violet-300")}Cuentas compartidas conmigo</h2>
      <p class="text-xs text-slate-400 -mt-2">Cuentas de otras personas que usted puede consultar en modo solo lectura.</p>
      ${sharedWithMeHTML()}
    </div>

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

    <div class="card reveal space-y-4 lg:col-span-2">
      <div class="flex flex-wrap justify-between gap-3 items-start">
        <div><h2 class="card-title">${ic("users", "w-5 h-5 text-violet-300")}Usuarios de solo lectura</h2>
        <p class="text-xs text-slate-400 mt-1 max-w-2xl">Comparta su información con otra persona (familiar, contador, entrenador) para que solo la consulte. Usted elige qué módulos ve; no podrá crear, editar ni eliminar nada.</p></div>
        <button class="btn btn-primary" data-action="share:new">${ic("user-plus", "w-4 h-4")}Agregar usuario</button>
      </div>
      <div id="sharesBox">${sharesHTML()}</div>
      <p class="text-[11px] text-slate-500">La persona entra a RACK 21 con ese mismo correo (Google o correo verificado) y verá su cuenta en modo lectura. Puede quitarle el acceso cuando quiera.</p>
    </div>

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
  if (DB.readOnly) return;
  if (myShares === null) DB.listMyShares().then((l) => { myShares = l; const b = document.getElementById("sharesBox"); if (b) { b.innerHTML = sharesHTML(); import("../ui.js").then((u) => u.icons()); } }).catch(() => { myShares = []; });
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
  logout: () => DB.signOut(),
  "share:new": () => shareForm(),
  "share:invite": (d) => inviteModal(myShares.find((x) => x.id === d.id)),
  "verify:send": async () => {
    try { await DB.resendVerification(); toast(`Enviamos el correo de verificación a ${DB.user.email}. Revise también Spam.`, "info"); }
    catch (e) { toast(e.code?.includes("too-many") ? "Ya se envió hace poco. Espere unos minutos." : (e.message || "No se pudo enviar"), "error"); }
  },
  "verify:check": async () => {
    const ok = await DB.reloadUser();
    if (ok) { toast("¡Correo verificado! Cargando cuentas compartidas…"); setTimeout(() => location.reload(), 900); }
    else toast("Aún no aparece verificado. Abra el enlace del correo y vuelva a intentarlo.", "error");
  },
  "share:edit": (d) => shareForm(myShares.find((x) => x.id === d.id)),
  "share:del": async (d) => {
    const x = myShares.find((y) => y.id === d.id);
    if (!(await confirmDialog(`¿Quitar el acceso de ${x?.viewerEmail}? Dejará de ver su información de inmediato.`, { ok: "Quitar acceso" }))) return;
    await DB.deleteShare(d.id);
    myShares = await DB.listMyShares();
    toast("Acceso retirado", "info"); A.changed();
  }
};
