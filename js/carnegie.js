/* =====================================================================
   RACK 21 · Voz del coach (estilo Dale Carnegie)
   Principios aplicados en todo el texto de la app:
   - Llamar a la persona por su nombre.
   - Empezar con aprecio sincero y elogiar cada mejora, por pequeña que sea.
   - Hablar en términos de sus intereses (billar, ejercicio, sus negocios).
   - Sugerir con preguntas, no con órdenes.
   - Hacer que el error parezca fácil de corregir.
   - Darle una reputación que quiera sostener.
   ===================================================================== */
import { hour, firstName } from "./utils.js";

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export const greet = (name) => {
  const h = hour();
  const g = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  return `${g}, ${firstName(name) || "campeón"}`;
};

export const PRINCIPLES = [
  { t: "Aprecio sincero", d: "Reconozca hoy una cosa que usted hizo bien. Lo que se reconoce, se repite." },
  { t: "Elogie cada mejora", d: "Un 1 % mejor cada día es casi 38 veces mejor en un año. Celebre el 1 % de hoy." },
  { t: "Una reputación que sostener", d: "Usted ya es alguien que cumple. Cada check de hoy es una prueba más." },
  { t: "El error es fácil de corregir", d: "¿Falló ayer? Es una bola que se escapó, no la partida. Nunca falle dos veces seguidas." },
  { t: "Hable en términos de lo que le interesa", d: "Entrenar es tener pulso firme en la mesa. Ordenar la casa es jugar con la mesa limpia." },
  { t: "Despierte un deseo vehemente", d: "Imagine el día 21: más energía, sus negocios claros y la casa en orden. ¿Qué paso lo acerca hoy?" },
  { t: "Pregunte en lugar de ordenar", d: "¿Cuál sería la versión de 2 minutos de lo que hoy le cuesta empezar?" },
  { t: "Sonría", d: "La constancia se construye mejor con buen ánimo. Empiece por lo más fácil y disfrute la racha." },
  { t: "Empiece con elogios", d: "Antes de revisar lo pendiente, mire lo que ya logró esta semana." },
  { t: "Deje que la idea sea suya", d: "Usted diseñó sus anclas. Son sus reglas del juego, por eso funcionan." }
];

export const principleOfDay = () => PRINCIPLES[new Date().getDate() % PRINCIPLES.length];

export const CHEERS = [
  "¡Bola embocada! Así se construye una racha.",
  "¡Excelente tiro! Su yo del día 21 se lo agradece.",
  "Eso es disciplina de campeón. Siga así.",
  "¡Carambola! Otro voto por la persona que usted quiere ser.",
  "Pulso firme, mente clara. ¡Muy bien hecho!",
  "Cada check es una prueba de quién es usted ahora."
];
export const cheer = () => pick(CHEERS);

/* Mensaje del día construido con los datos reales: elogio → sugerencia en pregunta → reputación */
export function dailyMessage(name, s) {
  const n = firstName(name) || "campeón";
  const praise = [];
  if (s.streakBest >= 3) praise.push(`lleva ${s.streakBest} días seguidos con “${s.streakHabit}”`);
  if (s.pocketed > 0) praise.push(`ya embocó ${s.pocketed} ${s.pocketed === 1 ? "bola" : "bolas"} del reto`);
  if (s.weekMinutes > 0) praise.push(`suma ${s.weekMinutes} minutos de ejercicio esta semana`);
  if (s.doneToday > 0) praise.push(`hoy ya completó ${s.doneToday} ${s.doneToday === 1 ? "hábito" : "hábitos"}`);

  const open = praise.length
    ? `${n}, quiero reconocerle algo: ${praise.slice(0, 2).join(" y ")}. Eso no es suerte, es carácter.`
    : `${n}, hoy es un excelente día para abrir la mesa. Toda gran racha empezó con un primer tiro.`;

  let ask;
  if (s.missedTwiceRisk) ask = `Ayer se le escapó “${s.missedTwiceRisk}”. Es muy fácil de corregir: ¿qué tal si hoy hace solo la versión de 2 minutos?`;
  else if (s.lateChores > 0) ask = `Hay ${s.lateChores} ${s.lateChores === 1 ? "tarea" : "tareas"} de la casa esperando. ¿Cuál podría despachar en los próximos 15 minutos?`;
  else if (s.pendingToday > 0) ask = `Le quedan ${s.pendingToday} hábitos para hoy. ¿Cuál es el más fácil para empezar ahora mismo?`;
  else if (s.weekMinutes < s.weekTarget / 2) ask = `¿Qué tal una sesión corta de ejercicio hoy? Un cuerpo fuerte también afina el pulso en la mesa de billar.`;
  else ask = `Todo va en orden. ¿Qué pequeño reto adicional le haría sentir orgulloso esta noche?`;

  return { title: "Mensaje de su coach", body: `${open} ${ask}` };
}
