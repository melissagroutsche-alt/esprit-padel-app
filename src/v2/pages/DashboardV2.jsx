/**
 * DashboardV2 — Cockpit principal V2.
 * Lecture Firestore V1 read-only. Aucune écriture.
 *
 * Données réelles (via useV1Data.js):
 *   - useTasks       → ep:tasks       : À traiter aujourd'hui
 *   - useRequests    → ep:requests    : Demandes clubs + agrégation récents
 *   - usePublications→ ep:publications: Validations en attente
 *   - useObjectives  → ep:objectives  : Objectifs actifs
 *   - useProjects    → ep:projects    : Campagne active (fallback mock si vide)
 *   - useCalendarEvents → ep:events   : Agenda mini-calendrier
 *
 * Mocks clairement isolés (constantes MOCK_*):
 *   - MOCK_EMAILS    : Boîte mail — en attente intégration OVH/Zimbra (À VÉRIFIER)
 *   - MOCK_CAMPAIGN  : Campagne active si ep:projects vide
 */
import React, { useMemo } from "react";
import {
  useTasks, useRequests, usePublications, useObjectives,
  useProjects, useCalendarEvents,
  filterTodayTasks, filterOpenRequests, filterPendingValidations, filterActiveObjectives,
} from "../hooks/useV1Data";
import {
  IconCheckSquare, IconInbox, IconLayers, IconMail,
  IconTarget, IconMegaphone, IconChevronRight,
} from "../icons";

/* ─────────────────────────────────────────────────────────
   MOCKS — données de présentation temporaires
   À remplacer quand les modules correspondants seront connectés.
   Aucune écriture Firestore.
   ───────────────────────────────────────────────────────── */

/** @mock Boîte mail — intégration OVH/Zimbra À VÉRIFIER */
const MOCK_EMAILS = [
  {
    id: "mock-mail-1",
    from: "Antoine Martin",
    initials: "AM",
    avatarColor: "blue",
    subject: "Re: JPO Saint-Priest — Validation programme",
    preview: "Parfait pour le 12 octobre, je confirme la disponibilité.",
    time: "10:32",
    status: "a_traiter",
  },
  {
    id: "mock-mail-2",
    from: "Comm. Saint-Priest",
    initials: "CS",
    avatarColor: "orange",
    subject: "Flyer Octobre Rose — Retours visuels",
    preview: "Pouvez-vous modifier les couleurs pour la version digitale ?",
    time: "Hier",
    status: "important",
  },
  {
    id: "mock-mail-3",
    from: "Direction Mâcon",
    initials: "DM",
    avatarColor: "green",
    subject: "Planning tournoi novembre 2026",
    preview: "Nous aurions besoin d'un visuel pour l'affichage en club.",
    time: "18 sept.",
    status: "en_attente",
  },
];

/** @mock Campagne active — utilisé si ep:projects est vide */
const MOCK_CAMPAIGN = {
  id: "mock-camp-1",
  title: "Octobre Rose 2026",
  description: "Action mensuelle de sensibilisation au cancer du sein",
  progress: 68,
  clubs: ["Saint-Priest", "La Boisse", "Mâcon"],
  deadline: "2026-10-31",
  responsible: "Mélissa Le Guen",
  status: "En cours",
  isMock: true,
};

/* ─────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────── */

function greet(name) {
  const h = new Date().getHours();
  const first = (name || "vous").split(" ")[0];
  if (h < 12) return `Bonjour, ${first}`;
  if (h < 18) return `Bon après-midi, ${first}`;
  return `Bonsoir, ${first}`;
}

function formatDateFull() {
  const now = new Date();
  const jour = now.toLocaleDateString("fr-FR", { weekday: "long" });
  const date = now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return { jour, date };
}

function pct(n) { return Math.min(100, Math.max(0, Number(n) || 0)); }

function urgencyVariant(item) {
  const u = (item?.urgency || item?.priority || "").toLowerCase();
  if (u === "haute" || u === "high" || u === "urgent") return "red";
  if (u === "normale" || u === "normal") return "blue";
  return "gray";
}

function statusVariant(s) {
  const v = (s || "").toLowerCase();
  if (v.includes("urgent") || v.includes("haute")) return "red";
  if (v.includes("cours") || v.includes("progress")) return "blue";
  if (v.includes("valid") || v.includes("review")) return "yellow";
  if (v.includes("term") || v.includes("done") || v.includes("livr")) return "green";
  if (v.includes("reç") || v.includes("nouveau")) return "orange";
  return "gray";
}

function shortDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  const now = new Date();
  const diffDays = Math.round((dt - now) / 86400000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Demain";
  if (diffDays === -1) return "Hier";
  return dt.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const AVATAR_COLORS = {
  blue: "var(--ep-blue)",
  orange: "var(--ep-orange)",
  green: "var(--green)",
  yellow: "var(--ep-yellow)",
  red: "var(--red)",
};

/* ─────────────────────────────────────────────────────────
   SUB-COMPONENTS
   ───────────────────────────────────────────────────────── */

function Badge({ variant = "gray", children, dot = false }) {
  return (
    <span className={`v2-badge v2-badge--${variant}${dot ? " v2-badge--dot" : ""}`}>
      {children}
    </span>
  );
}

function Skeleton({ w = "100%", h = 13 }) {
  return <div className="v2-skel" style={{ width: w, height: h, borderRadius: 4, marginBottom: 6 }} />;
}

/** Counter card */
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
        <div className="v2-counter__icon">
          <Icon size={18} />
        </div>
        <div className="v2-counter__arrow">
          <IconChevronRight size={14} />
        </div>
      </div>
      <div className="v2-counter__bottom">
        <div className="v2-counter__value">{value}</div>
        <div className="v2-counter__label">{label}</div>
        {sub && <div className="v2-counter__sub">{sub}</div>}
      </div>
    </div>
  );
}

/** Avatar circle */
function Avatar({ initials, color = "blue", size = "sm" }) {
  return (
    <span
      className={`v2-avatar v2-avatar--${size}`}
      style={{ background: AVATAR_COLORS[color] || AVATAR_COLORS.blue, color: color === "yellow" ? "#000" : "#fff" }}
    >
      {initials}
    </span>
  );
}

