/**
 * ObjectifsV2 — Page Objectifs V2 Esprit Padel OS
 * Cockpit SaaS premium : liste + vue détail d'un objectif
 * READ-ONLY vis-à-vis de Firestore.
 */
import React, { useState, useMemo } from "react";
import {
  useObjectives, useUsers, useTasks, usePublications,
  useCalendarEvents, useProjects, filterActiveObjectives,
} from "../hooks/useV1Data";

/* ── Helpers ── */
function pct(current, baseline, target) {
  if (target === undefined || target === null) return 0;
  const c = Number(current || 0);
  const b = Number(baseline || 0);
  const t = Number(target || 0);
  if (t <= b) return t > 0 ? Math.max(0, Math.min(100, Math.round((c / t) * 100))) : 0;
  return Math.max(0, Math.min(100, Math.round(((c - b) / (t - b)) * 100)));
}
function objPct(o) {
  if (o.progress !== undefined && o.progress !== null) return Number(o.progress);
  return pct(o.current, o.baseline, o.target);
}
function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
function fmtShort(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function statusLabel(s) {
  const map = { active: "En cours", scheduled: "Planifié", success: "Réussi", almost_success: "Presque réussi", failed: "Raté" };
  return map[s] || s || "En cours";
}
function statusColor(s) {
  if (s === "success") return { bg: "#eaf7ee", text: "#1a7a38", dot: "#1a7a38" };
  if (s === "almost_success") return { bg: "#fef8e4", text: "#8a5c00", dot: "#FEB601" };
  if (s === "failed") return { bg: "#fdf0ee", text: "#bf3327", dot: "#bf3327" };
  if (s === "scheduled") return { bg: "#eff6ff", text: "#0F56B8", dot: "#0F56B8" };
  return { bg: "#eaf7ee", text: "#1a7a38", dot: "#1a7a38" };
}
function clubColor(clubId) {
  const map = { "1": "#0F56B8", "2": "#FB8500", "3": "#1a7a38" };
  return map[String(clubId)] || "#9896a0";
}
function clubName(clubId, clubs) {
  if (clubs && clubs.length) {
    const c = clubs.find(x => String(x.id) === String(clubId));
    if (c) return c.name;
  }
  const map = { "1": "Saint-Priest", "2": "La Boisse", "3": "Mâcon" };
  return map[String(clubId)] || `Club ${clubId}`;
}
function userName(userId, users) {
  if (!users || !userId) return null;
  const u = users.find(x => String(x.id) === String(userId) || String(x.appId) === String(userId));
  if (!u) return null;
  return u.firstName ? `${u.firstName} ${u.lastName || ""}`.trim() : u.name || null;
}
function initials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}
function daysLeft(deadline) {
  if (!deadline) return null;
  const d = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d - today) / 86400000);
  return diff;
}

