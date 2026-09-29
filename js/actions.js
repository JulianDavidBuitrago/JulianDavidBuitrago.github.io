/* =====================================================================
   RACK 21 · Acciones CRUD compartidas por todas las vistas
   ===================================================================== */
import { DB } from "./store.js";
import { today, esc, toISO, weekday } from "./utils.js";
import { formModal, confirmDialog, toast, confetti } from "./ui.js";
import {
  AREAS, TX_CATEGORIES, WORKOUT_TYPES, FREQUENCIES, STARTER_HABITS, STARTER_CHORES,
  TASK_STATUS, TASK_PRIORITY, DURATION_UNITS, RECURRENCE, recurrence, recurrenceLabel,
  logId, habitDone, choreDoneOn, dayScore, challenge
} from "./logic.js";
import { APP } from "./config.js";
import { cheer } from "./carnegie.js";

export const changed = () => window.dispatchEvent(new CustomEvent("rack:changed"));

const areaOpts = AREAS.map((a) => ({ v: a.id, l: a.label }));
export const BUSINESS_COLORS = ["#22d3ee", "#34d399", "#f5c518", "#f07c1b", "#e0373d", "#7b3fe4", "#2f6fdf", "#ec4899"];

/* ------------------------------ Hábitos ------------------------------ */
export function habitForm(h = null) {
  formModal({
    title: h ? "Editar hábito" : "Nuevo hábito atómico",
    size: "max-w-2xl",
    intro: `<div class="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 mb-5 text-sm text-emerald-100/90">
      <strong class="text-emerald-300">Fórmula del ancla:</strong> “Después de <em>[lo que ya hace todos los días]</em>, haré <em>[nuevo hábito]</em>”.
      Hágalo obvio, atractivo, sencillo y satisfactorio.</div>`,
    values: h || {},
    fields: [
      { name: "name", label: "Hábito", required: true, placeholder: "Ej.: Entrenar 30 minutos", col: "half" },
      { name: "area", label: "Área de vida", type: "select", options: areaOpts, col: "half" },
      { name: "anchor", label: "Ancla · Después de…", placeholder: "Ej.: llegar a casa y dejar las llaves", hint: "Un hábito que ya hace todos los días, sin falta.", required: true },
      { name: "identity", label: "Identidad · Soy una persona que…", placeholder: "Ej.: Soy un atleta en construcción" },
      { name: "time", label: "1ª ley · Obvio: hora", type: "time", col: "half" },
      { name: "place", label: "1ª ley · Obvio: lugar", placeholder: "Ej.: Sala, junto a la puerta", col: "half" },
      { name: "bundle", label: "2ª ley · Atractivo: mientras lo hago disfrutaré…", placeholder: "Ej.: mi playlist favorita de salsa" },
      { name: "twoMin", label: "3ª ley · Sencillo: versión de 2 minutos", placeholder: "Ej.: Ponerme la ropa de entrenamiento", hint: "El día difícil, con esto basta para no romper la racha." },
      { name: "reward", label: "4ª ley · Satisfactorio: recompensa inmediata", placeholder: "Ej.: Ducha caliente y marcarlo en RACK 21" },
      { name: "days", label: "Días", type: "days" }
    ],
    onSubmit: async (v) => {
      if (h) await DB.update("habits", h.id, v);
      else await DB.add("habits", { ...v, active: true, startDate: today() });
      toast(h ? "Hábito actualizado" : "Hábito creado. ¡Su nueva ancla está lista!");
      changed();
    }
  });
}

export async function toggleHabit(id, date = today()) {
  const h = DB.data.habits.find((x) => x.id === id);
  if (!h) return;
  const lid = logId(id, date);
  const before = challenge()?.days.find((d) => d.date === date)?.pocketed;
  if (habitDone(h, date)) {
    await DB.remove("habitLogs", lid);
  } else {
    await DB.set("habitLogs", lid, { habitId: id, date, ts: Date.now() });
    toast(cheer());
  }
  celebrateIfPocketed(date, before);
  changed();
}

let seeding = false;
export async function seedStarter({ habits = true, chores = true } = {}) {
  if (seeding) return;
  seeding = true;
  try {
    const t = today();
    const norm = (s) => (s || "").trim().toLowerCase();
    const hasH = new Set(DB.data.habits.map((h) => norm(h.name)));
    const hasC = new Set(DB.data.chores.map((c) => norm(c.name)));
    if (habits) for (const h of STARTER_HABITS) if (!hasH.has(norm(h.name))) await DB.add("habits", { ...h, active: true, days: [0, 1, 2, 3, 4, 5, 6], startDate: t });
    if (chores) for (const c of STARTER_CHORES) if (!hasC.has(norm(c.name))) await DB.add("chores", { ...c, active: true, startDate: t });
  } finally { seeding = false; }
  changed();
}

