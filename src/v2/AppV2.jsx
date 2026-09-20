/**
 * AppV2 — Shell principal de la V2 Esprit Padel OS.
 *
 * Coexiste avec App.jsx (V1) : ces deux composants ne tournent jamais ensemble.
 * Le toggle USE_V2_SHELL dans src/index.js détermine lequel est rendu.
 *
 * V2 lit les données V1 en lecture seule. Aucune écriture Firestore.
 * Aucune migration. La V1 reste opérationnelle si USE_V2_SHELL = false.
 */
import React, { useState, useMemo } from "react";
import "./v2.css";
import { useAuth } from "../auth/AuthContext";
import { loginUser } from "../auth/authService";
import AppShell from "./layout/AppShell";
import DashboardV2 from "./pages/DashboardV2";
import ObjectifsV2 from "./pages/ObjectifsV2";
import CalendrierV2 from "./pages/CalendrierV2";
import DemandesV2 from "./pages/DemandesV2";
import PlaceholderPage from "./pages/PlaceholderPage";
import { useUsers } from "./hooks/useV1Data";
import { useRequests, filterOpenRequests } from "./hooks/useV1Data";

/* ── Login page ── */
function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginUser(email, password, remember);
      // onAuthStateChanged in AuthContext handles the rest
    } catch (err) {
      const code = err?.code || "";
      if (code.includes("user-not-found") || code.includes("wrong-password") || code.includes("invalid-credential")) {
        setError("Email ou mot de passe incorrect.");
      } else if (code.includes("too-many-requests")) {
        setError("Trop de tentatives. Veuillez patienter avant de réessayer.");
      } else {
        setError("Une erreur est survenue. Veuillez réessayer.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="v2-login">
      <div className="v2-login__card">
        <div className="v2-login__logo">
          <div className="v2-login__logo-mark">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
              <path d="M4 19L9 5L14 19" stroke="#1a1a1c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 14h6" stroke="#1a1a1c" strokeWidth="2.2" strokeLinecap="round"/>
              <circle cx="19" cy="15" r="3.5" fill="#1a1a1c"/>
            </svg>
          </div>
          <h1 className="v2-login__title">Esprit Padel</h1>
          <p className="v2-login__sub">Communication OS — V2</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="v2-form-group">
            <label className="v2-form-label" htmlFor="v2-email">Adresse email</label>
            <input
              id="v2-email"
              type="email"
              className={`v2-form-input${error ? " error" : ""}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="vous@espritpadel.com"
            />
          </div>

          <div className="v2-form-group">
            <label className="v2-form-label" htmlFor="v2-password">Mot de passe</label>
            <input
              id="v2-password"
              type="password"
              className={`v2-form-input${error ? " error" : ""}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
            {error && <p className="v2-form-error">{error}</p>}
          </div>

          <label className="v2-login__remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Rester connecté
          </label>

          <div className="v2-login__actions">
            <button type="submit" className="v2-login__btn" disabled={loading}>
              {loading ? (
                <span className="v2-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              ) : "Se connecter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Loading screen ── */
function LoadingScreen({ message = "Chargement…" }) {
  return (
    <div className="v2-loading">
      <div className="v2-spinner" />
      <span className="v2-loading__text">{message}</span>
    </div>
  );
}

/* ── Error screen ── */
function ErrorScreen({ message }) {
  return (
    <div className="v2-loading">
      <p style={{ color: "var(--red)", fontSize: 14, textAlign: "center", maxWidth: 320 }}>{message}</p>
    </div>
  );
}

/* ── Page title map ── */
const PAGE_TITLES = {
  dashboard:   "Dashboard",
  objectifs:   "Objectifs",
  demandes:    "Demandes clubs",
  campagnes:   "Campagnes",
  calendrier:  "Calendrier",
  contenus:    "Contenus",
  projets:     "Projets & Tâches",
  mail:        "Boîte mail",
  evenements:  "Événements",
  kpi:         "KPI & Reporting",
  brand:       "Brand Center",
  equipe:      "Équipe",
  ressources:  "Ressources",
  formation:   "Formation",
  parametres:  "Paramètres",
};

/* ── Main App ── */
export default function AppV2() {
  const { firebaseUser, appId, authLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState("dashboard");
  // Prépare le deep-link DemandesV2 : sera branché depuis CalendrierV2 lors d'une passe ultérieure.
  const [selectedDemandeId, setSelectedDemandeId] = useState(null);

  // Read users to find current user profile + role
  const { users, loading: loadingUsers } = useUsers();
  const currentUser = useMemo(() => {
    if (!appId || !users.length) return null;
    return users.find((u) => u.id === appId || u.appId === appId) || null;
  }, [users, appId]);

  // Badges for sidebar
  const { requests } = useRequests();
  const openReqCount = useMemo(() => filterOpenRequests(requests).length, [requests]);
  const badges = useMemo(() => ({
    demandes: openReqCount,
    mail: 0, // À connecter quand boîte mail sera implémentée
  }), [openReqCount]);

  // ── States ──
  if (authLoading) return (
    <div className="v2-app">
      <LoadingScreen message="Connexion en cours…" />
    </div>
  );

  if (!firebaseUser) return (
    <div className="v2-app">
      <LoginPage />
    </div>
  );

  if (!authLoading && !appId) return (
    <div className="v2-app">
      <ErrorScreen message="Votre compte n'est pas encore configuré. Contactez l'administrateur." />
    </div>
  );

  // ── App shell ──
  function renderPage() {
    if (currentPage === "dashboard") {
      return (
        <DashboardV2
          appId={appId}
          currentUser={currentUser}
          onNavigate={setCurrentPage}
        />
      );
    }
    if (currentPage === "objectifs") {
      return (
        <ObjectifsV2
          appId={appId}
          currentUser={currentUser}
          onNavigate={setCurrentPage}
        />
      );
    }
    if (currentPage === "calendrier") {
      return (
        <CalendrierV2
          appId={appId}
          currentUser={currentUser}
          onNavigate={setCurrentPage}
        />
      );
    }
    if (currentPage === "demandes") {
      return (
        <DemandesV2
          appId={appId}
          currentUser={currentUser}
          onNavigate={setCurrentPage}
          initialSelectedId={selectedDemandeId}
        />
      );
    }
    return (
      <PlaceholderPage
        pageId={currentPage}
        title={PAGE_TITLES[currentPage] || currentPage}
      />
    );
  }

  return (
    <div className="v2-app">
      <AppShell
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        badges={badges}
        currentUser={currentUser}
      >
        {renderPage()}
      </AppShell>
    </div>
  );
}
