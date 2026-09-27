/* RACK 21 · Gráficos (Chart.js) con paleta validada para fondo oscuro */
export const PALETTE = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
export const C = {
  income: "#199e70", expense: "#d95926", line: "#22d3ee", good: "#0ca30c", warn: "#fab219",
  text: "#e2e8f0", muted: "#94a3b8", grid: "rgba(148,163,184,.10)", surface: "#0c1220"
};

const registry = new Map();

export function destroyCharts() { registry.forEach((c) => c.destroy()); registry.clear(); }

function base() {
  const Chart = window.Chart;
  if (!Chart || Chart.__rack) return;
  Chart.__rack = true;
  Chart.defaults.color = C.muted;
  Chart.defaults.font.family = "'Space Grotesk', system-ui, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.borderColor = C.grid;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.plugins.legend.labels.color = C.text;
  Chart.defaults.plugins.tooltip.backgroundColor = "rgba(8,12,22,.95)";
  Chart.defaults.plugins.tooltip.borderColor = "rgba(34,211,238,.35)";
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.titleColor = "#fff";
  Chart.defaults.plugins.tooltip.bodyColor = C.text;
  Chart.defaults.animation.duration = 900;
  Chart.defaults.maintainAspectRatio = false;
}

export function chart(id, config) {
  base();
  const el = document.getElementById(id);
  if (!el || !window.Chart) return null;
  registry.get(id)?.destroy();
  const c = new window.Chart(el, config);
  registry.set(id, c);
  return c;
}

export const axes = ({ money = false, max, stacked = false, beginAtZero = true } = {}) => ({
  x: { grid: { display: false }, stacked, ticks: { maxRotation: 0, autoSkipPadding: 12 } },
  y: {
    beginAtZero, max, stacked, grid: { color: C.grid }, border: { display: false },
    ticks: { callback: (v) => money ? new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(v) : v }
  }
});

export const moneyTip = {
  callbacks: {
    label: (c) => {
      const v = typeof c.parsed === "number" ? c.parsed : c.chart.options.indexAxis === "y" ? c.parsed.x : c.parsed.y;
      return ` ${c.dataset.label || c.label}: ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v)}`;
    }
  }
};
