/**
 * RessourcesV2 — Bibliothèque numérique Esprit Padel OS V2.
 *
 * P2 scope (INCHANGÉ) :
 *   - Lecture ep:ressources (appdata, pattern V1)
 *   - Création / modification / publication / archivage de liens et liens Canva
 *   - Onglet Stocks : placeholder — aucune écriture, aucune collection stock
 *   - Admin : currentUser?.admin === true
 *   - Non-admin : uniquement published === true && archived === false
 *   - Aucun upload Storage
 *
 * Deux modes d'affichage :
 *   cockpit     — page d'accueil : 4 catégories + récents + par campagne + accès rapides
 *   bibliotheque — recherche & classement complet
 */
import React, { useState, useMemo } from "react";
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
  link:     { label: "Lien",     color: "#0F56B8", bg: "#EFF6FF" },
  canva:    { label: "Canva",    color: "#7C3AED", bg: "#F5F3FF" },
  pdf:      { label: "PDF",      color: "#bf3327", bg: "#fdf0ee" },
  image:    { label: "Image",    color: "#1a7a38", bg: "#eaf7ee" },
  video:    { label: "Vidéo",    color: "#c17d00", bg: "#fef8e4" },
  template: { label: "Template", color: "#0e7a74", bg: "#e0f2f1" },
  autre:    { label: "Autre",    color: "#58565e", bg: "#f0eeea" },
};
const CAT_META = {
  visuel:   { label: "Visuels & médias" },
  brief:    { label: "Briefs & plans" },
  planning: { label: "Plannings" },
  bilan:    { label: "Bilans" },
  template: { label: "Templates" },
  autre:    { label: "Divers" },
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
   CATEGORY BUCKETS pour bibliothèque
───────────────────────────────────── */
const BUCKETS = [
  { id: "all",      label: "Tout" },
  { id: "media",    label: "Fichiers & médias", cats: ["visuel"], types: ["image", "video", "pdf"] },
  { id: "canva",    label: "Canva & liens",     types: ["canva", "link"] },
  { id: "internal", label: "Documents internes",cats: ["brief", "planning", "bilan"] },
  { id: "archive",  label: "Archives",          archive: true },
];

/* ─────────────────────────────────────
   ICONS INLINE
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
function IconBox({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27,6.96 12,12.01 20.73,6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}
function IconDoc({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="12" y2="17" />
    </svg>
  );
}
function IconArrowRight({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12,5 19,12 12,19" />
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
   BUCKET COUNT HELPER
───────────────────────────────────── */
function countBucket(ressources, bucketId) {
  if (bucketId === "archive") return ressources.filter(r => r.archived).length;
  const b = BUCKETS.find(x => x.id === bucketId);
  if (!b || b.id === "all") return ressources.filter(r => !r.archived).length;
  return ressources.filter(r => {
    if (r.archived) return false;
    if (b.types && b.types.includes(r.type)) return true;
    if (b.cats  && b.cats.includes(r.category)) return true;
    return false;
  }).length;
}

/* ─────────────────────────────────────
   RESOURCE ROW COMPACT (cockpit)
───────────────────────────────────── */
function RessourceRow({ r, campagnes, onClick }) {
  const tm = typeMeta(r.type);
  const camp = (r.campagneIds || []).length > 0
    ? campagnes.find(c => String(c.id) === String(r.campagneIds[0]))?.name
    : null;
  return (
    <div className="rsrc-row" onClick={() => onClick(r)} role="button" tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onClick(r)}>
      <div className="rsrc-row__icon" style={{ color: tm.color, background: tm.bg }}>
        {typeIcon(r.type, 14)}
      </div>
      <div className="rsrc-row__body">
        <div className="rsrc-row__name">{r.name || "Sans titre"}</div>
        <div className="rsrc-row__meta">
          <span style={{ color: tm.color }}>{tm.label}</span>
          {camp && <><span className="rsrc-row__sep">·</span><span>{camp}</span></>}
          {r.updatedAt && <><span className="rsrc-row__sep">·</span><span>{fmtDateShort(r.updatedAt)}</span></>}
          {!r.published && <span className="rsrc-row__draft">Brouillon</span>}
        </div>
      </div>
      <IconChevronRight size={14} className="rsrc-row__chevron" />
    </div>
  );
}

