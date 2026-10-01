/* =====================================================================
   RACK 21 · Reglas de negocio
   Puntajes diarios, rachas, tareas del hogar, finanzas y reto de 21 días.
   ===================================================================== */
import { APP } from "./config.js";
import { DB } from "./store.js";
import {
  today, addDays, diffDays, dateRange, lastNDays, weekday, monthKey, sum, groupBy, toISO, parseISO
} from "./utils.js";

/* --------------------------- Catálogos base --------------------------- */
export const AREAS = [
  { id: "salud",      label: "Salud y ejercicio", ball: 1,  color: "#f5c518", icon: "dumbbell" },
  { id: "laboral",    label: "Laboral",           ball: 2,  color: "#2f6fdf", icon: "briefcase" },
  { id: "hogar",      label: "Hogar",             ball: 3,  color: "#e0373d", icon: "house" },
  { id: "academica",  label: "Académica",         ball: 4,  color: "#7b3fe4", icon: "graduation-cap" },
  { id: "personal",   label: "Personal",          ball: 5,  color: "#f07c1b", icon: "user" },
  { id: "financiera", label: "Financiera",        ball: 6,  color: "#1f9d55", icon: "piggy-bank" },
  { id: "relaciones", label: "Relaciones",        ball: 7,  color: "#9b2335", icon: "heart" }
];
export const areaOf = (id) => AREAS.find((a) => a.id === id) || AREAS[4];

export const TX_CATEGORIES = {
  ingreso: ["Ventas", "Servicios", "Honorarios / salario", "Inversiones", "Préstamo recibido", "Otros ingresos"],
  gasto: ["Mercancía / inventario", "Nómina", "Arriendo", "Servicios públicos", "Transporte", "Alimentación",
    "Salud", "Educación", "Billar y ocio", "Impuestos", "Mantenimiento", "Publicidad", "Deudas", "Hogar", "Otros gastos"]
};

export const WORKOUT_TYPES = ["Fuerza", "Cardio", "Caminata", "Billar", "Movilidad / estiramiento", "Deporte", "Bicicleta", "Natación"];

export const FREQUENCIES = [
  { v: 1, l: "Diaria" }, { v: 2, l: "Cada 2 días" }, { v: 3, l: "Cada 3 días" },
  { v: 4, l: "Cada 4 días" }, { v: 7, l: "Semanal" }, { v: 14, l: "Quincenal" }, { v: 30, l: "Mensual" }
];

export const LEVELS = [
  { min: 0,    name: "Aprendiz de mesa" },
  { min: 300,  name: "Taco firme" },
  { min: 800,  name: "Tiro limpio" },
  { min: 1600, name: "Maestro de banda" },
  { min: 2800, name: "Rey de la carambola" },
  { min: 4500, name: "Leyenda de la bola 8" }
];

/* Plan de arranque: hábitos con ancla (Hábitos Atómicos) */
export const STARTER_HABITS = [
  { name: "Tomar un vaso de agua", area: "salud", anchor: "apagar la alarma", twoMin: "Servir el vaso la noche anterior en la mesa de noche", place: "Habitación", time: "06:00", reward: "Marcar el día en RACK 21", identity: "Soy una persona que cuida su cuerpo desde el primer minuto" },
  { name: "Planear el día en 3 prioridades", area: "personal", anchor: "servir el primer café", twoMin: "Escribir solo la prioridad número 1", place: "Cocina", time: "06:30", reward: "Disfrutar el café en calma", identity: "Soy una persona organizada que decide su día" },
  { name: "Entrenar", area: "salud", anchor: "llegar a casa y dejar las llaves", twoMin: "Ponerme la ropa de entrenamiento", place: "Casa / gimnasio", time: "18:00", reward: "Ducha caliente y música favorita", identity: "Soy un atleta en construcción" },
  { name: "Registrar ingresos y gastos del día", area: "financiera", anchor: "cerrar caja en cada negocio", twoMin: "Registrar un solo movimiento", place: "Negocio", time: "20:00", reward: "Ver el balance del día en verde", identity: "Soy un empresario que conoce sus números" },
  { name: "Lavar la loza que usé", area: "hogar", anchor: "terminar de comer", twoMin: "Lavar solo el plato y el vaso", place: "Cocina", time: "13:30", reward: "Cocina limpia al llegar", identity: "Soy una persona que vive en orden" },
  { name: "Leer 10 páginas", area: "academica", anchor: "cepillarme los dientes en la noche", twoMin: "Leer una página", place: "Habitación", time: "21:30", reward: "Una partida corta de billar el fin de semana por cada 5 días cumplidos", identity: "Soy un aprendiz permanente" },
  { name: "Estirar 5 minutos", area: "salud", anchor: "terminar una sesión de billar", twoMin: "Un estiramiento de espalda", place: "Donde juegue", time: "", reward: "Espalda sin dolor para la próxima partida", identity: "Soy un jugador que cuida su postura" }
];

