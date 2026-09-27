/* RACK 21 · Inicio (la mesa de hoy) */
import { DB } from "../store.js";
import { APP } from "../config.js";
import { today, longDate, esc, money, lastNDays, sum, shortDate, firstName } from "../utils.js";
import { ic, ball, ring, empty } from "../ui.js";
import {
  challenge, dayScore, level, habitScheduled, habitDone, habitStreak, missedYesterday, areaOf,
  choreStatus, minutesOn, weeklyExerciseTarget, txFilter, totals
} from "../logic.js";
import { greet, dailyMessage, principleOfDay } from "../carnegie.js";
import * as A from "../actions.js";

export function rackHTML(ch, size = 38) {
  const rows = [1, 2, 3, 4, 5, 6];
  let n = 0;
  return `<div class="rack flex flex-col items-center gap-1">${rows.map((r) => `
    <div class="flex gap-1">${Array.from({ length: r }, () => {
      const d = ch.days[n++];
      const cls = d.isToday ? "rack-today" : d.future ? "rack-future" : d.pocketed ? "rack-in" : "rack-miss";
      const tip = `Día ${d.n} · ${shortDate(d.date)}${d.score !== null && !d.future ? ` · ${d.score}%` : ""}${d.pocketed ? " · embocada" : ""}`;
      return `<div class="rack-ball ${cls}" title="${tip}" style="animation-delay:${d.n * 35}ms">${ball(d.n, { size, pocketed: d.pocketed || d.isToday, label: tip })}</div>`;
    }).join("")}</div>`).join("")}</div>`;
}