/* ─────────────────────────────────────
   RESOURCE CARD (bibliothèque)
───────────────────────────────────── */
function RessourceCard({ r, campagnes, clubs, isAdmin, onClick }) {
  const tm = typeMeta(r.type);
  const campNames = useMemo(() =>
    (r.campagneIds || [])
      .map(id => campagnes.find(c => String(c.id) === String(id))?.name)
      .filter(Boolean)
  , [r.campagneIds, campagnes]);
  const clubNames = useMemo(() =>
    (r.clubs || []).map(id => clubs.find(c => String(c.id) === String(id))?.name).filter(Boolean)
  , [r.clubs, clubs]);

  return (
    <div className={`rsrc-card${r.archived ? " rsrc-card--archived" : ""}${!r.published ? " rsrc-card--draft" : ""}`}
      onClick={() => onClick(r)} role="button" tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onClick(r)}>
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
          {campNames.slice(0, 2).map((n, i) => <span key={i} className="rsrc-card__camp-tag">{n}</span>)}
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
   RESOURCE DETAIL PANEL
───────────────────────────────────── */
function RessourceDetail({ r, campagnes, events, clubs, isAdmin, appId, ressources, onClose, onUpdated, onEdit }) {
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
    if (!window.confirm(`${r.archived ? "Désarchiver" : "Archiver"} cette ressource ?`)) return;
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
              {!r.published && <span className="rsrc-badge rsrc-badge--draft" style={{ marginLeft: 4 }}>Brouillon</span>}
              {r.archived  && <span className="rsrc-badge rsrc-badge--archive" style={{ marginLeft: 4 }}>Archivée</span>}
            </div>
          </div>
        </div>
        <div className="rsrc-detail__hd-actions">
          {isAdmin && !r.archived && (
            <button className={`camp-btn ${r.published ? "camp-btn--ghost" : "camp-btn--publish"}`}
              onClick={handleTogglePublish} disabled={saving}>
              {r.published ? "Brouillon" : "Publier"}
            </button>
          )}
          {isAdmin && onEdit && (
            <button className="camp-btn camp-btn--ghost" onClick={onEdit} disabled={saving}>
              <IconSettings size={13} /> Modifier
            </button>
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
            <a href={effectiveUrl} target="_blank" rel="noopener noreferrer" className="rsrc-detail__url-btn">
              <IconExternalLink size={14} /> Ouvrir la ressource
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
              {campNames.map(({ id, name }) => <span key={id} className="rsrc-card__camp-tag">{name}</span>)}
            </div>
          </div>
        )}
        {eventNames.length > 0 && (
          <div className="rsrc-detail__section">
            <div className="rsrc-detail__section-title">Événements liés</div>
            <div className="rsrc-detail__tags-list">
              {eventNames.map(({ id, name }) => <span key={id} className="rsrc-card__camp-tag">{name}</span>)}
            </div>
          </div>
        )}
        <div className="rsrc-detail__section">
          <div className="rsrc-detail__section-title">Clubs</div>
          <div className="rsrc-detail__tags-list">
            {clubNames.map(({ id, name }) => <span key={id} className="rsrc-card__club-dot rsrc-card__club-dot--lg">{name}</span>)}
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
            <button className="camp-btn camp-btn--ghost rsrc-detail__archive-btn"
              onClick={handleArchive} disabled={saving}>
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
   CRÉATION PANEL
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
    setErr(null); setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), type: form.type,
        externalUrl: form.externalUrl.trim(), url: form.externalUrl.trim(),
        category: form.category || "autre", description: form.description.trim(),
        documentDate: form.documentDate || null, season: form.season.trim() || null,
        tags: parseTags(form.tags), clubs: form.clubs,
        campagneIds: form.campagneIds, eventIds: form.eventIds, published: form.published,
      };
      await createRessource(ressources, payload, appId);
      onCreated(); onClose();
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
              <button key={v} type="button" className={`rsrc-type-btn${form.type === v ? " active" : ""}`}
                onClick={() => set("type", v)}>
                <span className="rsrc-type-btn__icon" style={{ color: typeMeta(v).color, background: typeMeta(v).bg }}>
                  {typeIcon(v, 14)}
                </span>{l}
              </button>
            ))}
          </div>
          <div className="camp-form-group">
            <label className="camp-form-label">Nom <span className="rsrc-required">*</span></label>
            <input className="camp-form-input" value={form.name} onChange={e => set("name", e.target.value)}
              placeholder="Ex : Flyer Octobre Rose 2026" maxLength={120} autoFocus />
          </div>
          <div className="camp-form-group">
            <label className="camp-form-label">URL <span className="rsrc-required">*</span></label>
            <input className="camp-form-input" value={form.externalUrl}
              onChange={e => set("externalUrl", e.target.value)} placeholder="https://" type="url" />
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
            <textarea className="camp-form-input camp-form-textarea" value={form.description}
              onChange={e => set("description", e.target.value)} rows={2} placeholder="Contexte, usage…" />
          </div>
          <div className="camp-form-group">
            <label className="camp-form-label">Tags <span className="camp-form-hint">(virgule ou espace)</span></label>
            <input className="camp-form-input" value={form.tags} onChange={e => set("tags", e.target.value)}
              placeholder="octobre-rose, imprimé, A5" />
          </div>
          {campagnes.length > 0 && (
            <div className="camp-form-group">
              <label className="camp-form-label">Campagnes liées</label>
              <div className="rsrc-multi-select">
                {campagnes.filter(c => c.name).map(c => (
                  <button key={c.id} type="button"
                    className={`rsrc-multi-btn${form.campagneIds.includes(String(c.id)) ? " active" : ""}`}
                    onClick={() => toggleArr("campagneIds", String(c.id))}>{c.name}</button>
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
                    onClick={() => toggleArr("eventIds", String(e.id))}>{e.name || e.title}</button>
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
                    onClick={() => toggleArr("clubs", String(c.id))}>{c.name}</button>
                ))}
              </div>
            </div>
          )}
          <div className="rsrc-form-publish-row">
            <label className="rsrc-toggle-label">
              <input type="checkbox" checked={form.published} onChange={e => set("published", e.target.checked)} />
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
   MODIFICATION PANEL
