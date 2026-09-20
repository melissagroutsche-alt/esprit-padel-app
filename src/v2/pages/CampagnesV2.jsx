/**
 * CampagnesV2 — Module Campagnes Marketing, V2 Esprit Padel OS.
 *
 * Source de vérité : ep:campagnes (UNIQUEMENT).
 * Lecture seule Firestore. Aucune écriture, aucune migration.
 * Aucune relation inventée avec ep:projects, ep:tasks ou ep:publications.
 *
 * Statuts calculés (pas stockés) :
 *   brouillon  = published === false
 *   a-venir    = published && today < dateStart
 *   active     = published && dateStart ≤ today ≤ dateEnd
 *   terminee   = published && today > dateEnd
 *   indefini   = published, dates absentes ou inexploitables
 *
 * Progression : timeline[].done / timeline items valides (label non vide)
 *   null si aucune timeline exploitable → état neutre affiché.
 */
import React, { useState, useMemo, useEffect } from "react";
import { useCampagnes, useUsers, useClubs } from "../hooks/useV1Data";

/* ─────────────────────────────────────
   HELPERS DATES
───────────────────────────────────── */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function fmtDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
function fmtShort(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function isValidDate(d) {
  if (!d) return false;
  const dt = new Date(d);
  return !isNaN(dt.getTime());
}

/* ─────────────────────────────────────
   STATUT CALCULÉ
───────────────────────────────────── */
function getCampagneStatus(c) {
  if (!c.published) return "brouillon";
  const today = todayStr();
  const hasStart = isValidDate(c.dateStart);
  const hasEnd   = isValidDate(c.dateEnd);
  if (!hasStart && !hasEnd) return "indefini";
  if (hasStart && today < c.dateStart) return "a-venir";
  if (hasStart && hasEnd) {
    if (today >= c.dateStart && today <= c.dateEnd) return "active";
    if (today > c.dateEnd) return "terminee";
  }
  if (hasStart && !hasEnd) {
    if (today >= c.dateStart) return "active";
  }
  // E : end sans start — seul cas interprétable avec certitude
  if (!hasStart && hasEnd && today > c.dateEnd) return "terminee";
  return "indefini";
}

const STATUS_META = {
  "active":    { label: "Active",    bg: "#ECFDF5", text: "#065F46", dot: "#10B981" },
  "a-venir":   { label: "À venir",   bg: "#EFF6FF", text: "#1D4ED8", dot: "#3B82F6" },
  "terminee":  { label: "Terminée",  bg: "#F8FAFC", text: "#475569", dot: "#94A3B8" },
  "brouillon": { label: "Brouillon", bg: "#FFF7ED", text: "#9A3412", dot: "#FB8500" },
  "indefini":  { label: "Publiée",   bg: "#ECFDF5", text: "#065F46", dot: "#10B981" },
};

/* ─────────────────────────────────────
   PROGRESSION
───────────────────────────────────── */
function getProgress(c) {
  const items = (c.timeline || []).filter(t => t.label && t.label.trim());
  if (items.length === 0) return null;
  const done = items.filter(t => t.done).length;
  return { done, total: items.length, pct: Math.round((done / items.length) * 100) };
}

/* ─────────────────────────────────────
   RÉSOLUTION
───────────────────────────────────── */
function resolveUser(id, users) {
  if (!id || !users.length) return null;
  return users.find(u => String(u.id) === String(id) || String(u.appId) === String(id)) || null;
}
function userName(u) {
  if (!u) return null;
  return `${u.firstName || ""} ${(u.lastName || "")[0] || ""}`.trim() || null;
}
function initials(name) {
  if (!name) return "?";
  const p = name.split(" ").filter(Boolean);
  if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  return (p[0][0] || "?").toUpperCase();
}
function resolveClub(id, clubs) {
  if (!id || !clubs.length) return null;
  return clubs.find(c => String(c.id) === String(id)) || null;
}

/* ─────────────────────────────────────
   CANAUX → ICON
───────────────────────────────────── */
const CHANNEL_ICONS = {
  "Instagram": "📸", "Facebook": "👥", "TikTok": "🎵", "LinkedIn": "💼",
  "Newsletter": "📧", "WhatsApp": "💬", "SMS": "📱", "Affichage": "🖼",
  "Site web": "🌐", "Google Business": "🔍",
};
function channelIcon(ch) { return CHANNEL_ICONS[ch] || "📣"; }

/* ─────────────────────────────────────
   PALETTES CARDS ACTIVES (cycle sur index)
───────────────────────────────────── */
const CARD_PALETTES = [
  { bg: "#2D2D30", accent: "#FEB601", text: "#FFFFFF", textSub: "rgba(255,255,255,0.65)", bar: "#FEB601", barBg: "rgba(255,255,255,0.15)" },
  { bg: "#0F56B8", accent: "#FEB601", text: "#FFFFFF", textSub: "rgba(255,255,255,0.65)", bar: "#FEB601", barBg: "rgba(255,255,255,0.2)"  },
  { bg: "#FB8500", accent: "#FFFFFF", text: "#FFFFFF", textSub: "rgba(255,255,255,0.7)",  bar: "#FFFFFF", barBg: "rgba(255,255,255,0.25)" },
  { bg: "#1E3A5F", accent: "#FEB601", text: "#FFFFFF", textSub: "rgba(255,255,255,0.6)",  bar: "#FEB601", barBg: "rgba(255,255,255,0.15)" },
];

/* ─────────────────────────────────────
   COMPOSANTS RÉUTILISABLES
───────────────────────────────────── */
function Spinner() {
  return <div className="camp-spinner" />;
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META["indefini"];
  return (
    <span className="camp-status-badge" style={{ background: m.bg, color: m.text }}>
      <span className="camp-status-dot" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

function ProgressBar({ pct, barColor, barBg, height = 6 }) {
  return (
    <div className="camp-prog-track" style={{ background: barBg || "var(--border)", height }}>
      <div className="camp-prog-fill" style={{ width: `${pct}%`, background: barColor || "var(--ep-blue)", height }} />
    </div>
  );
}

function ChannelPill({ channel, dark }) {
  return (
    <span className={`camp-ch-pill${dark ? " camp-ch-pill--dark" : ""}`}>
      {channelIcon(channel)} {channel}
    </span>
  );
}

/* ─────────────────────────────────────
   SECTION: GRANDE CARD CAMPAGNE ACTIVE
───────────────────────────────────── */
function ActiveCampagneCard({ campagne, palette, users, onClick }) {
  const prog  = getProgress(campagne);
  const owner = resolveUser(campagne.owner, users);
  const start = fmtShort(campagne.dateStart);
  const end   = fmtShort(campagne.dateEnd);
  const channels = (campagne.channels || []).slice(0, 4);
  const moreChannels = (campagne.channels || []).length - 4;

  return (
    <button className="camp-active-card" style={{ background: palette.bg }} onClick={onClick}>
      <div className="camp-active-card__header">
        <div className="camp-active-card__icon" style={{ background: palette.accent, color: palette.bg }}>
          📢
        </div>
        <div className="camp-active-card__meta" style={{ color: palette.textSub }}>
          {start && end ? `${start} → ${end}` : start || "Dates non renseignées"}
        </div>
      </div>

      <div className="camp-active-card__name" style={{ color: palette.text }}>
        {campagne.name}
      </div>

      {campagne.concept && (
        <div className="camp-active-card__concept" style={{ color: palette.textSub }}>
          {campagne.concept.length > 80 ? campagne.concept.slice(0, 80) + "…" : campagne.concept}
        </div>
      )}

      <div className="camp-active-card__channels">
        {channels.map(ch => (
          <span key={ch} className="camp-active-card__ch" style={{ background: palette.barBg, color: palette.text }}>
            {channelIcon(ch)} {ch}
          </span>
        ))}
        {moreChannels > 0 && (
          <span className="camp-active-card__ch" style={{ background: palette.barBg, color: palette.text }}>
            +{moreChannels}
          </span>
        )}
      </div>

      <div className="camp-active-card__footer">
        <div className="camp-active-card__prog">
          {prog !== null ? (
            <>
              <div className="camp-active-card__prog-label" style={{ color: palette.textSub }}>
                Progression · {prog.done}/{prog.total} étapes
              </div>
              <ProgressBar pct={prog.pct} barColor={palette.bar} barBg={palette.barBg} height={5} />
              <div className="camp-active-card__pct" style={{ color: palette.text }}>{prog.pct}%</div>
            </>
          ) : (
            <div className="camp-active-card__prog-label" style={{ color: palette.textSub }}>
              Progression non renseignée
            </div>
          )}
        </div>
        {owner && (
          <div className="camp-active-card__owner" style={{ background: palette.barBg, color: palette.text }}>
            {initials(userName(owner) || "?")}
          </div>
        )}
      </div>
    </button>
  );
}

/* ─────────────────────────────────────
   SECTION: PLANNING TIMELINE
───────────────────────────────────── */
function PlanningZone({ campagnes }) {
  const active = campagnes.filter(c => getCampagneStatus(c) === "active");
  if (active.length === 0) return null;

  return (
    <div className="camp-planning">
      <div className="camp-planning__title">Planning des campagnes actives</div>
      {active.map(camp => {
        const items = (camp.timeline || []).filter(t => t.label && t.label.trim());
        if (items.length === 0) return null;
        const phases = ["Avant", "Pendant", "Après"];
        return (
          <div key={camp.id} className="camp-planning__camp">
            <div className="camp-planning__camp-name">{camp.name}</div>
            <div className="camp-planning__phases">
              {phases.map(phase => {
                const phaseItems = items.filter(t => t.phase === phase);
                if (phaseItems.length === 0) return null;
                return (
                  <div key={phase} className="camp-planning__phase">
                    <div className={`camp-planning__phase-label camp-planning__phase-label--${phase.toLowerCase()}`}>
                      {phase}
                    </div>
                    <div className="camp-planning__steps">
                      {phaseItems.map(t => (
                        <div key={t.id} className={`camp-planning__step${t.done ? " camp-planning__step--done" : ""}`}>
                          <span className="camp-planning__step-check">{t.done ? "✓" : "○"}</span>
                          <span className="camp-planning__step-label">{t.label}</span>
                          {t.date && isValidDate(t.date) && (
                            <span className="camp-planning__step-date">{fmtShort(t.date)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }).filter(Boolean)}
    </div>
  );
}

/* ─────────────────────────────────────
   SECTION: PROCHAINES ACTIONS (sidebar)
   Source : timeline[] et actions[] uniquement.
   Campagnes éligibles : active OU a-venir (published).
   Brouillons et terminées exclus.
   Items : non terminés, date valide.
   Ordre : en retard d'abord, puis à venir — chaque groupe trié chronologiquement.
   Aucune relation avec ep:tasks.
───────────────────────────────────── */
function ProchainesActions({ campagnes }) {
  const today = todayStr();

  const { overdue, upcoming } = useMemo(() => {
    const all = [];
    const eligible = new Set(["active", "a-venir"]);

    campagnes.forEach(camp => {
      if (!eligible.has(getCampagneStatus(camp))) return;

      (camp.timeline || [])
        .filter(t => t.label && t.label.trim() && !t.done && isValidDate(t.date))
        .forEach(t => {
          all.push({
            id: `tl-${camp.id}-${t.id}`,
            campagneName: camp.name,
            label: t.label,
            date: t.date,
            phase: t.phase || null,
          });
        });

      (camp.actions || [])
        .filter(a => a.label && !a.done && isValidDate(a.deadline))
        .forEach(a => {
          all.push({
            id: `ac-${camp.id}-${a.id}`,
            campagneName: camp.name,
            label: a.label,
            date: a.deadline,
            phase: a.phase || null,
          });
        });
    });

    const asc = (a, b) => a.date.localeCompare(b.date);
    return {
      overdue:  all.filter(x => x.date < today).sort(asc),
      upcoming: all.filter(x => x.date >= today).sort(asc),
    };
  }, [campagnes, today]);

  const all = [...overdue, ...upcoming];

  return (
    <div className="camp-aside">
      <div className="camp-aside__title">Prochaines actions</div>
      {all.length === 0 ? (
        <div className="camp-aside__empty">Aucune action planifiée</div>
      ) : (
        <div className="camp-aside__list">
          {all.map(a => {
            const late = a.date < today;
            return (
              <div key={a.id} className={`camp-aside__item${late ? " camp-aside__item--late" : ""}`}>
                <div className={`camp-aside__item-date${late ? " late" : ""}`}>
                  {late ? "⚠" : ""} {fmtShort(a.date)}
                </div>
                <div className="camp-aside__item-body">
                  <div className="camp-aside__item-label">{a.label}</div>
                  <div className="camp-aside__item-meta">
                    {late && <span className="camp-aside__item-overdue">En retard</span>}
                    <span className="camp-aside__item-camp">{a.campagneName}</span>
                    {a.phase && <span className="camp-aside__item-phase">{a.phase}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────
   SECTION: TABLE TOUTES LES CAMPAGNES
───────────────────────────────────── */
const FILTERS = [
  { key: "toutes",    label: "Toutes" },
  { key: "active",   label: "Actives" },
  { key: "a-venir",  label: "À venir" },
  { key: "terminee", label: "Terminées" },
  { key: "brouillon",label: "Brouillons" },
];

function CampagnesTable({ campagnes, onSelect }) {
  const [filter, setFilter] = useState("toutes");

  const displayed = useMemo(() => {
    const sorted = [...campagnes].sort((a, b) => {
      const da = a.dateStart || a.createdAt || "";
      const db = b.dateStart || b.createdAt || "";
      return db.localeCompare(da);
    });
    if (filter === "toutes") return sorted;
    return sorted.filter(c => getCampagneStatus(c) === filter);
  }, [campagnes, filter]);

  const counts = useMemo(() => {
    const c = { toutes: campagnes.length, active: 0, "a-venir": 0, terminee: 0, brouillon: 0 };
    campagnes.forEach(camp => {
      const s = getCampagneStatus(camp);
      if (c[s] !== undefined) c[s]++;
    });
    return c;
  }, [campagnes]);

  return (
    <div className="camp-table-section">
      <div className="camp-table-header">
        <div className="camp-table-title">Toutes les campagnes</div>
        <div className="camp-table-filters">
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={`camp-filter-btn${filter === f.key ? " active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {counts[f.key] > 0 && <span className="camp-filter-count">{counts[f.key]}</span>}
            </button>
          ))}
        </div>
      </div>

      {displayed.length === 0 ? (
        <div className="camp-table-empty">Aucune campagne dans cette catégorie</div>
      ) : (
        <div className="camp-table-wrap">
          <table className="camp-table">
            <thead>
              <tr>
                <th>Campagne</th>
                <th>Canaux</th>
                <th>Dates</th>
                <th>Progression</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(camp => {
                const status = getCampagneStatus(camp);
                const prog   = getProgress(camp);
                const channels = (camp.channels || []).slice(0, 3);
                const more = (camp.channels || []).length - 3;
                return (
                  <tr key={camp.id} className="camp-table-row" onClick={() => onSelect(camp.id)}>
                    <td>
                      <div className="camp-table-name">{camp.name}</div>
                      {camp.concept && (
                        <div className="camp-table-concept">
                          {camp.concept.length > 55 ? camp.concept.slice(0, 55) + "…" : camp.concept}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="camp-table-channels">
                        {channels.map(ch => (
                          <span key={ch} className="camp-ch-pill camp-ch-pill--sm">{channelIcon(ch)}</span>
                        ))}
                        {more > 0 && <span className="camp-ch-pill camp-ch-pill--sm">+{more}</span>}
                      </div>
                    </td>
                    <td>
                      <div className="camp-table-dates">
                        {fmtShort(camp.dateStart) || "—"}
                        {camp.dateEnd && <> → {fmtShort(camp.dateEnd)}</>}
                      </div>
                    </td>
                    <td>
                      {prog !== null ? (
                        <div className="camp-table-prog">
                          <ProgressBar pct={prog.pct} height={5} />
                          <span className="camp-table-pct">{prog.pct}%</span>
                        </div>
                      ) : (
                        <span className="camp-table-noprog">—</span>
                      )}
                    </td>
                    <td><StatusBadge status={status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────
   SECTION: FICHE DÉTAIL CAMPAGNE
───────────────────────────────────── */
function DetailBlock({ title, color, children, className = "" }) {
  return (
    <div className={`camp-detail-block ${className}`} style={color ? { borderColor: color + "40" } : {}}>
      <div className="camp-detail-block__title" style={color ? { color } : {}}>{title}</div>
      <div className="camp-detail-block__body">{children}</div>
    </div>
  );
}

function FieldRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="camp-field-row">
      <span className="camp-field-label">{label}</span>
      <span className="camp-field-value">{value}</span>
    </div>
  );
}

function CampagneDetail({ campagne, users, clubs, onBack }) {
  const [tab, setTab] = useState("identite");

  const status = getCampagneStatus(campagne);
  const prog   = getProgress(campagne);
  const owner  = resolveUser(campagne.owner, users);

  const TABS = [
    { id: "identite",    label: "Identité" },
    { id: "timeline",    label: "Timeline" },
    { id: "suivi",       label: "Suivi clubs" },
    { id: "comms",       label: "Communication" },
    { id: "kpi",         label: "KPI" },
    { id: "ressources",  label: "Ressources" },
  ];

  return (
    <div className="camp-detail">
      {/* Back */}
      <button className="camp-detail-back" onClick={onBack}>← Retour</button>

      {/* Header fort */}
      <div className="camp-detail-hd">
        <div className="camp-detail-hd__icon">📢</div>
        <div className="camp-detail-hd__main">
          <div className="camp-detail-hd__title">{campagne.name}</div>
          <div className="camp-detail-hd__meta">
            {isValidDate(campagne.dateStart) && (
              <span className="camp-detail-hd__dates">
                {fmtDate(campagne.dateStart)}
                {isValidDate(campagne.dateEnd) && <> → {fmtDate(campagne.dateEnd)}</>}
              </span>
            )}
            <StatusBadge status={status} />
            {owner && (
              <span className="camp-detail-hd__owner">
                <span className="camp-detail-hd__owner-avatar">{initials(userName(owner) || "?")}</span>
                {userName(owner)}
              </span>
            )}
          </div>
          {/* Channels pills */}
          {(campagne.channels || []).length > 0 && (
            <div className="camp-detail-hd__channels">
              {campagne.channels.map(ch => (
                <ChannelPill key={ch} channel={ch} />
              ))}
            </div>
          )}
          {/* Progress */}
          {prog !== null ? (
            <div className="camp-detail-hd__prog">
              <ProgressBar pct={prog.pct} height={7} />
              <span className="camp-detail-hd__pct">{prog.pct}% · {prog.done}/{prog.total} étapes</span>
            </div>
          ) : (
            <div className="camp-detail-hd__noprog">Progression non renseignée</div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="camp-detail-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`camp-detail-tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Identité / Stratégie ── */}
      {tab === "identite" && (
        <div className="camp-detail-content">
          {/* Brief si renseigné */}
          {campagne.presentation && (
            <DetailBlock title="📋 Brief" color="#0F56B8">
              <div className="camp-detail-presentation">{campagne.presentation}</div>
            </DetailBlock>
          )}

          {/* Identité stratégique */}
          {(campagne.persona || campagne.positioning || campagne.concept || campagne.signature) && (
            <DetailBlock title="🎯 Identité & Stratégie" color="#0F56B8">
              <FieldRow label="Persona" value={campagne.persona} />
              <FieldRow label="Positionnement" value={campagne.positioning} />
              <FieldRow label="Concept" value={campagne.concept} />
              <FieldRow label="Signature" value={campagne.signature} />
            </DetailBlock>
          )}

          {/* Objectifs */}
          {(campagne.objectives || []).length > 0 && (
            <DetailBlock title="🏆 Objectifs" color="#FEB601">
              <div className="camp-detail-tags">
                {campagne.objectives.map((o, i) => (
                  <span key={i} className="camp-detail-tag">{o}</span>
                ))}
              </div>
            </DetailBlock>
          )}

          {/* Offre */}
          {(campagne.packs?.length || campagne.products || campagne.carteClub || campagne.abonnements || campagne.cours || campagne.coursIndividuel) ? (
            <DetailBlock title="🛍️ Offre" color="#FB8500">
              {(campagne.packs || []).length > 0 && (
                <div className="camp-packs">
                  {campagne.packs.map(p => (
                    <div key={p.id} className="camp-pack">
                      <div className="camp-pack__name">{p.name}</div>
                      {(p.items || []).length > 0 && (
                        <ul className="camp-pack__items">
                          {p.items.map((it, i) => <li key={i}>{it}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <FieldRow label="Produits boutique" value={campagne.products} />
              <FieldRow label="Carte Club" value={campagne.carteClub} />
              <FieldRow label="Abonnements" value={campagne.abonnements} />
              <FieldRow label="Cours collectifs" value={campagne.cours} />
              <FieldRow label="Cours individuels" value={campagne.coursIndividuel} />
            </DetailBlock>
          ) : null}
        </div>
      )}

      {/* ── TAB: Timeline ── */}
      {tab === "timeline" && (
        <div className="camp-detail-content">
          {(() => {
            const items = (campagne.timeline || []).filter(t => t.label && t.label.trim());
            if (items.length === 0) {
              return <div className="camp-empty-state">Aucune étape de timeline renseignée pour cette campagne.</div>;
            }
            const phases = ["Avant", "Pendant", "Après"];
            return (
              <div className="camp-timeline-detail">
                {phases.map(phase => {
                  const phaseItems = items.filter(t => t.phase === phase);
                  if (phaseItems.length === 0) return null;
                  return (
                    <div key={phase} className={`camp-tl-phase camp-tl-phase--${phase.toLowerCase()}`}>
                      <div className="camp-tl-phase__label">{phase}</div>
                      <div className="camp-tl-phase__items">
                        {phaseItems.map(t => (
                          <div key={t.id} className={`camp-tl-item${t.done ? " camp-tl-item--done" : ""}`}>
                            <div className={`camp-tl-item__check${t.done ? " done" : ""}`}>
                              {t.done ? "✓" : ""}
                            </div>
                            <div className="camp-tl-item__body">
                              <div className="camp-tl-item__label">{t.label}</div>
                              {t.date && isValidDate(t.date) && (
                                <div className="camp-tl-item__date">{fmtDate(t.date)}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── TAB: Suivi clubs ── */}
      {tab === "suivi" && (
        <div className="camp-detail-content">
          {(() => {
            const actions = (campagne.actions || []).filter(a => a.label);
            if (actions.length === 0) {
              return <div className="camp-empty-state">Aucune action de suivi renseignée pour cette campagne.</div>;
            }
            const clubIds = [...new Set(actions.flatMap(a => a.clubs || []))];
            const resolvedClubs = clubIds.map(id => resolveClub(id, clubs)).filter(Boolean);
            return (
              <div className="camp-suivi-wrap">
                <div className="camp-suivi-table-wrap">
                  <table className="camp-suivi-table">
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>Phase</th>
                        <th>Deadline</th>
                        {resolvedClubs.map(cl => (
                          <th key={cl.id}>{cl.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {actions.map(a => (
                        <tr key={a.id}>
                          <td>
                            <div className="camp-suivi-action-label">{a.label}</div>
                          </td>
                          <td>
                            {a.phase && (
                              <span className={`camp-suivi-phase camp-suivi-phase--${(a.phase || "").toLowerCase()}`}>
                                {a.phase}
                              </span>
                            )}
                          </td>
                          <td>
                            <span className="camp-suivi-deadline">
                              {isValidDate(a.deadline) ? fmtShort(a.deadline) : "—"}
                            </span>
                          </td>
                          {resolvedClubs.map(cl => {
                            const raw = a.clubStatus?.[String(cl.id)];
                            // Interprétation stricte : on n'interprète que les valeurs connues
                            const isDone = raw === "done" || raw === "terminé" || raw === "Terminé" || a.done === true;
                            return (
                              <td key={cl.id} className="camp-suivi-cell">
                                <span className={`camp-suivi-dot${isDone ? " done" : ""}`}>
                                  {isDone ? "✓" : "○"}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── TAB: Communication ── */}
      {tab === "comms" && (
        <div className="camp-detail-content">
          {/* Hashtags */}
          {campagne.hashtags && (
            <DetailBlock title="# Hashtags" color="#6D28D9">
              <div className="camp-detail-hashtags">{campagne.hashtags}</div>
            </DetailBlock>
          )}

          {/* Push notifications */}
          {(campagne.pushTitle || campagne.pushMessage) && (
            <DetailBlock title="🔔 Push Notification" color="#0F56B8">
              <FieldRow label="Titre" value={campagne.pushTitle} />
              <FieldRow label="Message" value={campagne.pushMessage} />
            </DetailBlock>
          )}

          {/* WhatsApp messages programmés */}
          {(campagne.whatsappMessages || []).length > 0 && (
            <DetailBlock title="💬 Messages WhatsApp" color="#10B981">
              {campagne.whatsappMessages.map(m => (
                <div key={m.id} className="camp-wa-msg">
                  <div className="camp-wa-msg__meta">{m.date} {m.time} · {m.target || "Tous"}</div>
                  <div className="camp-wa-msg__text">{m.text}</div>
                </div>
              ))}
            </DetailBlock>
          )}

          {/* Notes par canal */}
          {Object.keys(campagne.channelNotes || {}).filter(k => campagne.channelNotes[k]).length > 0 && (
            <DetailBlock title="📣 Notes par canal" color="#FB8500">
              {Object.entries(campagne.channelNotes)
                .filter(([, v]) => v)
                .map(([ch, note]) => (
                  <div key={ch} className="camp-channel-note">
                    <div className="camp-channel-note__label">{channelIcon(ch)} {ch}</div>
                    <div className="camp-channel-note__text">{note}</div>
                  </div>
                ))}
            </DetailBlock>
          )}

          {/* Notifications programmées */}
          {(campagne.notifications || []).length > 0 && (
            <DetailBlock title="🔔 Notifications programmées" color="#0F56B8">
              {campagne.notifications.map(n => (
                <div key={n.id} className="camp-notif">
                  <div className="camp-notif__meta">{n.date} {n.time}</div>
                  <div className="camp-notif__title">{n.title}</div>
                  {n.body && <div className="camp-notif__body">{n.body}</div>}
                </div>
              ))}
            </DetailBlock>
          )}

          {!campagne.hashtags &&
           !campagne.pushTitle && !campagne.pushMessage &&
           !(campagne.whatsappMessages || []).length &&
           !Object.keys(campagne.channelNotes || {}).filter(k => campagne.channelNotes[k]).length &&
           !(campagne.notifications || []).length && (
            <div className="camp-empty-state">Aucun contenu de communication renseigné pour cette campagne.</div>
          )}
        </div>
      )}

      {/* ── TAB: KPI ── */}
      {tab === "kpi" && (
        <div className="camp-detail-content">
          {(() => {
            const indicators = (campagne.kpiIndicators || []);
            const values     = campagne.kpiValues || {};
            const targets    = (campagne.targets || []);
            const hasData = indicators.length > 0 || targets.length > 0;

            if (!hasData) {
              return <div className="camp-empty-state">Aucun indicateur KPI renseigné pour cette campagne.</div>;
            }

            return (
              <>
                {indicators.length > 0 && (
                  <DetailBlock title="📊 Indicateurs" color="#0F56B8">
                    <div className="camp-kpi-grid">
                      {indicators.map(ind => {
                        const clubVals = values[ind.id] || {};
                        const total = Object.values(clubVals).reduce((s, v) => s + (Number(v) || 0), 0);
                        return (
                          <div key={ind.id} className="camp-kpi-tile">
                            <div className="camp-kpi-tile__label">{ind.label}</div>
                            <div className="camp-kpi-tile__value">{total > 0 ? total.toLocaleString("fr-FR") : "—"}</div>
                          </div>
                        );
                      })}
                    </div>
                  </DetailBlock>
                )}
                {targets.length > 0 && (
                  <DetailBlock title="🎯 Objectifs chiffrés" color="#FEB601">
                    {targets.map((t, i) => (
                      <div key={i} className="camp-field-row">
                        <span className="camp-field-label">{t.label || `Cible ${i + 1}`}</span>
                        <span className="camp-field-value">{t.value ?? t.target ?? "—"}</span>
                      </div>
                    ))}
                  </DetailBlock>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ── TAB: Ressources ── */}
      {tab === "ressources" && (
        <div className="camp-detail-content">
          {/* Visuels */}
          {(campagne.visuels || []).length > 0 && (
            <DetailBlock title="🖼 Visuels" color="#6D28D9">
              <div className="camp-visuels-grid">
                {campagne.visuels.map((v, i) => (
                  <a
                    key={v.id || i}
                    href={v.url || v.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="camp-visuel-item"
                  >
                    {v.name || v.fileName || `Visuel ${i + 1}`}
                  </a>
                ))}
              </div>
            </DetailBlock>
          )}

          {/* Liens par club */}
          {(campagne.links || []).filter(l => l.label).length > 0 && (
            <DetailBlock title="🔗 Liens" color="#0F56B8">
              {campagne.links.filter(l => l.label).map(l => (
                <div key={l.id} className="camp-link-row">
                  <span className="camp-link-label">{l.label}</span>
                  <div className="camp-link-urls">
                    {Object.entries(l.urls || {}).filter(([, url]) => url).map(([clubId, url]) => {
                      const cl = resolveClub(clubId, clubs);
                      return (
                        <a key={clubId} href={url} target="_blank" rel="noopener noreferrer" className="camp-link-url">
                          {cl?.name || clubId}
                        </a>
                      );
                    })}
                  </div>
                </div>
              ))}
            </DetailBlock>
          )}

          {/* Liens visuels externes */}
          {(campagne.visualLinks || []).filter(v => v && (v.url || v.link || typeof v === "string")).length > 0 && (
            <DetailBlock title="🔗 Liens visuels" color="#6D28D9">
              <div className="camp-visuels-grid">
                {campagne.visualLinks
                  .filter(v => v && (v.url || v.link || typeof v === "string"))
                  .map((v, i) => {
                    const url   = typeof v === "string" ? v : (v.url || v.link);
                    const label = typeof v === "string" ? `Lien visuel ${i + 1}` : (v.name || v.label || `Lien visuel ${i + 1}`);
                    return (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="camp-visuel-item">
                        {label}
                      </a>
                    );
                  })}
              </div>
            </DetailBlock>
          )}

          {/* Visuels à faire */}
          {(campagne.visualsTodo || []).length > 0 && (
            <DetailBlock title="📝 Visuels à produire" color="#FB8500">
              <ul className="camp-visuels-todo">
                {campagne.visualsTodo.map((v, i) => (
                  <li key={i}>{typeof v === "string" ? v : v.label || JSON.stringify(v)}</li>
                ))}
              </ul>
            </DetailBlock>
          )}

          {/* PDF export — métadonnée discrète */}
          {campagne.pdfName && (
            <div className="camp-pdf-meta">PDF export : {campagne.pdfName}</div>
          )}

          {/* Stocks — empty state si rien d'autre */}
          {!(campagne.visuels || []).length &&
           !(campagne.links || []).filter(l => l.label).length &&
           !(campagne.visualLinks || []).filter(v => v && (v.url || v.link || typeof v === "string")).length &&
           !(campagne.visualsTodo || []).length &&
           !campagne.pdfName && (
            <div className="camp-empty-state">
              Aucune ressource attachée à cette campagne.
              <div className="camp-empty-state__sub camp-unavailable">
                Stocks physiques — fonctionnalité non disponible (source de données absente)
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────
   COMPOSANT RACINE
───────────────────────────────────── */
export default function CampagnesV2({ appId, currentUser, onNavigate, initialSelectedId }) {
  const { campagnes, loading: loadingC } = useCampagnes();
  const { users,    loading: loadingU  } = useUsers();
  const { clubs,    loading: loadingCl } = useClubs();

  const [selected, setSelected] = useState(null);

  // Deep-link : ouvre directement une campagne si initialSelectedId est fourni
  useEffect(() => {
    if (!initialSelectedId || !campagnes.length) return;
    const found = campagnes.find(c => String(c.id) === String(initialSelectedId));
    if (found) setSelected(found.id);
  }, [initialSelectedId, campagnes]);

  const loading = loadingC || loadingU || loadingCl;

  if (loading) {
    return (
      <div className="camp-loading">
        <Spinner />
        <span className="camp-loading__text">Chargement des campagnes…</span>
      </div>
    );
  }

  // Vue détail
  if (selected) {
    const camp = campagnes.find(c => String(c.id) === String(selected));
    if (camp) {
      return (
        <CampagneDetail
          campagne={camp}
          users={users}
          clubs={clubs}
          onBack={() => setSelected(null)}
        />
      );
    }
  }

  // Vue liste
  // F : tri par dateEnd croissant — campagnes sans dateEnd placées après celles avec date connue
  const activeCamps = campagnes
    .filter(c => getCampagneStatus(c) === "active")
    .sort((a, b) => {
      const hasA = isValidDate(a.dateEnd);
      const hasB = isValidDate(b.dateEnd);
      if (hasA && hasB) return a.dateEnd.localeCompare(b.dateEnd);
      if (hasA) return -1;
      if (hasB) return 1;
      return 0;
    })
    .slice(0, 4);

  const totalActive  = campagnes.filter(c => getCampagneStatus(c) === "active").length;
  const totalAvenir  = campagnes.filter(c => getCampagneStatus(c) === "a-venir").length;

  return (
    <div className="camp-root">
      {/* ── Header ── */}
      <div className="camp-header">
        <div className="camp-header__left">
          <h1 className="camp-header__title">Campagnes</h1>
          <div className="camp-header__counts">
            {totalActive > 0 && <span className="camp-header__count camp-header__count--active">{totalActive} active{totalActive > 1 ? "s" : ""}</span>}
            {totalAvenir > 0 && <span className="camp-header__count camp-header__count--avenir">{totalAvenir} à venir</span>}
            <span className="camp-header__count">{campagnes.length} total</span>
          </div>
        </div>
      </div>

      {/* ── Zone principale + sidebar ── */}
      <div className="camp-layout">
        {/* Colonne principale */}
        <div className="camp-main">
          {/* Cards campagnes actives */}
          {activeCamps.length > 0 ? (
            <div className="camp-active-section">
              <div className="camp-section-label">Campagnes actives</div>
              <div className="camp-active-grid">
                {activeCamps.map((camp, i) => (
                  <ActiveCampagneCard
                    key={camp.id}
                    campagne={camp}
                    palette={CARD_PALETTES[i % CARD_PALETTES.length]}
                    users={users}
                    onClick={() => setSelected(camp.id)}
                  />
                ))}
              </div>
            </div>
          ) : (
            campagnes.length > 0 && (
              <div className="camp-no-active">Aucune campagne active en ce moment</div>
            )
          )}

          {/* Zone planning */}
          <PlanningZone campagnes={campagnes} />

          {/* Table toutes les campagnes */}
          {campagnes.length === 0 ? (
            <div className="camp-empty-state camp-empty-state--full">
              Aucune campagne trouvée.
            </div>
          ) : (
            <CampagnesTable
              campagnes={campagnes}
              onSelect={(id) => setSelected(id)}
            />
          )}
        </div>

        {/* Colonne droite : prochaines actions */}
        <ProchainesActions campagnes={campagnes} />
      </div>
    </div>
  );
}
