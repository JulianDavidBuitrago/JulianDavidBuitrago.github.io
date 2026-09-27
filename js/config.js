/* =====================================================================
   RACK 21 · Configuración
   ---------------------------------------------------------------------
   1. Pegue aquí la configuración de su proyecto Firebase
      (Consola Firebase → Configuración del proyecto → Sus apps → Web).
   2. Mientras apiKey esté vacío, la aplicación funciona en MODO LOCAL
      (datos guardados solo en este navegador) para pruebas.
   ===================================================================== */

export const firebaseConfig = {
  apiKey: "AIzaSyBOkVGlUWFLWZtr25_w_InqtpAjDlqCn-k",
  authDomain: "rack21-19834.firebaseapp.com",
  projectId: "rack21-19834",
  storageBucket: "rack21-19834.firebasestorage.app",
  messagingSenderId: "11717080795",
  appId: "1:11717080795:web:7ca807bee4a6881378befe"
};


export const APP = {
  name: "RACK 21",
  challengeDays: 21,
  dayGoal: 70,             // % mínimo para "embocar" la bola del día
  currency: "COP",
  locale: "es-CO",
  claudeModels: [
    { id: "claude-sonnet-5", label: "Claude Sonnet 5 · equilibrado (recomendado)" },
    { id: "claude-opus-5-5", label: "Claude Opus 5.5 · máximo análisis" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 · rápido y económico" }
  ],
  defaultModel: "claude-sonnet-5"
};

export const isFirebaseConfigured = () => Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
