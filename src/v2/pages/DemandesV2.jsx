/**
 * DemandesV2 — Module Demandes clubs V2.
 * Lecture seule. Aucune écriture Firestore.
 *
 * Sources :
 *   ep:requests → demandes reçues via formulaire guest
 *   ep:tasks    → tâches liées (résolution via r.taskId → t.id)
 *   ep:users    → résolution des identités
 *   ep:clubs    → résolution des clubs
 *
 * Deep-link : prop initialSelectedId → ouvre directement la fiche si l'ID correspond.
 */
import React, { useState, useMemo, useEffect } from "react";
import { useRequests, useTasks, useUsers, useClubs } from "../hooks/useV1Data";

/* ── Task status / priority tokens ── */
const T_STATUS = {
  "À faire":        { bg: "#EFF6FF", text: "#1D4ED8" },
  "En cours":       { bg: "#DBEAFE", text: "#0F56B8" },
  "En validation":  { bg: "#F3E8FF", text: "#6D28D9" },
  "Terminée":       { bg: "#ECFDF5", text: "#065F46" },
  "Bloquée":        { bg: "#FEF2F2", text: "#991B1B" },
};
const T_PRIORITY = {
  "Basse":   "#64748B",
  "Normale": "#0F56B8",
  "Haute":   "#D97706",
  "Urgente": "#DC2626",
};

/* Statuts fermés sur la demande elle-même (jamais écrits en V1 — préparés pour l'avenir) */
const CLOSED = new Set(["clôturée", "closed", "refusée", "refused", "rejected"]);
/* Statuts terminés sur la tâche liée */
const DONE   = new Set(["terminée", "done", "completed"]);

const FR_MONTHS_S = ["jan.","fév.","mar.","avr.","mai","jui.","jul.","aoû.","sep.","oct.","nov.","déc."];

/* ════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════ */

function startOfDay(d) { const r = new Date(d); r.setHours(0,0,0,0); return r; }

