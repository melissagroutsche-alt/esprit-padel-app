/**
 * RessourcesV2 — Bibliothèque numérique Esprit Padel OS V2.
 *
 * P2 scope :
 *   - Lecture ep:ressources (appdata, pattern V1)
 *   - Création / modification / publication / archivage de liens et liens Canva
 *   - Onglet Stocks : placeholder "bientôt disponible" — aucune écriture, aucune collection stock
 *   - Admin : currentUser?.admin === true
 *   - Non-admin : uniquement published === true && archived === false
 *   - Aucun upload Storage
 *   - Aucune modification de ep:campagnes, ep:templates, Google Drive
 */
import React, { useState, useMemo, useCallback } from "react";
import {
  useRessources, useCampagnes, useCalendarEvents, useClubs,
} from "../hooks/useV1Data";
import {
  createRessource, updateRessource,
  toggleRessourcePublished, archiveRessource,
} from "../hooks/useV1Write";
import {
  IconFolder, IconSearch, IconPlus, IconX, IconExternalLink,
  IconChevronRight, IconSettings, IconLayers,
} from "../icons";

/* ─────────────────────────────────────
   HELPERS
───────────────────────────────────── */
function uid() {
  return String(Date.now()) + String(Math.random()).slice(2, 8);
}
function fmtDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateShort(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function strSearch(val) {
  return (val || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/* ─────────────────────────────────────
   TYPE / CATÉGORIE META
───────────────────────────────────── */
const TYPE_META = {
  link:     { label: "Lien",        color: "#0F56B8", bg: "#EFF6FF", icon: "↗" },
  canva:    { label: "Canva",       color: "#7C3AED", bg: "#F5F3FF", icon: "✦" },
  pdf:      { label: "PDF",         color: "#bf3327", bg: "#fdf0ee", icon: "⬛" },
  image:    { label: "Image",       color: "#1a7a38", bg: "#eaf7ee", icon: "◼" },
  video:    { label: "Vidéo",       color: "#c17d00", bg: "#fef8e4", icon: "▶" },
  template: { label: "Template",    color: "#0e7a74", bg: "#e0f2f1", icon: "⊞" },
  autre:    { label: "Autre",       color: "#58565e", bg: "#f0eeea", icon: "·" },
};
const CAT_META = {
  visuel:          { label: "Visuels & médias" },
  brief:           { label: "Briefs & plans" },
  planning:        { label: "Plannings" },
  bilan:           { label: "Bilans" },
  template:        { label: "Templates" },
  autre:           { label: "Divers" },
};
function typeMeta(t) { return TYPE_META[t] || TYPE_META.autre; }
function catLabel(c) { return CAT_META[c]?.label || c || "Divers"; }

const ALL_TYPES = [
  { value: "", label: "Tous les types" },
  { value: "link",     label: "Liens" },
  { value: "canva",    label: "Canva" },
  { value: "pdf",      label: "PDF" },
  { value: "image",    label: "Images" },
  { value: "video",    label: "Vidéos" },
  { value: "template", label: "Templates" },
  { value: "autre",    label: "Autres" },
];
const ALL_CATS = [
  { value: "", label: "Toutes catégories" },
  { value: "visuel",   label: "Visuels & médias" },
  { value: "brief",    label: "Briefs & plans" },
  { value: "planning", label: "Plannings" },
  { value: "bilan",    label: "Bilans" },
  { value: "template", label: "Templates" },
  { value: "autre",    label: "Divers" },
];

/* ─────────────────────────────────────
   CATEGORY BUCKETS (sidebar gauche)
───────────────────────────────────── */
const BUCKETS = [
  { id: "all",      label: "Tout",             cats: null },
  { id: "media",    label: "Fichiers & médias", cats: ["visuel", "image", "video"], types: ["image", "video", "pdf"] },
  { id: "canva",    label: "Canva & liens",     types: ["canva", "link"] },
  { id: "internal", label: "Documents internes",cats: ["brief", "planning", "bilan"] },
  { id: "archive",  label: "Archives",          archive: true },
];

/* ─────────────────────────────────────
   ICON SVG INLINE — types supplémentaires
───────────────────────────────────── */
function IconLink({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}
function IconImage({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21,15 16,10 5,21" />
    </svg>
  );
}
function IconFile({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
    </svg>
  );
}
function IconArchive({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21,8 21,21 3,21 3,8" />
      <rect x="1" y="3" width="22" height="5" rx="1" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}
function IconCanva({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="#7C3AED" opacity=".15" stroke="#7C3AED" />
      <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="700" fill="#7C3AED" stroke="none">C</text>
    </svg>
  );
}
function typeIcon(type, size = 14) {
  if (type === "canva")    return <IconCanva size={size} />;
  if (type === "link")     return <IconLink size={size} />;
  if (type === "image")    return <IconImage size={size} />;
  if (type === "pdf")      return <IconFile size={size} />;
  if (type === "video")    return <IconFile size={size} />;
  if (type === "template") return <IconLayers size={size} />;
  return <IconFile size={size} />;
}

/* ─────────────────────────────────────
   STOCKS PLACEHOLDER
───────────────────────────────────── */
function StocksPlaceholder() {
  return (
    <div className="rsrc-stocks-placeholder">
      <div className="rsrc-stocks-placeholder__inner">
        <div className="rsrc-stocks-placeholder__icon">
          <IconLayers size={36} />
        </div>
        <div className="rsrc-stocks-placeholder__title">Stocks physiques</div>
        <div className="rsrc-stocks-placeholder__sub">
          La gestion des stocks physiques liés aux campagnes et événements sera disponible dans une prochaine passe.
        </div>
        <div className="rsrc-stocks-placeholder__badge">En cours de développement — P3</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────
   EMPTY STATE
───────────────────────────────────── */
function EmptyState({ isAdmin, onAdd, filtered }) {
  return (
    <div className="rsrc-empty">
      <div className="rsrc-empty__icon"><IconFolder size={40} /></div>
      <div className="rsrc-empty__title">
        {filtered ? "Aucune ressource ne correspond aux filtres" : "La bibliothèque est vide"}
      </div>
      <div className="rsrc-empty__sub">
        {filtered
          ? "Modifiez les filtres ou la recherche pour afficher des résultats."
          : isAdmin
          ? "Ajoutez vos premiers liens, documents Canva et ressources internes."
          : "Les ressources publiées par l'équipe apparaîtront ici."}
      </div>
      {isAdmin && !filtered && (
        <button className="rsrc-btn rsrc-btn--primary rsrc-empty__cta" onClick={onAdd}>
          <IconPlus size={14} /> Ajouter une ressource
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────
   RESOURCE CARD
───────────────────────────────────── */
function RessourceCard({ r, campagnes, clubs, isAdmin, onClick }) {
  const tm = typeMeta(r.type);
  const campNames = useMemo(() =>
    (r.campagneIds || [])
      .map(id => campagnes.find(c => String(c.id) === String(id))?.name)
      .filter(Boolean)
  , [r.campagneIds, campagnes]);

  const clubNames = useMemo(() =>
    (r.clubs || []).length === 0
      ? []
      : (r.clubs || []).map(id => clubs.find(c => String(c.id) === String(id))?.name).filter(Boolean)
  , [r.clubs, clubs]);

  return (
    <div
      className={`rsrc-card${r.archived ? " rsrc-card--archived" : ""}${!r.published ? " rsrc-card--draft" : ""}`}
      onClick={() => onClick(r)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onClick(r)}
    >
      <div className="rsrc-card__top">
        <div className="rsrc-card__type-icon" style={{ color: tm.color, background: tm.bg }}>
          {typeIcon(r.type, 16)}
        </div>
        <div className="rsrc-card__badges">
          {r.archived && <span className="rsrc-badge rsrc-badge--archive">Archivée</span>}
          {!r.published && !r.archived && isAdmin && <span className="rsrc-badge rsrc-badge--draft">Brouillon</span>}
          <span className="rsrc-badge" style={{ color: tm.color, background: tm.bg }}>{tm.label}</span>
        </div>
      </div>
      <div className="rsrc-card__name">{r.name || "Sans titre"}</div>
      {r.description && <div className="rsrc-card__desc">{r.description}</div>}
      <div className="rsrc-card__meta">
        {r.category && <span className="rsrc-card__meta-item">{catLabel(r.category)}</span>}
        {r.season    && <span className="rsrc-card__meta-item">{r.season}</span>}
        {r.documentDate && <span className="rsrc-card__meta-item">{fmtDateShort(r.documentDate)}</span>}
      </div>
      {campNames.length > 0 && (
        <div className="rsrc-card__camps">
          {campNames.slice(0, 2).map((n, i) => (
            <span key={i} className="rsrc-card__camp-tag">{n}</span>
          ))}
          {campNames.length > 2 && <span className="rsrc-card__camp-tag">+{campNames.length - 2}</span>}
        </div>
      )}
      {clubNames.length > 0 && (
        <div className="rsrc-card__clubs">
          {clubNames.slice(0, 3).map((n, i) => <span key={i} className="rsrc-card__club-dot">{n}</span>)}
          {clubNames.length > 3 && <span className="rsrc-card__club-dot">+{clubNames.length - 3}</span>}
        </div>
      )}
      {(r.tags || []).length > 0 && (
        <div className="rsrc-card__tags">
          {r.tags.slice(0, 3).map((t, i) => <span key={i} className="rsrc-card__tag">#{t}</span>)}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────
   RESOURCE DETAIL PANEL (fiche)
───────────────────────────────────── */
function RessourceDetail({ r, campagnes, events, clubs, isAdmin, appId, ressources, onClose, onUpdated }) {
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);
  const [msg, setMsg]       = useState(null);

  const tm = typeMeta(r.type);
  const campNames = (r.campagneIds || [])
    .map(id => ({ id, name: campagnes.find(c => String(c.id) === String(id))?.name }))
    .filter(x => x.name);
  const eventNames = (r.eventIds || [])
    .map(id => ({ id, name: events.find(e => String(e.id) === String(id))?.name || events.find(e => String(e.id) === String(id))?.title }))
    .filter(x => x.name);
  const clubNames = (r.clubs || []).length === 0
    ? [{ id: "_all", name: "Tous les clubs" }]
    : (r.clubs || []).map(id => ({ id, name: clubs.find(c => String(c.id) === String(id))?.name || id }));

  const effectiveUrl = r.externalUrl || r.url;

  async function handleTogglePublish() {
    if (!isAdmin) return;
    if (!r.published && saving) return;
    if (r.published && !window.confirm("Repasser cette ressource en brouillon ?")) return;
    setSaving(true); setErr(null); setMsg(null);
    try {
      await toggleRessourcePublished(ressources, r.id, appId);
      setMsg(r.published ? "Repassée en brouillon." : "Ressource publiée.");
      onUpdated();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleArchive() {
    if (!isAdmin) return;
    const action = r.archived ? "Désarchiver" : "Archiver";
    if (!window.confirm(`${action} cette ressource ?`)) return;
    setSaving(true); setErr(null); setMsg(null);
    try {
      await archiveRessource(ressources, r.id, !r.archived, appId);
      setMsg(r.archived ? "Ressource désarchivée." : "Ressource archivée.");
      onUpdated();
      if (!r.archived) onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="rsrc-detail">
      <div className="rsrc-detail__header">
        <div className="rsrc-detail__hd-left">
          <div className="rsrc-detail__type-icon" style={{ color: tm.color, background: tm.bg }}>
            {typeIcon(r.type, 20)}
          </div>
          <div>
            <div className="rsrc-detail__name">{r.name || "Sans titre"}</div>
            <div className="rsrc-detail__hd-meta">
              <span style={{ color: tm.color }}>{tm.label}</span>
              {r.category && <span>· {catLabel(r.category)}</span>}
              {r.season    && <span>· {r.season}</span>}
              {!r.published && <span className="rsrc-badge rsrc-badge--draft" style={{ marginLeft: 4 }}>Brouillon</span>}
              {r.archived  && <span className="rsrc-badge rsrc-badge--archive" style={{ marginLeft: 4 }}>Archivée</span>}
            </div>
          </div>
        </div>
        <div className="rsrc-detail__hd-actions">
          {isAdmin && !r.archived && (
            <>
              <button
                className={`camp-btn ${r.published ? "camp-btn--ghost" : "camp-btn--publish"}`}
                onClick={handleTogglePublish}
                disabled={saving}
              >
                {r.published ? "Brouillon" : "Publier"}
              </button>
            </>
          )}
          <button className="camp-btn camp-btn--ghost rsrc-detail__close" onClick={onClose} aria-label="Fermer">
            <IconX size={16} />
          </button>
        </div>
      </div>

      {err && <div className="rsrc-detail__msg rsrc-detail__msg--err">{err}</div>}
      {msg && <div className="rsrc-detail__msg rsrc-detail__msg--ok">{msg}</div>}

      <div className="rsrc-detail__body">
        {r.description && (
          <div className="rsrc-detail__section">
            <div className="rsrc-detail__section-title">Description</div>
            <p className="rsrc-detail__desc-text">{r.description}</p>
          </div>
        )}

        {effectiveUrl && (
          <div className="rsrc-detail__section">
            <div className="rsrc-detail__section-title">Lien</div>
            <a
              href={effectiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rsrc-detail__url-btn"
            >
              <IconExternalLink size={14} />
              Ouvrir la ressource
            </a>
            <div className="rsrc-detail__url-text">{effectiveUrl}</div>
          </div>
        )}

        <div className="rsrc-detail__section rsrc-detail__section--meta">
          <div className="rsrc-detail__section-title">Métadonnées</div>
          <div className="rsrc-detail__meta-grid">
            {r.documentDate && <><span>Date document</span><span>{fmtDate(r.documentDate)}</span></>}
            {r.season        && <><span>Saison</span><span>{r.season}</span></>}
            {r.createdAt     && <><span>Ajoutée le</span><span>{fmtDate(r.createdAt)}</span></>}
            {r.updatedAt     && <><span>Modifiée le</span><span>{fmtDate(r.updatedAt)}</span></>}
          </div>
        </div>

        {campNames.length > 0 && (
          <div className="rsrc-detail__section">
            <div className="rsrc-detail__section-title">Campagnes liées</div>
            <div className="rsrc-detail__tags-list">
              {campNames.map(({ id, name }) => (
                <span key={id} className="rsrc-card__camp-tag">{name}</span>
              ))}
            </div>
          </div>
        )}

        {eventNames.length > 0 && (
          <div className="rsrc-detail__section">
            <div className="rsrc-detail__section-title">Événements liés</div>
            <div className="rsrc-detail__tags-list">
              {eventNames.map(({ id, name }) => (
                <span key={id} className="rsrc-card__camp-tag">{name}</span>
              ))}
            </div>
          </div>
        )}

        <div className="rsrc-detail__section">
          <div className="rsrc-detail__section-title">Clubs</div>
          <div className="rsrc-detail__tags-list">
            {clubNames.map(({ id, name }) => (
              <span key={id} className="rsrc-card__club-dot rsrc-card__club-dot--lg">{name}</span>
            ))}
          </div>
        </div>

        {(r.tags || []).length > 0 && (
          <div className="rsrc-detail__section">
            <div className="rsrc-detail__section-title">Tags</div>
            <div className="rsrc-detail__tags-list">
              {r.tags.map((t, i) => <span key={i} className="rsrc-card__tag">#{t}</span>)}
            </div>
          </div>
        )}

        {isAdmin && (r.history || []).length > 0 && (
          <div className="rsrc-detail__section">
            <div className="rsrc-detail__section-title">Historique</div>
            <div className="rsrc-detail__history">
              {(r.history || []).map((h, i) => (
                <div key={i} className="rsrc-detail__history-row">
                  <span className="rsrc-detail__history-action">{h.action}</span>
                  <span className="rsrc-detail__history-date">{fmtDate(h.at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="rsrc-detail__section rsrc-detail__section--danger">
            <button
              className="camp-btn camp-btn--ghost rsrc-detail__archive-btn"
              onClick={handleArchive}
              disabled={saving}
            >
              <IconArchive size={14} />
              {r.archived ? "Désarchiver" : "Archiver la ressource"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────
   CREATION PANEL
───────────────────────────────────── */

const EMPTY_FORM = {
  name: "", type: "link", externalUrl: "", category: "visuel",
  description: "", documentDate: "", season: "",
  tags: "", clubs: [], campagneIds: [], eventIds: [],
  published: false,
};

function CreationPanel({ campagnes, events, clubs, appId, ressources, onClose, onCreated }) {
  const [form, setForm]   = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState(null);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function toggleArr(k, id) {
    setForm(f => {
      const arr = f[k] || [];
      return { ...f, [k]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] };
    });
  }

  function parseTags(str) {
    return str.split(/[,\s]+/).map(t => t.replace(/^#/, "").trim()).filter(Boolean);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setErr("Le nom est obligatoire."); return; }
    if (!form.externalUrl.trim()) { setErr("L'URL est obligatoire."); return; }
    setErr(null);
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        externalUrl: form.externalUrl.trim(),
        url: form.externalUrl.trim(),
        category: form.category || "autre",
        description: form.description.trim(),
        documentDate: form.documentDate || null,
        season: form.season.trim() || null,
        tags: parseTags(form.tags),
        clubs: form.clubs,
        campagneIds: form.campagneIds,
        eventIds: form.eventIds,
        published: form.published,
      };
      await createRessource(ressources, payload, appId);
      onCreated();
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const seasons = useMemo(() => {
    const cur = new Date().getFullYear();
    return [cur, cur - 1, cur + 1].map(y => String(y));
  }, []);

  return (
    <>
      <div className="camp-panel-overlay" onClick={onClose} />
      <div className="camp-panel rsrc-creation-panel">
        <div className="camp-panel__header">
          <span className="camp-panel__title">Nouvelle ressource</span>
          <button className="camp-panel__close" onClick={onClose} aria-label="Fermer"><IconX size={16} /></button>
        </div>
        <form className="camp-panel__body rsrc-form" onSubmit={handleSubmit}>

          <div className="rsrc-form-section-title">Type</div>
          <div className="rsrc-type-grid">
            {[{ v: "link", l: "Lien externe" }, { v: "canva", l: "Canva" }].map(({ v, l }) => (
              <button
                key={v} type="button"
                className={`rsrc-type-btn${form.type === v ? " active" : ""}`}
                onClick={() => set("type", v)}
              >
                <span className="rsrc-type-btn__icon" style={{ color: typeMeta(v).color, background: typeMeta(v).bg }}>
                  {typeIcon(v, 16)}
                </span>
                {l}
              </button>
            ))}
          </div>

          <div className="camp-form-group">
            <label className="camp-form-label">Nom <span className="rsrc-required">*</span></label>
            <input
              className="camp-form-input"
              value={form.name}
              onChange={e => set("name", e.target.value)}
              placeholder="Ex : Flyer Octobre Rose 2026"
              maxLength={120}
              autoFocus
            />
          </div>

          <div className="camp-form-group">
            <label className="camp-form-label">URL <span className="rsrc-required">*</span></label>
            <input
              className="camp-form-input"
              value={form.externalUrl}
              onChange={e => set("externalUrl", e.target.value)}
              placeholder="https://"
              type="url"
            />
          </div>

          <div className="camp-form-row">
            <div className="camp-form-group">
              <label className="camp-form-label">Catégorie</label>
              <select className="camp-form-input" value={form.category} onChange={e => set("category", e.target.value)}>
                {ALL_CATS.slice(1).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="camp-form-group">
              <label className="camp-form-label">Saison / Année</label>
              <select className="camp-form-input" value={form.season} onChange={e => set("season", e.target.value)}>
                <option value="">—</option>
                {seasons.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="camp-form-group">
            <label className="camp-form-label">Date du document</label>
            <input className="camp-form-input" type="date" value={form.documentDate} onChange={e => set("documentDate", e.target.value)} />
          </div>

          <div className="camp-form-group">
            <label className="camp-form-label">Description</label>
            <textarea
              className="camp-form-textarea"
              value={form.description}
              onChange={e => set("description", e.target.value)}
              rows={2}
              placeholder="Contexte, usage, remarques…"
            />
          </div>

          <div className="camp-form-group">
            <label className="camp-form-label">Tags <span className="camp-form-hint">(séparés par virgule ou espace)</span></label>
            <input
              className="camp-form-input"
              value={form.tags}
              onChange={e => set("tags", e.target.value)}
              placeholder="Ex : octobre-rose, imprimé, A5"
            />
          </div>

          {campagnes.length > 0 && (
            <div className="camp-form-group">
              <label className="camp-form-label">Campagnes liées</label>
              <div className="rsrc-multi-select">
                {campagnes.filter(c => c.name).map(c => (
                  <button
                    key={c.id} type="button"
                    className={`rsrc-multi-btn${form.campagneIds.includes(String(c.id)) ? " active" : ""}`}
                    onClick={() => toggleArr("campagneIds", String(c.id))}
                  >{c.name}</button>
                ))}
              </div>
            </div>
          )}

          {events.length > 0 && (
            <div className="camp-form-group">
              <label className="camp-form-label">Événements liés</label>
              <div className="rsrc-multi-select">
                {events.filter(e => e.name || e.title).map(e => (
                  <button
                    key={e.id} type="button"
                    className={`rsrc-multi-btn${form.eventIds.includes(String(e.id)) ? " active" : ""}`}
                    onClick={() => toggleArr("eventIds", String(e.id))}
                  >{e.name || e.title}</button>
                ))}
              </div>
            </div>
          )}

          {clubs.length > 0 && (
            <div className="camp-form-group">
              <label className="camp-form-label">Clubs <span className="camp-form-hint">(vide = tous)</span></label>
              <div className="rsrc-multi-select">
                {clubs.filter(c => c.name).map(c => (
                  <button
                    key={c.id} type="button"
                    className={`rsrc-multi-btn${form.clubs.includes(String(c.id)) ? " active" : ""}`}
                    onClick={() => toggleArr("clubs", String(c.id))}
                  >{c.name}</button>
                ))}
              </div>
            </div>
          )}

          <div className="rsrc-form-publish-row">
            <label className="rsrc-toggle-label">
              <input
                type="checkbox"
                checked={form.published}
                onChange={e => set("published", e.target.checked)}
              />
              Publier immédiatement
            </label>
          </div>

          {err && <div className="camp-form-error">{err}</div>}

          <div className="camp-panel__footer">
            <button type="button" className="camp-btn camp-btn--ghost" onClick={onClose} disabled={saving}>Annuler</button>
            <button type="submit" className="camp-btn camp-btn--primary" disabled={saving}>
              {saving ? <span className="v2-spinner camp-btn camp-spinner" /> : "Créer la ressource"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

/* ─────────────────────────────────────
   EDIT PANEL
───────────────────────────────────── */
function EditPanel({ r, campagnes, events, clubs, appId, ressources, onClose, onUpdated }) {
  const [form, setForm]   = useState({
    name:         r.name        || "",
    type:         r.type        || "link",
    externalUrl:  r.externalUrl || r.url || "",
    category:     r.category    || "autre",
    description:  r.description || "",
    documentDate: r.documentDate || "",
    season:       r.season      || "",
    tags:         (r.tags || []).join(", "),
    clubs:        r.clubs       || [],
    campagneIds:  r.campagneIds || [],
    eventIds:     r.eventIds    || [],
    published:    r.published   || false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function toggleArr(k, id) {
    setForm(f => {
      const arr = f[k] || [];
      return { ...f, [k]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] };
    });
  }
  function parseTags(str) {
    return str.split(/[,\s]+/).map(t => t.replace(/^#/, "").trim()).filter(Boolean);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setErr("Le nom est obligatoire."); return; }
    setErr(null); setSaving(true);
    try {
      await updateRessource(ressources, r.id, {
        name: form.name.trim(),
        type: form.type,
        externalUrl: form.externalUrl.trim() || null,
        url: form.externalUrl.trim() || null,
        category: form.category,
        description: form.description.trim(),
        documentDate: form.documentDate || null,
        season: form.season.trim() || null,
        tags: parseTags(form.tags),
        clubs: form.clubs,
        campagneIds: form.campagneIds,
        eventIds: form.eventIds,
        published: form.published,
      }, appId);
      onUpdated();
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const seasons = useMemo(() => {
    const cur = new Date().getFullYear();
    return [cur, cur - 1, cur + 1].map(y => String(y));
  }, []);

  return (
    <>
      <div className="camp-panel-overlay" onClick={onClose} />
      <div className="camp-panel rsrc-creation-panel">
        <div className="camp-panel__header">
          <span className="camp-panel__title">Modifier la ressource</span>
          <button className="camp-panel__close" onClick={onClose} aria-label="Fermer"><IconX size={16} /></button>
        </div>
        <form className="camp-panel__body rsrc-form" onSubmit={handleSubmit}>
          <div className="camp-form-group">
            <label className="camp-form-label">Nom <span className="rsrc-required">*</span></label>
            <input className="camp-form-input" value={form.name} onChange={e => set("name", e.target.value)} maxLength={120} />
          </div>
          <div className="rsrc-type-grid">
            {[{ v: "link", l: "Lien externe" }, { v: "canva", l: "Canva" }].map(({ v, l }) => (
              <button key={v} type="button" className={`rsrc-type-btn${form.type === v ? " active" : ""}`} onClick={() => set("type", v)}>
                <span className="rsrc-type-btn__icon" style={{ color: typeMeta(v).color, background: typeMeta(v).bg }}>{typeIcon(v, 14)}</span>{l}
              </button>
            ))}
          </div>
          <div className="camp-form-group">
            <label className="camp-form-label">URL</label>
            <input className="camp-form-input" value={form.externalUrl} onChange={e => set("externalUrl", e.target.value)} type="url" placeholder="https://" />
          </div>
          <div className="camp-form-row">
            <div className="camp-form-group">
              <label className="camp-form-label">Catégorie</label>
              <select className="camp-form-input" value={form.category} onChange={e => set("category", e.target.value)}>
                {ALL_CATS.slice(1).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="camp-form-group">
              <label className="camp-form-label">Saison</label>
              <select className="camp-form-input" value={form.season} onChange={e => set("season", e.target.value)}>
                <option value="">—</option>
                {seasons.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="camp-form-group">
            <label className="camp-form-label">Date du document</label>
            <input className="camp-form-input" type="date" value={form.documentDate} onChange={e => set("documentDate", e.target.value)} />
          </div>
          <div className="camp-form-group">
            <label className="camp-form-label">Description</label>
            <textarea className="camp-form-textarea" value={form.description} onChange={e => set("description", e.target.value)} rows={2} />
          </div>
          <div className="camp-form-group">
            <label className="camp-form-label">Tags</label>
            <input className="camp-form-input" value={form.tags} onChange={e => set("tags", e.target.value)} placeholder="Ex : octobre-rose, A5" />
          </div>
          {campagnes.length > 0 && (
            <div className="camp-form-group">
              <label className="camp-form-label">Campagnes liées</label>
              <div className="rsrc-multi-select">
                {campagnes.filter(c => c.name).map(c => (
                  <button key={c.id} type="button"
                    className={`rsrc-multi-btn${form.campagneIds.includes(String(c.id)) ? " active" : ""}`}
                    onClick={() => toggleArr("campagneIds", String(c.id))}
                  >{c.name}</button>
                ))}
              </div>
            </div>
          )}
          {events.length > 0 && (
            <div className="camp-form-group">
              <label className="camp-form-label">Événements liés</label>
              <div className="rsrc-multi-select">
                {events.filter(e => e.name || e.title).map(e => (
                  <button key={e.id} type="button"
                    className={`rsrc-multi-btn${form.eventIds.includes(String(e.id)) ? " active" : ""}`}
                    onClick={() => toggleArr("eventIds", String(e.id))}
                  >{e.name || e.title}</button>
                ))}
              </div>
            </div>
          )}
          {clubs.length > 0 && (
            <div className="camp-form-group">
              <label className="camp-form-label">Clubs <span className="camp-form-hint">(vide = tous)</span></label>
              <div className="rsrc-multi-select">
                {clubs.filter(c => c.name).map(c => (
                  <button key={c.id} type="button"
                    className={`rsrc-multi-btn${form.clubs.includes(String(c.id)) ? " active" : ""}`}
                    onClick={() => toggleArr("clubs", String(c.id))}
                  >{c.name}</button>
                ))}
              </div>
            </div>
          )}
          <div className="rsrc-form-publish-row">
            <label className="rsrc-toggle-label">
              <input type="checkbox" checked={form.published} onChange={e => set("published", e.target.checked)} />
              Publiée
            </label>
          </div>
          {err && <div className="camp-form-error">{err}</div>}
          <div className="camp-panel__footer">
            <button type="button" className="camp-btn camp-btn--ghost" onClick={onClose} disabled={saving}>Annuler</button>
            <button type="submit" className="camp-btn camp-btn--primary" disabled={saving}>
              {saving ? <span className="v2-spinner camp-btn camp-spinner" /> : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

/* ─────────────────────────────────────
   MAIN PAGE
───────────────────────────────────── */
export default function RessourcesV2({ currentUser, appId }) {
  const isAdmin = currentUser?.admin === true;

  const { ressources: allRessources, loading } = useRessources();
  const { campagnes }   = useCampagnes();
  const { events }      = useCalendarEvents();
  const { clubs }       = useClubs();

  // UI state
  const [tab,         setTab]         = useState("bibliotheque");
  const [activeBucket,setActiveBucket]= useState("all");
  const [search,      setSearch]      = useState("");
  const [filterType,  setFilterType]  = useState("");
  const [filterCat,   setFilterCat]   = useState("");
  const [filterCamp,  setFilterCamp]  = useState("");
  const [filterClub,  setFilterClub]  = useState("");
  const [filterSeason,setFilterSeason]= useState("");

  const [selectedId,  setSelectedId]  = useState(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [showEdit,    setShowEdit]    = useState(false);
  const [refreshKey,  setRefreshKey]  = useState(0);

  function handleUpdated() { setRefreshKey(k => k + 1); }

  // Permissions filter
  const visibleRessources = useMemo(() => {
    if (isAdmin) return allRessources;
    return allRessources.filter(r => r.published && !r.archived);
  }, [allRessources, isAdmin]);

  // Bucket filter
  const bucketFiltered = useMemo(() => {
    const b = BUCKETS.find(b => b.id === activeBucket);
    if (!b || b.id === "all") return visibleRessources.filter(r => !r.archived);
    if (b.archive) return visibleRessources.filter(r => r.archived);
    return visibleRessources.filter(r => {
      if (r.archived) return false;
      if (b.types && b.types.includes(r.type)) return true;
      if (b.cats  && b.cats.includes(r.category)) return true;
      return false;
    });
  }, [visibleRessources, activeBucket]);

  // Active filters
  const filtered = useMemo(() => {
    let list = bucketFiltered;
    const q = strSearch(search);
    if (q) {
      list = list.filter(r =>
        strSearch(r.name).includes(q) ||
        strSearch(r.description).includes(q) ||
        (r.tags || []).some(t => strSearch(t).includes(q))
      );
    }
    if (filterType)   list = list.filter(r => r.type === filterType);
    if (filterCat)    list = list.filter(r => r.category === filterCat);
    if (filterCamp)   list = list.filter(r => (r.campagneIds || []).includes(filterCamp));
    if (filterClub)   list = list.filter(r => (r.clubs || []).length === 0 || (r.clubs || []).includes(filterClub));
    if (filterSeason) list = list.filter(r => r.season === filterSeason);
    return list;
  }, [bucketFiltered, search, filterType, filterCat, filterCamp, filterClub, filterSeason]);

  // Season options from data
  const seasons = useMemo(() => {
    const s = new Set(allRessources.map(r => r.season).filter(Boolean));
    return Array.from(s).sort().reverse();
  }, [allRessources]);

  const selectedRessource = useMemo(() =>
    allRessources.find(r => String(r.id) === String(selectedId)) || null
  , [allRessources, selectedId, refreshKey]);

  const hasFilters = search || filterType || filterCat || filterCamp || filterClub || filterSeason;

  function clearFilters() {
    setSearch(""); setFilterType(""); setFilterCat("");
    setFilterCamp(""); setFilterClub(""); setFilterSeason("");
  }

  return (
    <div className="rsrc-page">
      {/* ── Panneau latéral gauche ── */}
      <aside className="rsrc-sidebar">
        <div className="rsrc-sidebar__section">
          <div className="rsrc-sidebar__section-label">Bibliothèque</div>
          {BUCKETS.map(b => (
            <button
              key={b.id}
              className={`rsrc-sidebar__item${activeBucket === b.id && tab === "bibliotheque" ? " active" : ""}`}
              onClick={() => { setTab("bibliotheque"); setActiveBucket(b.id); setSelectedId(null); }}
            >
              {b.id === "all"      && <IconFolder size={14} />}
              {b.id === "media"    && <IconImage size={14} />}
              {b.id === "canva"    && <IconLink size={14} />}
              {b.id === "internal" && <IconFile size={14} />}
              {b.id === "archive"  && <IconArchive size={14} />}
              {b.label}
              <span className="rsrc-sidebar__count">
                {b.id === "all"
                  ? visibleRessources.filter(r => !r.archived).length
                  : b.archive
                  ? visibleRessources.filter(r => r.archived).length
                  : visibleRessources.filter(r => {
                      if (r.archived) return false;
                      if (b.types && b.types.includes(r.type)) return true;
                      if (b.cats  && b.cats.includes(r.category)) return true;
                      return false;
                    }).length
                }
              </span>
            </button>
          ))}
        </div>
        <div className="rsrc-sidebar__section">
          <div className="rsrc-sidebar__section-label">Modules</div>
          <button
            className={`rsrc-sidebar__item${tab === "stocks" ? " active" : ""}`}
            onClick={() => { setTab("stocks"); setSelectedId(null); }}
          >
            <IconLayers size={14} />
            Stocks
            <span className="rsrc-sidebar__badge rsrc-sidebar__badge--soon">Bientôt</span>
          </button>
        </div>
      </aside>

      {/* ── Contenu principal ── */}
      <div className="rsrc-main">
        {tab === "stocks" ? (
          <StocksPlaceholder />
        ) : (
          <>
            {/* Header */}
            <div className="rsrc-header">
              <div className="rsrc-header__left">
                <h1 className="rsrc-header__title">
                  {activeBucket === "all"      && "Bibliothèque"}
                  {activeBucket === "media"    && "Fichiers & médias"}
                  {activeBucket === "canva"    && "Canva & liens"}
                  {activeBucket === "internal" && "Documents internes"}
                  {activeBucket === "archive"  && "Archives"}
                </h1>
                <p className="rsrc-header__sub">
                  {activeBucket === "archive"
                    ? "Ressources archivées — visibles uniquement des administrateurs"
                    : "Médiathèque interne Esprit Padel"}
                </p>
              </div>
              <div className="rsrc-header__right">
                {isAdmin && activeBucket !== "archive" && (
                  <button className="camp-btn camp-btn--primary rsrc-add-btn" onClick={() => setShowCreate(true)}>
                    <IconPlus size={14} /> Ajouter
                  </button>
                )}
              </div>
            </div>

            {/* Filters bar */}
            <div className="rsrc-filters">
              <div className="rsrc-search-wrap">
                <IconSearch size={14} className="rsrc-search-icon" />
                <input
                  className="rsrc-search"
                  placeholder="Rechercher…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select className="rsrc-filter-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
                {ALL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <select className="rsrc-filter-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                {ALL_CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              {campagnes.length > 0 && (
                <select className="rsrc-filter-select" value={filterCamp} onChange={e => setFilterCamp(e.target.value)}>
                  <option value="">Toutes campagnes</option>
                  {campagnes.filter(c => c.name).map(c => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
              )}
              {clubs.length > 0 && (
                <select className="rsrc-filter-select" value={filterClub} onChange={e => setFilterClub(e.target.value)}>
                  <option value="">Tous les clubs</option>
                  {clubs.filter(c => c.name).map(c => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
              )}
              {seasons.length > 0 && (
                <select className="rsrc-filter-select" value={filterSeason} onChange={e => setFilterSeason(e.target.value)}>
                  <option value="">Toutes saisons</option>
                  {seasons.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              {hasFilters && (
                <button className="rsrc-clear-filters" onClick={clearFilters}>
                  <IconX size={12} /> Effacer
                </button>
              )}
            </div>

            {/* Grid / content */}
            {loading ? (
              <div className="rsrc-loading"><div className="v2-spinner" /></div>
            ) : filtered.length === 0 ? (
              <EmptyState isAdmin={isAdmin} onAdd={() => setShowCreate(true)} filtered={!!hasFilters} />
            ) : (
              <div className="rsrc-grid">
                {filtered.map(r => (
                  <RessourceCard
                    key={r.id}
                    r={r}
                    campagnes={campagnes}
                    clubs={clubs}
                    isAdmin={isAdmin}
                    onClick={r2 => { setSelectedId(r2.id); setShowEdit(false); }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Fiche détail ── */}
      {selectedRessource && !showEdit && (
        <div className="rsrc-detail-panel">
          {isAdmin && (
            <button
              className="rsrc-detail-edit-btn camp-btn camp-btn--ghost"
              onClick={() => setShowEdit(true)}
            >
              <IconSettings size={14} /> Modifier
            </button>
          )}
          <RessourceDetail
            r={selectedRessource}
            campagnes={campagnes}
            events={events}
            clubs={clubs}
            isAdmin={isAdmin}
            appId={appId}
            ressources={allRessources}
            onClose={() => setSelectedId(null)}
            onUpdated={handleUpdated}
          />
        </div>
      )}

      {/* ── Panneau modification ── */}
      {showEdit && selectedRessource && isAdmin && (
        <EditPanel
          r={selectedRessource}
          campagnes={campagnes}
          events={events}
          clubs={clubs}
          appId={appId}
          ressources={allRessources}
          onClose={() => setShowEdit(false)}
          onUpdated={() => { handleUpdated(); setShowEdit(false); }}
        />
      )}

      {/* ── Panneau création ── */}
      {showCreate && isAdmin && (
        <CreationPanel
          campagnes={campagnes}
          events={events}
          clubs={clubs}
          appId={appId}
          ressources={allRessources}
          onClose={() => setShowCreate(false)}
          onCreated={handleUpdated}
        />
      )}
    </div>
  );
}
