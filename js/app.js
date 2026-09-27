/* =====================================================================
   RACK 21 · Aplicación principal (enrutador, autenticación y shell)
   ===================================================================== */
import { DB } from "./store.js";
import { APP } from "./config.js";
import { esc, firstName, today } from "./utils.js";
import { ic, icons, toast, countUp, modal, closeModal, ball } from "./ui.js";
import { destroyCharts } from "./charts.js";
import { level, challenge } from "./logic.js";
import * as A from "./actions.js";

import * as Home from "./views/home.js";
import * as Habits from "./views/habits.js";
import * as Chores from "./views/chores.js";
import * as Tasks from "./views/tasks.js";
import * as Finance from "./views/finance.js";
import * as Exercise from "./views/exercise.js";
import * as Goals from "./views/goals.js";
import * as Panel from "./views/panel.js";
import * as Coach from "./views/coach.js";
import * as Settings from "./views/settings.js";

const ROUTES = {
  inicio:    { label: "Inicio",     icon: "layout-dashboard", view: Home },
  habitos:   { label: "Hábitos",    icon: "repeat",           view: Habits },
  hogar:     { label: "Hogar",      icon: "house",            view: Chores },
  tareas:    { label: "Tareas",     icon: "list-checks",      view: Tasks },
  finanzas:  { label: "Finanzas",   icon: "wallet",           view: Finance },
  ejercicio: { label: "Ejercicio",  icon: "dumbbell",         view: Exercise },
  metas:     { label: "Metas",      icon: "target",           view: Goals },
  panel:     { label: "Panel BI",   icon: "chart-pie",        view: Panel },
  coach:     { label: "Coach IA",   icon: "bot",              view: Coach },
  ajustes:   { label: "Ajustes",    icon: "settings",         view: Settings }
};
const MOBILE_PREF = ["inicio", "habitos", "coach", "panel", "tareas", "hogar", "finanzas", "ejercicio", "metas"];
/* Rutas visibles: todas para el dueño; en solo lectura, solo los módulos habilitados + Ajustes */
const visible = () => Object.keys(ROUTES).filter((id) => !DB.readOnly || id === "ajustes" || (DB.modules || []).includes(id));
const mobileRoutes = () => MOBILE_PREF.filter((id) => visible().includes(id)).slice(0, 4);

const app = document.getElementById("app");
let route = "inicio";

function splash(text, error = false) {
  return `<div class="min-h-dvh grid place-items-center"><div class="text-center">
    <div class="loader-rack mx-auto mb-6">${[1, 2, 3].map((n) => ball(n, { size: 34 })).join("")}</div>
    <p class="${error ? "text-rose-300" : "text-slate-400"} text-sm tracking-wide">${text}</p></div></div>`;
}