/* ------------------------------- Hogar ------------------------------- */
export function choreForm(c = null) {
  const r = c ? recurrence(c) : { type: "dias", days: [weekday(today())], every: 2, monthDay: Number(today().slice(8)) };
  const base = { rtype: r.type, days: r.days, everyWeeks: r.type === "semanas" ? r.every : 2, everyDays: r.type === "intervalo" ? r.every : 3, monthDay: r.monthDay };
  const vals = c ? { ...c, ...base } : { ...base, minutes: 15 };
  formModal({
    title: c ? "Editar tarea del hogar" : "Nueva tarea del hogar",
    values: vals,
    fields: [
      { name: "name", label: "Tarea", required: true, placeholder: "Ej.: Sacar la basura, Pagar facturas" },
      { name: "rtype", label: "¿Cada cuánto se hace?", type: "select", options: RECURRENCE },
      { name: "days", label: "¿Qué días?", type: "days", when: { rtype: ["dias", "semanas"] }, hint: "Ej.: sacar la basura miércoles y sábado." },
      { name: "everyWeeks", label: "Cada cuántas semanas", type: "number", min: 1, max: 12, col: "half", when: { rtype: ["semanas"] } },
      { name: "everyDays", label: "Cada cuántos días", type: "number", min: 1, max: 90, col: "half", when: { rtype: ["intervalo"] } },
      { name: "monthDay", label: "Día del mes", type: "number", min: 1, max: 31, col: "half", when: { rtype: ["mensual"] }, hint: "Si el mes es más corto, se programa el último día." },
      { name: "minutes", label: "Minutos estimados", type: "number", min: 1, col: "half" },
      { name: "anchor", label: "Ancla · Después de…", placeholder: "Ej.: poner la lavadora", hint: "Enganche la tarea a algo que ya hace para no tener que acordarse." }
    ],
    onSubmit: async (v) => {
      if (["dias", "semanas"].includes(v.rtype) && !v.days?.length) throw new Error("Elija al menos un día de la semana");
      const rec = { name: v.name, rtype: v.rtype, days: ["dias", "semanas"].includes(v.rtype) ? v.days : [], every: Math.max(1, Number(v.rtype === "semanas" ? v.everyWeeks : v.everyDays) || 1), monthDay: Math.min(31, Math.max(1, Number(v.monthDay) || 1)), minutes: v.minutes, anchor: v.anchor, freq: null };
      if (c) await DB.update("chores", c.id, rec);
      else await DB.add("chores", { ...rec, active: true, startDate: today() });
      toast(c ? "Tarea actualizada" : `Tarea creada · ${recurrenceLabel(rec)}`);
      changed();
    }
  });
}

export async function toggleChore(id, date = today()) {
  const c = DB.data.chores.find((x) => x.id === id);
  if (!c) return;
  const lid = `${id}_${date}`;
  const before = challenge()?.days.find((d) => d.date === date)?.pocketed;
  if (choreDoneOn(c, date)) await DB.remove("choreLogs", lid);
  else { await DB.set("choreLogs", lid, { choreId: id, date, ts: Date.now() }); toast(`¡${c.name}: listo! Casa en orden, mente en orden.`); }
  celebrateIfPocketed(date, before);
  changed();
}

/* ------------------------------ Finanzas ----------------------------- */
export function businessForm(b = null) {
  formModal({
    title: b ? "Editar negocio" : "Nuevo negocio",
    values: b || {},
    fields: [
      { name: "name", label: "Nombre del negocio", required: true, placeholder: "Ej.: Billar El Taco de Oro" },
      { name: "kind", label: "Tipo / sector", placeholder: "Ej.: Comercio, servicios, arriendo…", col: "half" },
      { name: "monthlyGoal", label: "Meta de utilidad mensual", type: "money", col: "half" },
      { name: "color", label: "Color", type: "color", options: BUSINESS_COLORS },
      { name: "notes", label: "Notas", type: "textarea", rows: 2 }
    ],
    onSubmit: async (v) => {
      if (b) await DB.update("businesses", b.id, v);
      else await DB.add("businesses", { ...v, active: true });
      toast(b ? "Negocio actualizado" : "Negocio creado. Registre su primer movimiento.");
      changed();
    }
  });
}

export async function deleteBusiness(id) {
  const n = DB.data.transactions.filter((t) => t.entity === id).length;
  const ok = await confirmDialog(n ? `Este negocio tiene ${n} movimientos. Se eliminarán también. ¿Continuar?` : "¿Eliminar este negocio?");
  if (!ok) return;
  await DB.removeWhere("transactions", (t) => t.entity === id);
  await DB.remove("businesses", id);
  toast("Negocio eliminado", "info");
  changed();
}