/* ── Campaign card ── */
function CampaignCard({ campaign, isMock, onNavigate }) {
  if (!campaign) {
    return (
      <div className="v2-block">
        <div className="v2-block-header">
          <span className="v2-block-header__label">Campagne active</span>
          <span className="v2-block-header__link" onClick={() => onNavigate("campagnes")}>
            Voir tout <IconChevronRight size={11} />
          </span>
        </div>
        <div className="v2-block-divider" />
        <div className="v2-empty" style={{ padding: "32px 20px" }}>
          <div className="v2-empty__icon"><IconMegaphone size={32} /></div>
          <div className="v2-empty__title">Aucune campagne active</div>
          <div className="v2-empty__sub">Créez votre première campagne pour la suivre ici.</div>
        </div>
      </div>
    );
  }

  const p = pct(campaign.progress || campaign.progression);
  const dead = shortDate(campaign.deadline || campaign.dateEcheance || campaign.endDate);
  const clubs = campaign.clubs || campaign.clubsIds || [];

  return (
    <div className="v2-block">
      <div className="v2-block-header">
        <span className="v2-block-header__label">Campagne active</span>
        {isMock && (
          <span className="v2-badge v2-badge--gray" style={{ fontSize: 9, padding: "1px 6px" }}>Aperçu</span>
        )}
        <span className="v2-block-header__link" onClick={() => onNavigate("campagnes")}>
          Voir tout <IconChevronRight size={11} />
        </span>
      </div>
      <div className="v2-block-divider" />
      <div className="v2-campaign-block">
        <div className="v2-campaign-block__eyebrow">
          <span className="v2-campaign-block__eyebrow-label">En cours</span>
          <Badge variant="blue">{campaign.status || "En cours"}</Badge>
        </div>
        <div className="v2-campaign-block__name">{campaign.title || campaign.name || "—"}</div>
        {campaign.description && (
          <div className="v2-campaign-block__desc">{campaign.description}</div>
        )}
        <div className="v2-campaign-block__progress-row">
          <div className="v2-campaign-progress">
            <div className="v2-campaign-progress__bar" style={{ width: `${p}%` }} />
          </div>
          <span className="v2-campaign-block__pct">{p}%</span>
        </div>
        <div className="v2-campaign-block__meta">
          Progression
          {dead && <> · Échéance {dead}</>}
        </div>
        <div className="v2-campaign-block__footer">
          {clubs.slice(0, 3).map((club, i) => (
            <div key={i} className="v2-club-chip">
              <div className="v2-club-chip__dot" />
              {club}
            </div>
          ))}
          {campaign.responsible && (
            <Avatar initials={campaign.responsible.split(" ").map((w) => w[0]).join("").slice(0, 2)} size="sm" />
          )}
          <div className="v2-campaign-block__cta">
            <button
              className="v2-btn v2-btn--ghost v2-btn--sm"
              onClick={() => onNavigate("campagnes")}
            >
              Voir la campagne <IconChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Mail card (mock — OVH/Zimbra À VÉRIFIER) ── */
function MailCard({ onNavigate }) {
  const statusBadge = {
    a_traiter: <Badge variant="yellow">À traiter</Badge>,
    important:  <Badge variant="orange">Important</Badge>,
    en_attente: <Badge variant="gray">En attente</Badge>,
  };

  return (
    <div className="v2-block">
      <div className="v2-block-header">
        <span className="v2-block-header__label">Boîte mail</span>
        <span className="v2-block-header__link" onClick={() => onNavigate("mail")}>
          Voir tout <IconChevronRight size={11} />
        </span>
      </div>
      <div className="v2-block-divider" />
      {MOCK_EMAILS.map((email) => (
        <div key={email.id} className="v2-mail-row" onClick={() => onNavigate("mail")}>
          <div className="v2-mail-row__avatar">
            <Avatar initials={email.initials} color={email.avatarColor} size="sm" />
          </div>
          <div className="v2-mail-row__body">
            <div className="v2-mail-row__top">
              <span className="v2-mail-row__from">{email.from}</span>
              <span className="v2-mail-row__time">{email.time}</span>
            </div>
            <div className="v2-mail-row__subject">{email.subject}</div>
            <div className="v2-mail-row__preview">{email.preview}</div>
          </div>
        </div>
      ))}
      <div className="v2-mail-mock-notice">
        Données de démonstration — intégration OVH/Zimbra à configurer
      </div>
    </div>
  );
}

/* ── Objectives card ── */
function ObjectivesCard({ objectives, loading, onNavigate }) {
  return (
    <div className="v2-block">
      <div className="v2-block-header">
        <span className="v2-block-header__label">Objectifs</span>
        <span className="v2-block-header__link" onClick={() => onNavigate("objectifs")}>
          Voir tout <IconChevronRight size={11} />
        </span>
      </div>
      <div className="v2-block-divider" />
      {loading ? (
        <div style={{ padding: "12px 20px" }}><Skeleton /><Skeleton w="70%" /></div>
      ) : objectives.length === 0 ? (
        <div className="v2-empty" style={{ padding: "24px 20px" }}>
          <div className="v2-empty__icon"><IconTarget size={28} /></div>
          <div className="v2-empty__title">Aucun objectif actif</div>
        </div>
      ) : (
        objectives.slice(0, 3).map((obj, i) => {
          const p = pct(obj.progress || obj.progression);
          const dead = shortDate(obj.deadline || obj.dateEcheance || obj.endDate);
          return (
            <div key={obj.id || i} className="v2-obj-row" onClick={() => onNavigate("objectifs")}>
              <div className="v2-obj-row__top">
                <span className="v2-obj-row__name">{obj.title || obj.titre || obj.name || "Objectif"}</span>
                <Badge variant="blue">{p}%</Badge>
              </div>
              <div className="v2-obj-progress">
                <div className="v2-obj-progress__bar" style={{ width: `${p}%` }} />
              </div>
              <div className="v2-obj-row__meta">
                <span>{obj.status || obj.statut || "Actif"}</span>
                {dead && <span>· {dead}</span>}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/* ── Mini Calendar / Agenda ── */
function AgendaCard({ events, loading, onNavigate }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayDay = now.getDate();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const startOffset = (firstDay + 6) % 7; // Mon-first

  const monthName = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const eventsByDay = useMemo(() => {
    const map = {};
    (events || []).forEach((e) => {
      const d = e.date || e.startDate || e.dateDebut || e.start;
      if (!d) return;
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return;
      const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [events]);

  const todayEvents = useMemo(() => {
    const key = `${year}-${month}-${todayDay}`;
    return eventsByDay[key] || [];
  }, [eventsByDay, year, month, todayDay]);

  const cells = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ day: daysInPrev - startOffset + 1 + i, other: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, isToday: d === todayDay });
  }
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, other: true });
  }

  const DOW = ["L", "M", "Me", "J", "V", "S", "D"];

  const todayLabel = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="v2-block">
      <div className="v2-block-header">
        <span className="v2-block-header__label">Mon agenda</span>
        <span className="v2-block-header__link" onClick={() => onNavigate("calendrier")}>
          Voir tout <IconChevronRight size={11} />
        </span>
      </div>
      <div className="v2-block-divider" />

      <div className="v2-minical">
        <div className="v2-minical__header">
          <span className="v2-minical__month">{monthName}</span>
        </div>
        <div className="v2-minical__grid">
          {DOW.map((d) => <div key={d} className="v2-minical__dow">{d}</div>)}
          {cells.map((c, i) => {
            const key = `${year}-${month}-${c.day}`;
            const evts = !c.other ? (eventsByDay[key] || []) : [];
            return (
              <div
                key={i}
                className={`v2-minical__day${c.isToday ? " v2-minical__day--today" : ""}${c.other ? " v2-minical__day--other" : ""}`}
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

      <div className="v2-agenda-events">
        <div className="v2-agenda-date-label" style={{ textTransform: "capitalize" }}>{todayLabel}</div>
        {loading ? (
          <div><Skeleton /><Skeleton w="70%" /></div>
        ) : todayEvents.length === 0 ? (
          <div className="v2-agenda-empty">Aucun événement aujourd'hui</div>
        ) : (
          todayEvents.slice(0, 4).map((ev, i) => {
            const startTime = ev.startTime || ev.heure || (ev.start ? new Date(ev.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : null);
            return (
              <div key={ev.id || i} className="v2-agenda-event">
                <span className="v2-agenda-event__time">{startTime || "—"}</span>
                <div className="v2-agenda-event__dot" style={{ background: "var(--ep-blue)" }} />
                <span className="v2-agenda-event__name">{ev.title || ev.titre || ev.name || "Événement"}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ── Demandes & tâches récentes ── */
function RecentDemandsTasks({ tasks, requests, loadingTasks, loadingReq, onNavigate }) {
  const combined = useMemo(() => {
    const items = [];

    // Requests — tri par date décroissante
    (requests || []).forEach((r) => {
      if (!r) return;
      const closed = ["clôturée", "closed", "refusée", "refused", "rejected"];
      if (closed.includes((r.status || "").toLowerCase())) return;
      items.push({
        type: "demande",
        id: r.id,
        title: r.title || r.titre || r.name || "Demande",
        club: r.club,
        assignedTo: r.assignedTo || r.responsable,
        status: r.status || r.statut || "Reçue",
        priority: r.priority || r.priorite,
        date: r.createdAt || r.date || r.updatedAt,
      });
    });

    // Tasks
    (tasks || []).forEach((t) => {
      if (!t) return;
      const done = t.status === "done" || t.done === true || t.status === "completed";
      if (done) return;
      items.push({
        type: "tache",
        id: t.id,
        title: t.title || t.titre || t.name || "Tâche",
        club: t.club,
        assignedTo: t.assignedTo || t.assignee,
        status: t.status || t.statut || "À faire",
        priority: t.urgency || t.priority,
        date: t.createdAt || t.dueDate || t.deadline,
      });
    });

    // Sort: most recent first
    items.sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return db - da;
    });

    return items.slice(0, 5);
  }, [tasks, requests]);

  const loading = loadingTasks || loadingReq;

  const priorityColor = (p) => {
    const v = (p || "").toLowerCase();
    if (v === "haute" || v === "high" || v === "urgent") return "var(--ep-orange)";
    return "var(--ep-blue)";
  };

  return (
    <div className="v2-block v2-dash-full">
      <div className="v2-block-header">
        <span className="v2-block-header__label">Demandes & tâches récentes</span>
        {!loading && combined.length > 0 && (
          <span className="v2-block-header__count">{combined.length}</span>
        )}
        <span className="v2-block-header__link" onClick={() => onNavigate("demandes")}>
          Voir tout <IconChevronRight size={11} />
        </span>
      </div>
      <div className="v2-block-divider" />
      {loading ? (
        <div style={{ padding: "12px 20px" }}>
          <Skeleton /><Skeleton w="80%" /><Skeleton w="65%" />
        </div>
      ) : combined.length === 0 ? (
        <div className="v2-empty" style={{ padding: "28px 20px" }}>
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
              {item.type === "demande" ? (
                <Badge variant="orange">Demande</Badge>
              ) : (
                <Badge variant="blue">Tâche</Badge>
              )}
            </div>
            <div className="v2-recent-row__body">
              <div className="v2-recent-row__title">{item.title}</div>
              <div className="v2-recent-row__meta">
                {item.club && (
                  <>
                    <span>{item.club}</span>
                    <div className="v2-recent-row__meta-dot" />
                  </>
                )}
                {item.assignedTo && (
                  <>
                    <span>{typeof item.assignedTo === "string" ? item.assignedTo : "—"}</span>
                    <div className="v2-recent-row__meta-dot" />
                  </>
                )}
                {item.date && <span>{shortDate(item.date)}</span>}
              </div>
            </div>
            <div className="v2-recent-row__right">
              {item.priority && (
                <div
                  style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: priorityColor(item.priority),
                    flexShrink: 0,
                  }}
                  title={item.priority}
                />
              )}
              <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   DASHBOARD V2
   ───────────────────────────────────────────────────────── */
export default function DashboardV2({ appId, currentUser, onNavigate }) {
  const { tasks, loading: loadingTasks }        = useTasks();
  const { requests, loading: loadingReq }       = useRequests();
  const { publications, loading: loadingPub }   = usePublications();
  const { objectives, loading: loadingObj }     = useObjectives();
  const { projects, loading: loadingProj }      = useProjects();
  const { events, loading: loadingCal }         = useCalendarEvents();

  const todayTasks        = useMemo(() => filterTodayTasks(tasks, appId), [tasks, appId]);
  const openRequests      = useMemo(() => filterOpenRequests(requests), [requests]);
  const pendingValidations = useMemo(() => filterPendingValidations(publications), [publications]);
  const activeObjectives  = useMemo(() => filterActiveObjectives(objectives), [objectives]);

  // Campagne active — utilise ep:projects, fallback mock
  const activeCampaign = useMemo(() => {
    if (!loadingProj && projects.length > 0) {
      // Prend le premier projet actif comme campagne active
      const active = projects.find((p) => {
        const s = (p?.status || p?.statut || "").toLowerCase();
        return s === "actif" || s === "active" || s === "en cours" || !s;
      });
      return active ? { ...active, isMock: false } : null;
    }
    if (!loadingProj && projects.length === 0) {
      return { ...MOCK_CAMPAIGN, isMock: true };
    }
    return null; // encore en chargement
  }, [projects, loadingProj]);

  // Identité affichée
  const displayName = currentUser?.name || "Mélissa Le Guen";
  const userTitle   = currentUser?.fonction || currentUser?.title || currentUser?.role_label
    || "Responsable France Communication & Marketing Digital";

  const { jour, date } = formatDateFull();

  return (
    <div className="v2-dashboard">

      {/* ── Hero ── */}
      <div className="v2-dash-hero">
        <div>
          <div className="v2-dash-hero__greeting">{greet(displayName)}</div>
          <div className="v2-dash-hero__sub">Voici ce qui vous attend aujourd'hui.</div>
          <div className="v2-dash-hero__identity">{displayName} · {userTitle}</div>
        </div>
        <div className="v2-dash-hero__date">
          <div className="v2-dash-hero__date-day">{jour}</div>
          <div className="v2-dash-hero__date-full">{date}</div>
        </div>
      </div>

      {/* ── Counter cards ── */}
      <div className="v2-dash-counters">
        <CounterCard
          icon={IconCheckSquare}
          value={loadingTasks ? "—" : todayTasks.length}
          label="À traiter aujourd'hui"
          sub={todayTasks.length > 0 ? `${todayTasks.length} tâche${todayTasks.length > 1 ? "s" : ""} urgente${todayTasks.length > 1 ? "s" : ""}` : "Aucune tâche urgente"}
          color="yellow"
          onClick={() => onNavigate("projets")}
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
          color="blue"
          onClick={() => onNavigate("contenus")}
        />
        <CounterCard
          icon={IconMail}
          value="—"
          label="Boîte mail"
          sub="Non connectée"
          color="gray"
          onClick={() => onNavigate("mail")}
        />
      </div>

      {/* ── Main body: 2 columns ── */}
      <div className="v2-dash-body">

        {/* Left column */}
        <div className="v2-dash-col-main">
          <CampaignCard
            campaign={activeCampaign}
            isMock={activeCampaign?.isMock}
            onNavigate={onNavigate}
          />
          <MailCard onNavigate={onNavigate} />
        </div>

        {/* Right column */}
        <div className="v2-dash-col-side">
          <AgendaCard
            events={events}
            loading={loadingCal}
            onNavigate={onNavigate}
          />
          <ObjectivesCard
            objectives={activeObjectives}
            loading={loadingObj}
            onNavigate={onNavigate}
          />
        </div>
      </div>

      {/* ── Full width: Demandes & tâches récentes ── */}
      <RecentDemandsTasks
        tasks={tasks}
        requests={requests}
        loadingTasks={loadingTasks}
        loadingReq={loadingReq}
        onNavigate={onNavigate}
      />
    </div>
  );
}