/* ---------------------------- Autenticación ---------------------------- */
function renderAuth(mode = "login") {
  const local = DB.mode === "local";
  app.innerHTML = `
  <div class="min-h-dvh grid lg:grid-cols-2">
    <section class="hidden lg:flex relative overflow-hidden felt items-center justify-center p-12">
      <div class="absolute inset-0 felt-glow"></div>
      <div class="relative max-w-md">
        <div class="auth-rack mb-10">${[1, 2, 3, 4, 5, 6].map((r, i) => `<div class="flex justify-center gap-1.5">${Array.from({ length: r }, (_, j) => ball(r * (r - 1) / 2 + j + 1, { size: 44 })).join("")}</div>`).join("")}</div>
        <h2 class="font-display text-4xl text-white leading-tight mb-4">21 días para cambiar <span class="text-neon">el juego</span>.</h2>
        <p class="text-emerald-50/80">Hábitos con ancla, casa en orden, cuerpo en forma y negocios con números claros. Cada día cumplido es una bola embocada.</p>
      </div>
    </section>
    <section class="flex items-center justify-center p-5 sm:p-10">
      <div class="w-full max-w-md">
        <div class="flex items-center gap-3 mb-10">${logo()}</div>
        <h1 class="font-display text-3xl text-white mb-2">${mode === "login" ? "Bienvenido de nuevo" : mode === "register" ? "Cree su cuenta" : "Recuperar contraseña"}</h1>
        <p class="text-slate-400 mb-8">${mode === "login" ? "Su mesa lo está esperando. Cada día cuenta." : mode === "register" ? "El mejor momento para empezar es hoy." : "Le enviaremos un enlace a su correo."}</p>
        ${local ? `<div class="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-100 mb-6">${ic("info", "w-4 h-4 inline mr-1")}Modo local: Firebase aún no está configurado en <code>js/config.js</code>. Los datos se guardarán solo en este navegador.</div>` : ""}
        <form id="authForm" class="space-y-4">
          ${mode === "register" ? `<div><label class="label" for="a_name">Nombre</label><input id="a_name" name="name" class="input" required autocomplete="name"></div>` : ""}
          <div><label class="label" for="a_email">Correo electrónico</label><input id="a_email" name="email" type="email" class="input" required autocomplete="email"></div>
          ${mode !== "reset" ? `<div><label class="label" for="a_pass">Contraseña</label><input id="a_pass" name="password" type="password" class="input" required minlength="6" autocomplete="${mode === "login" ? "current-password" : "new-password"}"></div>` : ""}
          <button class="btn btn-primary btn-lg w-full" type="submit">${mode === "login" ? "Entrar" : mode === "register" ? "Crear cuenta" : "Enviar enlace"}</button>
        </form>
        ${mode !== "reset" ? `<div class="flex items-center gap-3 my-6 text-xs text-slate-500"><span class="flex-1 h-px bg-white/10"></span>o<span class="flex-1 h-px bg-white/10"></span></div>
        <button id="gBtn" class="btn btn-ghost w-full">${googleIcon()}Continuar con Google</button>` : ""}
        <div class="mt-8 text-sm text-slate-400 flex flex-wrap gap-x-4 gap-y-2 justify-between">
          ${mode === "login" ? `<button class="link" data-auth="register">Crear una cuenta</button><button class="link" data-auth="reset">¿Olvidó su contraseña?</button>` : `<button class="link" data-auth="login">Ya tengo cuenta</button>`}
        </div>
      </div>
    </section>
  </div>`;
  icons();
  app.querySelectorAll("[data-auth]").forEach((b) => b.onclick = () => renderAuth(b.dataset.auth));
  document.getElementById("gBtn")?.addEventListener("click", async () => {
    try { await DB.signInGoogle(); } catch (e) { toast(authError(e), "error"); }
  });
  document.getElementById("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      if (mode === "login") await DB.signIn(f.email, f.password);
      else if (mode === "register") await DB.signUp(f.email, f.password, f.name);
      else { await DB.resetPassword(f.email); toast("Revise su correo para restablecer la contraseña", "info"); renderAuth("login"); }
    } catch (err) { toast(authError(err), "error"); btn.disabled = false; }
  });
}

function authError(e) {
  const c = e?.code || "";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "Correo o contraseña incorrectos.";
  if (c.includes("email-already-in-use")) return "Ese correo ya tiene una cuenta. Inicie sesión.";
  if (c.includes("weak-password")) return "La contraseña debe tener al menos 6 caracteres.";
  if (c.includes("popup-closed")) return "Se cerró la ventana de Google antes de terminar.";
  if (c.includes("unauthorized-domain")) return "Dominio no autorizado: agréguelo en Firebase → Authentication → Settings.";
  if (c.includes("too-many-requests")) return "Demasiados intentos. Espere unos minutos.";
  return e?.message || "No fue posible continuar.";
}

const logo = () => `<div class="logo-mark">${ball(21, { size: 38, color: "#22d3ee" })}</div>
  <div><p class="font-display text-xl text-white tracking-[.2em] leading-none">RACK<span class="text-neon">21</span></p><p class="text-[10px] text-slate-500 tracking-[.3em] uppercase mt-1">Vida en juego</p></div>`;

