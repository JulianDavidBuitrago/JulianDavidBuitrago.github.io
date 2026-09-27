/* =====================================================================
   RACK 21 · Reglas de negocio
   Puntajes diarios, rachas, tareas del hogar, finanzas y reto de 21 días.
   ===================================================================== */
import { APP } from "./config.js";
import { DB } from "./store.js";
import {
  today, addDays, diffDays, dateRange, lastNDays, weekday, monthKey, sum, groupBy, toISO
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
export const freqLabel = (v) => FREQUENCIES.find((f) => f.v === Number(v))?.l || `Cada ${v} días`;

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
  { name: "Tender la cama", freq: 1, minutes: 3, anchor: "levantarme" },
  { name: "Lavar la loza", freq: 1, minutes: 15, anchor: "terminar la cena" },
  { name: "Sacar la basura", freq: 2, minutes: 5, anchor: "salir de casa en la mañana" },
  { name: "Barrer", freq: 2, minutes: 15, anchor: "llegar del trabajo" },
  { name: "Trapear", freq: 4, minutes: 20, anchor: "terminar de barrer" },
  { name: "Lavar la ropa", freq: 7, minutes: 40, anchor: "desayunar el sábado" },
  { name: "Lavar los baños", freq: 7, minutes: 30, anchor: "poner la lavadora" },
  { name: "Limpiar la cocina a fondo", freq: 7, minutes: 30, anchor: "terminar el almuerzo del domingo" },
  { name: "Cambiar sábanas y toallas", freq: 14, minutes: 15, anchor: "lavar la ropa" },
  { name: "Limpiar la nevera", freq: 30, minutes: 25, anchor: "hacer el mercado" }
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

export function choreDueOn(c, date) {
  if (c.active === false || date < createdISO(c)) return false;
  const last = choreLastDoneBefore(c, date);
  if (!last) return true;
  return diffDays(date, last) >= Number(c.freq || 1);
}
export function choreNextDue(c) {
  const all = choreLogs(c);
  const last = all.length ? all[all.length - 1] : null;
  if (!last) return createdISO(c) > today() ? createdISO(c) : today();
  return addDays(last, Number(c.freq || 1));
}
export function choreStatus(c) {
  const t = today();
  if (choreDoneOn(c, t)) return { key: "done", label: "Hecha hoy" };
  const next = choreNextDue(c);
  const d = diffDays(next, t);
  if (d < 0) return { key: "late", label: `Atrasada ${-d} d`, days: d };
  if (d === 0) return { key: "today", label: "Para hoy", days: 0 };
  if (d === 1) return { key: "soon", label: "Mañana", days: 1 };
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
    d.commitments.filter((c) => c.done).length * 12 + d.goals.filter((g) => g.status === "lograda").length * 80;
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
