/* =====================================================================
   RACK 21 · Coach IA conectado a la API de Claude (Anthropic)
   Dos modos de conexión:
   - "proxy"  (recomendado): la app llama a su Worker de Cloudflare, que guarda
               la API key como secreto. La clave nunca llega al navegador.
   - "direct": la app llama a api.anthropic.com con una clave guardada solo en
               este dispositivo (útil para uso personal y pruebas).
   ===================================================================== */
import { APP } from "./config.js";
import { DB } from "./store.js";
import * as F from "./fin.js";
import {
  today, addDays, lastNDays, sum, firstName, longDate, toISO
} from "./utils.js";
import {
  AREAS, areaOf, habitScheduled, habitDone, habitStreak, habitRate, choreStatus, freqLabel,
  minutesOn, weeklyExerciseTarget, dayScore, challenge, txFilter, totals, byCategory, byEntity, byMonth,
  level, transformation, areaBalance, taskState, durationLabel
} from "./logic.js";

const KEY = "rack21:ai";
export const aiSettings = () => ({ mode: "proxy", proxyUrl: "", apiKey: "", model: APP.defaultModel, ...JSON.parse(localStorage.getItem(KEY) || "{}") });
export const saveAiSettings = (s) => localStorage.setItem(KEY, JSON.stringify({ ...aiSettings(), ...s }));
export const aiReady = () => { const s = aiSettings(); return s.mode === "proxy" ? !!s.proxyUrl : !!s.apiKey; };