const googleIcon = () => `<svg class="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

/* -------------------------------- Shell -------------------------------- */
function renderShell() {
  app.innerHTML = `
  <div class="min-h-dvh lg:pl-72">
    <aside class="sidebar hidden lg:flex">
      <div class="flex items-center gap-3 px-6 pt-7 pb-8">${logo()}</div>
      <nav class="flex-1 px-4 space-y-1 overflow-y-auto" aria-label="Principal">${visible().map((id) => [id, ROUTES[id]]).map(([id, r]) =>
        `<a href="#/${id}" class="nav-link" data-nav="${id}">${ic(r.icon, "w-5 h-5")}<span>${r.label}</span>${id === "coach" && !DB.readOnly ? '<span class="ml-auto nav-pill">IA</span>' : ""}</a>`).join("")}</nav>
      <div class="p-4"><div id="sideLevel" class="side-level"></div></div>
    </aside>

    <header class="lg:hidden sticky top-0 z-30 glass border-b border-white/5 px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-2 scale-90 origin-left">${logo()}</div>
      <div id="topLevel" class="text-right"></div>
    </header>

    ${DB.readOnly ? `<div class="ro-banner px-4 sm:px-6 lg:px-10 py-2.5 flex items-center gap-3 text-xs sm:text-sm text-violet-100">
      ${ic("eye", "w-4 h-4 shrink-0 text-violet-300")}<span class="flex-1 min-w-0 truncate">Solo lectura · cuenta de <strong class="text-white">${esc(DB.share.ownerName || "")}</strong></span>
      <button class="link !text-violet-200 shrink-0" data-action="account">${ic("repeat", "w-3.5 h-3.5")}Cambiar</button></div>`
    : DB.sharedWithMe?.length ? `<div class="hidden lg:flex justify-end px-10 pt-4 -mb-6"><button class="link text-xs" data-action="account">${ic("users", "w-3.5 h-3.5")}Cuentas compartidas conmigo (${DB.sharedWithMe.length})</button></div>` : ""}
    <main id="view" class="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 pb-28 lg:pb-10 max-w-[1500px] mx-auto"></main>

    <nav class="bottom-nav lg:hidden" aria-label="Navegación móvil">
      ${mobileRoutes().map((id) => `<a href="#/${id}" class="bn-link ${id === "coach" ? "bn-coach" : ""}" data-nav="${id}">${ic(ROUTES[id].icon, "w-5 h-5")}<span>${ROUTES[id].label.replace(" IA", "").replace(" BI", "")}</span></a>`).join("")}
      <button class="bn-link" data-action="more">${ic("menu", "w-5 h-5")}<span>Más</span></button>
    </nav>
  </div>`;
  if (!window.__rackNav) { window.addEventListener("hashchange", navigate); window.__rackNav = true; }
  navigate();
}

function navigate() {
  const r = (location.hash.replace(/^#\/?/, "") || "inicio").split("?")[0];
  const vis = visible();
  route = vis.includes(r) ? r : vis[0];
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === route));
  const more = document.querySelector('[data-action="more"]');
  more?.classList.toggle("active", !mobileRoutes().includes(route));
  closeModal();
  paint(true);
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

function paint(anim = false) {
  const el = document.getElementById("view");
  if (!el) return;
  const focused = document.activeElement?.dataset?.input;
  const caret = document.activeElement?.selectionStart;
  const scroll = window.scrollY;
  destroyCharts();
  const v = ROUTES[route].view;
  el.innerHTML = v.render();
  el.classList.toggle("view-anim", anim);
  if (!anim) el.querySelectorAll(".reveal").forEach((r) => r.classList.add("revealed"));
  icons();
  countUp(el);
  v.mount?.(el);
  if (!anim) window.scrollTo(0, scroll);
  if (focused) { const inp = el.querySelector(`[data-input="${focused}"]`); if (inp) { inp.focus(); inp.setSelectionRange?.(caret, caret); } }
  document.title = `${ROUTES[route].label} · ${APP.name}`;
  paintLevel();
}

function paintLevel() {
  const lv = level(), ch = challenge();
  const side = document.getElementById("sideLevel");
  if (side) side.innerHTML = `
    <div class="flex items-center gap-3 mb-3">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 grid place-items-center text-slate-900 font-display">${lv.idx}</div>
      <div class="min-w-0"><p class="text-white text-sm truncate">${esc(firstName(DB.profile.name || DB.user?.displayName) || "Jugador")}</p><p class="text-[11px] text-slate-400 truncate">${lv.name}</p></div>
    </div>
    <div class="bar"><span style="--w:${lv.progress}%"></span></div>
    <p class="text-[11px] text-slate-500 mt-2 flex justify-between"><span>${lv.points.toLocaleString("es-CO")} pts</span><span>${ch ? `Día ${Math.min(ch.dayNum, 21)}/21 · ${ch.pocketed} 🎱` : "Reto sin iniciar"}</span></p>`;
  const top = document.getElementById("topLevel");
  if (top) top.innerHTML = `<p class="text-[11px] text-slate-400">${ch ? `Día ${Math.min(ch.dayNum, 21)}/21` : lv.name}</p><p class="font-mono text-xs text-amber-300">${lv.points.toLocaleString("es-CO")} pts</p>`;
}

window.addEventListener("rack:changed", () => paint(false));

/* ------------------------ Delegación de eventos ------------------------ */
const GLOBAL = {
  go: (d) => { location.hash = `#/${d.to}`; },
  more: () => {
    const extra = visible().filter((id) => !mobileRoutes().includes(id)).map((id) => [id, ROUTES[id]]);
    modal({
      title: "Más secciones",
      body: `<div class="grid grid-cols-3 gap-3">${extra.map(([id, r]) => `<a href="#/${id}" class="more-tile ${route === id ? "active" : ""}">${ic(r.icon, "w-6 h-6")}<span>${r.label}</span></a>`).join("")}</div>`
    });
  },
  "habit:new": () => A.habitForm(),
  "habit:toggle": (d) => A.toggleHabit(d.id, d.date || today()),
  "chore:new": () => A.choreForm(),
  "chore:toggle": (d) => A.toggleChore(d.id, d.date || today()),
  "tx:new": (d) => A.txForm(null, d.kind || "gasto", d.entity || "personal"),
  "workout:new": () => A.workoutForm(),
  "goal:new": (d) => A.goalForm(null, d.area),
  "commit:toggle": (d) => A.toggleCommitment(d.id),
  "task:new": () => A.taskForm(),
  "task:toggle": (d) => A.toggleTask(d.id),
  account: () => accountPicker(),
  switch: (d) => switchAccount(d.owner || null)
};