export function render() {
  const t = today();
  const name = DB.profile.name || DB.user?.displayName || "";
  const ch = challenge();
  const sc = dayScore(t);
  const lv = level();
  const habitsToday = DB.data.habits.filter((h) => habitScheduled(h, t)).sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  const chores = DB.data.chores.filter((c) => c.active !== false).map((c) => ({ c, s: choreStatus(c) }))
    .filter((x) => ["late", "today", "done"].includes(x.s.key)).sort((a, b) => ({ late: 0, today: 1, done: 2 }[a.s.key] - { late: 0, today: 1, done: 2 }[b.s.key]));
  const weekMin = sum(lastNDays(7), minutesOn);
  const weekTarget = weeklyExerciseTarget();
  const month = totals(txFilter({ from: `${t.slice(0, 7)}-01`, to: t }));
  const commits = DB.data.commitments.filter((c) => !c.done).slice(-4).reverse();

  let bestStreak = 0, bestHabit = "";
  DB.data.habits.forEach((h) => { const s = habitStreak(h); if (s > bestStreak) { bestStreak = s; bestHabit = h.name; } });
  const risk = habitsToday.find((h) => missedYesterday(h) && !habitDone(h, t));
  const msg = dailyMessage(name, {
    streakBest: bestStreak, streakHabit: bestHabit, pocketed: ch?.pocketed || 0, weekMinutes: weekMin, weekTarget,
    doneToday: sc.habits.done, pendingToday: sc.habits.total - sc.habits.done,
    lateChores: chores.filter((x) => x.s.key === "late").length, missedTwiceRisk: risk?.name
  });
  const pr = principleOfDay();

  return `
  <section class="mb-6 reveal">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <p class="text-cyan-300/80 text-xs uppercase tracking-[.25em] mb-1">${esc(longDate(t))}</p>
        <h1 class="font-display text-2xl sm:text-4xl text-white">${esc(greet(name))} <span class="wave">🎱</span></h1>
      </div>
      <div class="card !p-3 flex items-center gap-3 min-w-[250px]">
        <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 grid place-items-center text-slate-900 font-display text-lg shadow-lg shadow-amber-500/30">${lv.idx}</div>
        <div class="flex-1">
          <div class="flex justify-between text-sm"><span class="text-white font-medium">${lv.name}</span><span class="font-mono text-amber-300">${lv.points.toLocaleString("es-CO")} pts</span></div>
          <div class="bar mt-1.5"><span style="--w:${lv.progress}%"></span></div>
          <p class="text-[11px] text-slate-500 mt-1">${lv.next ? `${(lv.next.min - lv.points).toLocaleString("es-CO")} pts para “${lv.next.name}”` : "Nivel máximo alcanzado"}</p>
        </div>
      </div>
    </div>
  </section>

  <section class="grid lg:grid-cols-5 gap-4 sm:gap-6 mb-6">
    <div class="card felt lg:col-span-3 reveal overflow-hidden relative flex flex-col justify-center">
      <div class="absolute inset-0 pointer-events-none felt-glow"></div>
      ${ch ? `
      <div class="relative grid sm:grid-cols-[auto_1fr] gap-6 items-center">
        <div class="flex justify-center">${rackHTML(ch, window.innerWidth < 400 ? 32 : 38)}</div>
        <div>
          <p class="text-emerald-200/80 text-xs uppercase tracking-[.25em]">Reto RACK 21</p>
          <h2 class="font-display text-3xl sm:text-4xl text-white mt-1">${ch.finished ? "¡Reto completado!" : `Día <span class="text-neon">${Math.min(ch.dayNum, 21)}</span> de 21`}</h2>
          <p class="text-emerald-50/80 mt-2 text-sm">Cada día que supere el ${APP.dayGoal} % embocará su bola. Hábitos 50 %, hogar 25 %, ejercicio 25 %.</p>
          <div class="grid grid-cols-3 gap-3 mt-5">
            <div class="stat"><span class="stat-v" data-count="${ch.pocketed}">0</span><span class="stat-l">Bolas embocadas</span></div>
            <div class="stat"><span class="stat-v" data-count="${ch.currentRun}">0</span><span class="stat-l">Racha actual</span></div>
            <div class="stat"><span class="stat-v" data-count="${ch.bestRun}">0</span><span class="stat-l">Mejor racha</span></div>
          </div>
          ${ch.finished ? `<button class="btn btn-primary mt-5" data-action="go" data-to="panel">${ic("trophy", "w-4 h-4")}Ver informe de transformación</button>` : ""}
        </div>
      </div>` : `
      <div class="relative text-center py-6">
        <p class="text-emerald-200/80 text-xs uppercase tracking-[.25em]">Reto RACK 21</p>
        <h2 class="font-display text-3xl text-white mt-2 mb-3">21 días. 21 bolas. Una nueva versión de usted.</h2>
        <p class="text-emerald-50/80 max-w-lg mx-auto mb-6">Cada día que cumpla su plan, embocará una bola. Al completar el triángulo, los cambios serán visibles en su casa, su cuerpo y sus números.</p>
        <button class="btn btn-primary btn-lg" data-action="challenge:start">${ic("play", "w-5 h-5")}Romper el triángulo hoy</button>
      </div>`}
    </div>

    <div class="card lg:col-span-2 reveal flex flex-col">
      <div class="flex items-center gap-5">
        ${ring(sc.score ?? 0, { size: 118, label: "%", sub: "hoy" })}
        <div class="flex-1 space-y-3 text-sm">
          ${metric("repeat", "Hábitos", `${sc.habits.done}/${sc.habits.total}`, sc.habits.total ? (sc.habits.done / sc.habits.total) * 100 : 0)}
          ${metric("house", "Hogar", `${sc.chores.done}/${sc.chores.total}`, sc.chores.total ? (sc.chores.done / sc.chores.total) * 100 : 0)}
          ${metric("dumbbell", "Ejercicio", `${sc.exercise.minutes}/${sc.exercise.target} min`, (sc.exercise.minutes / sc.exercise.target) * 100)}
        </div>
      </div>
      <div class="mt-5 pt-5 border-t border-white/5 flex-1">
        <div class="flex items-start gap-3">
          <div class="coach-avatar shrink-0">${ic("bot", "w-5 h-5")}</div>
          <div>
            <p class="text-xs uppercase tracking-widest text-cyan-300/80 mb-1">${msg.title}</p>
            <p class="text-slate-200 text-sm leading-relaxed">${esc(msg.body)}</p>
            <button class="link mt-2" data-action="go" data-to="coach">Conversar con el coach ${ic("arrow-right", "w-3.5 h-3.5")}</button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 reveal">
    ${quick("tx:new", "trending-up", "Ingreso", "from-emerald-400/20", 'data-kind="ingreso"')}
    ${quick("tx:new", "trending-down", "Gasto", "from-orange-400/20", 'data-kind="gasto"')}
    ${quick("workout:new", "dumbbell", "Entrenamiento", "from-cyan-400/20")}
    ${quick("habit:new", "anchor", "Nuevo hábito", "from-violet-400/20")}
  </section>

  <section class="grid lg:grid-cols-3 gap-4 sm:gap-6 mb-6 items-start">
    <div class="card lg:col-span-2 reveal">
      <div class="flex items-center justify-between mb-4">
        <h2 class="card-title">${ic("repeat", "w-5 h-5 text-emerald-300")}Hábitos de hoy</h2>
        <button class="link" data-action="go" data-to="habitos">Gestionar</button>
      </div>
      ${habitsToday.length ? `<ul class="space-y-2">${habitsToday.map(habitRow).join("")}</ul>` :
        `<div class="text-center py-8"><p class="text-slate-400 mb-4">Aún no tiene hábitos programados para hoy.</p>
          <div class="flex flex-wrap gap-2 justify-center"><button class="btn btn-primary" data-action="seed:habits">${ic("sparkles", "w-4 h-4")}Cargar plan de arranque</button><button class="btn btn-ghost" data-action="habit:new">Crear el mío</button></div></div>`}
    </div>

    <div class="space-y-4 sm:space-y-6">
      <div class="card reveal">
        <div class="flex items-center justify-between mb-4">
          <h2 class="card-title">${ic("house", "w-5 h-5 text-rose-300")}Hogar hoy</h2>
          <button class="link" data-action="go" data-to="hogar">Ver todo</button>
        </div>
        ${chores.length ? `<ul class="space-y-2">${chores.slice(0, 6).map(({ c, s }) => `
          <li class="row ${s.key === "done" ? "row-done" : ""}">
            <button class="check ${s.key === "done" ? "is-on" : ""}" data-action="chore:toggle" data-id="${c.id}" aria-label="Marcar ${esc(c.name)}">${ic("check", "w-4 h-4")}</button>
            <div class="flex-1 min-w-0"><p class="truncate text-sm ${s.key === "done" ? "line-through text-slate-500" : "text-white"}">${esc(c.name)}</p>
            <p class="text-[11px] text-slate-500">${c.minutes || "?"} min${c.anchor ? ` · después de ${esc(c.anchor)}` : ""}</p></div>
            <span class="badge badge-${s.key}">${s.label}</span>
          </li>`).join("")}</ul>` : `<p class="text-slate-400 text-sm">Nada pendiente en casa. ¡Mesa limpia!</p>`}
      </div>

      <div class="card reveal">
        <h2 class="card-title mb-4">${ic("gauge", "w-5 h-5 text-cyan-300")}Pulso de la semana</h2>
        <div class="space-y-4 text-sm">
          <div><div class="flex justify-between mb-1"><span class="text-slate-400">Ejercicio 7 días</span><span class="font-mono text-white">${weekMin}/${weekTarget} min</span></div><div class="bar"><span style="--w:${Math.min(100, (weekMin / weekTarget) * 100)}%"></span></div></div>
          <div class="grid grid-cols-2 gap-3">
            <div class="mini"><span class="mini-l">Ingresos del mes</span><span class="mini-v text-emerald-300">${money(month.inc, true)}</span></div>
            <div class="mini"><span class="mini-l">Gastos del mes</span><span class="mini-v text-orange-300">${money(month.exp, true)}</span></div>
          </div>
          <div class="mini"><span class="mini-l">Balance del mes</span><span class="mini-v ${month.net >= 0 ? "text-emerald-300" : "text-rose-300"}">${money(month.net)}</span></div>
        </div>
      </div>
    </div>
  </section>

  <section class="grid lg:grid-cols-2 gap-4 sm:gap-6">
    <div class="card reveal">
      <div class="flex items-center justify-between mb-4">
        <h2 class="card-title">${ic("handshake", "w-5 h-5 text-amber-300")}Compromisos con el coach</h2>
        <button class="link" data-action="go" data-to="coach">Abrir chat</button>
      </div>
      ${commits.length ? `<ul class="space-y-2">${commits.map((c) => `
        <li class="row"><button class="check" data-action="commit:toggle" data-id="${c.id}" aria-label="Cumplir compromiso">${ic("check", "w-4 h-4")}</button>
        <p class="flex-1 text-sm text-slate-200">${esc(c.text)}</p><span class="text-[11px] text-slate-500">${shortDate(c.date)}</span></li>`).join("")}</ul>`
      : `<p class="text-slate-400 text-sm">Cuando el coach le sugiera acciones, guárdelas aquí con un toque y márquelas al cumplirlas.</p>`}
    </div>
    <div class="card reveal bg-gradient-to-br from-violet-500/10 to-cyan-500/5">
      <p class="text-xs uppercase tracking-widest text-violet-300 mb-2">Principio del día</p>
      <h3 class="font-display text-xl text-white mb-2">${pr.t}</h3>
      <p class="text-slate-300 text-sm leading-relaxed">${pr.d}</p>
      ${DB.profile.identity ? `<div class="mt-4 pt-4 border-t border-white/5"><p class="text-xs uppercase tracking-widest text-emerald-300 mb-1">Su identidad</p><p class="text-white italic">“${esc(DB.profile.identity)}”</p></div>` : ""}
    </div>
  </section>`;
}