export const STARTER_CHORES = [
  { name: "Tender la cama", rtype: "diaria", minutes: 3, anchor: "levantarme" },
  { name: "Lavar la loza", rtype: "diaria", minutes: 15, anchor: "terminar la cena" },
  { name: "Sacar la basura", rtype: "dias", days: [3, 6], minutes: 5, anchor: "salir de casa en la mañana" },
  { name: "Barrer", rtype: "dias", days: [1, 4], minutes: 15, anchor: "llegar del trabajo" },
  { name: "Trapear", rtype: "dias", days: [4], minutes: 20, anchor: "terminar de barrer" },
  { name: "Lavar la ropa", rtype: "dias", days: [6], minutes: 40, anchor: "desayunar el sábado" },
  { name: "Lavar los baños", rtype: "dias", days: [6], minutes: 30, anchor: "poner la lavadora" },
  { name: "Limpiar la cocina a fondo", rtype: "dias", days: [0], minutes: 30, anchor: "terminar el almuerzo del domingo" },
  { name: "Cambiar sábanas y toallas", rtype: "semanas", every: 2, days: [0], minutes: 15, anchor: "lavar la ropa" },
  { name: "Pagar facturas de servicios", rtype: "mensual", monthDay: 5, minutes: 20, anchor: "recibir el pago del mes" },
  { name: "Limpiar la nevera", rtype: "mensual", monthDay: 1, minutes: 25, anchor: "hacer el mercado" }
];

/* -------------------------------- Hábitos ------------------------------ */
const createdISO = (r) => (r.startDate || (r.createdAt ? toISO(r.createdAt) : today()));

export const habitScheduled = (h, date) =>
  h.active !== false && date >= createdISO(h) && (h.days?.length ? h.days.includes(weekday(date)) : true);

export const logId = (hid, date) => `${hid}_${date}`;
export const habitDone = (h, date) => DB.data.habitLogs.some((l) => l.habitId === h.id && l.date === date);

export function habitStreak(h) {
  let d = today(), streak = 0, guard = 0;
  if (!habitDone(h, d)) d = addDays(d, -1);
  while (guard++ < 400) {
    if (d < createdISO(h)) break;
    if (!habitScheduled(h, d)) { d = addDays(d, -1); continue; }
    if (habitDone(h, d)) { streak++; d = addDays(d, -1); } else break;
  }
  return streak;
}

export function habitRate(h, days) {
  const sched = days.filter((d) => habitScheduled(h, d));
  if (!sched.length) return null;
  return (sched.filter((d) => habitDone(h, d)).length / sched.length) * 100;
}

/* Regla "nunca fallar dos veces" */
export const missedYesterday = (h) => {
  const y = addDays(today(), -1);
  return habitScheduled(h, y) && !habitDone(h, y);
};

/* ------------------------------ Hogar --------------------------------- */
const choreLogs = (c) => DB.data.choreLogs.filter((l) => l.choreId === c.id).map((l) => l.date).sort();

export function choreLastDoneBefore(c, date) {
  const ls = choreLogs(c).filter((d) => d < date);
  return ls.length ? ls[ls.length - 1] : null;
}
export const choreDoneOn = (c, date) => DB.data.choreLogs.some((l) => l.choreId === c.id && l.date === date);