/* Acciones permitidas en modo solo lectura (navegación y consulta) */
const RO_OK = new Set(["go", "more", "filter", "tab", "range", "open", "open-session", "history", "account", "switch", "logout", "verify"]);

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el || el.disabled) return;
  const name = el.dataset.action;
  const v = ROUTES[route]?.view;
  const fn = v?.actions?.[name] || GLOBAL[name];
  if (!fn) return;
  e.preventDefault();
  if (DB.readOnly && !RO_OK.has(name)) { toast("Modo solo lectura: esta cuenta solo se puede consultar.", "info"); return; }
  Promise.resolve(fn({ ...el.dataset }, el, e)).catch((err) => { console.error(err); toast(err.message || "Algo salió mal", "error"); });
});
document.addEventListener("change", (e) => {
  const el = e.target.closest("[data-change]");
  if (!el) return;
  ROUTES[route]?.view?.changes?.[el.dataset.change]?.(el.value, el);
});
let inputT;
document.addEventListener("input", (e) => {
  const el = e.target.closest("[data-input]");
  if (!el) return;
  clearTimeout(inputT);
  inputT = setTimeout(() => ROUTES[route]?.view?.inputs?.[el.dataset.input]?.(el.value, el), 250);
});

/* ----------------------------- Bienvenida ------------------------------ */
function onboarding() {
  const name = DB.profile.name || DB.user?.displayName || "";
  const m = modal({
    title: "Bienvenido a RACK 21",
    size: "max-w-xl",
    body: `
      <div class="flex justify-center mb-5">${[1, 2, 3].map((n) => ball(n, { size: 40 })).join("")}</div>
      <p class="text-slate-300 mb-6 text-sm leading-relaxed">En los próximos 21 días va a construir una versión más saludable, ordenada y próspera de sí mismo. Cada día que cumpla su plan embocará una bola. Empecemos por lo esencial:</p>
      ${DB.mode === "firebase" && !DB.user.emailVerified ? `<div class="rounded-xl border border-violet-400/30 bg-violet-400/5 p-3 text-xs text-violet-100 mb-4">${ic("eye", "w-4 h-4 inline mr-1")}¿Alguien le compartió su cuenta para consultarla? Verifique su correo con el enlace que le enviamos y luego pulse <button type="button" class="link !text-xs" id="obVerify">Ya verifiqué mi correo</button>.</div>` : ""}
      <form id="obForm" class="space-y-4">
        <div><label class="label" for="ob_name">¿Cómo le gusta que le llamen?</label><input id="ob_name" name="name" class="input" required value="${esc(name)}"></div>
        <div><label class="label" for="ob_id">¿Quién quiere ser al día 21? <span class="text-slate-500">(identidad)</span></label><input id="ob_id" name="identity" class="input" placeholder="Soy una persona saludable, ordenada y dueña de sus números"></div>
        <div><label class="label" for="ob_why">¿Por qué es importante para usted?</label><textarea id="ob_why" name="why" rows="2" class="input" placeholder="Quiero tener más energía, la casa en orden y claridad en mis negocios"></textarea></div>
        <label class="flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 cursor-pointer">
          <input type="checkbox" name="seed" checked class="mt-1 w-4 h-4 accent-emerald-400">
          <span class="text-sm text-slate-200"><strong class="text-emerald-300">Cargar plan de arranque:</strong> 7 hábitos con ancla (Hábitos Atómicos) y 10 tareas típicas del hogar. Podrá editarlos o eliminarlos cuando quiera.</span></label>
        <label class="flex items-start gap-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3 cursor-pointer">
          <input type="checkbox" name="start" checked class="mt-1 w-4 h-4 accent-cyan-400">
          <span class="text-sm text-slate-200"><strong class="text-cyan-300">Iniciar el reto de 21 días hoy.</strong></span></label>
        <button class="btn btn-primary btn-lg w-full" type="submit">${ic("play", "w-5 h-5")}Empezar mi reto</button>
      </form>`
  });
  m.querySelector("[data-close]")?.remove();
  m.querySelector("#obVerify")?.addEventListener("click", async () => {
    if (await DB.reloadUser()) location.reload();
    else { try { await DB.resendVerification(); } catch {} toast("Aún no aparece verificado. Le reenviamos el correo de verificación.", "info"); }
  });
  m.querySelector("#obForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const sb = e.target.querySelector("button[type=submit]");
    if (sb.disabled) return;
    sb.disabled = true;
    const f = new FormData(e.target);
    const patch = { name: f.get("name"), identity: f.get("identity"), why: f.get("why"), onboarded: true, exerciseDaily: 30, exerciseWeekly: 180 };
    if (f.get("start")) patch.challengeStart = today();
    await DB.saveProfile(patch);
    if (f.get("seed") && !DB.data.habits.length) await A.seedStarter({ habits: true, chores: !DB.data.chores.length });
    closeModal();
    toast(`¡Excelente decisión, ${firstName(patch.name)}! La mesa está servida.`);
    A.changed();
  });
}