const metric = (icon, label, val, p) => `
  <div><div class="flex justify-between mb-1"><span class="text-slate-400 flex items-center gap-1.5">${ic(icon, "w-3.5 h-3.5")}${label}</span><span class="font-mono text-white text-xs">${val}</span></div>
  <div class="bar"><span style="--w:${Math.min(100, p)}%"></span></div></div>`;

const quick = (action, icon, label, grad, extra = "") => `
  <button class="quick bg-gradient-to-br ${grad} to-transparent" data-action="${action}" ${extra}>
    <span class="quick-ic">${ic(icon, "w-5 h-5")}</span><span>${label}</span>
  </button>`;

export function habitRow(h) {
  const t = today();
  const done = habitDone(h, t);
  const a = areaOf(h.area);
  const streak = habitStreak(h);
  const risk = !done && missedYesterday(h);
  return `<li class="row ${done ? "row-done" : ""}">
    <button class="check ${done ? "is-on" : ""}" data-action="habit:toggle" data-id="${h.id}" aria-label="Marcar ${esc(h.name)}">${ic("check", "w-4 h-4")}</button>
    <span class="hidden sm:block">${ball(a.ball, { size: 26 })}</span>
    <div class="flex-1 min-w-0">
      <p class="text-sm ${done ? "line-through text-slate-500" : "text-white"} truncate">${esc(h.name)}${h.time ? ` <span class="text-slate-500 font-mono text-xs">· ${h.time}</span>` : ""}</p>
      <p class="text-[11px] text-slate-500 truncate">${h.anchor ? `Después de ${esc(h.anchor)}` : esc(a.label)}${!done && h.twoMin ? ` · <span class="text-cyan-300/80">2 min: ${esc(h.twoMin)}</span>` : ""}</p>
    </div>
    ${risk ? `<span class="badge badge-late" title="Ayer no se cumplió. Nunca falle dos veces.">¡No 2 veces!</span>` : ""}
    <span class="streak ${streak ? "" : "opacity-40"}" title="Racha">${ic("flame", "w-3.5 h-3.5")}${streak}</span>
  </li>`;
}

export const actions = {
  "challenge:start": () => A.startChallenge(),
  "seed:habits": () => A.seedStarter({ habits: true, chores: !DB.data.chores.length })
};
