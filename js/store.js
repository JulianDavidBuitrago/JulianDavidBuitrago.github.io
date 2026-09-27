/* =====================================================================
   RACK 21 · Capa de datos
   Firebase Auth + Cloud Firestore, con respaldo en modo local.
   Estructura en Firestore:
     users/{uid}                    → perfil (documento)
     users/{uid}/{colección}/{id}   → registros
   ===================================================================== */
import { firebaseConfig, isFirebaseConfigured } from "./config.js";
import { uid as makeId } from "./utils.js";

export const COLLECTIONS = [
  "habits", "habitLogs", "chores", "choreLogs", "businesses", "transactions",
  "workouts", "goals", "commitments", "chat"
];

const FB_VER = "10.12.2";
const FB = (m) => `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-${m}.js`;

export const DB = {
  mode: isFirebaseConfigured() ? "firebase" : "local",
  user: null,
  profile: {},
  data: Object.fromEntries(COLLECTIONS.map((c) => [c, []])),
  _fb: null,

  /* ---------------------------- Autenticación ---------------------------- */
  async init(onUser) {
    if (this.mode === "local") {
      const s = localStorage.getItem("rack21:session");
      this.user = s ? JSON.parse(s) : null;
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
    auth.onAuthStateChanged(a, (u) => {
      this.user = u ? { uid: u.uid, email: u.email, displayName: u.displayName || "" } : null;
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
  },
  async signInGoogle() {
    if (this.mode === "local") return this._localLogin("demo@rack21.app", "Campeón");
    const { auth, a } = this._fb;
    await auth.signInWithPopup(a, new auth.GoogleAuthProvider());
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
    this.user = { uid: "local", email: email || "modo-local", displayName: name };
    localStorage.setItem("rack21:session", JSON.stringify(this.user));
    location.reload();
  },

  /* ------------------------------- Datos -------------------------------- */
  _localKey() { return `rack21:data:${this.user.uid}`; },
  _saveLocal() {
    localStorage.setItem(this._localKey(), JSON.stringify({ profile: this.profile, data: this.data }));
  },
  _col(col) { const { fs, db } = this._fb; return fs.collection(db, "users", this.user.uid, col); },
  _doc(col, id) { const { fs, db } = this._fb; return fs.doc(db, "users", this.user.uid, col, id); },

  async loadAll() {
    if (this.mode === "local") {
      const raw = JSON.parse(localStorage.getItem(this._localKey()) || "{}");
      this.profile = raw.profile || {};
      for (const c of COLLECTIONS) this.data[c] = raw.data?.[c] || [];
      return;
    }
    const { fs, db } = this._fb;
    const snap = await fs.getDoc(fs.doc(db, "users", this.user.uid));
    this.profile = snap.exists() ? snap.data() : {};
    const results = await Promise.all(COLLECTIONS.map((c) => fs.getDocs(this._col(c))));
    results.forEach((qs, i) => {
      this.data[COLLECTIONS[i]] = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
    });
  },

  async saveProfile(patch) {
    this.profile = { ...this.profile, ...patch, updatedAt: Date.now() };
    if (this.mode === "local") return this._saveLocal();
    const { fs, db } = this._fb;
    await fs.setDoc(fs.doc(db, "users", this.user.uid), clean(this.profile), { merge: true });
  },

  async add(col, data) { return this.set(col, makeId(), { ...data, createdAt: Date.now() }); },

  async set(col, id, data) {
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
    this.data[col] = this.data[col].filter((r) => r.id !== id);
    if (this.mode === "local") return this._saveLocal();
    await this._fb.fs.deleteDoc(this._doc(col, id));
  },

  async removeWhere(col, pred) {
    const ids = this.data[col].filter(pred).map((r) => r.id);
    for (const id of ids) await this.remove(col, id);
  },

  exportJSON() {
    return JSON.stringify({ app: "RACK 21", exportedAt: new Date().toISOString(), profile: this.profile, data: this.data }, null, 2);
  },

  async importJSON(obj) {
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