/* ------------------------ Contexto para decisiones ----------------------- */
export function buildContext() {
  const t = today();
  const d21 = lastNDays(21);
  const month = t.slice(0, 7);
  const monthTx = txFilter({ from: `${month}-01`, to: t });
  const last30 = txFilter({ from: addDays(t, -29), to: t });
  const ch = challenge();
  const lv = level();

  return {
    fecha_hoy: `${t} (${longDate(t)})`,
    persona: {
      nombre: DB.profile.name || DB.user?.displayName || "",
      identidad_deseada: DB.profile.identity || "",
      por_que_cambiar: DB.profile.why || "",
      intereses: "billar y ejercicio",
      nivel: `${lv.name} (${lv.points} puntos)`
    },
    reto_21_dias: ch ? {
      inicio: ch.start, dia_actual: Math.min(ch.dayNum, 21), bolas_embocadas: ch.pocketed,
      meta_diaria_pct: APP.dayGoal,
      puntaje_por_dia: ch.days.filter((d) => !d.future).map((d) => `${d.n}:${d.score ?? "-"}`).join(" "),
      comparativo_semanas: transformation()
    } : "sin iniciar",
    hoy: (() => { const s = dayScore(t); return { puntaje: s.score, habitos: `${s.habits.done}/${s.habits.total}`, tareas_hogar: `${s.chores.done}/${s.chores.total}`, ejercicio_min: `${s.exercise.minutes}/${s.exercise.target}` }; })(),
    habitos: DB.data.habits.filter((h) => h.active !== false).map((h) => ({
      nombre: h.name, area: areaOf(h.area).label,
      ancla: h.anchor ? `Después de ${h.anchor}, ${h.name.toLowerCase()}` : "",
      version_2_min: h.twoMin || "", hoy: habitScheduled(h, t) ? (habitDone(h, t) ? "hecho" : "pendiente") : "no programado",
      racha: habitStreak(h), cumplimiento_21d: Math.round(habitRate(h, d21) ?? 0)
    })),
    tareas_con_fecha: DB.data.tasks.filter((x) => x.status !== "completada").map((x) => ({ tarea: x.title, avance_actividades: x.items?.length ? `${x.items.filter((i) => i.done).length}/${x.items.length}` : null, actividades_pendientes: (x.items || []).filter((i) => !i.done).map((i) => i.text).slice(0, 8), fecha_fin: x.dueDate, estado: x.status, prioridad: x.priority, duracion: durationLabel(x), situacion: taskState(x).label })),
    tareas_completadas_30d: DB.data.tasks.filter((x) => x.status === "completada" && x.completedAt && x.completedAt > Date.now() - 30 * 864e5).length,
    hogar: DB.data.chores.filter((c) => c.active !== false).map((c) => ({ tarea: c.name, frecuencia: freqLabel(c.freq), estado: choreStatus(c).label })),
    ejercicio: {
      meta_semanal_min: weeklyExerciseTarget(),
      ultimos_7_dias_min: sum(lastNDays(7), minutesOn),
      ultimos_14_dias: lastNDays(14).map((d) => `${d.slice(5)}:${minutesOn(d)}`).join(" "),
      sesiones_recientes: DB.data.workouts.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((w) => `${w.date} ${w.type} ${w.minutes}min int${w.intensity || "-"}`)
    },
    finanzas: {
      moneda: APP.currency,
      negocios: DB.data.businesses.map((b) => b.name),
      mes_actual: { ...roundT(totals(monthTx)), por_entidad: byEntity(monthTx).filter((e) => e.inc || e.exp).map((e) => ({ entidad: e.name, ingresos: e.inc, gastos: e.exp, utilidad: e.net })) },
      gastos_top_30d: byCategory(last30).slice(0, 6).map((c) => `${c.k}: ${Math.round(c.v)}`),
      saldos_por_cuenta: F.accounts().map((a) => `${a.name}: ${Math.round(F.accountBalance(a.id))}`),
      patrimonio: (() => { const n = F.netWorth(); return { en_cuentas: Math.round(n.cash), ahorro_prevision: Math.round(n.saved), deudas: Math.round(n.debt), neto: Math.round(n.net) }; })(),
      deudas: DB.data.debts.map((d) => { const s = F.debtStatus(d); return { deuda: d.name, acreedor: d.creditor, cuenta: d.entity, capital: d.principal, saldo: Math.round(s.balance), tasa: `${d.rate}% ${d.ratePeriod}`, metodo: d.method === "frances" ? "cuota fija" : "interés sobre capital", cuota: Math.round(s.sc.cuota), cuotas_pagadas: `${(d.payments || []).length}/${d.months}`, proximo_pago: s.next?.date, vencida: s.late }; }),
      rubros_ahorro: DB.data.funds.map((f) => ({ rubro: f.name, tipo: f.kind, saldo: Math.round(F.fundBalance(f)), meta: f.goal || null, fecha_objetivo: f.targetDate || null })),
      prestamos_entre_cuentas: DB.data.loans.map((l) => { const s = F.loanStatus(l); return { de: l.from, para: l.to, valor: l.amount, pendiente: Math.round(s.balance), vence: l.dueDate || null }; }),
      tendencia_6_meses: byMonth(DB.data.transactions, 6).map((m) => `${m.k} ing ${Math.round(m.inc)} gas ${Math.round(m.exp)}`)
    },
    metas: DB.data.goals.map((g) => ({ meta: g.title, area: areaOf(g.area).label, progreso: g.progress, estado: g.status, fecha_limite: g.deadline, siguiente_accion: g.nextAction })),
    equilibrio_areas: areaBalance(d21).map((a) => `${a.label}: ${a.value}`),
    compromisos_abiertos: DB.data.commitments.filter((c) => !c.done).map((c) => c.text)
  };
}
const roundT = (t) => ({ ingresos: Math.round(t.inc), gastos: Math.round(t.exp), utilidad: Math.round(t.net), margen_pct: Math.round(t.margin) });