export function txForm(t = null, kind = "gasto", entity = "personal") {
  const k = t?.kind || kind;
  const ents = [{ v: "personal", l: "Personal" }, ...DB.data.businesses.map((b) => ({ v: b.id, l: b.name }))];
  const m = formModal({
    title: t ? "Editar movimiento" : k === "ingreso" ? "Registrar ingreso" : "Registrar gasto",
    values: t || { kind: k, date: today(), entity, category: TX_CATEGORIES[k][0] },
    fields: [
      { name: "kind", label: "Tipo", type: "select", options: [{ v: "ingreso", l: "Ingreso" }, { v: "gasto", l: "Gasto" }], col: "half" },
      { name: "amount", label: "Valor", type: "money", required: true, col: "half" },
      { name: "entity", label: "¿De quién es?", type: "select", options: ents, col: "half" },
      { name: "date", label: "Fecha", type: "date", required: true, col: "half" },
      { name: "category", label: "Categoría", type: "select", options: TX_CATEGORIES[k] },
      { name: "method", label: "Medio de pago", type: "select", options: ["Efectivo", "Transferencia", "Tarjeta débito", "Tarjeta crédito", "Nequi / Daviplata", "Otro"], col: "half" },
      { name: "note", label: "Descripción", placeholder: "Ej.: Venta del día, pago proveedor…", col: "half" }
    ],
    onSubmit: async (v) => {
      if (TX_CATEGORIES[v.kind] && !TX_CATEGORIES[v.kind].includes(v.category)) v.category = TX_CATEGORIES[v.kind][TX_CATEGORIES[v.kind].length - 1];
      if (t) await DB.update("transactions", t.id, v);
      else await DB.add("transactions", v);
      toast(v.kind === "ingreso" ? "Ingreso registrado. ¡Así se conocen los números!" : "Gasto registrado. Lo que se mide, se mejora.");
      changed();
    }
  });
  const kSel = m.querySelector('[name="kind"]'), cSel = m.querySelector('[name="category"]');
  kSel.addEventListener("change", () => {
    cSel.innerHTML = TX_CATEGORIES[kSel.value].map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  });
}

/* ------------------------------ Ejercicio ---------------------------- */
export function workoutForm(w = null) {
  formModal({
    title: w ? "Editar entrenamiento" : "Registrar entrenamiento",
    values: w || { date: today(), type: WORKOUT_TYPES[0], minutes: 30, intensity: 3 },
    fields: [
      { name: "type", label: "Actividad", type: "select", options: WORKOUT_TYPES, col: "half" },
      { name: "date", label: "Fecha", type: "date", required: true, col: "half" },
      { name: "minutes", label: "Minutos", type: "number", min: 1, required: true, col: "half" },
      { name: "intensity", label: "Intensidad (1 a 5)", type: "range", min: 1, max: 5, step: 1, suffix: "", col: "half" },
      { name: "notes", label: "Notas", type: "textarea", rows: 2, placeholder: "Ej.: 4x10 sentadillas, 3 km trote, 2 horas de billar a tres bandas…" }
    ],
    onSubmit: async (v) => {
      const before = challenge()?.days.find((d) => d.date === v.date)?.pocketed;
      if (w) await DB.update("workouts", w.id, v);
      else await DB.add("workouts", v);
      toast(w ? "Entrenamiento actualizado" : `¡${v.minutes} minutos sumados! Pulso firme, cuerpo fuerte.`);
      celebrateIfPocketed(v.date, before);
      changed();
    }
  });
}

/* ------------------------------- Metas ------------------------------- */
export function goalForm(g = null, area = "personal") {
  formModal({
    title: g ? "Editar meta" : "Nueva meta de vida",
    size: "max-w-2xl",
    values: g || { area, progress: 0, status: "activa" },
    fields: [
      { name: "title", label: "Meta", required: true, placeholder: "Ej.: Bajar 4 kg / Ahorrar 2 millones / Terminar curso de inglés" },
      { name: "area", label: "Área", type: "select", options: areaOpts, col: "half" },
      { name: "deadline", label: "Fecha límite", type: "date", col: "half" },
      { name: "why", label: "¿Por qué es importante para usted?", type: "textarea", rows: 2, hint: "Un porqué fuerte hace atractivo el camino (Carnegie: despierte un deseo vehemente)." },
      { name: "nextAction", label: "Siguiente acción concreta", placeholder: "Ej.: Pedir cita con nutricionista el lunes" },
      { name: "progress", label: "Avance", type: "range", min: 0, max: 100, step: 5, col: "half" },
      { name: "status", label: "Estado", type: "select", options: [{ v: "activa", l: "Activa" }, { v: "lograda", l: "Lograda" }, { v: "pausada", l: "Pausada" }], col: "half" }
    ],
    onSubmit: async (v) => {
      if (v.progress >= 100) v.status = "lograda";
      if (g) await DB.update("goals", g.id, v);
      else await DB.add("goals", v);
      if (v.status === "lograda" && g?.status !== "lograda") { confetti(); toast("¡Meta lograda! Esto merece celebrarse."); }
      else toast(g ? "Meta actualizada" : "Meta creada. Ahora, ¿cuál es el primer paso?");
      changed();
    }
  });
}

