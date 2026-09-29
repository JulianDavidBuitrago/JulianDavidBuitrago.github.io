/* RACK 21 · Panel administrativo (solo correos en ADMIN_EMAILS) */
import { DB } from "../store.js";
import { ADMIN_EMAILS } from "../config.js";
import { esc } from "../utils.js";
import { ic, sectionHead, toast } from "../ui.js";
import * as A from "../actions.js";

export function render() {
  if (!DB.isAdmin()) return `<div class="card text-center py-12"><p class="text-white font-display mb-2">Acceso restringido</p><p class="text-slate-400 text-sm">Solo los administradores pueden ver este panel.</p></div>`;
  const c = DB.appConfig;
  const open = c.registrationOpen !== false;
  const invited = c.allowInvited !== false;
  return `
  ${sectionHead("Panel administrativo", "Controle quién puede crear cuentas nuevas en RACK 21.")}

  <div class="grid lg:grid-cols-2 gap-4 sm:gap-6">
    <form class="card reveal space-y-5 lg:col-span-2" id="regForm">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="card-title">${ic("user-plus", "w-5 h-5 text-cyan-300")}Registro de nuevos usuarios</h2>
          <p class="text-xs text-slate-400 mt-1 max-w-xl">Cuando está cerrado, la pantalla de inicio de sesión oculta la opción <em>Crear una cuenta</em> y bloquea las cuentas nuevas, también las creadas con Google. Los usuarios existentes siguen entrando normalmente.</p>
        </div>
        <label class="switch" title="Abrir o cerrar el registro">
          <input type="checkbox" name="registrationOpen" ${open ? "checked" : ""} aria-label="Registro abierto">
          <span class="switch-track"><span class="switch-thumb"></span></span>
          <span class="switch-label" data-on="Abierto" data-off="Cerrado"></span>
        </label>
      </div>

      <div class="rounded-2xl p-4 border ${open ? "border-emerald-400/30 bg-emerald-400/5" : "border-rose-400/30 bg-rose-500/5"}" id="regState">
        <p class="text-sm ${open ? "text-emerald-100" : "text-rose-100"} flex items-center gap-2">${ic(open ? "lock-open" : "lock", "w-4 h-4")}
          ${open ? "El registro está <strong>abierto</strong>: cualquier persona puede crear una cuenta." : "El registro está <strong>cerrado</strong>: nadie nuevo puede crear cuenta" + (invited ? ", salvo los correos invitados en modo solo lectura." : ".")}</p>
      </div>

      <label class="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3 cursor-pointer">
        <input type="checkbox" name="allowInvited" ${invited ? "checked" : ""} class="mt-1 w-4 h-4 accent-cyan-400">
        <span class="text-sm text-slate-200"><strong class="text-white">Permitir el registro de correos invitados</strong><br><span class="text-xs text-slate-400">Si alguien le compartió su cuenta en modo solo lectura, esa persona podrá registrarse aunque el registro esté cerrado.</span></span>
      </label>

      <div><label class="label" for="closedMsg">Mensaje que verá quien intente registrarse con el registro cerrado</label>
        <textarea id="closedMsg" name="closedMessage" rows="2" class="input" placeholder="El registro de nuevos usuarios está cerrado. Solicite acceso al administrador.">${esc(c.closedMessage || "")}</textarea></div>

      <div class="flex flex-wrap items-center gap-3">
        <button class="btn btn-primary" type="submit">${ic("save", "w-4 h-4")}Guardar configuración</button>
        ${c.updatedAt ? `<span class="text-[11px] text-slate-500">Último cambio: ${new Date(c.updatedAt).toLocaleString("es-CO")} · ${esc(c.updatedBy || "")}</span>` : ""}
      </div>
    </form>

    <div class="card reveal space-y-3">
      <h2 class="card-title">${ic("shield-check", "w-5 h-5 text-violet-300")}Administradores</h2>
      <ul class="space-y-1.5">${ADMIN_EMAILS.length ? ADMIN_EMAILS.map((e) => `<li class="text-sm text-slate-200 flex items-center gap-2">${ic("user", "w-4 h-4 text-slate-400")}${esc(e)}</li>`).join("") : `<li class="text-sm text-amber-200">Modo local: sin lista de administradores. Configure <code>ADMIN_EMAILS</code> antes de publicar.</li>`}</ul>
      <p class="text-[11px] text-slate-500">Se definen en <code>js/config.js</code> y en <code>firestore.rules</code> (función <code>isAdmin</code>). Ambas listas deben coincidir.</p>
    </div>

    <div class="card reveal space-y-3">
      <h2 class="card-title">${ic("lock-keyhole", "w-5 h-5 text-amber-300")}Bloqueo total (opcional)</h2>
      <p class="text-sm text-slate-300">Para impedir cualquier registro, incluso desde fuera de la app, en Firebase vaya a <strong>Authentication → Configuración → Acciones del usuario</strong> y desactive <em>Habilitar creación (registro)</em>.</p>
      <p class="text-[11px] text-slate-500">Con ese bloqueo tampoco podrán registrarse los invitados. Úselo solo si no va a compartir su cuenta con personas nuevas.</p>
    </div>
  </div>`;
}

export function mount(root) {
  const f = root.querySelector("#regForm");
  if (!f) return;
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = f.querySelector("[type=submit]"); btn.disabled = true;
    try {
      await DB.saveAppConfig({
        registrationOpen: f.registrationOpen.checked,
        allowInvited: f.allowInvited.checked,
        closedMessage: f.closedMessage.value.trim()
      });
      toast(f.registrationOpen.checked ? "Registro abierto para nuevos usuarios" : "Registro cerrado. Solo entran los usuarios existentes.");
      A.changed();
    } catch (err) { toast(err.code === "permission-denied" ? "Firebase rechazó el cambio: revise que su correo esté en isAdmin() de firestore.rules y publique las reglas." : err.message, "error"); btn.disabled = false; }
  });
}
