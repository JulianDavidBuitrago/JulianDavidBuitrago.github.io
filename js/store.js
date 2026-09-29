/* =====================================================================
   RACK 21 · Capa de datos
   Firebase Auth + Cloud Firestore, con respaldo en modo local.
   Estructura en Firestore:
     users/{uid}                    → perfil (documento)
     users/{uid}/{colección}/{id}   → registros
     shares/{correo}_{uidDueño}     → accesos de solo lectura (por módulos)
   ===================================================================== */
import { firebaseConfig, isFirebaseConfigured } from "./config.js";
import { uid as makeId } from "./utils.js";

export const COLLECTIONS = [
  "habits", "habitLogs", "chores", "choreLogs", "tasks", "businesses", "transactions",
  "debts", "funds", "loans", "transfers",
  "workouts", "goals", "commitments", "chat"
];

/* Módulos que el administrador puede habilitar a un usuario de solo lectura
   y las colecciones que cada uno expone. Inicio y Panel BI muestran un resumen
   con los datos de los demás módulos habilitados. */
export const SHARE_MODULES = [
  { id: "inicio",    label: "Inicio (resumen del día)",  cols: [] },
  { id: "habitos",   label: "Hábitos",                    cols: ["habits", "habitLogs"] },
  { id: "hogar",     label: "Hogar",                      cols: ["chores", "choreLogs"] },
  { id: "tareas",    label: "Tareas",                     cols: ["tasks"] },
  { id: "finanzas",  label: "Finanzas y negocios",        cols: ["businesses", "transactions", "debts", "funds", "loans", "transfers"] },
  { id: "ejercicio", label: "Ejercicio",                  cols: ["workouts"] },
  { id: "metas",     label: "Metas",                      cols: ["goals"] },
  { id: "panel",     label: "Panel BI",                   cols: [] },
  { id: "coach",     label: "Coach IA (historial)",       cols: ["chat", "commitments"] }
];
export const colsForModules = (mods) => [...new Set(SHARE_MODULES.filter((m) => mods.includes(m.id)).flatMap((m) => m.cols))];

const FB_VER = "10.12.2";
const FB = (m) => `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-${m}.js`;
const low = (s) => String(s || "").trim().toLowerCase();

