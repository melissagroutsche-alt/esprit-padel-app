/**
 * ObjectifsV2 — Page Objectifs V2 Esprit Padel OS
 * Cockpit SaaS premium : liste cockpit + vue détail 3 colonnes
 * READ-ONLY vis-à-vis de Firestore.
 */
import React, { useState, useMemo } from "react";
import {
  useObjectives, useUsers, useClubs, useTasks, usePublications,
  useCalendarEvents, useProjects,
} from "../hooks/useV1Data";

/* ══════════════════════════════════════
   HELPERS
══════════════════════════════════════ */
function objPct(o) {
  if (o.progress !== undefined && o.progress !== null) return Math.max(0, Math.min(100, Number(o.progress)));
  const c = Number(o.current || 0);
  const b = Number(o.baseline || 0);
  const t = Number(o.target || 0);
  if (t <= b) return t > 0 ? Math.max(0, Math.min(100, Math.round((c / t) * 100))) : 0;
  return Math.max(0, Math.min(100, Math.round(((c - b) / (t - b)) * 100)));
}
function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
function fmtShort(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function statusLabel(s) {
  const norm = (s || "").toLowerCase();
  if (norm === "active" || norm === "actif" || norm === "en cours") return "En cours";
  if (norm === "scheduled" || norm === "planifié") return "Planifié";
  if (norm === "success" || norm === "réussi") return "Réussi";
  if (norm === "almost_success") return "Presque réussi";
  if (norm === "failed" || norm === "raté") return "Raté";
  return s || "En cours";
}
function statusColor(s) {
  const n = (s || "").toLowerCase();
  if (n === "success" || n === "réussi") return { bg: "#eaf7ee", text: "#1a7a38", dot: "#1a7a38" };
  if (n === "almost_success") return { bg: "#fef8e4", text: "#8a5c00", dot: "#FEB601" };
  if (n === "failed" || n === "raté") return { bg: "#fdf0ee", text: "#bf3327", dot: "#bf3327" };
  if (n === "scheduled" || n === "planifié") return { bg: "#eff6ff", text: "#0F56B8", dot: "#0F56B8" };
  return { bg: "#eaf7ee", text: "#1a7a38", dot: "#1a7a38" };
}
function isActive(o) {
  const n = (o.status || "").toLowerCase();
  return !n || n === "active" || n === "actif" || n === "en cours";
}
function isScheduled(o) {
  const n = (o.status || "").toLowerCase();
  return n === "scheduled" || n === "planifié";
}
function isFinished(o) {
  const n = (o.status || "").toLowerCase();
  return n === "success" || n === "almost_success" || n === "failed" || n === "réussi" || n === "raté";
}

/* Résolution club — jamais d'ID visible */
function resolveClub(clubId, clubs) {
  if (!clubId) return null;
  if (clubs && clubs.length) {
    const c = clubs.find(x => String(x.id) === String(clubId));
    if (c) return c;
  }
  /* Fallback pour IDs historiques connus */
  const known = { "1": "Saint-Priest", "2": "La Boisse", "3": "Mâcon" };
  const name = known[String(clubId)];
  if (name) return { id: clubId, name, color: null };
  return { id: clubId, name: "Club non renseigné", color: null };
}
function clubAccentColor(club) {
  if (!club) return "#9896a0";
  if (club.color) return club.color;
  const map = { "Saint-Priest": "#0F56B8", "La Boisse": "#FB8500", "Mâcon": "#1a7a38" };
  return map[club.name] || "#9896a0";
}

function resolveUser(userId, users) {
  if (!userId || !users?.length) return null;
  return users.find(u => String(u.id) === String(userId) || String(u.appId) === String(userId)) || null;
}
function userName(user) {
  if (!user) return null;
  return user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user.name || null;
}
function initials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}
function daysLeft(deadline) {
  if (!deadline) return null;
  const d = new Date(deadline);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((d - today) / 86400000);
}