/* Recurrencia de las tareas del hogar
   rtype: "diaria" | "dias" (días de la semana) | "semanas" (cada N semanas en días elegidos)
          | "mensual" (día fijo del mes) | "intervalo" (cada N días desde la última vez)
   Las tareas antiguas (solo "freq") se interpretan automáticamente. */
export const RECURRENCE = [
  { v: "diaria", l: "Todos los días" },
  { v: "dias", l: "Días específicos de la semana" },
  { v: "semanas", l: "Cada N semanas (en los días elegidos)" },
  { v: "mensual", l: "Una vez al mes (día fijo)" },
  { v: "anual", l: "Una vez al año (fecha fija)" },
  { v: "intervalo", l: "Cada N días desde la última vez" }
];

export function recurrence(c) {
  if (c.rtype) return { type: c.rtype, days: (c.days || []).map(Number), every: Math.max(1, Number(c.every || 1)), monthDay: Math.min(31, Math.max(1, Number(c.monthDay || 1))), month: Math.min(12, Math.max(1, Number(c.month || 1))) };
  const f = Number(c.freq || 1), start = createdISO(c), wd = weekday(start);
  if (f <= 1) return { type: "diaria", days: [], every: 1, monthDay: 1 };
  if (f === 7) return { type: "dias", days: [wd], every: 1, monthDay: 1 };
  if (f === 14) return { type: "semanas", days: [wd], every: 2, monthDay: 1 };
  if (f >= 28) return { type: "mensual", days: [], every: 1, monthDay: Number(start.slice(8)) };
  return { type: "intervalo", days: [], every: f, monthDay: 1 };
}