───────────────────────────────────── */
function EditPanel({ r, campagnes, events, clubs, appId, ressources, onClose, onUpdated }) {
  const [form, setForm] = useState({
    name: r.name || "", type: r.type || "link",
    externalUrl: r.externalUrl || r.url || "",
    category: r.category || "autre", description: r.description || "",
    documentDate: r.documentDate || "", season: r.season || "",
    tags: (r.tags || []).join(", "),
    clubs: r.clubs || [], campagneIds: r.campagneIds || [],
    eventIds: r.eventIds || [], published: r.published || false,
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
        name: form.name.trim(), type: form.type,
        externalUrl: form.externalUrl.trim() || null, url: form.externalUrl.trim() || null,
        category: form.category, description: form.description.trim(),
        documentDate: form.documentDate || null, season: form.season.trim() || null,
        tags: parseTags(form.tags), clubs: form.clubs,
        campagneIds: form.campagneIds, eventIds: form.eventIds, published: form.published,
      }, appId);
      onUpdated(); onClose();
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
              <button key={v} type="button" className={`rsrc-type-btn${form.type === v ? " active" : ""}`}
                onClick={() => set("type", v)}>
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
            <textarea className="camp-form-input camp-form-textarea" value={form.description}
              onChange={e => set("description", e.target.value)} rows={2} />
          </div>
          <div className="camp-form-group">
            <label className="camp-form-label">Tags</label>
            <input className="camp-form-input" value={form.tags} onChange={e => set("tags", e.target.value)} placeholder="octobre-rose, A5" />
          </div>
          {campagnes.length > 0 && (
            <div className="camp-form-group">
              <label className="camp-form-label">Campagnes liées</label>
              <div className="rsrc-multi-select">
                {campagnes.filter(c => c.name).map(c => (
                  <button key={c.id} type="button"
                    className={`rsrc-multi-btn${form.campagneIds.includes(String(c.id)) ? " active" : ""}`}
                    onClick={() => toggleArr("campagneIds", String(c.id))}>{c.name}</button>
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
                    onClick={() => toggleArr("eventIds", String(e.id))}>{e.name || e.title}</button>
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
                    onClick={() => toggleArr("clubs", String(c.id))}>{c.name}</button>
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
   VUE COCKPIT
───────────────────────────────────── */
const CATEGORY_CARDS = [
  {
    id: "media",
    title: "Fichiers & médias",
    desc: "Images, PDF, vidéos et supports visuels",
    color: "#0F56B8", bg: "#EFF6FF", border: "#BFDBFE",
    icon: <IconImage size={22} />,
    bucketId: "media",
  },
  {
    id: "canva",
    title: "Canva & liens",
    desc: "Templates et ressources externes",
    color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE",
    icon: <IconCanva size={22} />,
    bucketId: "canva",
  },
  {
    id: "internal",
    title: "Documents internes",
    desc: "Circulaires, Flash, books et docs opérationnels",
    color: "#D97706", bg: "#FFFBEB", border: "#FDE68A",
    icon: <IconDoc size={22} />,
    bucketId: "internal",
  },
  {
    id: "stocks",
    title: "Stocks & matériel",
    desc: "Ressources physiques liées aux campagnes",
    color: "#059669", bg: "#ECFDF5", border: "#A7F3D0",
    icon: <IconBox size={22} />,
    bucketId: "stocks",
    soon: true,
  },
];

function CockpitView({ visibleRessources, allRessources, campagnes, clubs, isAdmin, loading, onShowBibliotheque, onSelectRessource, onAdd }) {
  const recent = useMemo(() =>
    [...visibleRessources]
      .filter(r => !r.archived)
      .sort((a, b) => (b.updatedAt || b.createdAt || "") > (a.updatedAt || a.createdAt || "") ? 1 : -1)
      .slice(0, 6)
  , [visibleRessources]);

  // Campagnes ayant au moins une ressource liée
  const campagnesWithRessources = useMemo(() => {
    return campagnes
      .filter(c => c.name)
      .map(camp => ({
        camp,
        ressources: visibleRessources.filter(r =>
          !r.archived && (r.campagneIds || []).includes(String(camp.id))
        ),
      }))
      .filter(x => x.ressources.length > 0)
      .slice(0, 5);
  }, [campagnes, visibleRessources]);

  function countCat(bucketId) {
    return countBucket(visibleRessources, bucketId);
  }

  return (
    <div className="rsrc-cockpit">
      {/* ── 4 cartes catégories ── */}
      <div className="rsrc-cat-grid">
        {CATEGORY_CARDS.map(cat => (
          <button
            key={cat.id}
            className={`rsrc-cat-card${cat.soon ? " rsrc-cat-card--soon" : ""}`}
            style={{ "--cat-color": cat.color, "--cat-bg": cat.bg, "--cat-border": cat.border }}
            onClick={() => cat.soon ? null : onShowBibliotheque(cat.bucketId)}
            disabled={cat.soon}
          >
            <div className="rsrc-cat-card__icon">{cat.icon}</div>
            <div className="rsrc-cat-card__body">
              <div className="rsrc-cat-card__title">{cat.title}</div>
              <div className="rsrc-cat-card__desc">{cat.desc}</div>
            </div>
            <div className="rsrc-cat-card__footer">
              {cat.soon ? (
                <span className="rsrc-cat-card__soon-badge">Disponible en P3</span>
              ) : (
                <>
                  <span className="rsrc-cat-card__count">{countCat(cat.bucketId)}</span>
                  <span className="rsrc-cat-card__cta">Voir <IconArrowRight size={11} /></span>
                </>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* ── Deux colonnes ── */}
      <div className="rsrc-cockpit-cols">
        {/* Colonne principale */}
        <div className="rsrc-cockpit-main">
          {/* Ressources récentes */}
          <div className="rsrc-cockpit-block">
            <div className="rsrc-cockpit-block__header">
              <span className="rsrc-cockpit-block__title">Ressources récentes</span>
              <button className="rsrc-cockpit-block__link" onClick={() => onShowBibliotheque("all")}>
                Voir tout <IconArrowRight size={11} />
              </button>
            </div>
            {loading ? (
              <div className="rsrc-cockpit-block__loading"><div className="v2-spinner" /></div>
            ) : recent.length === 0 ? (
              <div className="rsrc-cockpit-empty">
                <IconFolder size={20} />
                <span>Aucune ressource publiée pour l'instant.{isAdmin && " Ajoutez votre première ressource."}</span>
                {isAdmin && (
                  <button className="camp-btn camp-btn--outline rsrc-cockpit-empty__btn" onClick={onAdd}>
                    <IconPlus size={13} /> Ajouter
                  </button>
                )}
              </div>
            ) : (
              <div className="rsrc-rows">
                {recent.map(r => (
                  <RessourceRow key={r.id} r={r} campagnes={campagnes} onClick={onSelectRessource} />
                ))}
              </div>
            )}
          </div>

          {/* Ressources par campagne */}
          <div className="rsrc-cockpit-block">
            <div className="rsrc-cockpit-block__header">
              <span className="rsrc-cockpit-block__title">Ressources par campagne</span>
            </div>
            {campagnesWithRessources.length === 0 ? (
              <div className="rsrc-cockpit-empty">
                <IconFolder size={20} />
                <span>Aucune campagne n'a encore de ressources liées.</span>
              </div>
            ) : (
              <div className="rsrc-camp-list">
                {campagnesWithRessources.map(({ camp, ressources: res }) => (
                  <div key={camp.id} className="rsrc-camp-item">
                    <div className="rsrc-camp-item__header">
                      <span className="rsrc-camp-item__name">{camp.name}</span>
                      <span className="rsrc-camp-item__count">{res.length}</span>
                    </div>
                    <div className="rsrc-camp-item__types">
                      {Array.from(new Set(res.map(r => r.type))).map(t => {
                        const tm = typeMeta(t);
                        return (
                          <span key={t} className="rsrc-camp-item__type-dot"
                            style={{ color: tm.color, background: tm.bg }}>
                            {tm.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Colonne latérale */}
        <div className="rsrc-cockpit-side">
          {/* Accès rapides */}
          <div className="rsrc-cockpit-block rsrc-cockpit-block--side">
            <div className="rsrc-cockpit-block__header">
              <span className="rsrc-cockpit-block__title">Accès rapides</span>
            </div>
            <div className="rsrc-quick-links">
              {[
                { id: "canva",    label: "Canva & liens",      icon: <IconCanva size={14} />,   color: "#7C3AED", bg: "#F5F3FF" },
                { id: "archive",  label: "Archives",            icon: <IconArchive size={14} />, color: "#6B7280", bg: "#F3F4F6" },
                { id: "internal", label: "Documents internes",  icon: <IconDoc size={14} />,     color: "#D97706", bg: "#FFFBEB" },
              ].map(({ id, label, icon, color, bg }) => (
                <button key={id} className="rsrc-quick-link"
                  onClick={() => onShowBibliotheque(id)}>
                  <span className="rsrc-quick-link__icon" style={{ color, background: bg }}>{icon}</span>
                  <span className="rsrc-quick-link__label">{label}</span>
                  <span className="rsrc-quick-link__count">{countBucket(visibleRessources, id)}</span>
                  <IconChevronRight size={12} />
                </button>
              ))}
            </div>
          </div>

          {/* Stocks & matériel */}
          <div className="rsrc-stocks-block">
            <div className="rsrc-stocks-block__header">
              <div className="rsrc-stocks-block__icon"><IconBox size={18} /></div>
              <div>
                <div className="rsrc-stocks-block__title">Stocks & matériel</div>
                <div className="rsrc-stocks-block__badge">Disponible en P3</div>
              </div>
            </div>
            <p className="rsrc-stocks-block__desc">
              Gérez les stocks physiques liés à vos campagnes et événements — réceptions, mouvements, transferts et inventaires.
            </p>
            <div className="rsrc-stocks-block__features">
              {["Articles & variantes", "Réceptions fournisseurs", "Mouvements inter-clubs", "Inventaires"].map(f => (
                <div key={f} className="rsrc-stocks-block__feature">
                  <span className="rsrc-stocks-block__feature-dot" />
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────
   VUE BIBLIOTHÈQUE COMPLÈTE
───────────────────────────────────── */
function BibliothequView({ visibleRessources, allRessources, campagnes, events, clubs, isAdmin, appId, loading,
  initialBucket, onBack, onAdd, onSelectRessource }) {
  const [activeBucket, setActiveBucket] = useState(initialBucket || "all");
  const [search,       setSearch]       = useState("");
  const [filterType,   setFilterType]   = useState("");
  const [filterCat,    setFilterCat]    = useState("");
  const [filterCamp,   setFilterCamp]   = useState("");
  const [filterClub,   setFilterClub]   = useState("");
  const [filterSeason, setFilterSeason] = useState("");

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

  const filtered = useMemo(() => {
    let list = bucketFiltered;
    const q = strSearch(search);
    if (q) list = list.filter(r =>
      strSearch(r.name).includes(q) || strSearch(r.description).includes(q) ||
      (r.tags || []).some(t => strSearch(t).includes(q))
    );
    if (filterType)   list = list.filter(r => r.type === filterType);
    if (filterCat)    list = list.filter(r => r.category === filterCat);
    if (filterCamp)   list = list.filter(r => (r.campagneIds || []).includes(filterCamp));
    if (filterClub)   list = list.filter(r => (r.clubs || []).length === 0 || (r.clubs || []).includes(filterClub));
    if (filterSeason) list = list.filter(r => r.season === filterSeason);
    return list;
  }, [bucketFiltered, search, filterType, filterCat, filterCamp, filterClub, filterSeason]);

  const seasons = useMemo(() => {
    const s = new Set(allRessources.map(r => r.season).filter(Boolean));
    return Array.from(s).sort().reverse();
  }, [allRessources]);

  const hasFilters = search || filterType || filterCat || filterCamp || filterClub || filterSeason;
  function clearFilters() {
    setSearch(""); setFilterType(""); setFilterCat("");
    setFilterCamp(""); setFilterClub(""); setFilterSeason("");
  }

  return (
    <div className="rsrc-biblio">
      {/* Barre de navigation */}
      <div className="rsrc-biblio-nav">
        <button className="rsrc-biblio-back" onClick={onBack}>
          <IconArrowRight size={13} style={{ transform: "rotate(180deg)" }} /> Accueil Ressources
        </button>
        <div className="rsrc-biblio-tabs">
          {BUCKETS.map(b => (
            <button key={b.id}
              className={`rsrc-biblio-tab${activeBucket === b.id ? " active" : ""}`}
              onClick={() => setActiveBucket(b.id)}>
              {b.label}
              <span className="rsrc-biblio-tab__count">{countBucket(visibleRessources, b.id)}</span>
            </button>
          ))}
        </div>
        {isAdmin && (
          <button className="camp-btn camp-btn--primary rsrc-add-btn" onClick={onAdd}>
            <IconPlus size={14} /> Ajouter
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="rsrc-filters">
        <div className="rsrc-search-wrap">
          <IconSearch size={14} className="rsrc-search-icon" />
          <input className="rsrc-search" placeholder="Rechercher…" value={search}
            onChange={e => setSearch(e.target.value)} />
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

      {/* Grille */}
      {loading ? (
        <div className="rsrc-loading"><div className="v2-spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="rsrc-empty">
          <div className="rsrc-empty__icon"><IconFolder size={36} /></div>
          <div className="rsrc-empty__title">{hasFilters ? "Aucune ressource ne correspond" : "Cette catégorie est vide"}</div>
          <div className="rsrc-empty__sub">{hasFilters ? "Modifiez les filtres." : isAdmin ? "Ajoutez une première ressource." : "Les ressources publiées apparaîtront ici."}</div>
          {isAdmin && !hasFilters && (
            <button className="camp-btn camp-btn--primary rsrc-empty__cta" onClick={onAdd}>
              <IconPlus size={14} /> Ajouter une ressource
            </button>
          )}
        </div>
      ) : (
        <div className="rsrc-grid">
          {filtered.map(r => (
            <RessourceCard key={r.id} r={r} campagnes={campagnes} clubs={clubs}
              isAdmin={isAdmin} onClick={onSelectRessource} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────
   PAGE PRINCIPALE
───────────────────────────────────── */
export default function RessourcesV2({ currentUser, appId }) {
  const isAdmin = currentUser?.admin === true;

  const { ressources: allRessources, loading } = useRessources();
  const { campagnes }   = useCampagnes();
  const { events }      = useCalendarEvents();
  const { clubs }       = useClubs();

  const [mode,          setMode]         = useState("cockpit");   // "cockpit" | "bibliotheque"
  const [initialBucket, setInitialBucket] = useState("all");
  const [search,        setSearch]        = useState("");
  const [selectedId,    setSelectedId]    = useState(null);
  const [showCreate,    setShowCreate]    = useState(false);
  const [showEdit,      setShowEdit]      = useState(false);
  const [refreshKey,    setRefreshKey]    = useState(0);

  function handleUpdated() { setRefreshKey(k => k + 1); }

  const visibleRessources = useMemo(() => {
    if (isAdmin) return allRessources;
    return allRessources.filter(r => r.published && !r.archived);
  }, [allRessources, isAdmin, refreshKey]);

  const selectedRessource = useMemo(() =>
    allRessources.find(r => String(r.id) === String(selectedId)) || null
  , [allRessources, selectedId, refreshKey]);

  function handleShowBibliotheque(bucketId = "all") {
    setInitialBucket(bucketId);
    setMode("bibliotheque");
    setSelectedId(null);
  }

  function handleSelectRessource(r) {
    setSelectedId(r.id);
    setShowEdit(false);
  }

  return (
    <div className="rsrc-page">
      {/* ── Panneau principal ── */}
      <div className="rsrc-main">
        {/* Header global */}
        <div className="rsrc-header">
          <div className="rsrc-header__left">
            <h1 className="rsrc-header__title">Ressources</h1>
            <p className="rsrc-header__sub">Bibliothèque, supports et ressources opérationnelles</p>
          </div>
          <div className="rsrc-header__right">
            <div className="rsrc-search-wrap rsrc-search-wrap--header">
              <IconSearch size={13} className="rsrc-search-icon" />
              <input className="rsrc-search rsrc-search--header" placeholder="Recherche globale…"
                value={search} onChange={e => {
                  setSearch(e.target.value);
                  if (e.target.value && mode === "cockpit") handleShowBibliotheque("all");
                }} />
            </div>
            {isAdmin && (
              <button className="camp-btn camp-btn--primary rsrc-add-btn" onClick={() => setShowCreate(true)}>
                <IconPlus size={14} /> Ajouter une ressource
              </button>
            )}
          </div>
        </div>

        {/* Contenu selon mode */}
        {mode === "cockpit" ? (
          <CockpitView
            visibleRessources={visibleRessources}
            allRessources={allRessources}
            campagnes={campagnes}
            clubs={clubs}
            isAdmin={isAdmin}
            loading={loading}
            onShowBibliotheque={handleShowBibliotheque}
            onSelectRessource={handleSelectRessource}
            onAdd={() => setShowCreate(true)}
          />
        ) : (
          <BibliothequView
            visibleRessources={visibleRessources}
            allRessources={allRessources}
            campagnes={campagnes}
            events={events}
            clubs={clubs}
            isAdmin={isAdmin}
            appId={appId}
            loading={loading}
            initialBucket={initialBucket}
            onBack={() => { setMode("cockpit"); setSelectedId(null); }}
            onAdd={() => setShowCreate(true)}
            onSelectRessource={handleSelectRessource}
          />
        )}
      </div>

      {/* ── Fiche détail ── */}
      {selectedRessource && !showEdit && (
        <div className="rsrc-detail-panel">
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
            onEdit={isAdmin ? () => setShowEdit(true) : null}
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