/* ---------------------------- Compromisos ---------------------------- */
export async function addCommitment(text, source = "coach") {
  await DB.add("commitments", { text, source, date: today(), done: false });
  toast("Compromiso guardado en su tablero");
  changed();
}
export async function toggleCommitment(id) {
  const c = DB.data.commitments.find((x) => x.id === id);
  if (!c) return;
  await DB.update("commitments", id, { done: !c.done, doneAt: !c.done ? Date.now() : null });
  if (!c.done) toast("¡Compromiso cumplido! Palabra de campeón.");
  changed();
}

/* ---------------------------- Genéricos ------------------------------ */
export async function removeItem(col, id, label = "este registro") {
  if (!(await confirmDialog(`¿Eliminar ${label}? Esta acción no se puede deshacer.`))) return;
  await DB.remove(col, id);
  if (col === "habits") await DB.removeWhere("habitLogs", (l) => l.habitId === id);
  if (col === "chores") await DB.removeWhere("choreLogs", (l) => l.choreId === id);
  toast("Eliminado", "info");
  changed();
}

function celebrateIfPocketed(date, before) {
  const ch = challenge();
  const d = ch?.days.find((x) => x.date === date);
  if (d && d.pocketed && !before) {
    confetti();
    toast(`¡Bola ${d.n} embocada! Superó el ${APP.dayGoal} % del día.`);
  }
}

export async function startChallenge(date = today()) {
  await DB.saveProfile({ challengeStart: date });
  toast("¡Reto de 21 días iniciado! La mesa está servida.");
  changed();
}

/* ------------------------- Tareas únicas ---------------------------- */
export function taskForm(t = null) {
  formModal({
    title: t ? "Editar tarea" : "Nueva tarea",
    size: "max-w-2xl",
    values: t || { area: "personal", priority: "media", status: "pendiente", durationUnit: "min", dueDate: today() },
    fields: [
      { name: "title", label: "Tarea", required: true, placeholder: "Ej.: Renovar el SOAT de la moto" },
      { name: "description", label: "Descripción", type: "textarea", rows: 2, placeholder: "Detalles, pasos o notas" },
      { name: "area", label: "Área", type: "select", options: areaOpts, col: "half" },
      { name: "priority", label: "Prioridad", type: "select", options: TASK_PRIORITY, col: "half" },
      { name: "dueDate", label: "Fecha de finalización", type: "date", required: true, col: "half" },
      { name: "status", label: "Estado", type: "select", options: TASK_STATUS, col: "half" },
      { name: "duration", label: "Duración estimada", type: "number", min: 0, step: "any", col: "half" },
      { name: "durationUnit", label: "Unidad", type: "select", options: DURATION_UNITS, col: "half" }
    ],
    onSubmit: async (v) => {
      const wasDone = t?.status === "completada";
      if (v.status === "completada" && !wasDone) v.completedAt = Date.now();
      if (v.status !== "completada") v.completedAt = null;
      if (t) await DB.update("tasks", t.id, v);
      else await DB.add("tasks", v);
      toast(t ? "Tarea actualizada" : "Tarea creada. ¿Cuál es el primer paso?");
      changed();
    }
  });
}

export async function toggleTask(id) {
  const t = DB.data.tasks.find((x) => x.id === id);
  if (!t) return;
  const done = t.status === "completada";
  const items = (t.items || []).map((x) => ({ ...x, done: done ? x.done : true }));
  await DB.update("tasks", id, { status: done ? (items.some((x) => x.done) ? "en_progreso" : "pendiente") : "completada", completedAt: done ? null : Date.now(), items });
  if (!done) toast(`¡“${t.title}” completada! Una cosa menos en la mesa.`);
  changed();
}

export async function cycleTaskStatus(id) {
  const t = DB.data.tasks.find((x) => x.id === id);
  if (!t) return;
  const order = ["pendiente", "en_progreso", "completada"];
  const next = order[(order.indexOf(t.status || "pendiente") + 1) % order.length];
  await DB.update("tasks", id, { status: next, completedAt: next === "completada" ? Date.now() : null, items: next === "completada" ? (t.items || []).map((x) => ({ ...x, done: true })) : (t.items || []) });
  changed();
}