function parseDate(s) {
  if (!s) return null;
  if (s instanceof Date) return isNaN(s.getTime()) ? null : s;
  if (s && typeof s === "object" && s.toDate) return s.toDate();
  if (s && typeof s === "object" && s.seconds) return new Date(s.seconds * 1000);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDateFull(s) {
  const d = parseDate(s);
  if (!d) return null;
  return `${d.getDate()} ${FR_MONTHS_S[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtDateShort(s) {
  const d = parseDate(s);
  if (!d) return null;
  return `${d.getDate()} ${FR_MONTHS_S[d.getMonth()]}`;
}

function resolveUser(rawId, users) {
  if (!rawId) return null;
  const sid = String(rawId).trim();
  if (users && users.length) {
    const u = users.find(x =>
      String(x.id) === sid || String(x.appId) === sid || String(x.uid) === sid
    );
    if (u) {
      const name =
        u.name || u.displayName ||
        [u.prenom, u.nom].filter(Boolean).join(" ") ||
        [u.firstName, u.lastName].filter(Boolean).join(" ") ||
        u.email;
      return name || null;
    }
  }
  if (/^\d{10,}$/.test(sid)) return null; // ID technique → masqué
  return sid;
}

function resolveUserList(ids, users) {
  if (!ids) return null;
  const list = Array.isArray(ids) ? ids : [ids];
  const names = list.map(id => resolveUser(id, users)).filter(Boolean);
  return names.length > 0 ? names.join(", ") : null;
}

function resolveClub(clubId, clubs) {
  if (!clubId) return null;
  if (clubs && clubs.length) {
    const c = clubs.find(x => String(x.id) === String(clubId));
    if (c) return c;
  }
  const known = { "1": "Saint-Priest", "2": "La Boisse", "3": "Mâcon" };
  const name = known[String(clubId)];
  return name ? { id: clubId, name } : null;
}

/* Normalise les IDs club d'une demande (club singulier + clubs tableau) */
function requestClubIds(r) {
  const arr = Array.isArray(r.clubs) ? r.clubs.map(String) : [];
  if (r.club && !arr.includes(String(r.club))) arr.push(String(r.club));
  return arr;
}

/* Progression subtasks d'une tâche */
function taskProgress(task) {
  if (!task) return null;
  const subs = task.subtasks || [];
  if (!subs.length) return null;
  const done = subs.filter(s => s.done).length;
  return { done, total: subs.length, pct: Math.round(done / subs.length * 100) };
}

/* Initiales pour avatar (présentation uniquement) */
function initials(name) {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0][0] || "?").toUpperCase();
}

/* ════════════════════════════════════════════════════════
   RÈGLES MÉTIER — documentées
   ════════════════════════════════════════════════════════ */

/*
 * isOpen(r, taskById)
 * Une demande est « ouverte » si :
 *   1. Son statut propre (r.status) n'est PAS dans CLOSED.
 *   2. ET si une tâche liée existe et est retrouvée, son statut n'est PAS dans DONE.
 * Si aucune tâche liée ou si la tâche n'est pas retrouvée : considérée ouverte.
 * Note : en pratique, r.status = "Nouvelle" pour toutes les demandes (seule valeur
 * jamais écrite par le formulaire V1). La logique tâche liée est l'indicateur réel.
 */
function isOpen(r, taskById) {
  if (CLOSED.has((r.status || "").toLowerCase())) return false;
  if (r.taskId) {
    const t = taskById.get(String(r.taskId));
    if (t && DONE.has((t.status || "").toLowerCase())) return false;
  }
  return true;
}

/*
 * isLate(r, taskById)
 * Vrai si r.deadline < aujourd'hui ET tâche liée non terminée.
 * Une demande dont la tâche liée est terminée n'est plus comptée en retard.
 */
function isLate(r, taskById) {
  if (!r.deadline) return false;
  const today = startOfDay(new Date());
  const d = parseDate(r.deadline);
  if (!d || startOfDay(d) >= today) return false;
  if (r.taskId) {
    const t = taskById.get(String(r.taskId));
    if (t && DONE.has((t.status || "").toLowerCase())) return false;
  }
  return true;
}

/*
 * isSoon(r, taskById)
 * Vrai si r.deadline dans [aujourd'hui, aujourd'hui+7] ET tâche non terminée.
 */
function isSoon(r, taskById) {
  if (!r.deadline) return false;
  const today = startOfDay(new Date());
  const in7   = new Date(today); in7.setDate(in7.getDate() + 7);
  const d = parseDate(r.deadline);
  if (!d) return false;
  const ds = startOfDay(d);
  if (ds < today || ds > in7) return false;
  if (r.taskId) {
    const t = taskById.get(String(r.taskId));
    if (t && DONE.has((t.status || "").toLowerCase())) return false;
  }
  return true;
}

/*
 * isRecent(r)
 * Vrai si r.createdAt dans les 7 derniers jours.
 */
function isRecent(r) {
  if (!r.createdAt) return false;
  const d = parseDate(r.createdAt);
  if (!d) return false;
  const since = new Date(); since.setDate(since.getDate() - 7);
  return d >= since;
}

/* ════════════════════════════════════════════════════════
   COMPOSANTS PARTAGÉS
   ════════════════════════════════════════════════════════ */

function TaskStatusBadge({ status }) {
  if (!status) return null;
  const col = T_STATUS[status] || { bg: "#F1F5F9", text: "#64748B" };
  return (
    <span className="dem-task-badge" style={{ background: col.bg, color: col.text }}>
      {status}
    </span>
  );
}

/* ════════════════════════════════════════════════════════
   LIST VIEW
   ════════════════════════════════════════════════════════ */
function ListView({ requests, taskById, users, clubs, onSelect, filter, setFilter, clubFilter, setClubFilter, search, setSearch, loading }) {

  /* Compteurs pour le cockpit */
  const counts = useMemo(() => ({
    open:   requests.filter(r => isOpen(r, taskById)).length,
    late:   requests.filter(r => isLate(r, taskById)).length,
    soon:   requests.filter(r => isSoon(r, taskById)).length,
    recent: requests.filter(r => isRecent(r)).length,
  }), [requests, taskById]);

  /* Liste filtrée + triée */
  const filtered = useMemo(() => {
    let list = requests.filter(Boolean);

    if (filter === "late")   list = list.filter(r => isLate(r, taskById));
    if (filter === "soon")   list = list.filter(r => isSoon(r, taskById));
    if (filter === "recent") list = list.filter(r => isRecent(r));

    if (clubFilter) {
      list = list.filter(r => requestClubIds(r).includes(clubFilter));
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        (r.subject   || "").toLowerCase().includes(q) ||
        (r.firstName || "").toLowerCase().includes(q) ||
        (r.email     || "").toLowerCase().includes(q)
      );
    }

    /* Tri : retards d'abord, puis deadline croissante, puis createdAt décroissant */
    list.sort((a, b) => {
      const al = isLate(a, taskById) ? 0 : 1;
      const bl = isLate(b, taskById) ? 0 : 1;
      if (al !== bl) return al - bl;
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return  1;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });

    return list;
  }, [requests, filter, clubFilter, search, taskById]);

  /* Clubs disponibles */
  const clubList = clubs.length > 0
    ? clubs
    : [{ id: "1", name: "Saint-Priest" }, { id: "2", name: "La Boisse" }, { id: "3", name: "Mâcon" }];

  const FILTERS = [
    { id: "all",    label: "Toutes",          count: requests.length },
    { id: "late",   label: "En retard",        count: counts.late    },
    { id: "soon",   label: "Échéance proche",  count: counts.soon    },
    { id: "recent", label: "Récentes",         count: counts.recent  },
  ];

  return (
    <div className="obj-list-page">

      {/* ── Header ── */}
      <div className="obj-list-header">
        <div className="obj-list-header-left">
          <div className="obj-list-icon" style={{ background: "rgba(199,210,254,.3)", color: "#3730A3" }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M3 9.5h9M3 14h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 className="obj-list-title">Demandes clubs</h1>
            <div className="obj-list-sub">
              <span>{requests.length} demande{requests.length !== 1 ? "s" : ""} au total</span>
              {counts.open > 0 && (
                <span className="obj-alert-pill" style={{ background: "rgba(199,210,254,.3)", color: "#3730A3" }}>
                  {counts.open} ouverte{counts.open !== 1 ? "s" : ""}
                </span>
              )}
              {counts.late > 0 && (
                <span className="obj-alert-pill">
                  {counts.late} en retard
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Cockpit KPI strip ── */}
      <div className="dem-kpi-strip">

        {/* Ouvertes — bleu/indigo */}
        <div className="dem-kpi-tile dem-kpi-tile--open">
          <div className="dem-kpi-icon">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M1.5 3.5h12M1.5 7.5h7.5M1.5 11.5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="dem-kpi-val">{counts.open}</div>
          <div className="dem-kpi-label">Ouvertes</div>
          <div className="dem-kpi-rule">tâche liée non terminée</div>
        </div>

        {/* En retard — rouge/rose */}
        <div className={`dem-kpi-tile dem-kpi-tile--late${counts.late > 0 ? " is-nonzero" : ""}`}>
          <div className="dem-kpi-icon">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M7.5 4.5V7.5M7.5 9.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="dem-kpi-val">{counts.late}</div>
          <div className="dem-kpi-label">En retard</div>
          <div className="dem-kpi-rule">deadline dépassée · tâche active</div>
        </div>

        {/* Échéance proche — jaune/ambre */}
        <div className={`dem-kpi-tile dem-kpi-tile--soon${counts.soon > 0 ? " is-nonzero" : ""}`}>
          <div className="dem-kpi-icon">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M7.5 3.5V7.5l2.5 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="dem-kpi-val">{counts.soon}</div>
          <div className="dem-kpi-label">Échéance ≤ 7 j</div>
          <div className="dem-kpi-rule">tâche active</div>
        </div>

        {/* Récentes — bleu */}
        <div className="dem-kpi-tile dem-kpi-tile--recent">
          <div className="dem-kpi-icon">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M7.5 1v2M7.5 12v2M1 7.5h2M12 7.5h2M3.1 3.1l1.4 1.4M10.5 10.5l1.4 1.4M3.1 11.9l1.4-1.4M10.5 4.5l1.4-1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.4"/>
            </svg>
          </div>
          <div className="dem-kpi-val">{counts.recent}</div>
          <div className="dem-kpi-label">Reçues récemment</div>
          <div className="dem-kpi-rule">7 derniers jours</div>
        </div>

      </div>

      {/* ── Table card ── */}
      <div className="obj-cockpit-right">

        {/* Segmented control + recherche */}
        <div className="dem-toolbar-row">
          <div className="dem-seg-ctrl">
            {FILTERS.map(f => (
              <button
                key={f.id}
                className={`dem-seg-btn${filter === f.id ? " active" : ""}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
                {f.count > 0 && <span className="dem-seg-count">{f.count}</span>}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <select className="dem-club-select" value={clubFilter} onChange={e => setClubFilter(e.target.value)}>
            <option value="">Tous les clubs</option>
            {clubList.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
          <div className="dem-search">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Sujet, nom, email…"
            />
          </div>
        </div>

        {/* En-tête de table */}
        <div className="obj-table-head">
          <div style={{ width: 3, marginRight: 12, flexShrink: 0 }} />
          <div className="obj-table-col dem-col--demand">Demande</div>
          <div className="obj-table-col dem-col--club">Club</div>
          <div className="obj-table-col dem-col--person">Demandeur</div>
          <div className="obj-table-col dem-col--person">Assigné à</div>
          <div className="obj-table-col dem-col--task">Tâche liée</div>
          <div className="obj-table-col dem-col--date">Échéance</div>
          <div className="obj-table-col dem-col--date">Reçue le</div>
          <div style={{ width: 24, flexShrink: 0 }} />
        </div>

        {/* Lignes */}
        {loading && (
          <div className="obj-table-empty">
            <span style={{ color: "var(--text-3)", fontSize: 12 }}>Chargement des demandes…</span>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="obj-table-empty">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M5 7h18M5 12h11M5 17h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span>Aucune demande dans cette vue.</span>
          </div>
        )}
        {!loading && filtered.map(r => {
          const task         = r.taskId ? taskById.get(String(r.taskId)) : null;
          const club         = resolveClub(requestClubIds(r)[0], clubs);
          const assignedName = resolveUserList(r.assignedTo || r.assigneeId, users);
          const late         = isLate(r, taskById);
          const soon         = !late && isSoon(r, taskById);

          return (
            <div key={r.id} className="obj-table-row" onClick={() => onSelect(r)}>
              <div
                className="obj-table-row-indicator"
                style={{ background: late ? "var(--red)" : soon ? "#F59E0B" : "transparent" }}
              />

              {/* Demande */}
              <div className="obj-table-col dem-col--demand">
                <div className="obj-table-name">{r.subject || "–"}</div>
                {r.description && (
                  <div className="dem-row-excerpt">
                    {r.description.slice(0, 55)}{r.description.length > 55 ? "…" : ""}
                  </div>
                )}
              </div>

              {/* Club — dot + nom */}
              <div className="obj-table-col dem-col--club">
                {club ? (
                  <div className="dem-row-club-wrap">
                    <span className="dem-row-club-dot" />
                    <span className="dem-row-club">{club.name}</span>
                  </div>
                ) : <span className="dem-row-empty">–</span>}
              </div>

              {/* Demandeur — prénom brut (champ texte libre du formulaire, pas un ID) */}
              <div className="obj-table-col dem-col--person">
                {r.firstName ? (
                  <div className="dem-row-person-wrap">
                    <div className="dem-row-avatar" aria-hidden="true">{initials(r.firstName)}</div>
                    <span className="dem-row-person">{r.firstName}</span>
                  </div>
                ) : <span className="dem-row-empty">–</span>}
              </div>

              {/* Assigné à */}
              <div className="obj-table-col dem-col--person">
                {assignedName ? (
                  <div className="dem-row-person-wrap">
                    <div className="dem-row-avatar dem-row-avatar--ep" aria-hidden="true">{initials(assignedName)}</div>
                    <span className="dem-row-person">{assignedName}</span>
                  </div>
                ) : <span className="dem-row-empty">–</span>}
              </div>

              {/* Tâche liée */}
              <div className="obj-table-col dem-col--task">
                {task
                  ? <TaskStatusBadge status={task.status} />
                  : r.taskId
                    ? <span className="dem-row-empty" style={{ fontSize: 10.5 }}>Réf. introuvable</span>
                    : <span className="dem-row-empty">–</span>
                }
              </div>

              {/* Échéance — icône alerte si retard */}
              <div className="obj-table-col dem-col--date">
                {r.deadline ? (
                  <div className={`dem-row-deadline${late ? " dem-row-deadline--late" : soon ? " dem-row-deadline--soon" : ""}`}>
                    {late && (
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <circle cx="5.5" cy="5.5" r="5" stroke="currentColor" strokeWidth="1.4"/>
                        <path d="M5.5 3v2.5M5.5 7v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                    )}
                    <span style={{ fontSize: 11.5, fontWeight: 700 }}>{fmtDateShort(r.deadline)}</span>
                  </div>
                ) : <span className="dem-row-empty">–</span>}
              </div>

              {/* Reçue le */}
              <div className="obj-table-col dem-col--date">
                {r.createdAt
                  ? <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>{fmtDateShort(r.createdAt)}</span>
                  : <span className="dem-row-empty">–</span>
                }
              </div>

              {/* Flèche */}
              <div className="obj-table-col--arrow">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   DETAIL VIEW
   ════════════════════════════════════════════════════════ */
function DetailView({ request: r, taskById, users, clubs, onBack, onNavigate }) {
  const task         = r.taskId ? taskById.get(String(r.taskId)) : null;
  const club         = resolveClub(requestClubIds(r)[0], clubs);
  const assignedName = resolveUserList(r.assignedTo || r.assigneeId, users);
  const taskAssigned = task ? resolveUserList(task.assignedTo || task.assignee, users) : null;
  const prog         = taskProgress(task);
  const late         = isLate(r, taskById);

  /* Activité : task.history — 5 entrées les plus récentes */
  const activity = useMemo(() => {
    if (!task || !Array.isArray(task.history) || !task.history.length) return [];
    return [...task.history]
      .filter(h => h && h.text)
      .sort((a, b) => (b.at || "").localeCompare(a.at || ""))
      .slice(0, 5);
  }, [task]);

  return (
    <div className="obj-detail-page">

      {/* Breadcrumb */}
      <div className="obj-breadcrumb">
        <button className="obj-back-btn" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Retour aux demandes
        </button>
        <span>›</span>
        <span style={{ color: "var(--text-2)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>
          {r.subject || "Demande"}
        </span>
      </div>

      {/* ── Header premium ── */}
      <div className="dem-detail-hd">
        <div className="dem-detail-hd-icon">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M3 5h16M3 10.5h10M3 16h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="dem-detail-hd-body">
          <h1 className="dem-detail-hd-title">{r.subject || "–"}</h1>
          <div className="dem-detail-hd-meta">
            {club && (
              <span className="dem-club-pill">
                <span className="dem-club-pill-dot" />
                {club.name}
              </span>
            )}
            <span className="dem-date-chip">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <rect x="1" y="2" width="9" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M3.5 1v2M7.5 1v2M1 5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Reçue le {fmtDateFull(r.createdAt) || "–"}
            </span>
            {late && (
              <span className="dem-late-badge">
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <circle cx="5.5" cy="5.5" r="5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M5.5 3V5.5M5.5 7v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Échéance dépassée
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Grille 3 colonnes */}
      <div className="obj-detail-grid">

        {/* ── Colonne 1 — Identité de la demande ── */}
        <div className="obj-detail-col">
          <div className="obj-block dem-block--blue">
            <div className="obj-block-header">
              <span className="dem-bh-icon">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <rect x="1.5" y="1.5" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M4 5h5M4 7.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </span>
              Demande
            </div>
            <div className="obj-info-row">
              <span className="obj-info-label">Sujet</span>
              <span className="obj-info-val">{r.subject || "–"}</span>
            </div>
            {club && (
              <div className="obj-info-row">
                <span className="obj-info-label">Club</span>
                <span className="obj-info-val">{club.name}</span>
              </div>
            )}
            <div className="obj-info-row">
              <span className="obj-info-label">De la part de</span>
              <span className="obj-info-val">
                {[r.firstName, r.lastName].filter(Boolean).join(" ") || "–"}
              </span>
            </div>
            {r.email && (
              <div className="obj-info-row">
                <span className="obj-info-label">Email</span>
                <span className="obj-info-val" style={{ wordBreak: "break-all" }}>{r.email}</span>
              </div>
            )}
            {r.phone && (
              <div className="obj-info-row">
                <span className="obj-info-label">Téléphone</span>
                <span className="obj-info-val">{r.phone}</span>
              </div>
            )}
            <div className="obj-info-row">
              <span className="obj-info-label">Reçue le</span>
              <span className="obj-info-val">{fmtDateFull(r.createdAt) || "–"}</span>
            </div>
          </div>
        </div>

        {/* ── Colonne 2 — Besoin & traitement ── */}
        <div className="obj-detail-col">

          {/* Description */}
          {r.description && (
            <div className="obj-block dem-block--orange">
              <div className="obj-block-header">
                <span className="dem-bh-icon">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M2 2.5h9v8H2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                    <path d="M4 5h5M4 7h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </span>
                Besoin
              </div>
              <div className="obj-block-body" style={{ fontSize: 12.5, lineHeight: 1.65, color: "var(--text)" }}>
                {r.description}
              </div>
            </div>
          )}

          {/* Traitement */}
          <div className="obj-block dem-block--green">
            <div className="obj-block-header">
              <span className="dem-bh-icon">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M4.5 6.5l1.5 1.5 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              Traitement
            </div>
            <div className="obj-info-row">
              <span className="obj-info-label">Assigné à</span>
              <span className="obj-info-val">{assignedName || "–"}</span>
            </div>
            <div className="obj-info-row">
              <span className="obj-info-label">Échéance</span>
              <span className="obj-info-val" style={{ color: late ? "var(--red)" : "inherit", fontWeight: late ? 700 : 600 }}>
                {fmtDateFull(r.deadline) || "–"}
                {late && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700 }}>· dépassée</span>}
              </span>
            </div>
          </div>

          {/* ── Tâche opérationnelle liée — identité violette ── */}
          <div className="dem-task-block">
            <div className="dem-task-block-header">
              <div className="dem-task-block-icon">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <rect x="1.5" y="2" width="10" height="9" rx="1.8" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M4.5 6.5l1.5 1.5L9.5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="dem-task-block-label">Tâche opérationnelle liée</span>
              {task && <TaskStatusBadge status={task.status} />}
            </div>

            {/* Pas de taskId */}
            {!r.taskId && (
              <div className="dem-empty-sm">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" style={{ color: "#DDD6FE", marginBottom: 4 }}>
                  <rect x="2" y="3" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.6"/>
                  <path d="M7 11.5l2.5 2.5L15 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Aucune tâche liée à cette demande.</span>
              </div>
            )}

            {/* taskId présent mais tâche non retrouvée */}
            {r.taskId && !task && (
              <div className="dem-empty-sm">
                <span>Tâche introuvable — la référence existe mais la tâche n'est plus disponible.</span>
              </div>
            )}

            {/* Tâche trouvée */}
            {task && (
              <>
                <div className="dem-task-row">
                  <span className="dem-task-lbl">Titre</span>
                  <span className="dem-task-val">{task.title || "–"}</span>
                </div>
                <div className="dem-task-row">
                  <span className="dem-task-lbl">Statut</span>
                  <span className="dem-task-val">
                    <TaskStatusBadge status={task.status} />
                  </span>
                </div>
                {task.priority && (
                  <div className="dem-task-row">
                    <span className="dem-task-lbl">Priorité</span>
                    <span className="dem-task-val" style={{ color: T_PRIORITY[task.priority] || "var(--text-2)", fontWeight: 700 }}>
                      {task.priority}
                    </span>
                  </div>
                )}
                {task.deadline && (
                  <div className="dem-task-row">
                    <span className="dem-task-lbl">Échéance</span>
                    <span className="dem-task-val">{fmtDateFull(task.deadline) || task.deadline}</span>
                  </div>
                )}
                {taskAssigned && (
                  <div className="dem-task-row">
                    <span className="dem-task-lbl">Assigné(s)</span>
                    <span className="dem-task-val">{taskAssigned}</span>
                  </div>
                )}
                {prog && (
                  <div className="dem-task-row">
                    <span className="dem-task-lbl">Sous-tâches</span>
                    <span className="dem-task-val">
                      <div className="dem-sub-prog">
                        <div className="dem-sub-bar">
                          <div className="dem-sub-fill" style={{ width: `${prog.pct}%` }} />
                        </div>
                        <span className="dem-sub-label">{prog.done}/{prog.total}</span>
                      </div>
                    </span>
                  </div>
                )}
                {task.description && (
                  <div className="dem-task-row dem-task-row--col">
                    <span className="dem-task-lbl">Note</span>
                    <span className="dem-task-desc">
                      {task.description.slice(0, 200)}{task.description.length > 200 ? "…" : ""}
                    </span>
                  </div>
                )}
                {/* Bouton navigation — "projets" est une route réelle de AppV2 */}
                {onNavigate && (
                  <button className="dem-task-nav-btn" onClick={() => onNavigate("projets")}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <rect x="1" y="1.5" width="10" height="9" rx="2" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M3.5 5.5l2 2L8.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Voir dans Projets &amp; Tâches
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ marginLeft: "auto" }}>
                      <path d="M4 2l3.5 3.5L4 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Colonne 3 — Pilotage ── */}
        <div className="obj-detail-col">

          {/* Alerte retard — bloc dédié rose/rouge */}
          {late && (
            <div className="dem-alert-block">
              <div className="dem-alert-block-header">
                <div className="dem-alert-block-icon">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M6.5 4V6.5M6.5 8.5v.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </div>
                <span className="dem-alert-block-title">Alerte échéance</span>
              </div>
              <div className="dem-alert-row">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="7" cy="7" r="6" stroke="#DC2626" strokeWidth="1.4"/>
                  <path d="M7 4V7M7 9v.5" stroke="#DC2626" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <div>
                  <div style={{ fontWeight: 800, color: "#DC2626", fontSize: 12 }}>Échéance dépassée</div>
                  {r.deadline && (
                    <div style={{ fontSize: 11, color: "#9F1239", marginTop: 2, fontWeight: 500 }}>
                      depuis le {fmtDateFull(r.deadline)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Relations — accent indigo */}
          <div className="obj-block dem-block--indigo">
            <div className="obj-block-header">
              <span className="dem-bh-icon">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="4" r="2" stroke="currentColor" strokeWidth="1.3"/>
                  <circle cx="2.5" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
                  <circle cx="10.5" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M6.5 6v1.5M6.5 7.5l-3.5 1M6.5 7.5l3.5 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </span>
              Relations
            </div>
            {club && (
              <div className="obj-info-row">
                <span className="obj-info-label">Club</span>
                <span className="obj-info-val">{club.name}</span>
              </div>
            )}
            {assignedName && (
              <div className="obj-info-row">
                <span className="obj-info-label">Responsable</span>
                <span className="obj-info-val">{assignedName}</span>
              </div>
            )}
            <div className="obj-info-row">
              <span className="obj-info-label">Tâche liée</span>
              <span className="obj-info-val">
                {task ? (
                  <span style={{ color: "#7C3AED", fontWeight: 700 }}>
                    {task.title ? `${task.title.slice(0, 28)}${task.title.length > 28 ? "…" : ""}` : "–"}
                  </span>
                ) : r.taskId ? (
                  <span style={{ color: "var(--text-3)" }}>Non retrouvée</span>
                ) : (
                  <span style={{ color: "var(--text-3)" }}>Aucune</span>
                )}
              </span>
            </div>
          </div>

          {/* Activité — task.history (5 entrées max, les plus récentes) */}
          {activity.length > 0 && (
            <div className="obj-block dem-block--slate">
              <div className="obj-block-header">
                <span className="dem-bh-icon">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M6.5 2A4.5 4.5 0 1 0 11 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <path d="M6.5 4v2.5l1.5 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                Activité (tâche)
              </div>
              {activity.map((h, i) => {
                const userName = resolveUser(h.userId, users);
                return (
                  <div key={h.id || i} className="dem-activity-item">
                    <span className="dem-activity-time">{fmtDateShort(h.at) || "–"}</span>
                    <div className="dem-activity-text">
                      {userName && <span className="dem-activity-user">{userName} · </span>}
                      {h.text}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tâche présente mais historique vide */}
          {task && activity.length === 0 && (
            <div className="obj-block dem-block--slate">
              <div className="obj-block-header">
                <span className="dem-bh-icon">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M6.5 2A4.5 4.5 0 1 0 11 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <path d="M6.5 4v2.5l1.5 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                Activité
              </div>
              <div className="dem-empty-sm">
                <span>Aucune activité enregistrée sur cette tâche.</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   ROOT — DemandesV2
   ════════════════════════════════════════════════════════ */

/*
 * Props :
 *   appId           — ID de l'utilisateur connecté (lecture seule)
 *   currentUser     — profil utilisateur courant
 *   onNavigate      — navigation V2 (setCurrentPage)
 *   initialSelectedId — ID d'une demande à ouvrir directement (deep-link depuis Calendrier)
 *                       Null par défaut. Sera branché lors de la validation de la navigation
 *                       CalendrierV2 → DemandesV2.
 */
export default function DemandesV2({ appId, currentUser, onNavigate, initialSelectedId }) {
  const { requests, loading: loadingR } = useRequests();
  const { tasks,    loading: loadingT } = useTasks();
  const { users }  = useUsers();
  const { clubs }  = useClubs();

  const [selected,   setSelected]   = useState(null);
  const [filter,     setFilter]     = useState("all");
  const [clubFilter, setClubFilter] = useState("");
  const [search,     setSearch]     = useState("");

  /* Index tâches par ID pour lookup O(1) */
  const taskById = useMemo(() => {
    const m = new Map();
    (tasks || []).filter(Boolean).forEach(t => t.id && m.set(String(t.id), t));
    return m;
  }, [tasks]);

  /*
   * Deep-link : si initialSelectedId est fourni, attend que les données soient
   * disponibles puis ouvre la fiche correspondante.
   * Dépendance sur [initialSelectedId, requests] : réévalue si les données
   * arrivent après le montage initial (onSnapshot asynchrone).
   */
  useEffect(() => {
    if (!initialSelectedId || !requests.length) return;
    const r = requests.find(req => String(req.id) === String(initialSelectedId));
    if (r) setSelected(r);
  }, [initialSelectedId, requests]);

  if (selected) {
    return (
      <DetailView
        request={selected}
        taskById={taskById}
        users={users}
        clubs={clubs}
        onBack={() => setSelected(null)}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <ListView
      requests={requests}
      taskById={taskById}
      users={users}
      clubs={clubs}
      onSelect={setSelected}
      filter={filter}         setFilter={setFilter}
      clubFilter={clubFilter} setClubFilter={setClubFilter}
      search={search}         setSearch={setSearch}
      loading={loadingR || loadingT}
    />
  );
}
