/**
 * DashboardV2 — Cockpit V2.
 * Lecture Firestore V1 read-only via useV1Data.js. Aucune écriture.
 *
 * Données réelles : useTasks, useRequests, usePublications,
 *                   useObjectives, useProjects, useCalendarEvents
 *
 * Mocks clairement isolés (constantes MOCK_*) :
 *   MOCK_EMAILS   → boîte mail, en attente intégration OVH/Zimbra (À VÉRIFIER)
 *   MOCK_CAMPAIGN → campagne de démonstration si ep:projects est vide
 */
import React, { useMemo } from "react";
import {
  useTasks, useRequests, usePublications, useObjectives,
  useProjects, useCalendarEvents,
  filterTodayTasks, filterOpenRequests, filterPendingValidations, filterActiveObjectives,
} from "../hooks/useV1Data";
import {
  IconCheckSquare, IconInbox, IconLayers, IconMail,
  IconTarget, IconMegaphone,
} from "../icons";

/* ─────────────────────────────────────────────────────────
   MOCKS
   ───────────────────────────────────────────────────────── */

/** @mock Boîte mail — intégration OVH/Zimbra À VÉRIFIER */
const MOCK_EMAILS = [
  {
    id: "m1", initials: "TC", avatarBg: "#0F56B8",
    from: "Tennis Padel Club Saint-Priest",
    subject: "Demande de visuels pour notre tournoi",
    preview: "Bonjour, nous aurions besoin d'un flyer pour le 15 octobre…",
    time: "10:24", unread: true,
  },
  {
    id: "m2", initials: "LB", avatarBg: "#FB8500",
    from: "La Boisse Padel",
    subject: "Re: Partenariat tournoi — infos",
    preview: "Parfait, je confirme la disponibilité du terrain.",
    time: "09:41", unread: true,
  },
  {
    id: "m3", initials: "MP", avatarBg: "#1a7a38",
    from: "Mâcon Padel",
    subject: "Question sur la campagne Instagram",
    preview: "Pouvez-vous modifier la version mobile du visuel ?",
    time: "Hier", unread: false,
  },
  {
    id: "m4", initials: "DP", avatarBg: "#9896a0",
    from: "Direction — Esprit Padel",
    subject: "Merci pour les visuels !",
    preview: "Super travail sur la dernière campagne.",
    time: "Hier", unread: false,
  },
];

/** @mock Campagne — utilisé uniquement si ep:projects est vide */
const MOCK_CAMPAIGN = {
  id: "mock-1",
  title: "Octobre Rose 2026",
  clubs: ["Saint-Priest", "La Boisse", "Mâcon"],
  progress: 68,
  deadline: "2026-10-31",
  isMock: true,
};

/* ─────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────── */

function greetingText(firstName) {
  const h = new Date().getHours();
  const n = firstName || "Mélissa";
  if (h < 12) return `Bonjour, ${n}`;
  if (h < 18) return `Bon après-midi, ${n}`;
  return `Bonsoir, ${n}`;
}