/* Calcule les signaux d'alerte à partir de données réelles */
function computeAlerts(o, linkedTasks) {
  const alerts = [];
  const dl = daysLeft(o.deadline);
  const p = objPct(o);
  if (dl !== null && dl < 0 && !isFinished(o)) {
    alerts.push({ type: "red", text: `Échéance dépassée de ${Math.abs(dl)}j` });
  } else if (dl !== null && dl <= 10 && dl >= 0 && !isFinished(o)) {
    alerts.push({ type: "orange", text: `Échéance dans ${dl} jour${dl > 1 ? "s" : ""}` });
  }
  if (!isFinished(o) && !isScheduled(o) && p < 25) {
    alerts.push({ type: "orange", text: "Progression inférieure à 25%" });
  }
  const overdueTasks = (linkedTasks || []).filter(t => {
    if (!t || t.status === "Terminé" || t.status === "done") return false;
    return t.deadline && new Date(t.deadline) < new Date();
  });
  if (overdueTasks.length > 0) {
    alerts.push({ type: "orange", text: `${overdueTasks.length} tâche${overdueTasks.length > 1 ? "s" : ""} en retard` });
  }
  return alerts;
}

/* ══════════════════════════════════════
   SVG ICONS
══════════════════════════════════════ */
function IcoTarget({ size = 14, ...p }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></svg>;
}
function IcoChevR({ size = 12 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9,18 15,12 9,6" /></svg>;
}
function IcoChevL({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15,18 9,12 15,6" /></svg>;
}
function IcoCal({ size = 12 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /></svg>;
}
function IcoUser({ size = 12 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
}
function IcoAlert({ size = 12 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
}
function IcoEdit({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
}
function IcoCheck({ size = 10 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12" /></svg>;
}
function IcoPlus({ size = 11 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
}
function IcoMega({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a4 4 0 010 8" /><path d="M20 4a8 8 0 010 16" /><rect x="2" y="9" width="8" height="6" rx="1.5" /><path d="M10 9l8-5v16l-8-5" /></svg>;
}
function IcoLayers({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12,2 22,8.5 12,15 2,8.5" /><path d="M2 15.5l10 6.5 10-6.5" /><path d="M2 11.5l10 6.5 10-6.5" /></svg>;
}
function IcoClock({ size = 12 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" /></svg>;
}
function IcoEvent({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /><path d="M8 14h.01M12 14h.01M16 14h.01" /></svg>;
}
function IcoBar({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="14" width="4" height="7" rx="1" /><rect x="10" y="9" width="4" height="12" rx="1" /><rect x="17" y="5" width="4" height="16" rx="1" /></svg>;
}

/* ── Primitives ── */
function Badge({ label, bg, color, dot }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: bg || "var(--gray-bg)", color: color || "var(--text-2)",
      fontSize: 10.5, fontWeight: 700, borderRadius: 20,
      padding: "2px 9px", lineHeight: 1.6, whiteSpace: "nowrap",
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: "50%", background: dot, display: "inline-block" }} />}
      {label}
    </span>
  );
}
function ProgressBar({ value, color, height = 4 }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const c = color || (v >= 80 ? "#1a7a38" : v >= 50 ? "#FEB601" : "#FB8500");
  return (
    <div style={{ height, borderRadius: height, background: "#ECEAE5", overflow: "hidden", minWidth: 0 }}>
      <div style={{ height: "100%", width: `${v}%`, background: c, borderRadius: height, transition: "width .35s ease" }} />
    </div>
  );
}
function Avatar({ name, size = 26 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "#e0eaff", color: "#0F56B8",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 700, flexShrink: 0,
    }}>
      {initials(name)}
    </div>
  );
}
function EmptyRow({ icon, text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", color: "var(--text-3)", fontSize: 12 }}>
      <span style={{ opacity: .5 }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

/* ══════════════════════════════════════
   LISTE — MODULE COCKPIT GAUCHE
══════════════════════════════════════ */
function WatchModule({ objectives, clubs, tasks }) {
  /* Objectifs nécessitant attention (règles calculées, pas de priorité inventée) */
  const watched = useMemo(() => {
    return objectives
      .filter(o => !isFinished(o) && !isScheduled(o))
      .map(o => {
        const linkedT = tasks.filter(t => String(t.objectiveId) === String(o.id) || String(t.objective) === String(o.id));
        const alerts = computeAlerts(o, linkedT);
        return { o, alerts };
      })
      .filter(x => x.alerts.length > 0)
      .slice(0, 4);
  }, [objectives, tasks]);

  if (watched.length === 0) return null;
  return (
    <div className="obj-module">
      <div className="obj-module-header">
        <span style={{ color: "#b05a00" }}><IcoAlert size={12} /></span>
        <span className="obj-module-title">À surveiller</span>
        <span className="obj-module-count" style={{ background: "var(--orange-bg)", color: "#b05a00" }}>{watched.length}</span>
      </div>
      {watched.map(({ o, alerts }) => {
        const club = resolveClub(o.club, clubs);
        const acc = clubAccentColor(club);
        const p = objPct(o);
        return (
          <div key={o.id} className="obj-module-row">
            <div className="obj-module-row-dot" style={{ background: acc }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="obj-module-row-name">{o.title}</div>
              <div className="obj-module-row-meta">{alerts[0]?.text}</div>
              <ProgressBar value={p} height={3} />
            </div>
            <span className="obj-module-row-pct">{p}%</span>
          </div>
        );
      })}
    </div>
  );
}

function DeadlineModule({ objectives }) {
  const upcoming = useMemo(() => {
    return objectives
      .filter(o => !isFinished(o) && o.deadline)
      .map(o => ({ o, dl: daysLeft(o.deadline) }))
      .filter(x => x.dl !== null && x.dl >= 0 && x.dl <= 60)
      .sort((a, b) => a.dl - b.dl)
      .slice(0, 5);
  }, [objectives]);

  if (upcoming.length === 0) return null;
  return (
    <div className="obj-module">
      <div className="obj-module-header">
        <span style={{ color: "var(--ep-blue)" }}><IcoCal size={12} /></span>
        <span className="obj-module-title">Prochaines échéances</span>
      </div>
      {upcoming.map(({ o, dl }) => {
        const isClose = dl <= 14;
        return (
          <div key={o.id} className="obj-module-row">
            <div className="obj-deadline-badge" style={{ color: isClose ? "#b05a00" : "var(--ep-blue)", background: isClose ? "var(--orange-bg)" : "var(--blue-bg)" }}>
              <span style={{ fontSize: 13, fontWeight: 800, lineHeight: 1 }}>{dl}</span>
              <span style={{ fontSize: 9, fontWeight: 600 }}>j</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="obj-module-row-name">{o.title}</div>
              <div className="obj-module-row-meta">{fmtDate(o.deadline)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SummaryModule({ objectives }) {
  const actifs = objectives.filter(o => isActive(o)).length;
  const planifies = objectives.filter(o => isScheduled(o)).length;
  const termines = objectives.filter(o => isFinished(o)).length;
  const avgPct = useMemo(() => {
    const active = objectives.filter(o => isActive(o));
    if (!active.length) return 0;
    return Math.round(active.reduce((acc, o) => acc + objPct(o), 0) / active.length);
  }, [objectives]);

  return (
    <div className="obj-module obj-module--summary">
      <div className="obj-module-header">
        <span style={{ color: "#8a5c00" }}><IcoBar size={12} /></span>
        <span className="obj-module-title">Vue d'ensemble</span>
      </div>
      <div className="obj-summary-stats">
        <div className="obj-summary-stat">
          <span className="obj-summary-val" style={{ color: "#1a7a38" }}>{actifs}</span>
          <span className="obj-summary-label">En cours</span>
        </div>
        <div className="obj-summary-stat">
          <span className="obj-summary-val" style={{ color: "var(--ep-blue)" }}>{planifies}</span>
          <span className="obj-summary-label">Planifiés</span>
        </div>
        <div className="obj-summary-stat">
          <span className="obj-summary-val" style={{ color: "var(--text-3)" }}>{termines}</span>
          <span className="obj-summary-label">Terminés</span>
        </div>
      </div>
      {actifs > 0 && (
        <div style={{ padding: "0 14px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-3)", marginBottom: 5 }}>
            <span>Progression moyenne</span>
            <span style={{ fontWeight: 700, color: "var(--text)" }}>{avgPct}%</span>
          </div>
          <ProgressBar value={avgPct} height={5} />
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   LISTE — TABLEAU COMPACT DROITE
══════════════════════════════════════ */
function ObjTableRow({ o, clubs, users, onSelect }) {
  const club = resolveClub(o.club, clubs);
  const acc = clubAccentColor(club);
  const p = objPct(o);
  const sc = statusColor(o.status);
  const dl = daysLeft(o.deadline);
  const owner = resolveUser(o.owner || (o.assignedTo && o.assignedTo[0]), users);
  const ownerName = userName(owner);
  const dlText = dl === null ? null : dl < 0 ? `${Math.abs(dl)}j retard` : dl === 0 ? "Auj." : `${dl}j`;
  const dlColor = dl !== null && dl < 0 ? "var(--red)" : dl !== null && dl <= 10 ? "#b05a00" : "var(--text-3)";

  return (
    <div className="obj-table-row" onClick={() => onSelect(o)}>
      <div className="obj-table-row-indicator" style={{ background: acc }} />
      <div className="obj-table-col obj-table-col--main">
        <div className="obj-table-name">{o.title}</div>
        <div className="obj-table-club" style={{ color: acc }}>{club?.name}</div>
      </div>
      <div className="obj-table-col obj-table-col--progress">
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
          <span className="obj-table-pct">{p}%</span>
          <div style={{ flex: 1 }}><ProgressBar value={p} height={4} /></div>
        </div>
        <div style={{ fontSize: 10.5, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>
          {Number(o.current || 0).toLocaleString("fr-FR")} / {Number(o.target || 0).toLocaleString("fr-FR")} {o.unit}
        </div>
      </div>
      <div className="obj-table-col obj-table-col--status">
        <Badge label={statusLabel(o.status)} bg={sc.bg} color={sc.text} dot={sc.dot} />
      </div>
      <div className="obj-table-col obj-table-col--deadline">
        <span style={{ color: dlColor, fontSize: 11.5, fontWeight: 600 }}>{dlText || "—"}</span>
        <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 1 }}>{fmtShort(o.deadline)}</div>
      </div>
      <div className="obj-table-col obj-table-col--owner">
        {ownerName ? (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Avatar name={ownerName} size={22} />
            <span style={{ fontSize: 11, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 80 }}>{ownerName}</span>
          </div>
        ) : <span style={{ color: "var(--text-3)", fontSize: 11 }}>—</span>}
      </div>
      <div className="obj-table-col obj-table-col--arrow">
        <IcoChevR size={11} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   PAGE LISTE PRINCIPALE
══════════════════════════════════════ */
function ObjectifsList({ objectives, clubs, users, tasks, onSelect }) {
  const [filter, setFilter] = useState("current");
  const FILTERS = [
    { key: "current", label: "En cours" },
    { key: "scheduled", label: "Planifiés" },
    { key: "finished", label: "Terminés" },
    { key: "all", label: "Tous" },
  ];
  const filtered = useMemo(() => {
    return objectives.filter(o =>
      filter === "all" ? true :
      filter === "current" ? isActive(o) :
      filter === "scheduled" ? isScheduled(o) :
      filter === "finished" ? isFinished(o) :
      true
    );
  }, [objectives, filter]);

  const alertCount = useMemo(() => objectives.filter(o => {
    if (isFinished(o)) return false;
    const dl = daysLeft(o.deadline);
    const p = objPct(o);
    return (dl !== null && dl < 0) || (dl !== null && dl <= 10) || p < 25;
  }).length, [objectives]);

  return (
    <div className="obj-list-page">
      {/* Header */}
      <div className="obj-list-header">
        <div className="obj-list-header-left">
          <div className="obj-list-icon"><IcoTarget size={18} /></div>
          <div>
            <h1 className="obj-list-title">Objectifs</h1>
            <p className="obj-list-sub">
              {objectives.filter(isActive).length} en cours
              {alertCount > 0 && <span className="obj-alert-pill"><IcoAlert size={10} /> {alertCount} à surveiller</span>}
            </p>
          </div>
        </div>
        <div className="obj-filter-tabs">
          {FILTERS.map(f => (
            <button key={f.key} className={`obj-filter-tab${filter === f.key ? " active" : ""}`} onClick={() => setFilter(f.key)}>
              {f.label}
              <span className="obj-filter-tab-count">
                {f.key === "current" ? objectives.filter(isActive).length :
                 f.key === "scheduled" ? objectives.filter(isScheduled).length :
                 f.key === "finished" ? objectives.filter(isFinished).length :
                 objectives.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Cockpit layout */}
      <div className="obj-cockpit">
        {/* Colonne gauche — modules */}
        <div className="obj-cockpit-left">
          <SummaryModule objectives={objectives} />
          <WatchModule objectives={objectives} clubs={clubs} tasks={tasks} />
          <DeadlineModule objectives={objectives} />
        </div>

        {/* Colonne droite — tableau */}
        <div className="obj-cockpit-right">
          {filtered.length === 0 ? (
            <div className="obj-table-empty">
              <IcoTarget size={26} />
              <span>Aucun objectif pour ce filtre</span>
            </div>
          ) : (
            <>
              <div className="obj-table-head">
                <div className="obj-table-col obj-table-col--main">Objectif</div>
                <div className="obj-table-col obj-table-col--progress">Progression</div>
                <div className="obj-table-col obj-table-col--status">Statut</div>
                <div className="obj-table-col obj-table-col--deadline">Échéance</div>
                <div className="obj-table-col obj-table-col--owner">Responsable</div>
                <div className="obj-table-col obj-table-col--arrow" />
              </div>
              {filtered.map(o => (
                <ObjTableRow key={o.id} o={o} clubs={clubs} users={users} onSelect={onSelect} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   DÉTAIL — COLONNE GAUCHE
══════════════════════════════════════ */
function DetailLeft({ obj, clubs, users }) {
  const club = resolveClub(obj.club, clubs);
  const acc = clubAccentColor(club);
  const sc = statusColor(obj.status);
  const owner = resolveUser(obj.owner, users);
  const ownerName = userName(owner);

  return (
    <>
      {/* Bloc identité */}
      <div className="obj-block">
        <div className="obj-block-header">Identité de l'objectif</div>
        <div className="obj-block-body">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: `${acc}18`, color: acc, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <IcoTarget size={20} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3, color: "var(--text)" }}>{obj.title}</div>
              <div style={{ marginTop: 5, display: "flex", gap: 5, flexWrap: "wrap" }}>
                <Badge label={statusLabel(obj.status)} bg={sc.bg} color={sc.text} dot={sc.dot} />
              </div>
            </div>
          </div>

          {[
            { icon: <IcoCal />, label: "Début", val: fmtDate(obj.startDate) },
            { icon: <IcoCal />, label: "Échéance", val: fmtDate(obj.deadline) },
            { icon: <IcoUser />, label: "Responsable", val: ownerName || "—" },
            { icon: <span style={{ fontSize: 11 }}>◈</span>, label: "Club", val: (
              <span style={{ fontSize: 11, fontWeight: 700, color: acc, background: `${acc}15`, padding: "2px 9px", borderRadius: 20, border: `1px solid ${acc}30` }}>
                {club?.name}
              </span>
            )},
            { icon: <IcoBar />, label: "Source", val: obj.source || obj.metricKey || "—" },
            { icon: <IcoClock />, label: "Créé le", val: fmtDate(obj.createdAt) },
          ].map((r, i) => (
            <div key={i} className="obj-info-row">
              <span className="obj-info-icon">{r.icon}</span>
              <span className="obj-info-label">{r.label}</span>
              <span className="obj-info-val">{r.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Résultat attendu */}
      <div className="obj-block obj-block--accent">
        <div className="obj-block-header">Résultat attendu</div>
        <div className="obj-block-body">
          {obj.target ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                {Number(obj.target).toLocaleString("fr-FR")}
              </span>
              <span style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 600 }}>{obj.unit}</span>
            </div>
          ) : null}
          <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.55, marginBottom: 8 }}>
            {obj.description || `Atteindre ${obj.target ? Number(obj.target).toLocaleString("fr-FR") : "la cible"} ${obj.unit || ""} d'ici le ${fmtDate(obj.deadline)}.`}
          </p>
          <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-3)" }}>
            <span>Départ&nbsp;: <strong style={{ color: "var(--text-2)" }}>{Number(obj.baseline || obj.current || 0).toLocaleString("fr-FR")} {obj.unit}</strong></span>
            {obj.target && <span>Cible&nbsp;: <strong style={{ color: "var(--text-2)" }}>{Number(obj.target).toLocaleString("fr-FR")} {obj.unit}</strong></span>}
          </div>
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════
   DÉTAIL — COLONNE CENTRALE
══════════════════════════════════════ */
function DetailCenter({ obj, users, tasks }) {
  const p = objPct(obj);
  const dl = daysLeft(obj.deadline);
  const pColor = p >= 80 ? "#1a7a38" : p >= 50 ? "#FEB601" : "#FB8500";
  const R = 30, C = 38, circ = 2 * Math.PI * R;

  /* Seuls les KPI réellement calculables */
  const linkedTasks = useMemo(() =>
    tasks.filter(t => t && (String(t.objectiveId) === String(obj.id) || String(t.objective) === String(obj.id))),
    [tasks, obj.id]
  );
  const doneTasks = linkedTasks.filter(t => t.status === "Terminé" || t.status === "done").length;
  const totalTasks = linkedTasks.length;

  const assignedUsers = useMemo(() => {
    if (!users?.length) return [];
    const ids = obj.assignedTo || (obj.owner ? [obj.owner] : []);
    return ids.map(id => resolveUser(id, users)).filter(Boolean);
  }, [users, obj]);

  return (
    <>
      {/* Progression */}
      <div className="obj-block">
        <div className="obj-block-header">Progression</div>
        <div className="obj-block-body" style={{ paddingBottom: 0 }}>
          {/* Compact ring + chiffre */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width={C * 2} height={C * 2} viewBox={`0 0 ${C * 2} ${C * 2}`}>
                <circle cx={C} cy={C} r={R} fill="none" stroke="#ECEAE5" strokeWidth="6" />
                <circle cx={C} cy={C} r={R} fill="none"
                  stroke={pColor} strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={circ} strokeDashoffset={circ * (1 - p / 100)}
                  transform={`rotate(-90 ${C} ${C})`}
                />
              </svg>
              <span style={{ position: "absolute", fontSize: 16, fontWeight: 800, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{p}%</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 3 }}>Avancement global</div>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 6, fontVariantNumeric: "tabular-nums" }}>
                <strong>{Number(obj.current || 0).toLocaleString("fr-FR")}</strong>
                <span style={{ color: "var(--text-3)" }}> / {Number(obj.target || 0).toLocaleString("fr-FR")} {obj.unit}</span>
              </div>
              {dl !== null && (
                <div style={{ fontSize: 11, color: dl < 0 ? "var(--red)" : dl <= 14 ? "#b05a00" : "var(--text-3)", display: "flex", alignItems: "center", gap: 4 }}>
                  <IcoClock size={11} />
                  {dl < 0 ? `${Math.abs(dl)}j de retard` : dl === 0 ? "Échéance aujourd'hui" : `${dl}j restants`}
                </div>
              )}
            </div>
          </div>

          {/* Indicateurs réels seulement */}
          <div className="obj-kpi-section">
            {/* Progression toujours présente */}
            <KpiLine icon={<IcoBar size={13} />} label="Progression" value={`${p}%`} progress={p} color={pColor} />
            {/* Tâches seulement si des relations existent */}
            {totalTasks > 0 && (
              <KpiLine icon={<IcoCheck size={12} />} label="Tâches liées" value={`${doneTasks} / ${totalTasks}`} progress={totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0} />
            )}
          </div>
        </div>
      </div>

      {/* Évolution */}
      <div className="obj-block">
        <div className="obj-block-header">Évolution</div>
        <div style={{ padding: "20px 16px", textAlign: "center" }}>
          <div style={{ color: "var(--text-3)", opacity: .4, marginBottom: 8 }}><IcoBar size={22} /></div>
          <p style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.5, maxWidth: 240, margin: "0 auto" }}>
            Le graphique d'évolution apparaîtra dès que plusieurs points de progression auront été enregistrés.
          </p>
        </div>
      </div>

      {/* Équipe */}
      <div className="obj-block">
        <div className="obj-block-header">Équipe</div>
        {assignedUsers.length === 0 ? (
          <EmptyRow icon={<IcoUser size={16} />} text="Aucun membre assigné" />
        ) : (
          <div>
            {assignedUsers.map((u, i) => {
              const name = userName(u) || "Membre";
              const isOwner = String(u.id) === String(obj.owner) || String(u.appId) === String(obj.owner);
              return (
                <div key={u.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", borderBottom: "1px solid var(--border)" }}>
                  <Avatar name={name} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>{name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>{u.role || "Contributeur"}</div>
                  </div>
                  {isOwner && <Badge label="Responsable" bg="var(--yellow-bg)" color="#8a5c00" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function KpiLine({ icon, label, value, progress, color }) {
  const c = color || (progress >= 80 ? "#1a7a38" : progress >= 50 ? "#FEB601" : "#FB8500");
  return (
    <div className="obj-kpi-line">
      <span className="obj-kpi-line-icon" style={{ color: c }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{label}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
        </div>
        <ProgressBar value={progress} color={c} height={3} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   DÉTAIL — COLONNE DROITE
══════════════════════════════════════ */
function RelatedBlock({ title, icon, items, renderRow, emptyText }) {
  return (
    <div className="obj-block">
      <div className="obj-block-header">
        {title}
        <button className="obj-add-btn"><IcoPlus size={10} /></button>
      </div>
      {items.length === 0 ? (
        <EmptyRow icon={icon} text={emptyText} />
      ) : (
        <div>
          {items.slice(0, 5).map((item, i) => (
            <div key={i} className="obj-related-row">
              {renderRow(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailRight({ obj, clubs, tasks, publications, events, projects }) {
  const alerts = useMemo(() => {
    const linked = tasks.filter(t => t && (String(t.objectiveId) === String(obj.id) || String(t.objective) === String(obj.id)));
    return computeAlerts(obj, linked);
  }, [obj, tasks]);

  const linkedTasks = tasks.filter(t => t && (String(t.objectiveId) === String(obj.id) || String(t.objective) === String(obj.id)));
  const linkedPubs = publications.filter(p => p && (String(p.objectiveId) === String(obj.id) || String(p.objective) === String(obj.id)));
  const linkedEvents = events.filter(e => e && (String(e.objectiveId) === String(obj.id) || String(e.objective) === String(obj.id)));
  const linkedProjects = projects.filter(p => p && (String(p.objectiveId) === String(obj.id) || String(p.objective) === String(obj.id)));

  return (
    <>
      {/* Alertes */}
      {alerts.length > 0 && (
        <div className="obj-block obj-block--alert">
          <div className="obj-block-header">
            <span style={{ color: "#b05a00" }}><IcoAlert size={12} /></span>
            Alertes
            <span style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: "50%", background: "var(--orange-bg)", color: "#b05a00", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{alerts.length}</span>
          </div>
          {alerts.map((a, i) => (
            <div key={i} className={`obj-alert-row obj-alert-row--${a.type}`}>
              <IcoAlert size={11} /><span style={{ flex: 1 }}>{a.text}</span><IcoChevR size={10} />
            </div>
          ))}
        </div>
      )}

      <RelatedBlock
        title="Campagnes liées" icon={<IcoMega size={15} />} emptyText="Aucune campagne liée"
        items={linkedProjects}
        renderRow={pr => (
          <>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(15,86,184,.10)", color: "var(--ep-blue)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IcoMega size={12} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="obj-rel-name">{pr.title || pr.name}</div>
              <div className="obj-rel-meta">{fmtShort(pr.date || pr.startDate)}</div>
            </div>
            <IcoChevR size={10} />
          </>
        )}
      />

      <RelatedBlock
        title="Événements liés" icon={<IcoEvent size={15} />} emptyText="Aucun événement lié"
        items={linkedEvents}
        renderRow={ev => {
          const club = resolveClub(ev.club, clubs);
          return (
            <>
              <div className="obj-date-badge">
                <span>{fmtShort(ev.date).split(" ")[0]}</span>
                <span>{fmtShort(ev.date).split(" ")[1]}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="obj-rel-name">{ev.title}</div>
                <div className="obj-rel-meta">{club?.name}</div>
              </div>
              <IcoChevR size={10} />
            </>
          );
        }}
      />

      <RelatedBlock
        title="Contenus liés" icon={<IcoLayers size={15} />} emptyText="Aucun contenu lié"
        items={linkedPubs}
        renderRow={pub => {
          const s = (pub.status || pub.statut || "").toLowerCase();
          const isPub = s.includes("publi"); const isPend = s.includes("valider") || s.includes("review");
          const sp = isPub ? { bg: "var(--green-bg)", c: "var(--green)" } : isPend ? { bg: "var(--yellow-bg)", c: "#8a5c00" } : { bg: "var(--gray-bg)", c: "var(--text-3)" };
          return (
            <>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(251,133,0,.10)", color: "#b05a00", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IcoLayers size={12} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="obj-rel-name">{pub.title}</div>
                <div className="obj-rel-meta" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {pub.platform}
                  <Badge label={pub.status || "Brouillon"} bg={sp.bg} color={sp.c} />
                </div>
              </div>
              <IcoChevR size={10} />
            </>
          );
        }}
      />

      <RelatedBlock
        title="Tâches liées" icon={<IcoCheck size={15} />} emptyText="Aucune tâche liée"
        items={linkedTasks}
        renderRow={t => {
          const done = t.status === "Terminé" || t.status === "done";
          return (
            <>
              <div style={{ width: 16, height: 16, borderRadius: 5, border: `1.5px solid ${done ? "var(--green)" : "var(--border-strong)"}`, background: done ? "var(--green)" : "transparent", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {done && <IcoCheck size={9} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="obj-rel-name" style={{ textDecoration: done ? "line-through" : "none", color: done ? "var(--text-3)" : "var(--text)" }}>{t.title}</div>
                {t.deadline && <div className="obj-rel-meta"><IcoCal size={10} /> {fmtShort(t.deadline)}</div>}
              </div>
              <IcoChevR size={10} />
            </>
          );
        }}
      />

      {/* Historique */}
      <div className="obj-block">
        <div className="obj-block-header">Activité récente</div>
        <EmptyRow icon={<IcoClock size={15} />} text="L'activité apparaîtra ici au fil des mises à jour." />
      </div>
    </>
  );
}

/* ══════════════════════════════════════
   PAGE DÉTAIL
══════════════════════════════════════ */
function ObjectifDetail({ obj, clubs, users, tasks, publications, events, projects, onBack }) {
  const sc = statusColor(obj.status);
  const club = resolveClub(obj.club, clubs);
  const acc = clubAccentColor(club);

  return (
    <div className="obj-detail-page">
      {/* Breadcrumb */}
      <div className="obj-breadcrumb">
        <button className="obj-back-btn" onClick={onBack}><IcoChevL size={12} /> Objectifs</button>
        <IcoChevR size={10} />
        <span style={{ color: "var(--text)", fontWeight: 600, fontSize: 12 }}>{obj.title}</span>
      </div>

      {/* Header */}
      <div className="obj-detail-header">
        <div className="obj-detail-header-left">
          <div style={{ width: 48, height: 48, borderRadius: 15, background: `${acc}18`, color: acc, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <IcoTarget size={22} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
              <h1 className="obj-detail-title">{obj.title}</h1>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: sc.dot, flexShrink: 0 }} />
              <Badge label={statusLabel(obj.status)} bg={sc.bg} color={sc.text} />
            </div>
            <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
              {club?.name} · {fmtDate(obj.startDate)} → {fmtDate(obj.deadline)}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button className="obj-btn-edit"><IcoEdit size={13} /> Modifier</button>
          <button className="obj-btn-more">···</button>
        </div>
      </div>

      {/* 3-col grid */}
      <div className="obj-detail-grid">
        <div className="obj-detail-col">
          <DetailLeft obj={obj} clubs={clubs} users={users} />
        </div>
        <div className="obj-detail-col">
          <DetailCenter obj={obj} users={users} tasks={tasks} />
        </div>
        <div className="obj-detail-col">
          <DetailRight obj={obj} clubs={clubs} tasks={tasks} publications={publications} events={events} projects={projects} />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   ROOT
══════════════════════════════════════ */
export default function ObjectifsV2({ appId, currentUser, onNavigate }) {
  const { objectives, loading } = useObjectives();
  const { users } = useUsers();
  const { clubs } = useClubs();
  const { tasks } = useTasks();
  const { publications } = usePublications();
  const { events } = useCalendarEvents();
  const { projects } = useProjects();
  const [selected, setSelected] = useState(null);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: 60, color: "var(--text-3)", fontSize: 13 }}>
        <div className="v2-spinner" />
        <span>Chargement des objectifs…</span>
      </div>
    );
  }

  if (selected) {
    return (
      <ObjectifDetail
        obj={selected} clubs={clubs} users={users}
        tasks={tasks} publications={publications}
        events={events} projects={projects}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <ObjectifsList
      objectives={objectives} clubs={clubs} users={users} tasks={tasks}
      onSelect={setSelected}
    />
  );
}