/* ── SVG inline icons ── */
function Ico({ d, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
function IcoTarget({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IcoChevRight({ size = 12 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9,18 15,12 9,6" /></svg>;
}
function IcoChevLeft({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15,18 9,12 15,6" /></svg>;
}
function IcoSearch({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>;
}
function IcoCalendar({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /></svg>;
}
function IcoUser({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
}
function IcoBarChart({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="14" width="4" height="7" rx="1" /><rect x="10" y="9" width="4" height="12" rx="1" /><rect x="17" y="5" width="4" height="16" rx="1" /></svg>;
}
function IcoAlert({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
}
function IcoCheck({ size = 12 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12" /></svg>;
}
function IcoPlus({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
}
function IcoLink({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>;
}
function IcoMegaphone({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a4 4 0 010 8" /><path d="M20 4a8 8 0 010 16" /><rect x="2" y="9" width="8" height="6" rx="1.5" /><path d="M10 9l8-5v16l-8-5" /></svg>;
}
function IcoLayers({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12,2 22,8.5 12,15 2,8.5" /><path d="M2 15.5l10 6.5 10-6.5" /><path d="M2 11.5l10 6.5 10-6.5" /></svg>;
}
function IcoClock({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" /></svg>;
}
function IcoEvent({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>;
}
function IcoEdit({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
}

/* ── Pill badge ── */
function Badge({ label, bg, color }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: bg || "var(--gray-bg)", color: color || "var(--text-2)",
      fontSize: 10.5, fontWeight: 700, borderRadius: 20,
      padding: "2px 9px", lineHeight: 1.5, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

/* ── Progress bar ── */
function ProgressBar({ value, color, height = 5 }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const c = color || (v >= 80 ? "#1a7a38" : v >= 50 ? "#FEB601" : "#FB8500");
  return (
    <div style={{ height, borderRadius: height, background: "#ECEAE5", overflow: "hidden", minWidth: 0 }}>
      <div style={{ height: "100%", width: `${v}%`, background: c, borderRadius: height, transition: "width .4s ease" }} />
    </div>
  );
}

/* ── KPI indicator row ── */
const KPI_ICONS = [
  <IcoBarChart size={14} />, <IcoTarget size={14} />, <IcoCheck size={14} />,
  <IcoLayers size={14} />, <IcoEvent size={14} />, <IcoUser size={14} />,
  <IcoMegaphone size={14} />, <IcoLink size={14} />,
];
const KPI_COLORS = [
  { bg: "rgba(254,182,1,.14)", color: "#8a5c00" },
  { bg: "rgba(15,86,184,.11)", color: "#0F56B8" },
  { bg: "rgba(26,122,56,.12)", color: "#1a7a38" },
  { bg: "rgba(251,133,0,.12)", color: "#b05a00" },
  { bg: "rgba(15,86,184,.11)", color: "#0F56B8" },
  { bg: "rgba(26,122,56,.12)", color: "#1a7a38" },
  { bg: "rgba(254,182,1,.14)", color: "#8a5c00" },
  { bg: "rgba(251,133,0,.12)", color: "#b05a00" },
];

function KpiRow({ label, value, target, unit, idx }) {
  const v = Number(value || 0);
  const t = Number(target || 0);
  const progress = t > 0 ? Math.min(100, Math.round((v / t) * 100)) : 0;
  const pal = KPI_COLORS[idx % KPI_COLORS.length];
  const isMock = target === "MOCK";
  return (
    <div className="obj-kpi-row">
      <div className="obj-kpi-icon" style={{ background: pal.bg, color: pal.color }}>
        {KPI_ICONS[idx % KPI_ICONS.length]}
      </div>
      <div className="obj-kpi-body">
        <div className="obj-kpi-top">
          <span className="obj-kpi-label">{label}</span>
          {isMock && <span className="obj-mock-tag">aperçu</span>}
          <span className="obj-kpi-value">
            {isMock ? <span style={{ color: "var(--text-3)" }}>—</span> : (
              <>{Number(v).toLocaleString("fr-FR")}<span style={{ color: "var(--text-3)", fontWeight: 500 }}> / {Number(t).toLocaleString("fr-FR")} {unit}</span></>
            )}
          </span>
        </div>
        <ProgressBar value={isMock ? 0 : progress} color={pal.color} height={4} />
      </div>
      <button className="obj-kpi-arrow"><IcoChevRight size={11} /></button>
    </div>
  );
}

/* ── Empty state ── */
function EmptyState({ icon, text, sub }) {
  return (
    <div className="obj-empty">
      <div className="obj-empty-icon">{icon}</div>
      <div className="obj-empty-text">{text}</div>
      {sub && <div className="obj-empty-sub">{sub}</div>}
    </div>
  );
}

/* ════════════════════════════════════════
   LISTE DES OBJECTIFS
════════════════════════════════════════ */
function ObjectifsList({ objectives, users, onSelect }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("current");

  const FILTERS = [
    { key: "current", label: "En cours" },
    { key: "scheduled", label: "Planifiés" },
    { key: "finished", label: "Terminés" },
    { key: "all", label: "Tous" },
  ];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return objectives.filter(o => {
      const s = o.status || "active";
      const passFilter =
        filter === "all" ? true :
        filter === "current" ? (s === "active" || s === "en cours") :
        filter === "scheduled" ? s === "scheduled" :
        filter === "finished" ? ["success", "almost_success", "failed"].includes(s) :
        true;
      const passSearch = !q || (o.title || "").toLowerCase().includes(q);
      return passFilter && passSearch;
    });
  }, [objectives, filter, search]);

  return (
    <div className="obj-list-page">
      {/* Searchbar */}
      <div className="obj-searchbar">
        <IcoSearch size={15} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un objectif, un club, une campagne..."
          className="obj-searchbar-input"
        />
      </div>

      {/* Header */}
      <div className="obj-page-header">
        <div className="obj-page-header-left">
          <div className="obj-page-icon">
            <IcoTarget size={20} />
          </div>
          <div>
            <h1 className="obj-page-title">Objectifs</h1>
            <p className="obj-page-sub">{filtered.length} objectif{filtered.length !== 1 ? "s" : ""} · {objectives.filter(o => ["active","en cours"].includes(o.status || "active")).length} en cours</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="obj-filter-bar">
        {FILTERS.map(f => (
          <button key={f.key} className={`obj-filter-btn${filter === f.key ? " active" : ""}`} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState icon={<IcoTarget size={28} />} text="Aucun objectif trouvé" sub="Modifiez vos filtres ou créez un nouvel objectif." />
      ) : (
        <div className="obj-cards-grid">
          {filtered.map(o => {
            const p = objPct(o);
            const sc = statusColor(o.status);
            const dl = daysLeft(o.deadline);
            const owner = userName(o.owner || (o.assignedTo && o.assignedTo[0]), users);
            return (
              <div key={o.id} className="obj-card" onClick={() => onSelect(o)}>
                <div className="obj-card-header">
                  <div className="obj-card-icon" style={{ background: `${clubColor(o.club)}18`, color: clubColor(o.club) }}>
                    <IcoTarget size={15} />
                  </div>
                  <div className="obj-card-meta">
                    <div className="obj-card-club" style={{ color: clubColor(o.club) }}>
                      {clubName(o.club)}
                    </div>
                    <Badge label={statusLabel(o.status)} bg={sc.bg} color={sc.text} />
                  </div>
                  <IcoChevRight size={13} />
                </div>
                <div className="obj-card-title">{o.title}</div>
                <div className="obj-card-progress">
                  <ProgressBar value={p} />
                  <div className="obj-card-pct">{p}%</div>
                </div>
                <div className="obj-card-footer">
                  <span><IcoCalendar size={11} /> {fmtShort(o.startDate)} → {fmtShort(o.deadline)}</span>
                  {dl !== null && (
                    <span style={{ color: dl < 0 ? "var(--red)" : dl <= 14 ? "#b05a00" : "var(--text-3)" }}>
                      {dl < 0 ? `${Math.abs(dl)}j de retard` : dl === 0 ? "Échéance aujourd'hui" : `${dl}j restants`}
                    </span>
                  )}
                </div>
                {owner && (
                  <div className="obj-card-owner">
                    <div className="obj-avatar obj-avatar-xs" style={{ background: "#e0eaff", color: "#0F56B8" }}>{initials(owner)}</div>
                    <span>{owner}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   VUE DÉTAIL D'UN OBJECTIF
════════════════════════════════════════ */
function ObjectifDetail({ obj, users, tasks, publications, events, projects, onBack }) {
  const p = objPct(obj);
  const sc = statusColor(obj.status);
  const dl = daysLeft(obj.deadline);

  /* Relations réelles */
  const linkedTasks = useMemo(() => {
    if (!Array.isArray(tasks)) return [];
    return tasks.filter(t => t && (
      String(t.objectiveId) === String(obj.id) ||
      String(t.objective) === String(obj.id)
    ));
  }, [tasks, obj.id]);

  const linkedPubs = useMemo(() => {
    if (!Array.isArray(publications)) return [];
    return publications.filter(pub => pub && (
      String(pub.objectiveId) === String(obj.id) ||
      String(pub.objective) === String(obj.id)
    ));
  }, [publications, obj.id]);

  const linkedEvents = useMemo(() => {
    if (!Array.isArray(events)) return [];
    return events.filter(ev => ev && (
      String(ev.objectiveId) === String(obj.id) ||
      String(ev.objective) === String(obj.id)
    ));
  }, [events, obj.id]);

  const linkedProjects = useMemo(() => {
    if (!Array.isArray(projects)) return [];
    return projects.filter(pr => pr && (
      String(pr.objectiveId) === String(obj.id) ||
      String(pr.objective) === String(obj.id)
    ));
  }, [projects, obj.id]);

  /* Alertes calculées */
  const alerts = useMemo(() => {
    const list = [];
    if (dl !== null && dl < 0) list.push({ type: "red", text: `Échéance dépassée de ${Math.abs(dl)} jour${Math.abs(dl) > 1 ? "s" : ""}` });
    else if (dl !== null && dl <= 14 && dl >= 0) list.push({ type: "orange", text: `Échéance dans ${dl} jour${dl > 1 ? "s" : ""}` });
    if (p < 30 && (obj.status === "active" || !obj.status)) list.push({ type: "orange", text: "Progression inférieure à 30% — objectif à risque" });
    const overdueTasks = linkedTasks.filter(t => {
      if (t.status === "Terminé" || t.status === "done") return false;
      if (!t.deadline) return false;
      return new Date(t.deadline) < new Date();
    });
    if (overdueTasks.length > 0) list.push({ type: "orange", text: `${overdueTasks.length} tâche${overdueTasks.length > 1 ? "s" : ""} en retard` });
    return list;
  }, [dl, p, obj.status, linkedTasks]);

  /* KPI MOCK — marqués clairement, non présentés comme données réelles */
  // MOCK: ces KPI sont des exemples visuels. Ils n'existent pas encore dans Firestore.
  const MOCK_KPIS = [
    { label: "Avancement global", value: p, target: 100, unit: "%", isMock: false },
    { label: "Tâches terminées", value: linkedTasks.filter(t => t.status === "Terminé" || t.status === "done").length, target: linkedTasks.length || "MOCK", unit: "", isMock: linkedTasks.length === 0 },
    { label: "Contenus publiés", value: linkedPubs.filter(pub => (pub.status || pub.statut || "").toLowerCase() === "publié" || (pub.status || "").toLowerCase() === "published").length, target: linkedPubs.length || "MOCK", unit: "", isMock: linkedPubs.length === 0 },
    { label: "Clubs mobilisés", value: obj.club ? 1 : 0, target: 3, unit: "clubs", isMock: true },
    { label: "Portée réseaux sociaux", value: null, target: "MOCK", unit: "", isMock: true },
    { label: "Taux d'engagement", value: null, target: "MOCK", unit: "", isMock: true },
  ];

  const assignedUsers = useMemo(() => {
    if (!users || !users.length) return [];
    const ids = obj.assignedTo || (obj.owner ? [obj.owner] : []);
    return ids.map(id => users.find(u => String(u.id) === String(id) || String(u.appId) === String(id))).filter(Boolean);
  }, [users, obj]);

  return (
    <div className="obj-detail-page">
      {/* Searchbar */}
      <div className="obj-searchbar">
        <IcoSearch size={15} />
        <input
          readOnly
          defaultValue=""
          placeholder="Rechercher un objectif, une campagne, un contenu, un club..."
          className="obj-searchbar-input"
        />
      </div>

      {/* Breadcrumb */}
      <div className="obj-breadcrumb">
        <button className="obj-back-btn" onClick={onBack}><IcoChevLeft size={13} /> Objectifs</button>
        <span className="obj-breadcrumb-sep"><IcoChevRight size={11} /></span>
        <span className="obj-breadcrumb-current">{obj.title}</span>
      </div>

      {/* Page header */}
      <div className="obj-detail-header">
        <div className="obj-detail-header-left">
          <div className="obj-detail-icon" style={{ background: `${clubColor(obj.club)}18`, color: clubColor(obj.club) }}>
            <IcoTarget size={22} />
          </div>
          <div>
            <div className="obj-detail-header-row">
              <h1 className="obj-detail-title">{obj.title}</h1>
              <span className="obj-status-dot" style={{ background: sc.dot }} />
              <Badge label={statusLabel(obj.status)} bg={sc.bg} color={sc.text} />
            </div>
            <p className="obj-detail-sub">
              Objectif de communication · {clubName(obj.club)} · créé le {fmtDate(obj.createdAt)}
            </p>
          </div>
        </div>
        <div className="obj-detail-header-right">
          <div className="obj-period-card">
            <div className="obj-period-line"><IcoCalendar size={11} />{fmtShort(obj.startDate)}</div>
            <div className="obj-period-arrow">→</div>
            <div className="obj-period-line"><IcoCalendar size={11} />{fmtShort(obj.deadline)}</div>
          </div>
          <button className="obj-btn-edit"><IcoEdit size={13} /> Modifier</button>
          <button className="obj-btn-more">···</button>
        </div>
      </div>

      {/* Alertes banner */}
      {alerts.length > 0 && (
        <div className="obj-alerts-banner">
          {alerts.map((a, i) => (
            <div key={i} className={`obj-alert-item obj-alert-${a.type}`}>
              <IcoAlert size={12} /> {a.text}
            </div>
          ))}
        </div>
      )}

      {/* 3-col grid */}
      <div className="obj-detail-grid">

        {/* ── COL GAUCHE ── */}
        <div className="obj-detail-col obj-detail-col--left">

          {/* Carte identité */}
          <div className="obj-card-block">
            <div className="obj-card-block-header">
              <span className="obj-card-block-title">Identité de l'objectif</span>
            </div>
            <div className="obj-id-section">
              <div className="obj-id-visual">
                <div className="obj-id-icon" style={{ background: `${clubColor(obj.club)}18`, color: clubColor(obj.club) }}>
                  <IcoTarget size={26} />
                </div>
                <div>
                  <div className="obj-id-name">{obj.title}</div>
                  <div style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
                    <Badge label="Objectif comm." bg="var(--gray-bg)" color="var(--text-2)" />
                    <Badge label="Priorité haute" bg="var(--yellow-bg)" color="#8a5c00" />
                  </div>
                </div>
              </div>
            </div>

            <div className="obj-info-list">
              {[
                { icon: <Ico d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" size={13} />, label: "Statut", value: <Badge label={statusLabel(obj.status)} bg={sc.bg} color={sc.text} /> },
                { icon: <IcoUser size={13} />, label: "Responsable", value: userName(obj.owner, users) || "—" },
                { icon: <IcoCalendar size={13} />, label: "Début", value: fmtDate(obj.startDate) },
                { icon: <IcoCalendar size={13} />, label: "Échéance", value: fmtDate(obj.deadline) },
                { icon: <IcoBarChart size={13} />, label: "Source métrique", value: obj.source || obj.metricKey || "—" },
                { icon: <IcoClock size={13} />, label: "Dernière MAJ", value: obj.updatedAt ? fmtDate(obj.updatedAt) : fmtDate(obj.createdAt) },
              ].map((row, i) => (
                <div key={i} className="obj-info-row">
                  <span className="obj-info-icon">{row.icon}</span>
                  <span className="obj-info-label">{row.label}</span>
                  <span className="obj-info-value">{row.value}</span>
                </div>
              ))}

              <div className="obj-info-row">
                <span className="obj-info-icon"><IcoLink size={13} /></span>
                <span className="obj-info-label">Club</span>
                <span className="obj-info-value">
                  <span className="obj-club-chip" style={{ background: `${clubColor(obj.club)}18`, color: clubColor(obj.club), borderColor: `${clubColor(obj.club)}33` }}>
                    {clubName(obj.club)}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Résultat attendu */}
          <div className="obj-card-block obj-result-block">
            <div className="obj-card-block-header">
              <span className="obj-card-block-title">Résultat attendu</span>
            </div>
            <div className="obj-result-body">
              {obj.target ? (
                <div className="obj-result-metric">
                  <span className="obj-result-value">{Number(obj.target).toLocaleString("fr-FR")}</span>
                  <span className="obj-result-unit">{obj.unit || ""}</span>
                </div>
              ) : null}
              <p className="obj-result-desc">
                {obj.description || `Atteindre ${obj.target ? Number(obj.target).toLocaleString("fr-FR") : "la cible"} ${obj.unit || ""} d'ici le ${fmtDate(obj.deadline)} pour ${clubName(obj.club)}.`}
              </p>
              <div className="obj-result-from">
                <span>Départ : <strong>{Number(obj.baseline || obj.current || 0).toLocaleString("fr-FR")} {obj.unit || ""}</strong></span>
                {obj.target && <span>Cible : <strong>{Number(obj.target).toLocaleString("fr-FR")} {obj.unit || ""}</strong></span>}
              </div>
            </div>
          </div>

        </div>

        {/* ── COL CENTRALE ── */}
        <div className="obj-detail-col obj-detail-col--center">

          {/* Progression & indicateurs */}
          <div className="obj-card-block">
            <div className="obj-card-block-header">
              <span className="obj-card-block-title">Progression & indicateurs</span>
              <span className="obj-tab-pill">Vue globale</span>
            </div>

            {/* Gros chiffre progression */}
            <div className="obj-big-progress">
              <div className="obj-big-progress-ring">
                <svg viewBox="0 0 80 80" width="80" height="80">
                  <circle cx="40" cy="40" r="33" fill="none" stroke="#ECEAE5" strokeWidth="7" />
                  <circle cx="40" cy="40" r="33" fill="none"
                    stroke={p >= 80 ? "#1a7a38" : p >= 50 ? "#FEB601" : "#FB8500"}
                    strokeWidth="7" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 33}`}
                    strokeDashoffset={`${2 * Math.PI * 33 * (1 - p / 100)}`}
                    transform="rotate(-90 40 40)"
                  />
                </svg>
                <span className="obj-big-progress-pct">{p}%</span>
              </div>
              <div className="obj-big-progress-info">
                <div className="obj-big-progress-label">Avancement global</div>
                <div className="obj-big-progress-vals">
                  <span><strong>{Number(obj.current || 0).toLocaleString("fr-FR")}</strong> {obj.unit}</span>
                  <span style={{ color: "var(--text-3)" }}>/ {Number(obj.target || 0).toLocaleString("fr-FR")} {obj.unit}</span>
                </div>
                {dl !== null && (
                  <div style={{ fontSize: 11, color: dl <= 14 ? "#b05a00" : "var(--text-3)", marginTop: 4 }}>
                    <IcoClock size={11} /> {dl < 0 ? `${Math.abs(dl)}j de retard` : `${dl}j restants`}
                  </div>
                )}
              </div>
            </div>

            {/* KPI rows */}
            <div className="obj-kpi-list">
              {MOCK_KPIS.map((kpi, i) => (
                <KpiRow key={i} idx={i}
                  label={kpi.label}
                  value={kpi.isMock ? null : kpi.value}
                  target={kpi.isMock ? "MOCK" : kpi.target}
                  unit={kpi.unit}
                />
              ))}
            </div>
          </div>

          {/* Graphique évolution */}
          <div className="obj-card-block">
            <div className="obj-card-block-header">
              <span className="obj-card-block-title">Évolution de l'objectif</span>
            </div>
            <div className="obj-chart-empty">
              <div className="obj-chart-empty-icon"><IcoBarChart size={22} /></div>
              <div className="obj-chart-empty-text">Le graphique d'évolution apparaîtra dès que plusieurs points de progression auront été enregistrés.</div>
            </div>
          </div>

          {/* Équipe */}
          <div className="obj-card-block">
            <div className="obj-card-block-header">
              <span className="obj-card-block-title">Équipe & responsabilités</span>
            </div>
            {assignedUsers.length === 0 ? (
              <EmptyState icon={<IcoUser size={20} />} text="Aucun membre assigné" />
            ) : (
              <div className="obj-team-list">
                {assignedUsers.map((u, i) => {
                  const name = u.firstName ? `${u.firstName} ${u.lastName || ""}`.trim() : u.name || "Membre";
                  const isOwner = String(u.id) === String(obj.owner) || String(u.appId) === String(obj.owner);
                  return (
                    <div key={u.id || i} className="obj-team-row">
                      <div className="obj-avatar" style={{ background: "#e0eaff", color: "#0F56B8" }}>{initials(name)}</div>
                      <div className="obj-team-info">
                        <div className="obj-team-name">{name}</div>
                        <div className="obj-team-role">{u.role || "Contributeur"}</div>
                      </div>
                      {isOwner && <Badge label="Responsable" bg="var(--yellow-bg)" color="#8a5c00" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* ── COL DROITE ── */}
        <div className="obj-detail-col obj-detail-col--right">

          {/* Alertes */}
          {alerts.length > 0 && (
            <div className="obj-card-block obj-alerts-block">
              <div className="obj-card-block-header">
                <span className="obj-card-block-title">Alertes</span>
                <span className="obj-alert-count">{alerts.length}</span>
              </div>
              {alerts.map((a, i) => (
                <div key={i} className={`obj-alert-row obj-alert-row--${a.type}`}>
                  <IcoAlert size={12} />
                  <span>{a.text}</span>
                  <IcoChevRight size={11} />
                </div>
              ))}
            </div>
          )}

          {/* Campagnes liées */}
          <div className="obj-card-block">
            <div className="obj-card-block-header">
              <span className="obj-card-block-title">Campagnes liées</span>
              <button className="obj-add-btn"><IcoPlus size={11} /></button>
            </div>
            {linkedProjects.length === 0 ? (
              <EmptyState icon={<IcoMegaphone size={18} />} text="Aucune campagne liée" sub="Associez une campagne à cet objectif." />
            ) : (
              <div className="obj-related-list">
                {linkedProjects.slice(0, 4).map((pr, i) => (
                  <div key={i} className="obj-related-row">
                    <div className="obj-related-icon" style={{ background: "rgba(15,86,184,.10)", color: "#0F56B8" }}><IcoMegaphone size={13} /></div>
                    <div className="obj-related-info">
                      <div className="obj-related-name">{pr.title || pr.name}</div>
                      <div className="obj-related-meta">{fmtShort(pr.date || pr.startDate)}</div>
                    </div>
                    <IcoChevRight size={11} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Événements liés */}
          <div className="obj-card-block">
            <div className="obj-card-block-header">
              <span className="obj-card-block-title">Événements liés</span>
              <button className="obj-add-btn"><IcoPlus size={11} /></button>
            </div>
            {linkedEvents.length === 0 ? (
              <EmptyState icon={<IcoEvent size={18} />} text="Aucun événement lié" />
            ) : (
              <div className="obj-related-list">
                {linkedEvents.slice(0, 4).map((ev, i) => (
                  <div key={i} className="obj-related-row">
                    <div className="obj-related-date-badge">
                      <span>{fmtShort(ev.date).split(" ")[0]}</span>
                      <span>{fmtShort(ev.date).split(" ")[1]}</span>
                    </div>
                    <div className="obj-related-info">
                      <div className="obj-related-name">{ev.title}</div>
                      <div className="obj-related-meta">{clubName(ev.club)}</div>
                    </div>
                    <IcoChevRight size={11} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contenus liés */}
          <div className="obj-card-block">
            <div className="obj-card-block-header">
              <span className="obj-card-block-title">Contenus liés</span>
              <button className="obj-add-btn"><IcoPlus size={11} /></button>
            </div>
            {linkedPubs.length === 0 ? (
              <EmptyState icon={<IcoLayers size={18} />} text="Aucun contenu lié" />
            ) : (
              <div className="obj-related-list">
                {linkedPubs.slice(0, 5).map((pub, i) => {
                  const pubStatus = pub.status || pub.statut || "";
                  const isPub = pubStatus.toLowerCase().includes("publi");
                  const isPending = pubStatus.toLowerCase().includes("valider") || pubStatus.toLowerCase().includes("review");
                  const statusPill = isPub ? { bg: "var(--green-bg)", color: "var(--green)" } : isPending ? { bg: "var(--yellow-bg)", color: "#8a5c00" } : { bg: "var(--gray-bg)", color: "var(--text-2)" };
                  return (
                    <div key={i} className="obj-related-row">
                      <div className="obj-related-icon" style={{ background: "rgba(251,133,0,.10)", color: "#b05a00" }}><IcoLayers size={13} /></div>
                      <div className="obj-related-info">
                        <div className="obj-related-name">{pub.title}</div>
                        <div className="obj-related-meta">{pub.platform} · <Badge label={pubStatus || "Brouillon"} bg={statusPill.bg} color={statusPill.color} /></div>
                      </div>
                      <IcoChevRight size={11} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tâches liées */}
          <div className="obj-card-block">
            <div className="obj-card-block-header">
              <span className="obj-card-block-title">Tâches liées</span>
              <button className="obj-add-btn"><IcoPlus size={11} /></button>
            </div>
            {linkedTasks.length === 0 ? (
              <EmptyState icon={<Ico d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" size={18} />} text="Aucune tâche liée" />
            ) : (
              <div className="obj-related-list">
                {linkedTasks.slice(0, 5).map((t, i) => {
                  const done = t.status === "Terminé" || t.status === "done";
                  return (
                    <div key={i} className="obj-related-row">
                      <div className={`obj-task-check${done ? " done" : ""}`}>
                        {done && <IcoCheck size={9} />}
                      </div>
                      <div className="obj-related-info">
                        <div className="obj-related-name" style={{ textDecoration: done ? "line-through" : "none", color: done ? "var(--text-3)" : "var(--text)" }}>{t.title}</div>
                        {t.deadline && <div className="obj-related-meta"><IcoCalendar size={10} /> {fmtShort(t.deadline)}</div>}
                      </div>
                      <IcoChevRight size={11} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Historique */}
          <div className="obj-card-block">
            <div className="obj-card-block-header">
              <span className="obj-card-block-title">Historique</span>
            </div>
            <EmptyState
              icon={<IcoClock size={18} />}
              text="Aucun historique disponible"
              sub="L'activité apparaîtra ici au fil des mises à jour."
            />
          </div>

        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   EXPORT PRINCIPAL
════════════════════════════════════════ */
export default function ObjectifsV2({ appId, currentUser, onNavigate }) {
  const { objectives, loading: loadingObj } = useObjectives();
  const { users } = useUsers();
  const { tasks } = useTasks();
  const { publications } = usePublications();
  const { events } = useCalendarEvents();
  const { projects } = useProjects();

  const [selected, setSelected] = useState(null);

  if (loadingObj) {
    return (
      <div className="obj-loading">
        <div className="v2-spinner" />
        <span>Chargement des objectifs…</span>
      </div>
    );
  }

  if (selected) {
    return (
      <ObjectifDetail
        obj={selected}
        users={users}
        tasks={tasks}
        publications={publications}
        events={events}
        projects={projects}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <ObjectifsList
      objectives={objectives}
      users={users}
      onSelect={setSelected}
    />
  );
}