function formatDate() {
  const now = new Date();
  const s = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function shortDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt)) return null;
  const diff = Math.round((dt - Date.now()) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  if (diff === -1) return "Hier";
  return dt.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function pct(n) { return Math.min(100, Math.max(0, Number(n) || 0)); }

function statusVariant(s = "") {
  const v = s.toLowerCase();
  if (v.includes("urgent") || v.includes("haute")) return "red";
  if (v.includes("cours") || v.includes("actif")) return "blue";
  if (v.includes("valid") || v.includes("review")) return "yellow";
  if (v.includes("term") || v.includes("done") || v.includes("livr")) return "green";
  if (v.includes("reç") || v.includes("nouveau") || v.includes("ouverte")) return "orange";
  return "gray";
}

const OBJ_COLORS = ["yellow", "blue", "orange", "green"];

/* ─────────────────────────────────────────────────────────
   ATOMS
   ───────────────────────────────────────────────────────── */

function Badge({ variant = "gray", children }) {
  return <span className={`v2-badge v2-badge--${variant}`}>{children}</span>;
}

function Skeleton({ w = "100%", h = 12 }) {
  return <div className="v2-skel" style={{ width: w, height: h, borderRadius: 4, marginBottom: 6 }} />;
}

function SunIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="18" cy="18" r="8" fill="#FEB601"/>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
        <line
          key={i}
          x1={18 + 11 * Math.cos(deg * Math.PI / 180)}
          y1={18 + 11 * Math.sin(deg * Math.PI / 180)}
          x2={18 + 14.5 * Math.cos(deg * Math.PI / 180)}
          y2={18 + 14.5 * Math.sin(deg * Math.PI / 180)}
          stroke="#FEB601"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

function ChevLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function ChevRight() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function ObjIcon({ color }) {
  const icons = {
    yellow: <IconTarget size={18} />,
    blue:   <IconMegaphone size={18} />,
    orange: <IconCheckSquare size={18} />,
    green:  <IconLayers size={18} />,
  };
  return icons[color] || icons.blue;
}

/* ─────────────────────────────────────────────────────────
   COUNTER CARD
   ───────────────────────────────────────────────────────── */
function CounterCard({ icon: Icon, value, label, sub, color, onClick }) {
  return (
    <div
      className={`v2-counter v2-counter--${color}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
    >
      <div className="v2-counter__top">
        <div className="v2-counter__icon"><Icon size={20} /></div>
        <div className="v2-counter__arrow"><ChevRight /></div>
      </div>
      <div>
        <div className="v2-counter__value">{value}</div>
        <div className="v2-counter__label">{label}</div>
        {sub && <div className="v2-counter__sub">{sub}</div>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   CAMPAIGN BANNER — dark visual
   ───────────────────────────────────────────────────────── */
function CampaignBanner({ campaign, onNavigate }) {
  if (!campaign) {
    return (
      <div className="v2-campaign-empty">
        <div className="v2-campaign-empty__icon"><IconMegaphone size={36} /></div>
        <div className="v2-campaign-empty__title">Aucune campagne active</div>
        <div className="v2-campaign-empty__sub">Créez votre première campagne pour la suivre ici.</div>
        <button
          className="v2-btn v2-btn--primary v2-btn--sm"
          style={{ marginTop: 8 }}
          onClick={() => onNavigate("campagnes")}
        >
          Voir les campagnes
        </button>
      </div>
    );
  }

  const p = pct(campaign.progress || campaign.progression);
  const clubs = campaign.clubs || campaign.clubsIds || [];
  const dead = shortDate(campaign.deadline || campaign.dateEcheance || campaign.endDate);

  return (
    <div
      className="v2-campaign-banner"
      onClick={() => onNavigate("campagnes")}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onNavigate("campagnes")}
      aria-label={`Campagne : ${campaign.title || "—"}`}
    >
      <div className="v2-campaign-banner__left">
        <div className="v2-campaign-banner__eyebrow">
          <span className="v2-campaign-banner__dot" />
          Campagne en cours
          {campaign.isMock && (
            <span style={{ background: "rgba(255,255,255,.10)", borderRadius: 20, padding: "1px 7px", fontSize: 9, color: "rgba(255,255,255,.45)", marginLeft: 6, fontStyle: "normal", fontWeight: 500 }}>
              Aperçu
            </span>
          )}
        </div>

        <div className="v2-campaign-banner__title">
          {campaign.title || campaign.name || "—"}
        </div>

        {clubs.length > 0 && (
          <div className="v2-campaign-banner__clubs">
            {clubs.slice(0, 3).map((c, i) => (
              <span key={i} className="v2-campaign-banner__club">{c}</span>
            ))}
          </div>
        )}

        <div className="v2-campaign-banner__progress-area">
          <div className="v2-campaign-banner__progress-bar">
            <div className="v2-campaign-banner__progress-fill" style={{ width: `${p}%` }} />
          </div>
          <span className="v2-campaign-banner__pct">
            {p} % complétée{dead ? ` · Échéance ${dead}` : ""}
          </span>
        </div>
      </div>

      <div className="v2-campaign-banner__right">
        <div className="v2-campaign-banner__quote">
          Plus<br />de padel<br />ensemble.
        </div>
        <button
          className="v2-campaign-banner__cta"
          onClick={(e) => { e.stopPropagation(); onNavigate("campagnes"); }}
          aria-label="Ouvrir la campagne"
        >
          <ChevRight />
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   MAIL CARD — @mock OVH/Zimbra À VÉRIFIER
   ───────────────────────────────────────────────────────── */
function MailCard({ onNavigate }) {
  return (
    <div className="v2-block">
      <div className="v2-block-header">
        <span className="v2-block-header__label">Boîte mail</span>
        <span className="v2-block-header__link" onClick={() => onNavigate("mail")}>
          Voir tout <ChevRight />
        </span>
      </div>
      <div className="v2-block-divider" />
      {MOCK_EMAILS.map((email) => (
        <div key={email.id} className="v2-mail-row" onClick={() => onNavigate("mail")}>
          <div className="v2-mail-row__avatar">
            <span
              className="v2-avatar v2-avatar--sm"
              style={{ background: email.avatarBg, color: "#fff", fontWeight: 700 }}
            >
              {email.initials}
            </span>
          </div>
          <div className="v2-mail-row__body">
            <div className="v2-mail-row__top">
              <span className="v2-mail-row__from" style={{ fontWeight: email.unread ? 700 : 500 }}>
                {email.from}
              </span>
              <span className="v2-mail-row__time">{email.time}</span>
            </div>
            <div className="v2-mail-row__subject">{email.subject}</div>
            <div className="v2-mail-row__preview">{email.preview}</div>
          </div>
          {email.unread && (
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--ep-orange)", flexShrink: 0, marginTop: 4 }} />
          )}
        </div>
      ))}
      <div className="v2-mail-mock-notice">
        Données de démonstration — intégration OVH/Zimbra à configurer
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   OBJECTIVES CARD — icon circle style
   ───────────────────────────────────────────────────────── */
function ObjectivesCard({ objectives, loading, onNavigate }) {
  return (
    <div className="v2-block">
      <div className="v2-block-header">
        <span className="v2-block-header__label">Objectifs du mois</span>
        <span className="v2-block-header__link" onClick={() => onNavigate("objectifs")}>
          Voir tous <ChevRight />
        </span>
      </div>
      <div className="v2-block-divider" />

      {loading ? (
        <div style={{ padding: "14px 18px" }}>
          <Skeleton /><Skeleton w="75%" /><Skeleton w="55%" />
        </div>
      ) : objectives.length === 0 ? (
        <div className="v2-empty" style={{ padding: "28px 18px" }}>
          <div className="v2-empty__icon"><IconTarget size={28} /></div>
          <div className="v2-empty__title">Aucun objectif actif</div>
        </div>
      ) : (
        objectives.slice(0, 3).map((obj, i) => {
          const color = OBJ_COLORS[i % OBJ_COLORS.length];
          const p = pct(obj.progress || obj.progression);
          const current = obj.current ?? obj.valeurActuelle ?? null;
          const target  = obj.target  ?? obj.valeurCible   ?? null;
          const countLabel = (current !== null && target !== null)
            ? `${current} / ${target}`
            : `${p} %`;

          return (
            <div key={obj.id || i} className="v2-obj-item" onClick={() => onNavigate("objectifs")}>
              <div className={`v2-obj-item__icon v2-obj-item__icon--${color}`}>
                <ObjIcon color={color} />
              </div>
              <div className="v2-obj-item__body">
                <div className="v2-obj-item__top">
                  <span className="v2-obj-item__name">{obj.title || obj.titre || obj.name || "Objectif"}</span>
                  <span className="v2-obj-item__count">{countLabel}</span>
                </div>
                <div className={`v2-obj-progress v2-obj-progress--${color}`}>
                  <div className="v2-obj-progress__bar" style={{ width: `${p}%` }} />
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   AGENDA CARD — full right column
   ───────────────────────────────────────────────────────── */
function AgendaCard({ events, loading, onNavigate }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayDay = now.getDate();

  const monthName = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const startOffset = (firstDayOfMonth + 6) % 7;

  const eventsByDay = useMemo(() => {
    const map = {};
    (events || []).forEach((e) => {
      const d = e.date || e.startDate || e.dateDebut || e.start;
      if (!d) return;
      const dt = new Date(d);
      if (isNaN(dt)) return;
      const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [events]);

  const todayKey = `${year}-${month}-${todayDay}`;
  const todayEvents = useMemo(() => eventsByDay[todayKey] || [], [eventsByDay, todayKey]);

  const cells = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ day: daysInPrev - startOffset + 1 + i, other: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, isToday: d === todayDay });
  }
  const rem = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= rem; d++) cells.push({ day: d, other: true });

  const DOW = ["L", "M", "Me", "J", "V", "S", "D"];
  const EVT_COLORS = ["#0F56B8", "#FEB601", "#FB8500", "#1a7a38"];

  const todayLabel = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="v2-block" style={{ display: "flex", flexDirection: "column" }}>
      <div className="v2-block-header">
        <span className="v2-block-header__label">Mon agenda</span>
        <span className="v2-block-header__link" onClick={() => onNavigate("calendrier")}>
          Voir tout <ChevRight />
        </span>
      </div>
      <div className="v2-block-divider" />

      {/* Mini calendar */}
      <div className="v2-minical">
        <div className="v2-minical__header">
          <span className="v2-minical__month">{monthName}</span>
          <div className="v2-minical__nav">
            <button className="v2-minical__nav-btn" aria-label="Mois précédent"><ChevLeft /></button>
            <button className="v2-minical__nav-btn" aria-label="Mois suivant"><ChevRight /></button>
          </div>
        </div>
        <div className="v2-minical__grid">
          {DOW.map((d) => <div key={d} className="v2-minical__dow">{d}</div>)}
          {cells.map((c, i) => {
            const key = `${year}-${month}-${c.day}`;
            const evts = !c.other ? (eventsByDay[key] || []) : [];
            return (
              <div
                key={i}
                className={[
                  "v2-minical__day",
                  c.isToday ? "v2-minical__day--today" : "",
                  c.other   ? "v2-minical__day--other" : "",
                ].filter(Boolean).join(" ")}
              >
                {c.day}
                {evts.length > 0 && (
                  <div className="v2-minical__events">
                    {evts.slice(0, 2).map((_, j) => (
                      <div key={j} className="v2-minical__dot v2-minical__dot--blue" />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Today events */}
      <div className="v2-agenda-events">
        <div className="v2-agenda-date-label">
          {todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)}
        </div>
        {loading ? (
          <div><Skeleton /><Skeleton w="70%" /></div>
        ) : todayEvents.length === 0 ? (
          <div className="v2-agenda-empty">Aucun événement aujourd'hui</div>
        ) : (
          todayEvents.slice(0, 4).map((ev, i) => {
            const startT = ev.startTime || ev.heure
              || (ev.start ? new Date(ev.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : null);
            return (
              <div key={ev.id || i} className="v2-agenda-event">
                <span className="v2-agenda-event__time">{startT || "—"}</span>
                <div className="v2-agenda-event__dot" style={{ background: EVT_COLORS[i % EVT_COLORS.length] }} />
                <div className="v2-agenda-event__body">
                  <div className="v2-agenda-event__name">{ev.title || ev.titre || ev.name || "Événement"}</div>
                  {ev.location && <div className="v2-agenda-event__sub">{ev.location}</div>}
                </div>
              </div>
            );
          })
        )}
      </div>

      <button className="v2-agenda-add-btn" onClick={() => onNavigate("calendrier")}>
        + Ajouter un événement
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   DEMANDES & TÂCHES RÉCENTES
   ───────────────────────────────────────────────────────── */
function RecentDemandsTasks({ tasks, requests, loadingTasks, loadingReq, onNavigate }) {
  const combined = useMemo(() => {
    const items = [];
    const closed = new Set(["clôturée", "closed", "refusée", "refused", "rejected", "done", "completed"]);

    (requests || []).forEach((r) => {
      if (!r || closed.has((r.status || "").toLowerCase())) return;
      items.push({
        type: "demande", id: r.id,
        title: r.title || r.titre || r.name || "Demande",
        club: r.club, assignedTo: r.assignedTo || r.responsable,
        status: r.status || r.statut || "Reçue",
        date: r.createdAt || r.date || r.updatedAt,
      });
    });

    (tasks || []).forEach((t) => {
      if (!t || closed.has((t.status || "").toLowerCase()) || t.done === true) return;
      items.push({
        type: "tache", id: t.id,
        title: t.title || t.titre || t.name || "Tâche",
        club: t.club, assignedTo: t.assignedTo || t.assignee,
        status: t.status || t.statut || "À faire",
        date: t.createdAt || t.dueDate || t.deadline,
      });
    });

    items.sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return db - da;
    });
    return items.slice(0, 5);
  }, [tasks, requests]);

  const loading = loadingTasks || loadingReq;

  return (
    <div className="v2-block">
      <div className="v2-block-header">
        <span className="v2-block-header__label">Demandes clubs & tâches récentes</span>
        {!loading && combined.length > 0 && (
          <span className="v2-block-header__count">{combined.length}</span>
        )}
        <span className="v2-block-header__link" onClick={() => onNavigate("demandes")}>
          Voir tout <ChevRight />
        </span>
      </div>
      <div className="v2-block-divider" />

      {loading ? (
        <div style={{ padding: "14px 18px" }}>
          <Skeleton /><Skeleton w="80%" /><Skeleton w="65%" />
        </div>
      ) : combined.length === 0 ? (
        <div className="v2-empty" style={{ padding: "28px 18px" }}>
          <div className="v2-empty__icon"><IconInbox size={28} /></div>
          <div className="v2-empty__title">Aucun élément récent</div>
        </div>
      ) : (
        combined.map((item, i) => (
          <div
            key={item.id || i}
            className="v2-recent-row"
            onClick={() => onNavigate(item.type === "demande" ? "demandes" : "projets")}
          >
            <div className="v2-recent-row__type">
              {item.type === "demande"
                ? <Badge variant="orange">Demande</Badge>
                : <Badge variant="blue">Tâche</Badge>}
            </div>
            <div className="v2-recent-row__body">
              <div className="v2-recent-row__title">{item.title}</div>
              <div className="v2-recent-row__meta">
                {item.club && <><span>{item.club}</span><div className="v2-recent-row__meta-dot" /></>}
                {item.assignedTo && typeof item.assignedTo === "string" && (
                  <><span>{item.assignedTo}</span><div className="v2-recent-row__meta-dot" /></>
                )}
                {item.date && <span>{shortDate(item.date)}</span>}
              </div>
            </div>
            <div className="v2-recent-row__right">
              <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   DASHBOARD V2 — ROOT
   ───────────────────────────────────────────────────────── */
export default function DashboardV2({ appId, currentUser, onNavigate }) {
  const { tasks,        loading: loadingTasks } = useTasks();
  const { requests,     loading: loadingReq   } = useRequests();
  const { publications, loading: loadingPub   } = usePublications();
  const { objectives,   loading: loadingObj   } = useObjectives();
  const { projects,     loading: loadingProj  } = useProjects();
  const { events,       loading: loadingCal   } = useCalendarEvents();

  const todayTasks         = useMemo(() => filterTodayTasks(tasks, appId),        [tasks, appId]);
  const openRequests       = useMemo(() => filterOpenRequests(requests),           [requests]);
  const pendingValidations = useMemo(() => filterPendingValidations(publications), [publications]);
  const activeObjectives   = useMemo(() => filterActiveObjectives(objectives),     [objectives]);

  const activeCampaign = useMemo(() => {
    if (loadingProj) return null;
    if (projects.length > 0) {
      const active = projects.find((p) => {
        const s = (p?.status || p?.statut || "").toLowerCase();
        return !s || s === "actif" || s === "active" || s === "en cours";
      });
      return active ? { ...active, isMock: false } : null;
    }
    return { ...MOCK_CAMPAIGN, isMock: true };
  }, [projects, loadingProj]);

  const firstName = (currentUser?.name || "Mélissa Le Guen").split(" ")[0];

  return (
    <div className="v2-dashboard">

      {/* ── HERO ── */}
      <div className="v2-dash-hero">
        <div className="v2-dash-hero__left">
          <div className="v2-dash-hero__greeting">
            {greetingText(firstName)}
            <span className="v2-dash-hero__sun"><SunIcon /></span>
          </div>
          <div className="v2-dash-hero__sub">Voici ce qui vous attend aujourd'hui.</div>
        </div>
        <div className="v2-dash-hero__right">
          <div className="v2-dash-hero__date-label">{formatDate()}</div>
          <div className="v2-dash-hero__quote">
            "Des idées bien communiquées font grandir le padel."
            <span className="v2-dash-hero__quote-attr">— Esprit Padel</span>
          </div>
        </div>
      </div>

      {/* ── CORPS : 4 cartes + campagne/mail/obj | agenda + récents ── */}
      <div className="v2-dash-content">

        {/* Colonne principale */}
        <div className="v2-dash-main">

          {/* 4 counter cards — dans la colonne principale pour aligner avec l'agenda */}
          <div className="v2-dash-counters">
            <CounterCard
              icon={IconCheckSquare}
              value={loadingTasks ? "—" : todayTasks.length}
              label="À traiter aujourd'hui"
              sub={todayTasks.length > 0 ? `${todayTasks.length} tâche${todayTasks.length > 1 ? "s" : ""} en attente` : "Aucune tâche urgente"}
              color="yellow"
              onClick={() => onNavigate("projets")}
            />
            <CounterCard
              icon={IconMail}
              value="—"
              label="Boîte mail"
              sub="Non connectée"
              color="blue"
              onClick={() => onNavigate("mail")}
            />
            <CounterCard
              icon={IconInbox}
              value={loadingReq ? "—" : openRequests.length}
              label="Demandes clubs"
              sub="demandes ouvertes"
              color="orange"
              onClick={() => onNavigate("demandes")}
            />
            <CounterCard
              icon={IconLayers}
              value={loadingPub ? "—" : pendingValidations.length}
              label="Validations"
              sub="contenus à valider"
              color="gray"
              onClick={() => onNavigate("contenus")}
            />
          </div>

          <CampaignBanner campaign={activeCampaign} onNavigate={onNavigate} />

          <div className="v2-dash-row">
            <MailCard onNavigate={onNavigate} />
            <ObjectivesCard
              objectives={activeObjectives}
              loading={loadingObj}
              onNavigate={onNavigate}
            />
          </div>
        </div>

        {/* Colonne droite : agenda + demandes & tâches récentes */}
        <div className="v2-dash-agenda">
          <AgendaCard
            events={events}
            loading={loadingCal}
            onNavigate={onNavigate}
          />
          <RecentDemandsTasks
            tasks={tasks}
            requests={requests}
            loadingTasks={loadingTasks}
            loadingReq={loadingReq}
            onNavigate={onNavigate}
          />
        </div>
      </div>
    </div>
  );
}
