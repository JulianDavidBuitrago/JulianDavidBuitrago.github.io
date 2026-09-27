/* RACK 21 · Componentes de interfaz */
import { esc, DOW } from "./utils.js";

export const icons = () => { try { window.lucide?.createIcons({ icons: window.lucide.icons }); } catch {} };
export const ic = (name, cls = "w-5 h-5") => `<i data-lucide="${name}" class="${cls}"></i>`;

/* ------------------------------- Toast ------------------------------- */
export function toast(msg, type = "ok") {
  const host = document.getElementById("toasts");
  const el = document.createElement("div");
  const color = type === "error" ? "border-rose-500/60 text-rose-100" : type === "info" ? "border-cyan-400/50 text-cyan-50" : "border-emerald-400/60 text-emerald-50";
  el.className = `toast glass border ${color} px-4 py-3 rounded-xl text-sm shadow-2xl flex items-center gap-3`;
  el.innerHTML = `${ic(type === "error" ? "circle-alert" : type === "info" ? "info" : "sparkles", "w-4 h-4 shrink-0")}<span>${esc(msg)}</span>`;
  host.appendChild(el);
  icons();
  setTimeout(() => { el.classList.add("toast-out"); setTimeout(() => el.remove(), 350); }, 3200);
}

/* ------------------------------- Modal ------------------------------- */
export function modal({ title, body, size = "max-w-lg", onMount }) {
  closeModal();
  const wrap = document.createElement("div");
  wrap.id = "modal";
  wrap.className = "fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4";
  wrap.innerHTML = `
    <div class="modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm" data-close></div>
    <div role="dialog" aria-modal="true" aria-label="${esc(title)}" class="modal-panel relative w-full ${size} glass-strong rounded-t-3xl sm:rounded-3xl border border-white/10 max-h-[92vh] flex flex-col">
      <div class="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3">
        <h3 class="font-display text-lg tracking-wide text-white">${esc(title)}</h3>
        <button class="icon-btn" data-close aria-label="Cerrar">${ic("x")}</button>
      </div>
      <div class="px-5 sm:px-6 pb-6 overflow-y-auto">${body}</div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeModal));
  document.addEventListener("keydown", escClose);
  icons();
  onMount?.(wrap);
  setTimeout(() => wrap.querySelector("input,select,textarea")?.focus(), 60);
  return wrap;
}
function escClose(e) { if (e.key === "Escape") closeModal(); }
export function closeModal() {
  document.getElementById("modal")?.remove();
  document.removeEventListener("keydown", escClose);
}

export function confirmDialog(text, { ok = "Eliminar", danger = true } = {}) {
  return new Promise((resolve) => {
    const m = modal({
      title: "Confirmar", size: "max-w-sm",
      body: `<p class="text-slate-300 mb-6">${esc(text)}</p>
        <div class="flex gap-3 justify-end">
          <button class="btn btn-ghost" data-no>Cancelar</button>
          <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-yes>${esc(ok)}</button>
        </div>`
    });
    m.querySelector("[data-no]").onclick = () => { closeModal(); resolve(false); };
    m.querySelector("[data-yes]").onclick = () => { closeModal(); resolve(true); };
  });
}

/* ---------------------------- Formularios ---------------------------- */
/* fields: [{ name, label, type, options, required, placeholder, hint, col, min, max, step }] */
export function formModal({ title, fields, values = {}, submit = "Guardar", onSubmit, size, intro = "" }) {
  const field = (f) => {
    const v = values[f.name] ?? f.default ?? "";
    const req = f.required ? "required" : "";
    const base = `id="f_${f.name}" name="${f.name}" ${req} placeholder="${esc(f.placeholder || "")}"`;
    let input;
    switch (f.type) {
      case "textarea":
        input = `<textarea ${base} rows="${f.rows || 3}" class="input">${esc(v)}</textarea>`; break;
      case "select":
        input = `<select ${base} class="input">${f.options.map((o) => {
          const [val, lab] = typeof o === "object" ? [o.v, o.l] : [o, o];
          return `<option value="${esc(val)}" ${String(val) === String(v) ? "selected" : ""}>${esc(lab)}</option>`;
        }).join("")}</select>`; break;
      case "range":
        input = `<div class="flex items-center gap-3"><input type="range" ${base} min="${f.min ?? 0}" max="${f.max ?? 100}" step="${f.step ?? 5}" value="${esc(v || 0)}" class="range flex-1" oninput="this.nextElementSibling.textContent=this.value+'${f.suffix ?? "%"}'"><span class="w-12 text-right font-mono text-cyan-300">${esc(v || 0)}${f.suffix ?? "%"}</span></div>`; break;
      case "days": {
        const sel = Array.isArray(v) && v.length ? v : [0, 1, 2, 3, 4, 5, 6];
        input = `<div class="flex flex-wrap gap-2" data-days="${f.name}">${[1, 2, 3, 4, 5, 6, 0].map((d) =>
          `<label class="day-chip"><input type="checkbox" value="${d}" ${sel.includes(d) ? "checked" : ""}><span>${DOW[d]}</span></label>`).join("")}</div>`; break;
      }
      case "color":
        input = `<div class="flex flex-wrap gap-2">${(f.options || []).map((c, i) =>
          `<label class="color-dot" style="--c:${c}"><input type="radio" name="${f.name}" value="${c}" ${(v || f.options[0]) === c ? "checked" : ""} aria-label="Color ${i + 1}"><span></span></label>`).join("")}</div>`; break;
      case "checkbox":
        input = `<label class="flex items-center gap-3 cursor-pointer"><input type="checkbox" name="${f.name}" ${v ? "checked" : ""} class="w-5 h-5 accent-emerald-400"><span class="text-sm text-slate-300">${esc(f.text || "")}</span></label>`; break;
      case "money":
        input = `<div class="relative"><span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span><input ${base} type="text" inputmode="numeric" value="${v ? Number(v).toLocaleString("es-CO") : ""}" class="input pl-7 font-mono" data-money></div>`; break;
      default:
        input = `<input ${base} type="${f.type || "text"}" value="${esc(v)}" class="input" ${f.min !== undefined ? `min="${f.min}"` : ""} ${f.max !== undefined ? `max="${f.max}"` : ""} ${f.step ? `step="${f.step}"` : ""}>`;
    }
    return `<div class="${f.col === "half" ? "sm:col-span-1" : "sm:col-span-2"}">
      ${f.type === "checkbox" ? "" : `<label for="f_${f.name}" class="label">${esc(f.label)}${f.required ? ' <span class="text-rose-400">*</span>' : ""}</label>`}
      ${input}
      ${f.hint ? `<p class="text-xs text-slate-500 mt-1.5">${f.hint}</p>` : ""}
    </div>`;
  };

  const m = modal({
    title, size,
    body: `${intro}<form class="grid sm:grid-cols-2 gap-4" novalidate>
      ${fields.map(field).join("")}
      <div class="sm:col-span-2 flex gap-3 justify-end pt-2">
        <button type="button" class="btn btn-ghost" data-close-form>Cancelar</button>
        <button type="submit" class="btn btn-primary">${ic("check", "w-4 h-4")}<span>${esc(submit)}</span></button>
      </div>
    </form>`
  });
  const form = m.querySelector("form");
  m.querySelector("[data-close-form]").onclick = closeModal;
  form.querySelectorAll("[data-money]").forEach((inp) => inp.addEventListener("input", () => {
    const d = inp.value.replace(/\D/g, "");
    inp.value = d ? Number(d).toLocaleString("es-CO") : "";
  }));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const out = {};
    for (const f of fields) {
      if (f.type === "days") out[f.name] = [...form.querySelectorAll(`[data-days="${f.name}"] input:checked`)].map((i) => Number(i.value));
      else if (f.type === "checkbox") out[f.name] = form.querySelector(`[name="${f.name}"]`).checked;
      else if (f.type === "color") out[f.name] = form.querySelector(`[name="${f.name}"]:checked`)?.value;
      else {
        const el = form.querySelector(`[name="${f.name}"]`);
        let val = el.value.trim();
        if (f.type === "money") val = Number(val.replace(/\D/g, "")) || 0;
        else if (f.type === "number" || f.type === "range") val = val === "" ? null : Number(val);
        out[f.name] = val;
      }
      if (f.required && (out[f.name] === "" || out[f.name] === null || (f.type === "money" && !out[f.name]))) {
        const el = form.querySelector(`[name="${f.name}"]`);
        el?.classList.add("input-error"); el?.focus();
        toast(`Complete el campo “${f.label}”`, "error");
        return;
      }
    }
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    try { await onSubmit(out); closeModal(); }
    catch (err) { console.error(err); toast(err.message || "No se pudo guardar", "error"); btn.disabled = false; }
  });
  return m;
}

/* ------------------------- Piezas visuales -------------------------- */
export function ball(n, { size = 36, color, pocketed = true, label } = {}) {
  const colors = { 1: "#f5c518", 2: "#2f6fdf", 3: "#e0373d", 4: "#7b3fe4", 5: "#f07c1b", 6: "#1f9d55", 7: "#9b2335", 8: "#111" };
  const c = color || colors[((n - 1) % 8) + 1];
  const stripe = n > 8 && n < 16;
  const id = `g${Math.random().toString(36).slice(2, 7)}`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" class="ball ${pocketed ? "" : "ball-off"}" aria-label="${esc(label || `Bola ${n}`)}" role="img">
    <defs><radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#fff" stop-opacity=".55"/><stop offset="35%" stop-color="#fff" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".45"/></radialGradient><clipPath id="${id}c"><circle cx="20" cy="20" r="19"/></clipPath></defs>
    ${stripe ? `<g clip-path="url(#${id}c)"><rect width="40" height="40" fill="#f3f1ea"/><rect x="0" y="10" width="40" height="20" fill="${c}"/></g>` : `<circle cx="20" cy="20" r="19" fill="${c}"/>`}
    <circle cx="20" cy="20" r="8.2" fill="#f7f5ee"/>
    <text x="20" y="20.5" text-anchor="middle" dominant-baseline="middle" font-size="${n > 9 ? 8.5 : 10}" font-weight="700" fill="#111" font-family="JetBrains Mono, monospace">${n}</text>
    <circle cx="20" cy="20" r="19" fill="url(#${id})"/>
  </svg>`;
}