/* ------------------------------ Arranque ------------------------------ */
DB.init(async (user) => {
  if (!user) return renderAuth();
  app.innerHTML = splash("Preparando su mesa…");
  try {
    DB.sharedWithMe = await DB.listSharedWithMe();
    const saved = DB.savedContext();
    let ctx = DB.sharedWithMe.find((s) => s.ownerUid === saved) || null;
    await DB.useContext(ctx);
    // Quien solo tiene cuentas compartidas (sin cuenta propia configurada) entra directo en modo lectura
    if (!ctx && !DB.profile.onboarded && DB.sharedWithMe.length && saved === null) await DB.useContext(DB.sharedWithMe[0]);
  } catch (e) { console.error(e); toast("No se pudieron cargar los datos. Revise su conexión.", "error"); }
  start();
}).catch((e) => { console.error(e); app.innerHTML = splash("Error al iniciar Firebase. Revise js/config.js", true); });

/* ------------------------- Cuentas compartidas ------------------------- */
function start() {
  document.body.classList.toggle("ro", DB.readOnly);
  renderShell();
  if (!DB.readOnly && !DB.profile.onboarded) onboarding();
}

async function switchAccount(ownerUid) {
  closeModal();
  app.innerHTML = splash("Cambiando de cuenta…");
  const share = ownerUid ? DB.sharedWithMe.find((s) => s.ownerUid === ownerUid) : null;
  try { await DB.useContext(share); } catch (e) { console.error(e); toast("No fue posible abrir esa cuenta.", "error"); }
  location.hash = "#/inicio";
  start();
}

function accountPicker() {
  const opts = [{ ownerUid: "", ownerName: "Mi cuenta", modules: null, mine: true }, ...(DB.sharedWithMe || [])];
  modal({
    title: "Cambiar de cuenta",
    body: `<div class="space-y-2">${opts.map((o) => {
      const active = o.mine ? !DB.readOnly : DB.readOnly && DB.ownerUid === o.ownerUid;
      return `<button class="session ${active ? "session-on" : ""}" data-action="switch" data-owner="${esc(o.ownerUid)}">
        <span class="flex items-center gap-2 text-sm text-white">${ic(o.mine ? "user" : "eye", "w-4 h-4")}${esc(o.ownerName)}${o.mine ? "" : ' <span class="badge badge-later ml-1">Solo lectura</span>'}</span>
        ${o.mine ? `<span class="block text-[11px] text-slate-500 mt-0.5">Su propia cuenta, con acceso completo</span>` : `<span class="block text-[11px] text-slate-500 mt-0.5">${o.modules.length} módulos habilitados</span>`}
      </button>`;
    }).join("")}</div>`
  });
}