export const DB = {
  mode: isFirebaseConfigured() ? "firebase" : "local",
  user: null,
  ownerUid: null,       // cuenta cuyos datos se están viendo
  readOnly: false,      // true cuando se ve la cuenta de otra persona
  modules: null,        // módulos visibles (null = todos)
  share: null,          // acceso activo (modo lectura)
  profile: {},
  data: Object.fromEntries(COLLECTIONS.map((c) => [c, []])),
  _fb: null,

  /* ---------------------------- Autenticación ---------------------------- */
  async init(onUser) {
    if (this.mode === "local") {
      const s = localStorage.getItem("rack21:session");
      this.user = s ? JSON.parse(s) : null;
      if (this.user) this.user.emailVerified = true;
      onUser(this.user);
      return;
    }
    const [{ initializeApp }, auth, fs] = await Promise.all([
      import(FB("app")), import(FB("auth")), import(FB("firestore"))
    ]);
    const app = initializeApp(firebaseConfig);
    const a = auth.getAuth(app);
    await auth.setPersistence(a, auth.browserLocalPersistence);
    let db;
    try {
      db = fs.initializeFirestore(app, {
        localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() })
      });
    } catch { db = fs.getFirestore(app); }
    this._fb = { auth, fs, a, db };
    auth.getRedirectResult(a).catch((e) => console.warn("Redirección de Google", e.code || e));
    auth.onAuthStateChanged(a, (u) => {
      this.user = u ? { uid: u.uid, email: low(u.email), displayName: u.displayName || "", emailVerified: u.emailVerified } : null;
      onUser(this.user);
    });
  },

  async signIn(email, password) {
    if (this.mode === "local") return this._localLogin(email);
    const { auth, a } = this._fb;
    await auth.signInWithEmailAndPassword(a, email, password);
  },
  async signUp(email, password, name) {
    if (this.mode === "local") return this._localLogin(email, name);
    const { auth, a } = this._fb;
    const cred = await auth.createUserWithEmailAndPassword(a, email, password);
    if (name) await auth.updateProfile(cred.user, { displayName: name });
    try { await auth.sendEmailVerification(cred.user); } catch {}
  },
  async resendVerification() {
    if (this.mode === "local") return;
    await this._fb.auth.sendEmailVerification(this._fb.a.currentUser);
  },
  async reloadUser() {
    if (this.mode === "local") return true;
    await this._fb.a.currentUser.reload();
    await this._fb.a.currentUser.getIdToken(true);
    this.user.emailVerified = this._fb.a.currentUser.emailVerified;
    return this.user.emailVerified;
  },
  async signInGoogle() {
    if (this.mode === "local") return this._localLogin("demo@rack21.app", "Campeón");
    const { auth, a } = this._fb;
    const provider = new auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try { await auth.signInWithPopup(a, provider); }
    catch (e) {
      // En celulares y navegadores que bloquean ventanas emergentes se usa redirección
      if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/cancelled-popup-request"].includes(e.code)) {
        await auth.signInWithRedirect(a, provider);
      } else throw e;
    }
  },
  async resetPassword(email) {
    if (this.mode === "local") return;
    const { auth, a } = this._fb;
    await auth.sendPasswordResetEmail(a, email);
  },
  async signOut() {
    if (this.mode === "local") {
      localStorage.removeItem("rack21:session");
      location.reload();
      return;
    }
    await this._fb.auth.signOut(this._fb.a);
    location.reload();
  },
  _localLogin(email, name = "") {
    const e = low(email) || "modo-local";
    this.user = { uid: `local-${e}`, email: e, displayName: name };
    localStorage.setItem("rack21:session", JSON.stringify(this.user));
    location.reload();
  },

  /* ------------------------- Contexto de cuenta -------------------------- */
  /* share = null → mi cuenta; share = {ownerUid, modules,…} → solo lectura */
  async useContext(share = null, remember = false) {
    this.share = share;
    this.ownerUid = share ? share.ownerUid : this.user.uid;
    this.readOnly = !!share;
    this.modules = share ? share.modules : null;
    if (remember) localStorage.setItem(`rack21:ctx:${this.user.uid}`, share ? share.ownerUid : "");
    await this.loadAll();
  },
  savedContext() { return localStorage.getItem(`rack21:ctx:${this.user.uid}`); }, // null = nunca eligió

  _guard() { if (this.readOnly) throw new Error("Está en modo de solo lectura: no puede modificar esta cuenta."); },

  /* ------------------------------- Datos -------------------------------- */
  _localKey(uid = this.ownerUid) { return `rack21:data:${uid}`; },
  _saveLocal() {
    localStorage.setItem(this._localKey(), JSON.stringify({ profile: this.profile, data: this.data }));
  },
  _col(col) { const { fs, db } = this._fb; return fs.collection(db, "users", this.ownerUid, col); },
  _doc(col, id) { const { fs, db } = this._fb; return fs.doc(db, "users", this.ownerUid, col, id); },

  async loadAll() {
    if (!this.ownerUid) this.ownerUid = this.user.uid;
    const allowed = this.readOnly ? colsForModules(this.modules || []) : COLLECTIONS;
    if (this.mode === "local") {
      const raw = JSON.parse(localStorage.getItem(this._localKey()) || "{}");
      this.profile = raw.profile || {};
      for (const c of COLLECTIONS) this.data[c] = allowed.includes(c) ? (raw.data?.[c] || []) : [];
      return;
    }
    const { fs, db } = this._fb;
    try {
      const snap = await fs.getDoc(fs.doc(db, "users", this.ownerUid));
      this.profile = snap.exists() ? snap.data() : {};
    } catch (e) { if (!this.readOnly) throw e; this.profile = {}; }
    await Promise.all(COLLECTIONS.map(async (c) => {
      if (!allowed.includes(c)) { this.data[c] = []; return; }
      try {
        const qs = await fs.getDocs(this._col(c));
        this.data[c] = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (e) { console.warn(`Sin acceso a ${c}`, e.code || e); this.data[c] = []; }
    }));
  },

  async saveProfile(patch) {
    this._guard();
    this.profile = { ...this.profile, ...patch, updatedAt: Date.now() };
    if (this.mode === "local") return this._saveLocal();
    const { fs, db } = this._fb;
    await fs.setDoc(fs.doc(db, "users", this.ownerUid), clean(this.profile), { merge: true });
  },

  async add(col, data) { return this.set(col, makeId(), { ...data, createdAt: Date.now() }); },

  async set(col, id, data) {
    this._guard();
    const rec = { ...data, id, updatedAt: Date.now() };
    const list = this.data[col];
    const i = list.findIndex((r) => r.id === id);
    if (i >= 0) list[i] = rec; else list.push(rec);
    if (this.mode === "local") { this._saveLocal(); return rec; }
    const { id: _omit, ...payload } = rec;
    await this._fb.fs.setDoc(this._doc(col, id), clean(payload));
    return rec;
  },

  async update(col, id, patch) {
    const cur = this.data[col].find((r) => r.id === id) || {};
    return this.set(col, id, { ...cur, ...patch });
  },

  async remove(col, id) {
    this._guard();
    this.data[col] = this.data[col].filter((r) => r.id !== id);
    if (this.mode === "local") return this._saveLocal();
    await this._fb.fs.deleteDoc(this._doc(col, id));
  },

  async removeWhere(col, pred) {
    const ids = this.data[col].filter(pred).map((r) => r.id);
    for (const id of ids) await this.remove(col, id);
  },

  /* --------------------- Accesos de solo lectura ------------------------ */
  _localShares() { return JSON.parse(localStorage.getItem("rack21:shares") || "[]"); },
  _saveLocalShares(list) { localStorage.setItem("rack21:shares", JSON.stringify(list)); },

  /* Accesos que YO (dueño) he concedido */
  async listMyShares() {
    if (this.mode === "local") return this._localShares().filter((s) => s.ownerUid === this.user.uid);
    const { fs, db } = this._fb;
    const qs = await fs.getDocs(fs.query(fs.collection(db, "shares"), fs.where("ownerUid", "==", this.user.uid)));
    return qs.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  /* Cuentas que otras personas ME han compartido */
  /* shareStatus: "ok" | "unverified" | "error" — se muestra en Ajustes para diagnóstico */
  async listSharedWithMe() {
    this.shareStatus = "ok";
    if (!this.user?.email) return [];
    if (this.mode === "local") return this._localShares().filter((s) => s.viewerEmail === this.user.email);
    if (!this.user.emailVerified) { this.shareStatus = "unverified"; return []; }
    const { fs, db } = this._fb;
    const q = () => fs.getDocs(fs.query(fs.collection(db, "shares"), fs.where("viewerEmail", "==", this.user.email)));
    try {
      const qs = await q();
      return qs.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      // 1) El token de sesión puede estar desactualizado (p. ej. correo verificado hace poco): se renueva y se reintenta
      if (e.code === "permission-denied") {
        try {
          await this._fb.a.currentUser.getIdToken(true);
          const qs = await q();
          return qs.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (e2) { e = e2; }
      }
      console.warn("No se pudieron leer los accesos compartidos", e);
      this.shareStatus = "error"; this.shareError = e.code || e.message;
      // 2) Diagnóstico: si tampoco se pueden leer los accesos propios, las reglas no están publicadas
      this.shareDiag = "token";
      try { await fs.getDocs(fs.query(fs.collection(db, "shares"), fs.where("ownerUid", "==", this.user.uid), fs.limit(1))); }
      catch { this.shareDiag = "rules"; }
      return [];
    }
  },

  /* Actualiza el estado de verificación del correo (por si se verificó en otro dispositivo) */
  async refreshVerification() {
    if (this.mode === "local" || !this.user || this.user.emailVerified) return;
    try {
      const u = this._fb.a.currentUser;
      await u.reload();
      if (u.emailVerified) { await u.getIdToken(true); this.user.emailVerified = true; }
    } catch (e) { console.warn("No se pudo actualizar la verificación", e); }
  },

  async saveShare(email, modules, note = "") {
    const viewerEmail = low(email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(viewerEmail)) throw new Error("Correo no válido");
    if (viewerEmail === this.user.email) throw new Error("No puede compartir la cuenta con su propio correo");
    const rec = {
      ownerUid: this.user.uid, ownerName: this.profile.name || this.user.displayName || this.user.email,
      viewerEmail, modules, collections: colsForModules(modules), note, updatedAt: Date.now()
    };
    const id = `${viewerEmail}_${this.user.uid}`;
    if (this.mode === "local") {
      const list = this._localShares().filter((s) => s.id !== id);
      list.push({ id, ...rec });
      this._saveLocalShares(list);
      return;
    }
    const { fs, db } = this._fb;
    await fs.setDoc(fs.doc(db, "shares", id), rec);
  },

  /* Mantiene los accesos al día cuando la app agrega colecciones nuevas a un módulo */
  async syncShares() {
    if (this.readOnly) return;
    try {
      const mine = await this.listMyShares();
      for (const x of mine) {
        const cols = colsForModules(x.modules || []);
        if (JSON.stringify([...cols].sort()) !== JSON.stringify([...(x.collections || [])].sort())) await this.saveShare(x.viewerEmail, x.modules, x.note || "");
      }
    } catch (e) { console.warn("No se pudieron actualizar los accesos", e); }
  },

  async deleteShare(id) {
    if (this.mode === "local") return this._saveLocalShares(this._localShares().filter((s) => s.id !== id));
    const { fs, db } = this._fb;
    await fs.deleteDoc(fs.doc(db, "shares", id));
  },

  exportJSON() {
    return JSON.stringify({ app: "RACK 21", exportedAt: new Date().toISOString(), profile: this.profile, data: this.data }, null, 2);
  },

  async importJSON(obj) {
    this._guard();
    if (!obj?.data) throw new Error("Archivo no válido");
    if (obj.profile) await this.saveProfile(obj.profile);
    for (const c of COLLECTIONS) {
      for (const r of obj.data[c] || []) {
        const { id, ...rest } = r;
        await this.set(c, id || makeId(), rest);
      }
    }
  }
};

/* Firestore no acepta undefined */
function clean(o) {
  return JSON.parse(JSON.stringify(o, (_k, v) => (v === undefined ? null : v)));
}