export function ring(value, { size = 120, stroke = 10, color = "url(#ringGrad)", label = "", sub = "" } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.min(100, Math.max(0, value || 0)) / 100);
  return `<div class="relative inline-grid place-items-center" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" class="-rotate-90">
      <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#22d3ee"/></linearGradient></defs>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="rgba(255,255,255,.08)" stroke-width="${stroke}" fill="none"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color}" stroke-width="${stroke}" fill="none" stroke-linecap="round"
        stroke-dasharray="${c}" stroke-dashoffset="${c}" class="ring-anim" style="--off:${off}"/>
    </svg>
    <div class="absolute text-center"><div class="font-display text-2xl text-white" data-count="${Math.round(value || 0)}" data-suffix="${label}">0${label}</div>${sub ? `<div class="text-[10px] uppercase tracking-widest text-slate-400">${sub}</div>` : ""}</div>
  </div>`;
}

export function countUp(root = document) {
  root.querySelectorAll("[data-count]").forEach((el) => {
    const target = Number(el.dataset.count), suffix = el.dataset.suffix || "", fmt = el.dataset.fmt;
    const t0 = performance.now(), dur = 900;
    const compact = window.innerWidth < 640 && Math.abs(target) >= 1e6;
    const f = (x) => fmt === "money" ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: compact ? 1 : 0, notation: compact ? "compact" : "standard" }).format(x) : Math.round(x).toLocaleString("es-CO");
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = f(target * e) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

export const empty = (icon, title, text, action = "") => `
  <div class="card text-center py-12 px-6">
    <div class="mx-auto w-16 h-16 rounded-2xl bg-emerald-400/10 grid place-items-center text-emerald-300 mb-4 glow-soft">${ic(icon, "w-8 h-8")}</div>
    <h3 class="font-display text-white text-lg mb-1">${esc(title)}</h3>
    <p class="text-slate-400 text-sm max-w-md mx-auto mb-5">${text}</p>${action}
  </div>`;

export const sectionHead = (title, subtitle, actions = "") => `
  <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 reveal">
    <div>
      <h1 class="font-display text-2xl sm:text-3xl text-white tracking-wide">${title}</h1>
      <p class="text-slate-400 mt-1 text-sm sm:text-base">${subtitle}</p>
    </div>
    <div class="flex flex-wrap gap-2">${actions}</div>
  </div>`;

export function confetti() {
  const host = document.createElement("div");
  host.className = "pointer-events-none fixed inset-0 z-[70] overflow-hidden";
  const colors = ["#f5c518", "#2f6fdf", "#e0373d", "#7b3fe4", "#f07c1b", "#1f9d55", "#22d3ee"];
  for (let i = 0; i < 40; i++) {
    const s = document.createElement("span");
    s.className = "confetti";
    s.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${Math.random() * 0.3}s;animation-duration:${1.2 + Math.random()}s`;
    host.appendChild(s);
  }
  document.body.appendChild(host);
  setTimeout(() => host.remove(), 2600);
}