export function systemPrompt() {
  const name = firstName(DB.profile.name || DB.user?.displayName) || "el usuario";
  return `Usted es "Coach RACK 21", el coach personal de ${name} dentro de su aplicación de hábitos, hogar, ejercicio y finanzas.

ESTILO DE COMUNICACIÓN (Dale Carnegie):
- Llame a ${name} por su nombre y háblele de "usted", en español colombiano cálido y respetuoso.
- Empiece siempre con un reconocimiento sincero y específico basado en SUS DATOS reales.
- Sugiera mediante preguntas, no con órdenes. Haga que cada error parezca fácil de corregir.
- Hable en términos de sus intereses: el billar y el ejercicio. Use metáforas de billar con moderación (tiro, banda, embocar, carambola, pulso).
- Déle una reputación que quiera sostener ("usted es alguien que cumple").

MÉTODO (Hábitos Atómicos):
- Apilamiento de hábitos: "Después de [hábito actual], haré [nuevo hábito]".
- Las 4 leyes: hacerlo obvio, atractivo, sencillo y satisfactorio. Regla de los 2 minutos.
- Hábitos basados en identidad. Diseño del entorno. Nunca fallar dos veces seguidas.
- Mejora del 1 % diario; énfasis en sistemas más que en metas.

REGLAS:
- Base sus consejos en los DATOS del contexto: cite cifras concretas (rachas, puntajes, minutos, ingresos, gastos, utilidad por negocio).
- Sea breve y accionable: máximo 220 palabras salvo que le pidan un análisis detallado.
- En finanzas, entregue análisis y opciones; aclare que no reemplaza a un contador o asesor financiero cuando la decisión sea de alto impacto.
- En salud, no dé diagnósticos ni indicaciones médicas; sugiera consultar a un profesional si hay dolor o síntomas.
- Cierre SIEMPRE con la sección exacta "**Compromisos sugeridos:**" seguida de 1 a 3 viñetas con acciones concretas, medibles y para hoy o mañana (cada viñeta de máximo 15 palabras).
- No invente datos que no estén en el contexto; si falta información, pregunte.`;
}

/* ---------------------------- Llamada a la API ---------------------------- */
export async function askClaude(history) {
  const s = aiSettings();
  const ctx = buildContext();
  const messages = history.slice(-20).map((m) => ({ role: m.role, content: m.content }));
  // Se inyecta el contexto actualizado en el último mensaje del usuario
  const last = messages[messages.length - 1];
  last.content = `<datos_actualizados_de_la_app>\n${JSON.stringify(ctx)}\n</datos_actualizados_de_la_app>\n\n${last.content}`;

  const body = { model: s.model || APP.defaultModel, max_tokens: 1200, system: systemPrompt(), messages };
  let res;
  try {
    if (s.mode === "proxy") {
      if (!s.proxyUrl) throw new Error("Configure la URL del proxy en Ajustes → Coach IA.");
      res = await fetch(s.proxyUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    } else {
      if (!s.apiKey) throw new Error("Agregue su API key de Anthropic en Ajustes → Coach IA.");
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": s.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify(body)
      });
    }
  } catch (e) {
    if (e.message?.startsWith("Configure") || e.message?.startsWith("Agregue")) throw e;
    throw new Error("No hay conexión con el servicio del coach. Revise su internet o la URL del proxy.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    if (res.status === 401) throw new Error("La API key no es válida. Revísela en Ajustes → Coach IA.");
    if (res.status === 429) throw new Error("Se alcanzó el límite de uso de la API. Intente de nuevo en unos minutos.");
    if (res.status === 404) throw new Error(`Modelo no disponible (${body.model}). Elija otro en Ajustes.`);
    throw new Error(`Error del coach (${res.status}): ${msg}`);
  }
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  return { text, usage: data.usage, model: data.model || body.model };
}

/* Extrae las viñetas de "Compromisos sugeridos" */
export function extractCommitments(text) {
  const i = text.search(/compromisos sugeridos/i);
  if (i < 0) return [];
  return text.slice(i).split("\n").slice(1)
    .map((l) => l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)/)?.[1]?.replace(/\*\*/g, "").trim())
    .filter(Boolean).slice(0, 3);
}

export const QUICK_PROMPTS = [
  "¿Cómo voy en el reto de 21 días? Deme un diagnóstico honesto.",
  "Analice mis finanzas del mes: ¿qué negocio rinde más y dónde se me va la plata?",
  "Arme mi plan para mañana con horarios, anclas y tareas del hogar.",
  "¿Qué hábito debo reforzar primero y cómo lo hago más fácil?",
  "Propóngame una rutina de ejercicio de 30 minutos que mejore mi juego de billar."
];