export const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const joinY = (a) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} y ${a[a.length - 1]}` : a[0] || "");
export function recurrenceLabel(c) {
  const r = recurrence(c);
  const dn = [1, 2, 3, 4, 5, 6, 0].filter((d) => r.days.includes(d)).map((d) => DAY_NAMES[d]);
  switch (r.type) {
    case "diaria": return "Todos los días";
    case "dias": return dn.length === 7 ? "Todos los días" : dn.length ? `Cada ${joinY(dn)}` : "Sin días elegidos";
    case "semanas": return `Cada ${r.every} semanas · ${joinY(dn) || "sin día"}`;
    case "mensual": return `Cada mes · día ${r.monthDay}`;
    case "anual": return `Cada año · ${r.monthDay} de ${MONTH_NAMES[r.month - 1]}`;
    default: return r.every === 1 ? "Todos los días" : `Cada ${r.every} días`;
  }
}
/* Compatibilidad con código anterior */
export const freqLabel = (v) => (typeof v === "object" ? recurrenceLabel(v) : FREQUENCIES.find((f) => f.v === Number(v))?.l || `Cada ${v} días`);

const mondayOf = (iso) => { const d = weekday(iso); return addDays(iso, d === 0 ? -6 : 1 - d); };
const lastDayOfMonth = (iso) => { const d = parseISO(iso); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); };

/* ¿La tarea está programada para esa fecha? (tipos con calendario fijo) */
export function occursOn(c, date) {
  if (c.active === false || date < createdISO(c)) return false;
  const r = recurrence(c);
  switch (r.type) {
    case "diaria": return true;
    case "dias": return r.days.includes(weekday(date));
    case "semanas": {
      if (!r.days.includes(weekday(date))) return false;
      const w = Math.round(diffDays(mondayOf(date), mondayOf(createdISO(c))) / 7);
      return w % r.every === 0;
    }
    case "mensual": return Number(date.slice(8)) === Math.min(r.monthDay, lastDayOfMonth(date));
    case "anual": return Number(date.slice(5, 7)) === r.month && Number(date.slice(8)) === Math.min(r.monthDay, lastDayOfMonth(date));
    default: return false;
  }
}
function prevOccurrence(c, date) {
  const start = createdISO(c);
  for (let i = 0, d = date; i < 400 && d >= start; i++, d = addDays(d, -1)) if (occursOn(c, d)) return d;
  return null;
}
function nextOccurrence(c, after) {
  for (let i = 1, d = addDays(after, 1); i < 400; i++, d = addDays(d, 1)) if (occursOn(c, d)) return d;
  return null;
}

/* Ciclo actual: fecha pendiente (si la hay) y próxima fecha programada */
export function choreCycle(c, date = today()) {
  const r = recurrence(c);
  const start = createdISO(c);
  if (r.type === "intervalo") {
    const logs = choreLogs(c).filter((d) => d <= date);
    const last = logs.length ? logs[logs.length - 1] : null;
    const due = last ? addDays(last, r.every) : start;
    if (last === date) return { pending: null, next: addDays(date, r.every) };
    return due <= date ? { pending: due, next: due } : { pending: null, next: due };
  }
  const occ = prevOccurrence(c, date);
  const doneSince = occ && choreLogs(c).some((d) => d >= occ && d <= date);
  if (occ && !doneSince) return { pending: occ, next: occ };
  return { pending: null, next: nextOccurrence(c, date) || addDays(date, 30) };
}

/* Para puntajes: la tarea "toca" solo en su día programado, no todos los días */
export function choreDueOn(c, date) {
  if (c.active === false || date < createdISO(c)) return false;
  const r = recurrence(c);
  if (r.type !== "intervalo") return occursOn(c, date);
  const last = choreLastDoneBefore(c, date);
  return (last ? addDays(last, r.every) : createdISO(c)) === date;
}
export function choreNextDue(c) { return choreCycle(c).next; }
export function choreStatus(c) {
  const t = today();
  if (choreDoneOn(c, t)) return { key: "done", label: "Hecha hoy" };
  const cy = choreCycle(c, t);
  if (cy.pending) {
    const d = diffDays(t, cy.pending);
    return d === 0 ? { key: "today", label: "Para hoy", days: 0 } : { key: "late", label: `Atrasada ${d} d`, days: -d };
  }
  const d = diffDays(cy.next, t);
  if (d === 1) return { key: "soon", label: "Mañana", days: 1 };
  if (d <= 6) return { key: "soon", label: `El ${DAY_NAMES[weekday(cy.next)]}`, days: d };
  return { key: "later", label: `En ${d} días`, days: d };
}

/* ------------------------------ Ejercicio ------------------------------ */
export const dailyExerciseTarget = () => Number(DB.profile.exerciseDaily || 30);
export const weeklyExerciseTarget = () => Number(DB.profile.exerciseWeekly || 180);
export const minutesOn = (date) => sum(DB.data.workouts.filter((w) => w.date === date), (w) => w.minutes);

/* --------------------------- Puntaje del día --------------------------- */
export function dayScore(date) {
  const habits = DB.data.habits.filter((h) => habitScheduled(h, date));
  const hDone = habits.filter((h) => habitDone(h, date)).length;
  const chores = DB.data.chores.filter((c) => choreDueOn(c, date) || choreDoneOn(c, date));
  const cDone = chores.filter((c) => choreDoneOn(c, date)).length;
  const min = minutesOn(date);
  const target = dailyExerciseTarget();

  const parts = [];
  if (habits.length) parts.push([hDone / habits.length, 0.5]);
  if (chores.length) parts.push([cDone / chores.length, 0.25]);
  if (DB.profile.challengeStart && date >= DB.profile.challengeStart || min > 0) parts.push([Math.min(1, min / target), 0.25]);

  const w = sum(parts, (p) => p[1]);
  const score = w ? Math.round((sum(parts, (p) => p[0] * p[1]) / w) * 100) : null;
  return {
    date, score,
    habits: { done: hDone, total: habits.length },
    chores: { done: cDone, total: chores.length },
    exercise: { minutes: min, target }
  };
}

/* ---------------------------- Reto 21 días ----------------------------- */
export function challenge() {
  const start = DB.profile.challengeStart;
  if (!start) return null;
  const t = today();
  const dayNum = diffDays(t, start) + 1;
  const days = dateRange(start, addDays(start, APP.challengeDays - 1)).map((d, i) => {
    const s = d <= t ? dayScore(d) : null;
    return { n: i + 1, date: d, future: d > t, isToday: d === t, score: s?.score ?? null, pocketed: (s?.score ?? 0) >= APP.dayGoal };
  });
  const pocketed = days.filter((d) => d.pocketed).length;
  let run = 0, best = 0;
  for (const d of days) { if (d.future) break; if (d.pocketed) { run++; best = Math.max(best, run); } else if (!d.isToday) run = 0; }
  return { start, end: addDays(start, APP.challengeDays - 1), dayNum, days, pocketed, bestRun: best, currentRun: run, finished: dayNum > APP.challengeDays };
}

/* ------------------------ Puntos y nivel (billar) ---------------------- */
export function points() {
  const d = DB.data;
  let p = d.habitLogs.length * 10 + d.choreLogs.length * 6 + d.workouts.length * 15 + d.transactions.length * 2 +
    d.commitments.filter((c) => c.done).length * 12 + (d.tasks || []).reduce((n, t) => n + (t.status === "completada" ? 1 : 0) + (t.completions?.length || 0), 0) * 8 + d.goals.filter((g) => g.status === "lograda").length * 80;
  const ch = challenge();
  if (ch) p += ch.pocketed * 30;
  return p;
}
export function level(p = points()) {
  let i = 0;
  LEVELS.forEach((l, idx) => { if (p >= l.min) i = idx; });
  const cur = LEVELS[i], next = LEVELS[i + 1];
  const progress = next ? ((p - cur.min) / (next.min - cur.min)) * 100 : 100;
  return { ...cur, idx: i + 1, next, progress, points: p };
}

/* -------------------------------- Finanzas ----------------------------- */
export const entityName = (id) =>
  id === "personal" || !id ? "Personal" : DB.data.businesses.find((b) => b.id === id)?.name || "Negocio eliminado";

export function txFilter({ from, to, entity = "all", kind = "all" } = {}) {
  return DB.data.transactions.filter((t) =>
    (!from || t.date >= from) && (!to || t.date <= to) &&
    (entity === "all" || (entity === "negocios" ? t.entity !== "personal" : (t.entity || "personal") === entity)) &&
    (kind === "all" || t.kind === kind));
}
export function totals(list) {
  const inc = sum(list.filter((t) => t.kind === "ingreso"), (t) => t.amount);
  const exp = sum(list.filter((t) => t.kind === "gasto"), (t) => t.amount);
  return { inc, exp, net: inc - exp, margin: inc ? ((inc - exp) / inc) * 100 : 0 };
}
export function byCategory(list, kind = "gasto") {
  const g = groupBy(list.filter((t) => t.kind === kind), (t) => t.category || "Sin categoría");
  return Object.entries(g).map(([k, v]) => ({ k, v: sum(v, (t) => t.amount) })).sort((a, b) => b.v - a.v);
}
export function byMonth(list, months = 6) {
  const keys = []; const d = new Date(); d.setDate(1);
  for (let i = months - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); keys.push(toISO(x).slice(0, 7)); }
  return keys.map((k) => ({ k, ...totals(list.filter((t) => monthKey(t.date) === k)) }));
}
export function byEntity(list) {
  const ents = ["personal", ...DB.data.businesses.map((b) => b.id)];
  return ents.map((e) => ({ id: e, name: entityName(e), ...totals(list.filter((t) => (t.entity || "personal") === e)) }));
}

/* ------------------------ Equilibrio de áreas (radar) ------------------ */
export function areaBalance(days = lastNDays(21)) {
  return AREAS.map((a) => {
    const vals = [];
    const hs = DB.data.habits.filter((h) => h.area === a.id);
    const rates = hs.map((h) => habitRate(h, days)).filter((r) => r !== null);
    if (rates.length) vals.push(sum(rates) / rates.length);
    const gs = DB.data.goals.filter((g) => g.area === a.id && g.status !== "pausada");
    if (gs.length) vals.push(sum(gs, (g) => g.progress) / gs.length);
    if (a.id === "hogar" && DB.data.chores.length) {
      const due = days.flatMap((d) => DB.data.chores.filter((c) => choreDueOn(c, d) || choreDoneOn(c, d)).map((c) => choreDoneOn(c, d)));
      if (due.length) vals.push((due.filter(Boolean).length / due.length) * 100);
    }
    if (a.id === "salud") {
      const m = sum(days, minutesOn); const target = (weeklyExerciseTarget() / 7) * days.length;
      vals.push(Math.min(100, (m / target) * 100));
    }
    if (a.id === "financiera" && DB.data.transactions.length) {
      const t = totals(txFilter({ from: days[0], to: days[days.length - 1] }));
      vals.push(t.inc ? Math.max(0, Math.min(100, 50 + t.margin / 2)) : 30);
    }
    return { ...a, value: vals.length ? Math.round(sum(vals) / vals.length) : 0 };
  });
}

/* ---------------------- Comparativo semana 1 vs semana 3 ---------------- */
export function transformation() {
  const ch = challenge();
  if (!ch) return null;
  const w = (a, b) => {
    const ds = dateRange(addDays(ch.start, a), addDays(ch.start, b)).filter((d) => d <= today());
    const sc = ds.map(dayScore).filter((s) => s.score !== null);
    const tx = totals(txFilter({ from: ds[0], to: ds[ds.length - 1] }));
    return {
      days: ds.length,
      score: sc.length ? Math.round(sum(sc, (s) => s.score) / sc.length) : 0,
      minutes: sum(ds, minutesOn),
      habits: sum(sc, (s) => s.habits.done),
      chores: sum(sc, (s) => s.chores.done),
      net: tx.net
    };
  };
  return { w1: w(0, 6), w2: w(7, 13), w3: w(14, 20) };
}

/* ------------------------ Tareas únicas (con fecha) --------------------- */
export const TASK_STATUS = [
  { v: "pendiente", l: "Pendiente" },
  { v: "en_progreso", l: "En progreso" },
  { v: "completada", l: "Completada" }
];
export const TASK_PRIORITY = [
  { v: "alta", l: "Alta" }, { v: "media", l: "Media" }, { v: "baja", l: "Baja" }
];
export const DURATION_UNITS = [
  { v: "min", l: "minutos" }, { v: "h", l: "horas" }, { v: "d", l: "días" }
];
export const durationLabel = (t) => {
  if (!t.duration) return "";
  const u = DURATION_UNITS.find((x) => x.v === t.durationUnit)?.l || "minutos";
  return `${t.duration} ${Number(t.duration) === 1 ? u.replace(/s$/, "") : u}`;
};
export const durationMinutes = (t) => Number(t.duration || 0) * ({ min: 1, h: 60, d: 480 }[t.durationUnit] || 1);

export function taskState(t) {
  if (t.status === "completada") return { key: "done", label: "Completada" };
  if (!t.dueDate) return { key: "later", label: t.status === "en_progreso" ? "En progreso" : "Sin fecha" };
  const d = diffDays(t.dueDate, today());
  if (d < 0) return { key: "late", label: `Vencida hace ${-d} d`, days: d };
  if (d === 0) return { key: "today", label: "Vence hoy", days: 0 };
  if (d === 1) return { key: "soon", label: "Vence mañana", days: 1 };
  return { key: d <= 7 ? "soon" : "later", label: `Faltan ${d} días`, days: d };
}

/* --------------------- Tareas recurrentes (periodicidad) ---------------- */
export const TASK_REPEAT = [{ v: "unica", l: "Una sola vez" }, ...RECURRENCE];
export const isRecurring = (t) => !!t.rtype && t.rtype !== "unica";
export const taskRepeatLabel = (t) => (isRecurring(t) ? recurrenceLabel(t) : "Una sola vez");
/* Próxima fecha después de "from" según la periodicidad de la tarea */
export function nextTaskDate(t, from) {
  const r = recurrence(t);
  if (r.type === "intervalo") return addDays(from, r.every);
  const pseudo = { rtype: t.rtype, days: t.days, every: t.every, monthDay: t.monthDay, month: t.month, startDate: t.repeatStart || t.dueDate || from };
  for (let i = 1, d = addDays(from, 1); i < 400; i++, d = addDays(d, 1)) if (occursOn(pseudo, d)) return d;
  return addDays(from, 7);
}
