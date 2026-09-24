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
import React, { useState, useMemo, useCallback } from "react";
import {
  useRessources, useCampagnes, useCalendarEvents, useClubs,
} from "../hooks/useV1Data";
import {
  createRessource, updateRessource,
  toggleRessourcePublished, archiveRessource,
} from "../hooks/useV1Write";
import { useStockItems, useStockReceipts } from "../hooks/useStockData";
import { createStockItem, updateStockItem } from "../hooks/useStockWrite";
import { createReceipt, submitReceipt, validateReceiptTx, rejectReceipt } from "../hooks/useReceiptWrite";
import { createManualMovement, createTransfer } from "../hooks/useMovementWrite";
import { useStockMovements } from "../hooks/useStockData";
import { useAuth } from "../../auth/AuthContext";
import {
  IconFolder, IconSearch, IconPlus, IconX, IconExternalLink,
  IconChevronRight, IconSettings, IconLayers, IconInbox, IconCheckSquare,
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
  },
];

function CockpitView({ visibleRessources, allRessources, campagnes, clubs, isAdmin, loading, onShowBibliotheque, onShowStocks, onSelectRessource, onAdd }) {
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
            className="rsrc-cat-card"
            style={{ "--cat-color": cat.color, "--cat-bg": cat.bg, "--cat-border": cat.border }}
            onClick={() => cat.id === "stocks" ? onShowStocks() : onShowBibliotheque(cat.bucketId)}
          >
            <div className="rsrc-cat-card__icon">{cat.icon}</div>
            <div className="rsrc-cat-card__body">
              <div className="rsrc-cat-card__title">{cat.title}</div>
              <div className="rsrc-cat-card__desc">{cat.desc}</div>
            </div>
            <div className="rsrc-cat-card__footer">
              <span className="rsrc-cat-card__cta">Voir <IconArrowRight size={11} /></span>
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
          <button className="rsrc-stocks-block rsrc-stocks-block--active" onClick={onShowStocks}>
            <div className="rsrc-stocks-block__header">
              <div className="rsrc-stocks-block__icon"><IconBox size={18} /></div>
              <div>
                <div className="rsrc-stocks-block__title">Stocks & matériel</div>
                <div className="rsrc-stocks-block__badge rsrc-stocks-block__badge--live">Articles & variantes</div>
              </div>
            </div>
            <p className="rsrc-stocks-block__desc">
              Articles physiques liés à vos campagnes et événements. Réceptions, mouvements et inventaires arrivent en P4–P6.
            </p>
            <div className="rsrc-stocks-block__cta">
              Ouvrir le module <IconArrowRight size={12} />
            </div>
          </button>
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
   STOCKS VIEW — CONSTANTES
───────────────────────────────────── */
const STK_CATEGORIES = [
  { value: "textile",       label: "Textile" },
  { value: "équipement",    label: "Équipement" },
  { value: "communication", label: "Communication" },
  { value: "autre",         label: "Autre" },
];
const STK_UNITS = [
  { value: "pièce",      label: "Pièce" },
  { value: "lot",        label: "Lot" },
  { value: "kg",         label: "kg" },
  { value: "m",          label: "m" },
  { value: "exemplaire", label: "Exemplaire" },
];
const STK_CAT_META = {
  textile:       { color: "#0F56B8", bg: "#EFF6FF" },
  équipement:    { color: "#059669", bg: "#ECFDF5" },
  communication: { color: "#D97706", bg: "#FFFBEB" },
  autre:         { color: "#58565e", bg: "#F0EEEA" },
};
function stkCatMeta(cat) { return STK_CAT_META[cat] || STK_CAT_META.autre; }

function fmtPrice(n) {
  if (n == null) return null;
  return Number(n).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}
function fmtRate(r) {
  if (r == null) return null;
  return (Number(r) * 100).toFixed(0) + " %";
}

function stkVarUid() {
  return "v" + String(Date.now()) + String(Math.random()).slice(2, 8);
}

/* ─────────────────────────────────────
   ARTICLE CARD (liste)
───────────────────────────────────── */
function ArticleCard({ item, campagnes, events, selected, onClick }) {
  const camp  = campagnes.find(c => String(c.id) === String(item.campaignId));
  const event = events.find(e => String(e.id) === String(item.eventId));
  const catM  = stkCatMeta(item.category);
  const activeVariants = (item.variants || []).filter(v => v.active !== false);
  const prices = activeVariants
    .map(v => v.salePriceTTC)
    .filter(p => p != null)
    .map(Number);
  const priceRange = prices.length === 0 ? null
    : prices.length === 1 ? fmtPrice(prices[0])
    : `${fmtPrice(Math.min(...prices))} – ${fmtPrice(Math.max(...prices))}`;

  return (
    <button
      className={`stk-card${selected ? " stk-card--selected" : ""}`}
      onClick={() => onClick(item)}
    >
      <div className="stk-card__top">
        <span className="stk-card__name">{item.name}</span>
        <span className="stk-card__sku">{item.sku}</span>
      </div>
      <div className="stk-card__meta">
        <span className="stk-card__cat" style={{ color: catM.color, background: catM.bg }}>
          {item.category || "autre"}
        </span>
        {(camp || event) && (
          <span className="stk-card__link">
            {camp?.name || event?.title || "—"}
          </span>
        )}
        {activeVariants.length > 0 && (
          <span className="stk-card__variants">{activeVariants.length} variante{activeVariants.length > 1 ? "s" : ""}</span>
        )}
      </div>
      {priceRange && <div className="stk-card__price">{priceRange}</div>}
      {item.financialRule && (
        <div className="stk-card__rule">
          {item.financialRule.mode === "per_unit"
            ? `Reversement : ${fmtPrice(item.financialRule.amountPerUnit)} / unité`
            : `Reversement : ${fmtRate(item.financialRule.rate)} → ${item.financialRule.beneficiary}`}
        </div>
      )}
    </button>
  );
}

/* ─────────────────────────────────────
   VARIANT ROW (dans ArticleDetail)
───────────────────────────────────── */
function VariantRow({ v, isAdmin, onEdit, onToggleActive }) {
  const inactive = v.active === false;
  return (
    <div className={`stk-variant-row${inactive ? " stk-variant-row--inactive" : ""}`}>
      <div className="stk-variant-row__label">{v.label || <em>Sans nom</em>}</div>
      <div className="stk-variant-row__attrs">
        {v.dimensions?.taille  && <span>{v.dimensions.taille}</span>}
        {v.dimensions?.genre   && <span>{v.dimensions.genre}</span>}
        {v.dimensions?.couleur && <span>{v.dimensions.couleur}</span>}
        {v.dimensions?.modele  && <span>{v.dimensions.modele}</span>}
        {v.dimensions?.annee   && <span>{v.dimensions.annee}</span>}
        {Object.entries(v.dimensions?.custom || {}).map(([k, val]) => (
          <span key={k}>{k}: {val}</span>
        ))}
      </div>
      <div className="stk-variant-row__prices">
        {v.purchasePriceHT != null && <span>Achat HT : {fmtPrice(v.purchasePriceHT)}</span>}
        {v.salePriceTTC    != null && <span>Vente TTC : {fmtPrice(v.salePriceTTC)}</span>}
        {v.alertThreshold  > 0     && <span>Seuil : {v.alertThreshold}</span>}
      </div>
      {isAdmin && (
        <div className="stk-variant-row__actions">
          <button className="stk-variant-btn" onClick={() => onEdit(v)}>Modifier</button>
          <button className="stk-variant-btn stk-variant-btn--muted" onClick={() => onToggleActive(v)}>
            {inactive ? "Réactiver" : "Désactiver"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────
   VARIANT FORM (inline add/edit)
───────────────────────────────────── */
const EMPTY_DIMS = { taille: "", genre: "", couleur: "", modele: "", annee: "", custom: {} };
const EMPTY_VARIANT = { id: null, label: "", dimensions: { ...EMPTY_DIMS }, purchasePriceHT: "", salePriceTTC: "", alertThreshold: "", active: true };

function VariantForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_VARIANT,
    ...initial,
    dimensions: { ...EMPTY_DIMS, ...(initial?.dimensions || {}) },
  }));
  const [customKey, setCustomKey] = useState("");
  const [customVal, setCustomVal] = useState("");

  const set    = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setDim = (k, v) => setForm(f => ({ ...f, dimensions: { ...f.dimensions, [k]: v } }));

  function addCustomDim() {
    const k = customKey.trim();
    if (!k) return;
    setForm(f => ({ ...f, dimensions: { ...f.dimensions, custom: { ...(f.dimensions.custom || {}), [k]: customVal.trim() } } }));
    setCustomKey(""); setCustomVal("");
  }
  function removeCustomDim(k) {
    setForm(f => {
      const { [k]: _, ...rest } = f.dimensions.custom || {};
      return { ...f, dimensions: { ...f.dimensions, custom: rest } };
    });
  }

  return (
    <div className="stk-vform">
      <div className="stk-vform__grid">
        <div className="stk-vform__field">
          <label>Nom / libellé *</label>
          <input value={form.label} onChange={e => set("label", e.target.value)} placeholder="Ex : Taille M Bleu" />
        </div>
        <div className="stk-vform__field">
          <label>Taille</label>
          <input value={form.dimensions.taille} onChange={e => setDim("taille", e.target.value)} placeholder="XS / M / 42…" />
        </div>
        <div className="stk-vform__field">
          <label>Genre</label>
          <input value={form.dimensions.genre} onChange={e => setDim("genre", e.target.value)} placeholder="Homme / Femme / Mixte" />
        </div>
        <div className="stk-vform__field">
          <label>Couleur</label>
          <input value={form.dimensions.couleur} onChange={e => setDim("couleur", e.target.value)} placeholder="Bleu marine…" />
        </div>
        <div className="stk-vform__field">
          <label>Modèle</label>
          <input value={form.dimensions.modele} onChange={e => setDim("modele", e.target.value)} placeholder="Référence modèle" />
        </div>
        <div className="stk-vform__field">
          <label>Année</label>
          <input value={form.dimensions.annee || ""} onChange={e => setDim("annee", e.target.value)} placeholder="2026" maxLength={4} />
        </div>
        <div className="stk-vform__field">
          <label>Prix achat HT (€)</label>
          <input type="number" min="0" step="0.01" value={form.purchasePriceHT} onChange={e => set("purchasePriceHT", e.target.value)} placeholder="0.00" />
        </div>
        <div className="stk-vform__field">
          <label>Prix vente TTC (€)</label>
          <input type="number" min="0" step="0.01" value={form.salePriceTTC} onChange={e => set("salePriceTTC", e.target.value)} placeholder="0.00" />
        </div>
        <div className="stk-vform__field">
          <label>Seuil d'alerte</label>
          <input type="number" min="0" step="1" value={form.alertThreshold} onChange={e => set("alertThreshold", e.target.value)} placeholder="0" />
        </div>
      </div>
      {/* Dimensions custom */}
      <div className="stk-vform__dims">
        <div className="stk-vform__dims-title">Dimensions personnalisées</div>
        {Object.entries(form.dimensions.custom || {}).map(([k, v]) => (
          <div key={k} className="stk-vform__dim-row">
            <span className="stk-vform__dim-key">{k}</span>
            <span className="stk-vform__dim-val">{v}</span>
            <button className="stk-vform__dim-remove" onClick={() => removeCustomDim(k)}>×</button>
          </div>
        ))}
        <div className="stk-vform__dim-add">
          <input value={customKey} onChange={e => setCustomKey(e.target.value)} placeholder="Clé" />
          <input value={customVal} onChange={e => setCustomVal(e.target.value)} placeholder="Valeur" />
          <button onClick={addCustomDim} className="stk-vform__dim-btn">+</button>
        </div>
      </div>
      <div className="stk-vform__actions">
        <button className="camp-btn camp-btn--ghost" onClick={onCancel}>Annuler</button>
        <button className="camp-btn camp-btn--primary" onClick={() => onSave(form)}>
          {form.id ? "Enregistrer" : "Ajouter la variante"}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────
   ARTICLE DETAIL (panneau latéral)
───────────────────────────────────── */
function ArticleDetail({ item, campagnes, events, isAdmin, appId, allItems, onClose, onUpdated, onEdit }) {
  const [editingVariant,  setEditingVariant]  = useState(null);  // variant obj or {} for new
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState(null);

  const camp  = campagnes.find(c => String(c.id) === String(item.campaignId));
  const event = events.find(e => String(e.id) === String(item.eventId));
  const catM  = stkCatMeta(item.category);
  const variants = item.variants || [];

  async function handleSaveVariant(vForm) {
    setSaving(true); setErr(null);
    try {
      const isNew = !vForm.id;
      const prepared = {
        ...vForm,
        id: vForm.id || stkVarUid(),
        label: (vForm.label || "").trim(),
        dimensions: {
          taille:  (vForm.dimensions?.taille  || "").trim(),
          genre:   (vForm.dimensions?.genre   || "").trim(),
          couleur: (vForm.dimensions?.couleur || "").trim(),
          modele:  (vForm.dimensions?.modele  || "").trim(),
          annee:   vForm.dimensions?.annee   || null,
          custom:  vForm.dimensions?.custom  || {},
        },
        purchasePriceHT: vForm.purchasePriceHT !== "" ? Number(vForm.purchasePriceHT) : null,
        salePriceTTC:    vForm.salePriceTTC    !== "" ? Number(vForm.salePriceTTC)    : null,
        alertThreshold:  vForm.alertThreshold  !== "" ? Number(vForm.alertThreshold)  : 0,
        active: true,
      };
      const newVariants = isNew
        ? [...variants, prepared]
        : variants.map(v => v.id === prepared.id ? prepared : v);
      await updateStockItem(item.id, { variants: newVariants }, appId);
      setEditingVariant(null);
      onUpdated();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleToggleActive(v) {
    setSaving(true); setErr(null);
    try {
      const newVariants = variants.map(vv =>
        vv.id === v.id ? { ...vv, active: v.active === false ? true : false } : vv
      );
      await updateStockItem(item.id, { variants: newVariants }, appId);
      onUpdated();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="stk-detail">
      <div className="stk-detail__head">
        <div className="stk-detail__identity">
          <span className="stk-detail__name">{item.name}</span>
          <span className="stk-detail__sku">{item.sku}</span>
        </div>
        <div className="stk-detail__head-actions">
          {isAdmin && <button className="camp-btn camp-btn--outline camp-btn--sm" onClick={onEdit}>Modifier</button>}
          <button className="rsrc-detail-panel__close" onClick={onClose}>
            <IconX size={16} />
          </button>
        </div>
      </div>

      <div className="stk-detail__body">
        {/* Catégorie & unité */}
        <div className="stk-detail__row">
          <span className="stk-detail__label">Catégorie</span>
          <span className="stk-detail__val stk-detail__cat" style={{ color: catM.color, background: catM.bg }}>
            {item.category || "autre"}
          </span>
        </div>
        <div className="stk-detail__row">
          <span className="stk-detail__label">Unité</span>
          <span className="stk-detail__val">{item.unit || "pièce"}</span>
        </div>

        {/* Rattachement */}
        <div className="stk-detail__section-title">Rattachement</div>
        {camp  && <div className="stk-detail__row"><span className="stk-detail__label">Campagne</span><span className="stk-detail__val">{camp.name}</span></div>}
        {event && <div className="stk-detail__row"><span className="stk-detail__label">Événement</span><span className="stk-detail__val">{event.title || event.name}</span></div>}
        {!camp && !event && <div className="stk-detail__row"><span className="stk-detail__val stk-detail__val--muted">Aucun rattachement renseigné</span></div>}

        {/* Notes */}
        {item.notes && (
          <>
            <div className="stk-detail__section-title">Notes</div>
            <p className="stk-detail__notes">{item.notes}</p>
          </>
        )}

        {/* Règle financière */}
        {item.financialRule && (
          <>
            <div className="stk-detail__section-title">Règle financière</div>
            <div className="stk-detail__rule-block">
              {item.financialRule.mode === "per_unit" ? (
                <span>{fmtPrice(item.financialRule.amountPerUnit)} par unité → {item.financialRule.beneficiary}</span>
              ) : (
                <span>{fmtRate(item.financialRule.rate)} du prix vente → {item.financialRule.beneficiary}</span>
              )}
            </div>
          </>
        )}

        {/* Variantes */}
        <div className="stk-detail__section-title">
          Variantes
          {isAdmin && !editingVariant && (
            <button className="stk-detail__add-variant" onClick={() => setEditingVariant({ id: null })}>
              <IconPlus size={12} /> Ajouter
            </button>
          )}
        </div>

        {err && <div className="stk-error">{err}</div>}

        {editingVariant !== null && (
          <VariantForm
            initial={editingVariant.id ? editingVariant : {}}
            onSave={handleSaveVariant}
            onCancel={() => { setEditingVariant(null); setErr(null); }}
          />
        )}

        {variants.length === 0 && !editingVariant ? (
          <div className="stk-detail__empty">Aucune variante. {isAdmin && "Ajoutez-en une ci-dessus."}</div>
        ) : (
          <div className="stk-variant-list">
            {variants.map(v => (
              <VariantRow
                key={v.id}
                v={v}
                isAdmin={isAdmin && !editingVariant}
                onEdit={vv => setEditingVariant(vv)}
                onToggleActive={handleToggleActive}
              />
            ))}
          </div>
        )}

        {/* Prochaines étapes */}
        <div className="stk-detail__section-title">Prochaines étapes</div>
        <div className="stk-upcoming-list">
          {[
            { label: "Réceptions fournisseurs", phase: "P4" },
            { label: "Mouvements & transferts", phase: "P5" },
            { label: "Inventaires",              phase: "P6" },
          ].map(s => (
            <div key={s.label} className="stk-upcoming-item">
              <span className="stk-upcoming-item__dot" />
              <span className="stk-upcoming-item__label">{s.label}</span>
              <span className="stk-upcoming-item__phase">{s.phase}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────
   ARTICLE CREATION / EDIT PANEL
───────────────────────────────────── */
const EMPTY_ITEM_FORM = {
  name: "", sku: "", category: "autre", unit: "pièce",
  campaignId: "", eventId: "", notes: "",
  financialRule: null,
  variants: [],
};

function ArticlePanel({ initial, allItems, campagnes, events, appId, onClose, onSaved, editMode }) {
  const [form,       setForm]    = useState(() => ({ ...EMPTY_ITEM_FORM, ...(initial || {}) }));
  const [saving,     setSaving]  = useState(false);
  const [err,        setErr]     = useState(null);
  const [showFin,    setShowFin] = useState(() => !!(initial?.financialRule));
  const [editingVar, setEditingVar] = useState(null);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setFin   = (k, v) => setForm(f => ({
    ...f,
    financialRule: { ...(f.financialRule || { mode: "per_unit", currency: "EUR", beneficiary: "" }), [k]: v }
  }));

  function addVariant(vForm) {
    const prepared = {
      ...vForm,
      id: vForm.id || stkVarUid(),
      dimensions: {
        taille:  (vForm.dimensions?.taille  || "").trim(),
        genre:   (vForm.dimensions?.genre   || "").trim(),
        couleur: (vForm.dimensions?.couleur || "").trim(),
        modele:  (vForm.dimensions?.modele  || "").trim(),
        annee:   vForm.dimensions?.annee   || null,
        custom:  vForm.dimensions?.custom  || {},
      },
      purchasePriceHT: vForm.purchasePriceHT !== "" ? Number(vForm.purchasePriceHT) : null,
      salePriceTTC:    vForm.salePriceTTC    !== "" ? Number(vForm.salePriceTTC)    : null,
      alertThreshold:  vForm.alertThreshold  !== "" ? Number(vForm.alertThreshold)  : 0,
      active: true,
    };
    setForm(f => ({
      ...f,
      variants: f.variants.some(v => v.id === prepared.id)
        ? f.variants.map(v => v.id === prepared.id ? prepared : v)
        : [...f.variants, prepared],
    }));
    setEditingVar(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const payload = {
        ...form,
        financialRule: showFin && form.financialRule?.mode ? form.financialRule : null,
      };
      if (editMode) {
        await updateStockItem(initial.id, payload, appId);
      } else {
        await createStockItem(allItems, payload, appId);
      }
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const fin = form.financialRule || { mode: "per_unit", currency: "EUR", beneficiary: "", amount: "", rate: "" };

  return (
    <div className="stk-panel">
      <div className="stk-panel__head">
        <span className="stk-panel__title">{editMode ? "Modifier l'article" : "Nouvel article"}</span>
        <button className="rsrc-detail-panel__close" onClick={onClose}><IconX size={16} /></button>
      </div>
      <form className="stk-panel__body" onSubmit={handleSubmit}>
        {err && <div className="stk-error">{err}</div>}

        <div className="stk-panel__section">Identité</div>
        <div className="stk-panel__grid">
          <div className="camp-form-group">
            <label className="camp-form-label">Nom *</label>
            <input className="camp-form-input" value={form.name} onChange={e => setField("name", e.target.value)} placeholder="Ex : T-shirt Octobre Rose" required />
          </div>
          <div className="camp-form-group">
            <label className="camp-form-label">SKU / Référence *</label>
            <input className="camp-form-input" value={form.sku} onChange={e => setField("sku", e.target.value.toUpperCase())} placeholder="EX : TSH-OCT-2026" required />
          </div>
          <div className="camp-form-group">
            <label className="camp-form-label">Catégorie</label>
            <select className="camp-form-input" value={form.category} onChange={e => setField("category", e.target.value)}>
              {STK_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="camp-form-group">
            <label className="camp-form-label">Unité</label>
            <select className="camp-form-input" value={form.unit} onChange={e => setField("unit", e.target.value)}>
              {STK_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
        </div>

        <div className="stk-panel__section">Rattachement *</div>
        <p className="stk-panel__hint">Au moins une campagne ou un événement est obligatoire.</p>
        <div className="stk-panel__grid">
          <div className="camp-form-group">
            <label className="camp-form-label">Campagne</label>
            <select className="camp-form-input" value={form.campaignId} onChange={e => setField("campaignId", e.target.value)}>
              <option value="">— Aucune —</option>
              {campagnes.filter(c => c.name).map(c => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="camp-form-group">
            <label className="camp-form-label">Événement</label>
            <select className="camp-form-input" value={form.eventId} onChange={e => setField("eventId", e.target.value)}>
              <option value="">— Aucun —</option>
              {events.filter(ev => ev.title || ev.name).map(ev => (
                <option key={ev.id} value={String(ev.id)}>{ev.title || ev.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="camp-form-group">
          <label className="camp-form-label">Notes</label>
          <textarea className="camp-form-input camp-form-textarea" value={form.notes} onChange={e => setField("notes", e.target.value)} rows={2} placeholder="Contexte, fournisseur, spécifications…" />
        </div>

        {/* Règle financière */}
        <div className="stk-panel__section">
          <button type="button" className="stk-panel__toggle" onClick={() => setShowFin(s => !s)}>
            {showFin ? "▾" : "▸"} Règle de reversement (optionnel)
          </button>
        </div>
        {showFin && (
          <div className="stk-panel__grid">
            <div className="camp-form-group">
              <label className="camp-form-label">Mode</label>
              <select className="camp-form-input" value={fin.mode} onChange={e => setFin("mode", e.target.value)}>
                <option value="per_unit">Montant fixe par unité</option>
                <option value="percentage">Pourcentage du prix vente</option>
              </select>
            </div>
            {fin.mode === "per_unit" ? (
              <div className="camp-form-group">
                <label className="camp-form-label">Montant par unité (€)</label>
                <input type="number" min="0" step="0.01" className="camp-form-input" value={fin.amountPerUnit ?? ""} onChange={e => setFin("amountPerUnit", e.target.value)} placeholder="0.00" />
              </div>
            ) : (
              <div className="camp-form-group">
                <label className="camp-form-label">Taux (%)</label>
                <input type="number" min="0" max="100" step="0.1" className="camp-form-input"
                  value={fin.rate != null ? (fin.rate <= 1 ? fin.rate * 100 : fin.rate) : ""}
                  onChange={e => setFin("rate", e.target.value !== "" ? Number(e.target.value) / 100 : null)}
                  placeholder="Ex : 10 pour 10 %" />
              </div>
            )}
            <div className="camp-form-group">
              <label className="camp-form-label">Bénéficiaire</label>
              <input className="camp-form-input" value={fin.beneficiary || ""} onChange={e => setFin("beneficiary", e.target.value)} placeholder="Club, fournisseur…" />
            </div>
          </div>
        )}

        {/* Variantes */}
        <div className="stk-panel__section">
          Variantes
          {!editingVar && (
            <button type="button" className="stk-detail__add-variant" onClick={() => setEditingVar({})}>
              <IconPlus size={12} /> Ajouter
            </button>
          )}
        </div>
        {editingVar !== null && (
          <VariantForm
            initial={editingVar}
            onSave={addVariant}
            onCancel={() => setEditingVar(null)}
          />
        )}
        {form.variants.length === 0 && !editingVar && (
          <div className="stk-detail__empty">Aucune variante pour l'instant — vous pourrez en ajouter après création.</div>
        )}
        {form.variants.map(v => (
          <div key={v.id} className="stk-panel__var-summary">
            <span>{v.label || <em>Sans nom</em>}</span>
            {v.dimensions?.taille  && <span>{v.dimensions.taille}</span>}
            {v.dimensions?.couleur && <span>{v.dimensions.couleur}</span>}
            <button type="button" className="stk-variant-btn" onClick={() => setEditingVar(v)}>Modifier</button>
            <button type="button" className="stk-variant-btn stk-variant-btn--muted" onClick={() => setForm(f => ({ ...f, variants: f.variants.filter(vv => vv.id !== v.id) }))}>
              Supprimer
            </button>
          </div>
        ))}

        <div className="stk-panel__footer">
          <button type="button" className="camp-btn camp-btn--ghost" onClick={onClose}>Annuler</button>
          <button type="submit" className="camp-btn camp-btn--primary" disabled={saving}>
            {saving ? <span className="v2-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : (editMode ? "Enregistrer" : "Créer l'article")}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─────────────────────────────────────
   P4 — RÉCEPTIONS : HELPERS
───────────────────────────────────── */
const RECEIPT_STATUS_LABEL = {
  pending:   "En attente",
  submitted: "Soumis",
  validated: "Validé",
  rejected:  "Rejeté",
};

function resolveItem(items, itemId) {
  return items.find(i => i.id === itemId) || null;
}
function resolveVariant(item, variantId) {
  if (!item) return null;
  return (item.variants || []).find(v => v.id === variantId) || null;
}
function resolveClubR(clubs, clubId) {
  return clubs.find(c => String(c.id) === String(clubId) || String(c.appId) === String(clubId)) || null;
}
function variantLabel(v) {
  if (!v) return null;
  const d = v.dimensions || {};
  const parts = [d.taille, d.genre, d.couleur, d.modele, d.annee].filter(Boolean);
  return v.label || parts.join(" · ") || "Variante";
}
function fmtReceiptDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return "—"; }
}

/* Badge statut réception */
function ReceiptStatusBadge({ status }) {
  const mod = { pending: "pending", submitted: "submitted", validated: "validated", rejected: "rejected" }[status] || "pending";
  return <span className={`rcpt-badge rcpt-badge--${mod}`}>{RECEIPT_STATUS_LABEL[status] || status}</span>;
}

/* Carte réception dans la liste */
function ReceiptCard({ receipt, items, clubs, selected, onClick }) {
  const item    = resolveItem(items, receipt.itemId);
  const variant = resolveVariant(item, receipt.variantId);
  const club    = resolveClubR(clubs, receipt.clubId);
  const hasDelta = receipt.delta !== null && receipt.delta !== 0;

  return (
    <button
      className={`rcpt-card${selected ? " rcpt-card--selected" : ""}${hasDelta ? " rcpt-card--delta" : ""}`}
      onClick={() => onClick(receipt)}
    >
      <div className="rcpt-card__top">
        <div className="rcpt-card__name">
          {item ? item.name : <span className="rcpt-card__missing">Article introuvable</span>}
          {variant
            ? <span className="rcpt-card__variant"> · {variantLabel(variant)}</span>
            : <span className="rcpt-card__missing-small"> · Variante indisponible</span>}
        </div>
        <ReceiptStatusBadge status={receipt.status} />
      </div>
      <div className="rcpt-card__meta">
        <span className="rcpt-card__club">{club ? club.name : <span className="rcpt-card__missing-small">Club introuvable</span>}</span>
        <span className="rcpt-card__qty">
          Prévu : <strong>{receipt.plannedQty}</strong>
          {receipt.receivedQty !== null && (
            <> · Reçu : <strong>{receipt.receivedQty}</strong></>
          )}
          {hasDelta && (
            <span className={`rcpt-card__delta ${receipt.delta > 0 ? "rcpt-card__delta--pos" : "rcpt-card__delta--neg"}`}>
              {receipt.delta > 0 ? "+" : ""}{receipt.delta}
            </span>
          )}
        </span>
      </div>
    </button>
  );
}

/* Panneau création réception (admin) */
function ReceiptCreatePanel({ items, clubs, campagnes, events, appId, onClose, onSaved }) {
  const [form,   setForm]   = useState({ itemId: "", variantId: "", clubId: "", plannedQty: "" });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  const selectedItem = items.find(i => i.id === form.itemId) || null;
  const variants     = selectedItem ? (selectedItem.variants || []).filter(v => v.active !== false) : [];

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function handleItemChange(e) {
    setF("itemId", e.target.value);
    setF("variantId", "");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      const item = items.find(i => i.id === form.itemId);
      await createReceipt({
        itemId:     form.itemId,
        variantId:  form.variantId,
        clubId:     form.clubId,
        plannedQty: form.plannedQty,
        campaignId: item?.campaignId || null,
        eventId:    item?.eventId    || null,
      }, appId);
      onSaved();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  }

  const camp = selectedItem ? campagnes.find(c => String(c.id) === String(selectedItem.campaignId)) : null;
  const ev   = selectedItem ? events.find(e => String(e.id) === String(selectedItem.eventId)) : null;

  return (
    <div className="stk-panel rcpt-panel-create">
      <div className="stk-panel__head">
        <span className="stk-panel__title">Préparer une réception</span>
        <button className="stk-panel__close" onClick={onClose}><IconX size={16} /></button>
      </div>
      <form className="stk-panel__body" onSubmit={handleSubmit}>
        <div className="stk-panel__section">Identification</div>

        <div className="camp-form-group">
          <label className="camp-form-label">Article *</label>
          <select className="camp-form-input" value={form.itemId} onChange={handleItemChange} required>
            <option value="">— Choisir un article —</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
          </select>
        </div>

        <div className="camp-form-group">
          <label className="camp-form-label">Variante *</label>
          <select className="camp-form-input" value={form.variantId} onChange={e => setF("variantId", e.target.value)} required disabled={!form.itemId}>
            <option value="">— Choisir une variante —</option>
            {variants.map(v => <option key={v.id} value={v.id}>{variantLabel(v)}</option>)}
          </select>
          {selectedItem && variants.length === 0 && (
            <p className="camp-form-hint" style={{ color: "var(--ep-blue)" }}>Aucune variante active sur cet article.</p>
          )}
        </div>

        <div className="camp-form-group">
          <label className="camp-form-label">Club réceptionnaire *</label>
          <select className="camp-form-input" value={form.clubId} onChange={e => setF("clubId", e.target.value)} required>
            <option value="">— Choisir un club —</option>
            {clubs.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
        </div>

        {(camp || ev) && (
          <div className="rcpt-create__link-info">
            <span className="stk-panel__section" style={{ marginTop: 0 }}>Lié à</span>
            {camp && <span className="rcpt-create__link-val">{camp.name}</span>}
            {ev   && <span className="rcpt-create__link-val">{ev.title || ev.name}</span>}
          </div>
        )}

        <div className="stk-panel__section">Quantité</div>
        <div className="camp-form-group">
          <label className="camp-form-label">Quantité prévue *</label>
          <input className="camp-form-input" type="number" min="0" step="1"
            value={form.plannedQty} onChange={e => setF("plannedQty", e.target.value)} required placeholder="0" />
        </div>

        {err && <div className="camp-form-error">{err}</div>}

        <div className="stk-panel__footer" style={{ padding: "14px 0 0", border: "none" }}>
          <button type="button" className="camp-btn camp-btn--ghost" onClick={onClose}>Annuler</button>
          <button type="submit" className="camp-btn camp-btn--primary" disabled={saving}>
            {saving ? <span className="v2-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : "Créer la réception"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* Panneau détail réception (soumission équipe + validation admin) */
function ReceiptDetailPanel({ receipt, items, clubs, appId, authUid, isAdmin, onClose, onUpdated }) {
  const item    = resolveItem(items, receipt.itemId);
  const variant = resolveVariant(item, receipt.variantId);
  const club    = resolveClubR(clubs, receipt.clubId);

  const [receivedQty,    setReceivedQty]    = useState(receipt.receivedQty !== null ? String(receipt.receivedQty) : "");
  const [deltaNote,      setDeltaNote]      = useState(receipt.deltaNote || "");
  const [rejectionNote,  setRejectionNote]  = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [err,            setErr]            = useState("");

  const liveQty   = receivedQty !== "" ? Number(receivedQty) : null;
  const liveDelta = liveQty !== null ? liveQty - receipt.plannedQty : null;
  const needNote  = liveDelta !== null && liveDelta !== 0;

  async function handleSubmit() {
    setErr("");
    setSaving(true);
    try {
      await submitReceipt(receipt.id, Number(receivedQty), deltaNote, receipt.plannedQty, authUid);
      onUpdated();
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleValidate() {
    setErr("");
    setSaving(true);
    try {
      await validateReceiptTx(receipt.id, appId);
      onUpdated();
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleReject() {
    setErr("");
    setSaving(true);
    try {
      await rejectReceipt(receipt.id, rejectionNote, appId);
      onUpdated();
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const canSubmit = receipt.status === "pending" && !isAdmin && liveQty !== null && liveQty >= 0 && (!needNote || deltaNote.trim());
  const canAct    = receipt.status === "submitted" && isAdmin;
  const isReadOnly = receipt.status === "validated" || receipt.status === "rejected";

  return (
    <div className="stk-panel rcpt-panel-detail">
      <div className="stk-panel__head">
        <span className="stk-panel__title">Réception</span>
        <button className="stk-panel__close" onClick={onClose}><IconX size={16} /></button>
      </div>

      <div className="stk-panel__body">
        {/* En-tête article */}
        <div className="rcpt-detail__article">
          {item
            ? <><span className="rcpt-detail__item-name">{item.name}</span><span className="rcpt-detail__sku">{item.sku}</span></>
            : <span className="rcpt-card__missing">Article introuvable</span>}
          <div className="rcpt-detail__variant">
            {variant
              ? variantLabel(variant)
              : <span className="rcpt-card__missing-small">Variante indisponible</span>}
          </div>
          <div className="rcpt-detail__club">
            {club ? club.name : <span className="rcpt-card__missing-small">Club introuvable</span>}
          </div>
        </div>

        <ReceiptStatusBadge status={receipt.status} />

        {/* Quantités */}
        <div className="stk-panel__section" style={{ marginTop: 16 }}>Quantités</div>
        <div className="rcpt-qty-grid">
          <div className="rcpt-qty-cell">
            <div className="rcpt-qty-cell__label">Attendu</div>
            <div className="rcpt-qty-cell__val">{receipt.plannedQty}</div>
          </div>
          <div className="rcpt-qty-cell">
            <div className="rcpt-qty-cell__label">Reçu</div>
            {receipt.status === "pending" && !isAdmin ? (
              <input className="rcpt-qty-input" type="number" min="0" step="1"
                value={receivedQty} onChange={e => setReceivedQty(e.target.value)} placeholder="0" />
            ) : (
              <div className="rcpt-qty-cell__val">{receipt.receivedQty !== null ? receipt.receivedQty : "—"}</div>
            )}
          </div>
          <div className="rcpt-qty-cell">
            <div className="rcpt-qty-cell__label">Écart</div>
            <div className={`rcpt-qty-cell__val rcpt-qty-cell__val--delta${liveDelta !== null ? (liveDelta > 0 ? " pos" : liveDelta < 0 ? " neg" : " zero") : ""}`}>
              {receipt.status === "pending" && !isAdmin
                ? (liveDelta !== null ? (liveDelta > 0 ? "+" : "") + liveDelta : "—")
                : (receipt.delta !== null ? (receipt.delta > 0 ? "+" : "") + receipt.delta : "—")}
            </div>
          </div>
        </div>

        {/* Note d'écart */}
        {(needNote || (receipt.deltaNote && receipt.delta !== 0)) && (
          <>
            <div className="stk-panel__section">Note d'écart{needNote && !isReadOnly ? " *" : ""}</div>
            {receipt.status === "pending" && !isAdmin ? (
              <textarea className="camp-form-input rcpt-note-input" rows={3}
                placeholder="Expliquez l'écart constaté…"
                value={deltaNote} onChange={e => setDeltaNote(e.target.value)} />
            ) : (
              <p className="rcpt-detail__note">{receipt.deltaNote || "—"}</p>
            )}
          </>
        )}

        {/* Rejet — formulaire */}
        {showRejectForm && (
          <>
            <div className="stk-panel__section">Note de rejet *</div>
            <textarea className="camp-form-input rcpt-note-input" rows={3}
              placeholder="Motif du rejet…"
              value={rejectionNote} onChange={e => setRejectionNote(e.target.value)} />
          </>
        )}

        {/* Note de rejet affichée */}
        {receipt.status === "rejected" && receipt.rejectionNote && (
          <>
            <div className="stk-panel__section">Motif du rejet</div>
            <p className="rcpt-detail__note rcpt-detail__note--reject">{receipt.rejectionNote}</p>
          </>
        )}

        {/* Audit trail */}
        <div className="stk-panel__section" style={{ marginTop: 16 }}>Historique</div>
        <div className="rcpt-timeline">
          <div className="rcpt-timeline__row">
            <span className="rcpt-timeline__dot rcpt-timeline__dot--done" />
            <span className="rcpt-timeline__label">Créée</span>
            <span className="rcpt-timeline__date">{fmtDate(receipt.createdAt)}</span>
          </div>
          {receipt.submittedAt && (
            <div className="rcpt-timeline__row">
              <span className="rcpt-timeline__dot rcpt-timeline__dot--done" />
              <span className="rcpt-timeline__label">Soumise</span>
              <span className="rcpt-timeline__date">{fmtDate(receipt.submittedAt)}</span>
            </div>
          )}
          {receipt.validatedAt && (
            <div className="rcpt-timeline__row">
              <span className="rcpt-timeline__dot rcpt-timeline__dot--validated" />
              <span className="rcpt-timeline__label">Validée</span>
              <span className="rcpt-timeline__date">{fmtDate(receipt.validatedAt)}</span>
            </div>
          )}
          {receipt.rejectedAt && (
            <div className="rcpt-timeline__row">
              <span className="rcpt-timeline__dot rcpt-timeline__dot--rejected" />
              <span className="rcpt-timeline__label">Rejetée</span>
              <span className="rcpt-timeline__date">{fmtDate(receipt.rejectedAt)}</span>
            </div>
          )}
        </div>

        {err && <div className="camp-form-error" style={{ marginTop: 8 }}>{err}</div>}
      </div>

      {/* Actions */}
      {!isReadOnly && (
        <div className="stk-panel__footer">
          {receipt.status === "pending" && !isAdmin && (
            <>
              <button className="camp-btn camp-btn--ghost" onClick={onClose}>Annuler</button>
              <button className="camp-btn camp-btn--primary" disabled={!canSubmit || saving} onClick={handleSubmit}>
                {saving ? <span className="v2-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : "Soumettre"}
              </button>
            </>
          )}
          {canAct && !showRejectForm && (
            <>
              <button className="camp-btn camp-btn--ghost rcpt-btn-reject" disabled={saving} onClick={() => setShowRejectForm(true)}>
                Rejeter
              </button>
              <button className="camp-btn stk-add-btn" disabled={saving} onClick={handleValidate}>
                {saving ? <span className="v2-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <><IconCheckSquare size={14} /> Valider</>}
              </button>
            </>
          )}
          {canAct && showRejectForm && (
            <>
              <button className="camp-btn camp-btn--ghost" disabled={saving} onClick={() => setShowRejectForm(false)}>Annuler</button>
              <button className="camp-btn camp-btn--danger" disabled={!rejectionNote.trim() || saving} onClick={handleReject}>
                {saving ? <span className="v2-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : "Confirmer le rejet"}
              </button>
            </>
          )}
          {receipt.status === "pending" && isAdmin && (
            <button className="camp-btn camp-btn--ghost" onClick={onClose}>Fermer</button>
          )}
        </div>
      )}
      {isReadOnly && (
        <div className="stk-panel__footer">
          <button className="camp-btn camp-btn--ghost" onClick={onClose}>Fermer</button>
        </div>
      )}
    </div>
  );
}

/* Vue principale Réceptions */
function ReceiptsView({ currentUser, appId, authUid, items, clubs, campagnes, events }) {
  const isAdmin = currentUser?.admin === true;
  const { receipts, loading, error } = useStockReceipts();

  const [selectedId,   setSelectedId]   = useState(null);
  const [showCreate,   setShowCreate]   = useState(false);
  const [refreshKey,   setRefreshKey]   = useState(0);

  function handleUpdated() { setRefreshKey(k => k + 1); }

  const selectedReceipt = useMemo(
    () => receipts.find(r => r.id === selectedId) || null,
    [receipts, selectedId, refreshKey]
  );

  // Groupes selon statut + delta
  const groups = useMemo(() => ({
    toCheck:   receipts.filter(r => r.status === "submitted" && (r.delta === 0 || r.delta === null)),
    withDelta: receipts.filter(r => r.status === "submitted" && r.delta !== null && r.delta !== 0),
    validated: receipts.filter(r => r.status === "validated"),
    pending:   receipts.filter(r => r.status === "pending"),
    rejected:  receipts.filter(r => r.status === "rejected"),
  }), [receipts, refreshKey]);

  function renderGroup(title, list, mod) {
    if (list.length === 0) return null;
    return (
      <div className="rcpt-group" key={title}>
        <div className={`rcpt-group__header rcpt-group__header--${mod}`}>
          <span className="rcpt-group__title">{title}</span>
          <span className="rcpt-group__count">{list.length}</span>
        </div>
        {list.map(r => (
          <ReceiptCard
            key={r.id}
            receipt={r}
            items={items}
            clubs={clubs}
            selected={selectedId === r.id}
            onClick={r2 => { setSelectedId(r2.id); setShowCreate(false); }}
          />
        ))}
      </div>
    );
  }

  const isEmpty = receipts.length === 0;

  return (
    <div className="stk-content">
      <div className="stk-list-col">
        {/* Filtres / actions */}
        <div className="rcpt-list-header">
          {isAdmin && (
            <button className="camp-btn stk-add-btn" onClick={() => { setShowCreate(true); setSelectedId(null); }}>
              <IconPlus size={14} /> Préparer une réception
            </button>
          )}
        </div>

        {loading ? (
          <div className="stk-loading"><div className="v2-spinner" /></div>
        ) : error ? (
          <div className="stk-error">Erreur : {error.message}</div>
        ) : isEmpty ? (
          <div className="stk-empty">
            <div className="stk-empty__icon"><IconInbox size={22} /></div>
            <span className="stk-empty__title">Aucune réception</span>
            <span className="stk-empty__sub">
              {isAdmin
                ? "Préparez la première réception pour commencer à suivre les entrées de stock."
                : "Aucune réception en cours pour l'instant."}
            </span>
          </div>
        ) : (
          <div className="rcpt-list">
            {renderGroup("Avec écart", groups.withDelta, "delta")}
            {renderGroup("À vérifier", groups.toCheck, "check")}
            {renderGroup("En attente", groups.pending, "pending")}
            {renderGroup("Validées", groups.validated, "validated")}
            {renderGroup("Rejetées", groups.rejected, "rejected")}
          </div>
        )}
      </div>

      {/* Panneau création */}
      {showCreate && isAdmin && (
        <ReceiptCreatePanel
          items={items}
          clubs={clubs}
          campagnes={campagnes}
          events={events}
          appId={appId}
          onClose={() => setShowCreate(false)}
          onSaved={() => { handleUpdated(); setShowCreate(false); }}
        />
      )}

      {/* Panneau détail */}
      {selectedReceipt && !showCreate && (
        <ReceiptDetailPanel
          key={selectedReceipt.id + refreshKey}
          receipt={selectedReceipt}
          items={items}
          clubs={clubs}
          appId={appId}
          authUid={authUid}
          isAdmin={isAdmin}
          onClose={() => setSelectedId(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────
   STOCKS VIEW (page principale)
───────────────────────────────────── */
/* ─────────────────────────────────────
   P5 — MOUVEMENTS MANUELS
───────────────────────────────────── */

const MOV_TYPE_LABELS = {
  manual_in:    "Entrée manuelle",
  manual_out:   "Sortie manuelle",
  transfer_out: "Transfert (départ)",
  transfer_in:  "Transfert (arrivée)",
  reception:    "Réception",
};

const MOV_DIRECTION_COLOR = {
  in:  "stk-mov--in",
  out: "stk-mov--out",
};

/**
 * Formulaire de saisie d'un mouvement manuel (sortie, entrée, transfert).
 * Admin uniquement.
 */
function MovementFormPanel({ items, clubs, campagnes, events, appId, onClose, onSaved }) {
  const [movType,     setMovType]     = useState("manual_out");
  const [itemId,      setItemId]      = useState("");
  const [variantId,   setVariantId]   = useState("");
  const [clubFromId,  setClubFromId]  = useState("");
  const [clubToId,    setClubToId]    = useState("");
  const [qty,         setQty]         = useState("");
  const [reason,      setReason]      = useState("");
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState("");

  const isTransfer = movType === "transfer";
  const typeLabel  = isTransfer ? "Transfert inter-clubs"
    : movType === "manual_out" ? "Sortie manuelle" : "Entrée manuelle";

  const selectedItem = items.find(i => i.id === itemId) || null;
  const activeVariants = selectedItem?.variants?.filter(v => v.active !== false) || [];

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      if (isTransfer) {
        await createTransfer({
          itemId, variantId,
          clubFromId, clubToId,
          qty: Number(qty),
          reason,
        }, appId);
      } else {
        await createManualMovement({
          type: movType,
          itemId, variantId,
          clubId: clubFromId,
          qty: Number(qty),
          reason,
        }, appId);
      }
      onSaved();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stk-panel stk-panel--form">
      <div className="stk-panel__header">
        <h3 className="stk-panel__title">{typeLabel}</h3>
        <button className="stk-panel__close" onClick={onClose}><IconX size={15} /></button>
      </div>

      <div className="stk-panel__body">
        <form onSubmit={handleSubmit} className="stk-form">

          {/* Type de mouvement */}
          <div className="stk-field">
            <label className="stk-label">Type de mouvement</label>
            <div className="stk-radio-row">
              {[
                { v: "manual_out", label: "Sortie" },
                { v: "manual_in",  label: "Entrée" },
                { v: "transfer",   label: "Transfert inter-clubs" },
              ].map(opt => (
                <label key={opt.v} className={`stk-radio-btn${movType === opt.v ? " stk-radio-btn--on" : ""}`}>
                  <input type="radio" name="movType" value={opt.v}
                    checked={movType === opt.v}
                    onChange={() => { setMovType(opt.v); setClubToId(""); }}
                    style={{ display: "none" }} />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Article */}
          <div className="stk-field">
            <label className="stk-label">Article <span className="stk-req">*</span></label>
            <select className="stk-sel" value={itemId}
              onChange={e => { setItemId(e.target.value); setVariantId(""); }}
              required>
              <option value="">Sélectionner un article…</option>
              {items.map(i => (
                <option key={i.id} value={i.id}>{i.name} — {i.sku}</option>
              ))}
            </select>
          </div>

          {/* Variante */}
          {selectedItem && (
            <div className="stk-field">
              <label className="stk-label">Variante <span className="stk-req">*</span></label>
              <select className="stk-sel" value={variantId}
                onChange={e => setVariantId(e.target.value)}
                required>
                <option value="">Sélectionner une variante…</option>
                {activeVariants.map(v => (
                  <option key={v.id} value={v.id}>{v.label || v.id}</option>
                ))}
              </select>
            </div>
          )}

          {/* Club source (ou unique pour entrée/sortie) */}
          <div className="stk-field">
            <label className="stk-label">
              {isTransfer ? "Club source" : "Club"} <span className="stk-req">*</span>
            </label>
            <select className="stk-sel" value={clubFromId}
              onChange={e => setClubFromId(e.target.value)}
              required>
              <option value="">Sélectionner un club…</option>
              {clubs.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.id}</option>
              ))}
            </select>
          </div>

          {/* Club destination (transfert uniquement) */}
          {isTransfer && (
            <div className="stk-field">
              <label className="stk-label">Club destination <span className="stk-req">*</span></label>
              <select className="stk-sel" value={clubToId}
                onChange={e => setClubToId(e.target.value)}
                required>
                <option value="">Sélectionner un club…</option>
                {clubs.filter(c => c.id !== clubFromId).map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.id}</option>
                ))}
              </select>
            </div>
          )}

          {/* Quantité */}
          <div className="stk-field">
            <label className="stk-label">Quantité <span className="stk-req">*</span></label>
            <input className="stk-input" type="number" min="1" step="1"
              placeholder="0" value={qty}
              onChange={e => setQty(e.target.value)}
              required />
          </div>

          {/* Motif */}
          {(movType === "manual_out" || isTransfer) && (
            <div className="stk-field">
              <label className="stk-label">Motif <span className="stk-req">*</span></label>
              <input className="stk-input" type="text"
                placeholder="Ex. : casse, perte, prêt club partenaire…"
                value={reason}
                onChange={e => setReason(e.target.value)}
                required />
            </div>
          )}
          {movType === "manual_in" && (
            <div className="stk-field">
              <label className="stk-label">Motif (optionnel)</label>
              <input className="stk-input" type="text"
                placeholder="Ex. : retour de prêt, stock initial…"
                value={reason}
                onChange={e => setReason(e.target.value)} />
            </div>
          )}

          {err && <div className="stk-form-err">{err}</div>}

          <div className="stk-form-actions">
            <button type="button" className="camp-btn camp-btn--secondary"
              onClick={onClose} disabled={saving}>
              Annuler
            </button>
            <button type="submit" className="camp-btn" disabled={saving}>
              {saving ? "Enregistrement…" : "Valider le mouvement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Vue liste des mouvements avec filtres article/club/type.
 */
function MovementsView({ items, clubs, campagnes, events, appId, isAdmin }) {
  const [filterItem,  setFilterItem]  = useState("");
  const [filterClub,  setFilterClub]  = useState("");
  const [filterType,  setFilterType]  = useState("");
  const [showForm,    setShowForm]    = useState(false);
  const [refreshKey,  setRefreshKey]  = useState(0);

  const movFilters = useMemo(() => {
    const f = {};
    if (filterItem) f.itemId  = filterItem;
    if (filterClub) f.clubId  = filterClub;
    if (filterType) f.type    = filterType;
    return f;
  }, [filterItem, filterClub, filterType, refreshKey]);

  const { movements, loading, error } = useStockMovements(movFilters);

  function itemName(id) {
    const it = items.find(i => i.id === id);
    return it ? it.name : id;
  }
  function variantLabel(itemId, variantId) {
    const it = items.find(i => i.id === itemId);
    const v  = it?.variants?.find(v => v.id === variantId);
    return v?.label || variantId || "—";
  }
  function clubName(id) {
    const c = clubs.find(c => String(c.id) === String(id));
    return c ? (c.name || c.id) : id;
  }

  return (
    <div className="stk-mov-view">
      {/* Barre d'outils */}
      <div className="stk-mov-toolbar">
        <div className="stk-mov-filters">
          <select className="stk-filter-sel" value={filterItem}
            onChange={e => setFilterItem(e.target.value)}>
            <option value="">Tous les articles</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <select className="stk-filter-sel" value={filterClub}
            onChange={e => setFilterClub(e.target.value)}>
            <option value="">Tous les clubs</option>
            {clubs.map(c => <option key={c.id} value={String(c.id)}>{c.name || c.id}</option>)}
          </select>
          <select className="stk-filter-sel" value={filterType}
            onChange={e => setFilterType(e.target.value)}>
            <option value="">Tous les types</option>
            <option value="manual_in">Entrée manuelle</option>
            <option value="manual_out">Sortie manuelle</option>
            <option value="transfer_out">Transfert (départ)</option>
            <option value="transfer_in">Transfert (arrivée)</option>
            <option value="reception">Réception</option>
          </select>
        </div>
        {isAdmin && (
          <button className="camp-btn stk-add-btn"
            onClick={() => setShowForm(true)}>
            <IconPlus size={14} /> Nouveau mouvement
          </button>
        )}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="stk-loading"><div className="v2-spinner" /></div>
      ) : error ? (
        <div className="stk-error">Erreur : {error.message}</div>
      ) : movements.length === 0 ? (
        <div className="stk-empty">
          <div className="stk-empty__icon"><IconBarChart size={22} /></div>
          <span className="stk-empty__title">Aucun mouvement</span>
          <span className="stk-empty__sub">
            {filterItem || filterClub || filterType
              ? "Aucun mouvement ne correspond à ces filtres."
              : "Les mouvements de stock apparaîtront ici."}
          </span>
        </div>
      ) : (
        <div className="stk-mov-list">
          {movements.map(mov => (
            <div key={mov.id}
              className={`stk-mov-row ${MOV_DIRECTION_COLOR[mov.direction] || ""}`}>
              <div className="stk-mov-row__dir">
                {mov.direction === "in"
                  ? <span className="stk-mov-badge stk-mov-badge--in">+{mov.qty}</span>
                  : <span className="stk-mov-badge stk-mov-badge--out">−{mov.qty}</span>}
              </div>
              <div className="stk-mov-row__info">
                <div className="stk-mov-row__article">
                  {itemName(mov.itemId)}
                  <span className="stk-mov-row__variant"> · {variantLabel(mov.itemId, mov.variantId)}</span>
                </div>
                <div className="stk-mov-row__meta">
                  <span className="stk-mov-type">{MOV_TYPE_LABELS[mov.type] || mov.type}</span>
                  <span className="stk-mov-sep">·</span>
                  <span>{clubName(mov.clubId)}</span>
                  {mov.reason && <><span className="stk-mov-sep">·</span><span className="stk-mov-reason">"{mov.reason}"</span></>}
                </div>
              </div>
              <div className="stk-mov-row__date">
                {mov.at ? fmtDate(mov.at) : "—"}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulaire de saisie */}
      {showForm && isAdmin && (
        <MovementFormPanel
          items={items}
          clubs={clubs}
          campagnes={campagnes}
          events={events}
          appId={appId}
          onClose={() => setShowForm(false)}
          onSaved={() => { setRefreshKey(k => k + 1); }}
        />
      )}
    </div>
  );
}

function StocksView({ currentUser, appId, campagnes, events, clubs, onBack }) {
  const isAdmin = currentUser?.admin === true;
  const { firebaseUser } = useAuth();
  const authUid = firebaseUser?.uid || null;
  const { items, loading, error } = useStockItems();

  const [stockView,    setStockView]   = useState("articles"); // "articles" | "receipts" | "movements"
  const [search,       setSearch]      = useState("");
  const [filterCamp,   setFilterCamp]  = useState("");
  const [filterEvent,  setFilterEvent] = useState("");
  const [filterCat,    setFilterCat]   = useState("");
  const [selectedId,   setSelectedId]  = useState(null);
  const [showCreate,   setShowCreate]  = useState(false);
  const [editItem,     setEditItem]    = useState(null);
  const [refreshKey,   setRefreshKey]  = useState(0);

  function handleUpdated() { setRefreshKey(k => k + 1); }

  const selectedItem = useMemo(() =>
    items.find(i => i.id === selectedId) || null
  , [items, selectedId, refreshKey]);

  const filtered = useMemo(() => {
    let res = items;
    if (filterCamp)  res = res.filter(i => String(i.campaignId) === filterCamp);
    if (filterEvent) res = res.filter(i => String(i.eventId) === filterEvent);
    if (filterCat)   res = res.filter(i => i.category === filterCat);
    if (search) {
      const q = strSearch(search);
      res = res.filter(i =>
        strSearch(i.name).includes(q) ||
        strSearch(i.sku).includes(q)
      );
    }
    return res;
  }, [items, filterCamp, filterEvent, filterCat, search, refreshKey]);

  const kpiArticles = items.length;
  const kpiVariants = items.reduce((s, i) => s + (i.variants?.filter(v => v.active !== false).length || 0), 0);
  const kpiLinks    = new Set([
    ...items.map(i => i.campaignId).filter(Boolean),
    ...items.map(i => i.eventId).filter(Boolean),
  ]).size;

  // Campagnes et événements présents dans les items
  const campPresents  = useMemo(() => {
    const ids = new Set(items.map(i => i.campaignId).filter(Boolean).map(String));
    return campagnes.filter(c => ids.has(String(c.id)) && c.name);
  }, [items, campagnes]);
  const eventPresents = useMemo(() => {
    const ids = new Set(items.map(i => i.eventId).filter(Boolean).map(String));
    return events.filter(e => ids.has(String(e.id)) && (e.title || e.name));
  }, [items, events]);

  return (
    <div className="stk-page">
      {/* ── Header ── */}
      <div className="stk-header">
        <div className="stk-header__left">
          <button className="stk-back-btn" onClick={onBack}>
            <IconChevronRight size={13} style={{ transform: "rotate(180deg)" }} />
            Ressources
          </button>
          <div>
            <h2 className="stk-header__title">Stocks & matériel</h2>
            <p className="stk-header__sub">Ressources physiques liées aux campagnes et événements</p>
          </div>
        </div>
        {isAdmin && stockView === "articles" && (
          <button className="camp-btn stk-add-btn" onClick={() => setShowCreate(true)}>
            <IconPlus size={14} /> Nouvel article
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="stk-tabs">
        <button className={`stk-tab${stockView === "articles" ? " stk-tab--active" : ""}`}
          onClick={() => setStockView("articles")}>
          <IconLayers size={13} /> Articles
        </button>
        <button className={`stk-tab${stockView === "receipts" ? " stk-tab--active" : ""}`}
          onClick={() => setStockView("receipts")}>
          <IconInbox size={13} /> Réceptions
        </button>
        <button className={`stk-tab${stockView === "movements" ? " stk-tab--active" : ""}`}
          onClick={() => setStockView("movements")}>
          <IconBarChart size={13} /> Mouvements
        </button>
      </div>

      {/* ── KPI ── */}
      <div className="stk-kpi-row">
        <div className="stk-kpi stk-kpi--blue">
          <div className="stk-kpi__val">{loading ? "…" : kpiArticles}</div>
          <div className="stk-kpi__label">Articles</div>
        </div>
        <div className="stk-kpi stk-kpi--purple">
          <div className="stk-kpi__val">{loading ? "…" : kpiVariants}</div>
          <div className="stk-kpi__label">Variantes actives</div>
        </div>
        <div className="stk-kpi stk-kpi--yellow">
          <div className="stk-kpi__val">{loading ? "…" : kpiLinks}</div>
          <div className="stk-kpi__label">Campagnes / événements</div>
        </div>
        <div className="stk-kpi stk-kpi--green stk-kpi--na">
          <div className="stk-kpi__val">—</div>
          <div className="stk-kpi__label">Alertes stock</div>
          <div className="stk-kpi__hint">Disponible en P4</div>
        </div>
      </div>

      {/* ── Contenu selon onglet ── */}
      {stockView === "receipts" && (
        <ReceiptsView
          currentUser={currentUser}
          appId={appId}
          authUid={authUid}
          items={items}
          clubs={clubs}
          campagnes={campagnes}
          events={events}
        />
      )}

      {stockView === "movements" && (
        <MovementsView
          items={items}
          clubs={clubs}
          campagnes={campagnes}
          events={events}
          appId={appId}
          isAdmin={isAdmin}
        />
      )}

      {stockView === "articles" && <div className="stk-content">
        {/* Colonne liste */}
        <div className="stk-list-col">
          {/* Filtres */}
          <div className="stk-filters">
            <div className="rsrc-search-wrap" style={{ flex: 1 }}>
              <IconSearch size={13} className="rsrc-search-icon" />
              <input className="rsrc-search" placeholder="Rechercher un article…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="stk-filter-sel" value={filterCamp} onChange={e => setFilterCamp(e.target.value)}>
              <option value="">Toutes campagnes</option>
              {campPresents.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </select>
            <select className="stk-filter-sel" value={filterEvent} onChange={e => setFilterEvent(e.target.value)}>
              <option value="">Tous événements</option>
              {eventPresents.map(ev => <option key={ev.id} value={String(ev.id)}>{ev.title || ev.name}</option>)}
            </select>
            <select className="stk-filter-sel" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="">Toutes catégories</option>
              {STK_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Liste */}
          {loading ? (
            <div className="stk-loading"><div className="v2-spinner" /></div>
          ) : error ? (
            <div className="stk-error">Erreur de chargement : {error.message}</div>
          ) : filtered.length === 0 ? (
            <div className="stk-empty">
              {items.length === 0 ? (
                <>
                  <div className="stk-empty__icon"><IconFolder size={22} /></div>
                  <span className="stk-empty__title">Aucun article pour le moment</span>
                  <span className="stk-empty__sub">
                    {isAdmin
                      ? "Créez votre premier article pour préparer les futurs stocks liés à vos campagnes et événements."
                      : "Aucun article disponible pour l'instant."}
                  </span>
                </>
              ) : (
                <>
                  <div className="stk-empty__icon"><IconSearch size={20} /></div>
                  <span className="stk-empty__title">Aucun résultat</span>
                  <span className="stk-empty__sub">Aucun article ne correspond à ces filtres.</span>
                </>
              )}
            </div>
          ) : (
            <div className="stk-cards">
              {filtered.map(item => (
                <ArticleCard
                  key={item.id}
                  item={item}
                  campagnes={campagnes}
                  events={events}
                  selected={selectedId === item.id}
                  onClick={i => { setSelectedId(i.id); setEditItem(null); }}
                />
              ))}
            </div>
          )}

          {/* Prochaine étape P6 */}
          {!loading && (
            <div className="stk-upcoming-row">
              {[
                { label: "Inventaires", desc: "Comptage et ajustement des niveaux réels.", phase: "P6", mod: "p6" },
              ].map(s => (
                <div key={s.label} className={`stk-upcoming-card stk-upcoming-card--${s.mod}`}>
                  <div className="stk-upcoming-card__top">
                    <span className="stk-upcoming-card__label">{s.label}</span>
                    <span className="stk-upcoming-card__badge">À venir</span>
                  </div>
                  <p className="stk-upcoming-card__desc">{s.desc}</p>
                  <span className="stk-upcoming-card__phase">{s.phase}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panneau détail article */}
        {selectedItem && !editItem && (
          <ArticleDetail
            item={selectedItem}
            campagnes={campagnes}
            events={events}
            isAdmin={isAdmin}
            appId={appId}
            allItems={items}
            onClose={() => setSelectedId(null)}
            onUpdated={handleUpdated}
            onEdit={() => setEditItem(selectedItem)}
          />
        )}

        {/* Panneau édition article */}
        {editItem && isAdmin && (
          <ArticlePanel
            initial={editItem}
            allItems={items}
            campagnes={campagnes}
            events={events}
            appId={appId}
            editMode
            onClose={() => setEditItem(null)}
            onSaved={() => { handleUpdated(); setEditItem(null); }}
          />
        )}
      </div>
      }

      {/* Panneau création article (hors stk-content pour positionnement fixe) */}
      {stockView === "articles" && showCreate && isAdmin && (
        <ArticlePanel
          allItems={items}
          campagnes={campagnes}
          events={events}
          appId={appId}
          onClose={() => setShowCreate(false)}
          onSaved={() => { handleUpdated(); setShowCreate(false); }}
        />
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

  const [mode,          setMode]         = useState("cockpit");   // "cockpit" | "bibliotheque" | "stocks"
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

  function handleShowStocks() {
    setMode("stocks");
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
            onShowStocks={handleShowStocks}
            onSelectRessource={handleSelectRessource}
            onAdd={() => setShowCreate(true)}
          />
        ) : mode === "stocks" ? (
          <StocksView
            currentUser={currentUser}
            appId={appId}
            campagnes={campagnes}
            events={events}
            clubs={clubs}
            onBack={() => setMode("cockpit")}
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
