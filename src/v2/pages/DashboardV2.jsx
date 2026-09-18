import React, { useMemo } from "react";
import {
  useTasks, useRequests, usePublications, useObjectives, useCalendarEvents, useReporting,
  filterTodayTasks, filterOpenRequests, filterPendingValidations, filterActiveObjectives,
} from "../hooks/useV1Data";

/* ── Helpers ── */
function today() {
  return new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function greet(name) {
  const h = new Date().getHours();
  if (h < 12) return `Bonjour, ${name || ""}`;
  if (h < 18) return `Bon après-midi, ${name || ""}`;
  return `Bonsoir, ${name || ""}`;
}

function urgencyVariant(task) {
  const u = (task.urgency || task.priority || "").toLowerCase();
  if (u === "haute" || u === "high" || u === "urgent") return "red";
  if (u === "normale" || u === "normal" || u === "medium") return "blue";
  return "gray";
}

function statusVariant(req) {
  const s = (req.status || req.statut || "").toLowerCase();
  if (s === "en cours") return "blue";
  if (s === "reçue" || s === "nouvelle") return "orange";
  if (s === "livrée") return "green";
  return "gray";
}

function statusLabel(req) {
  return req.status || req.statut || "Reçue";
}

function Badge({ variant, children }) {
  return <span className={`v2-badge v2-badge--${variant}`}>{children}</span>;
}

function Skeleton({ w = "100%", h = 14, mb = 6 }) {
  return (
    <div className="v2-skel" style={{ width: w, height: h, marginBottom: mb, borderRadius: 4 }} />
  );
}

/* ── Mini Calendar ── */
function MiniCalendar({ events }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  // Monday-first: (0=Sun → 6, 1=Mon → 0, ...)
  const startOffset = (firstDay + 6) % 7;

  const monthName = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  // Index events by day
  const eventsByDay = useMemo(() => {
    const map = {};
    (events || []).forEach((e) => {
      const d = e.date || e.startDate || e.dateDebut;
      if (!d) return;
      const key = new Date(d).getDate();
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [events]);

  const DOW = ["L", "M", "Me", "J", "V", "S", "D"];

  // Build calendar cells: prev month overflow, current, next overflow
  const cells = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ day: daysInPrev - startOffset + 1 + i, other: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, today: d === now.getDate() });
  }
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, other: true });
  }

  return (
    <div className="v2-minical">
      <div className="v2-minical__header">
        <span className="v2-minical__month" style={{ textTransform: "capitalize" }}>{monthName}</span>
      </div>
      <div className="v2-minical__grid">
        {DOW.map((d) => <div key={d} className="v2-minical__dow">{d}</div>)}
        {cells.map((c, i) => {
          const evts = !c.other ? (eventsByDay[c.day] || []) : [];
          return (
            <div
              key={i}
              className={`v2-minical__day${c.today ? " v2-minical__day--today" : ""}${c.other ? " v2-minical__day--other" : ""}`}
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
  );
}

/* ── KPI Flash block ── */
function KpiFlash({ reporting }) {
  const items = useMemo(() => {
    if (!Array.isArray(reporting) || reporting.length === 0) return null;
    // Attempt to extract last entry's metrics
    const last = reporting[reporting.length - 1];
    if (!last) return null;
    const metrics = [];
    if (last.totalReach !== undefined) metrics.push({ label: "Portée totale", value: last.totalReach?.toLocaleString("fr-FR") || "—" });
    if (last.totalEngagement !== undefined) metrics.push({ label: "Engagements", value: last.totalEngagement?.toLocaleString("fr-FR") || "—" });
    if (last.totalPublications !== undefined) metrics.push({ label: "Publications", value: last.totalPublications || "—" });
    if (last.followersGain !== undefined) metrics.push({ label: "Nouveaux abonnés", value: `+${last.followersGain}` });
    return metrics.slice(0, 4);
  }, [reporting]);

  if (!items || items.length === 0) {
    return (
      <div className="v2-empty" style={{ padding: "24px" }}>
        <p className="v2-empty__sub">KPIs disponibles après synchronisation Metricool</p>
      </div>
    );
  }

  return (
    <div className="v2-kpi-grid">
      {items.map((item, i) => (
        <div key={i} className="v2-kpi-item">
          <div className="v2-kpi-item__value">{item.value}</div>
          <div className="v2-kpi-item__label">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   DASHBOARD V2
   ═══════════════════════════════════════════════════════ */
export default function DashboardV2({ appId, currentUser, onNavigate }) {
  const { tasks, loading: loadingTasks } = useTasks();
  const { requests, loading: loadingReq } = useRequests();
  const { publications, loading: loadingPub } = usePublications();
  const { objectives, loading: loadingObj } = useObjectives();
  const { events, loading: loadingCal } = useCalendarEvents();
  const { reporting, loading: loadingKpi } = useReporting();

  const todayTasks = useMemo(() => filterTodayTasks(tasks, appId), [tasks, appId]);
  const openRequests = useMemo(() => filterOpenRequests(requests), [requests]);
  const pendingValidations = useMemo(() => filterPendingValidations(publications), [publications]);
  const activeObjectives = useMemo(() => filterActiveObjectives(objectives), [objectives]);

  const displayName = currentUser?.name?.split(" ")[0] || "vous";

  return (
    <div className="v2-dashboard">
      {/* Welcome */}
      <div className="v2-dash-welcome">
        <div className="v2-dash-welcome__greeting">{greet(displayName)} 👋</div>
        <div className="v2-dash-welcome__date" style={{ textTransform: "capitalize" }}>{today()}</div>
      </div>

      {/* Counter row */}
      <div className="v2-dash-counters">
        <div
          className="v2-counter v2-counter--urgent"
          onClick={() => onNavigate("projets")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onNavigate("projets")}
        >
          <div className="v2-counter__value">
            {loadingTasks ? <div className="v2-skel" style={{ width: 36, height: 30, display: "inline-block" }} /> : todayTasks.length}
          </div>
          <div className="v2-counter__label">À traiter aujourd'hui</div>
        </div>

        <div
          className="v2-counter v2-counter--demand"
          onClick={() => onNavigate("demandes")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onNavigate("demandes")}
        >
          <div className="v2-counter__value">
            {loadingReq ? <div className="v2-skel" style={{ width: 36, height: 30, display: "inline-block" }} /> : openRequests.length}
          </div>
          <div className="v2-counter__label">Demandes clubs</div>
        </div>

        <div
          className="v2-counter v2-counter--valid"
          onClick={() => onNavigate("contenus")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onNavigate("contenus")}
        >
          <div className="v2-counter__value">
            {loadingPub ? <div className="v2-skel" style={{ width: 36, height: 30, display: "inline-block" }} /> : pendingValidations.length}
          </div>
          <div className="v2-counter__label">Validations en attente</div>
        </div>

        <div
          className="v2-counter v2-counter--mail"
          onClick={() => onNavigate("mail")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onNavigate("mail")}
        >
          <div className="v2-counter__value" style={{ color: "var(--ep-blue)" }}>—</div>
          <div className="v2-counter__label">Emails à traiter</div>
        </div>
      </div>

      {/* Main grid */}
      <div className="v2-dash-grid">

        {/* Block: À traiter aujourd'hui */}
        <div className="v2-card">
          <div className="v2-block-head">
            <span className="v2-block-head__title">À traiter aujourd'hui</span>
            {!loadingTasks && todayTasks.length > 0 && (
              <span className="v2-block-head__count">{todayTasks.length}</span>
            )}
            <span className="v2-block-head__link" onClick={() => onNavigate("projets")}>Tout voir</span>
          </div>
          <hr className="v2-divider" />
          {loadingTasks ? (
            <div style={{ padding: "10px 16px" }}>
              <Skeleton /><Skeleton w="80%" /><Skeleton w="90%" />
            </div>
          ) : todayTasks.length === 0 ? (
            <div className="v2-empty">
              <div className="v2-empty__title">Aucune tâche urgente</div>
              <div className="v2-empty__sub">Profitez-en !</div>
            </div>
          ) : (
            todayTasks.slice(0, 5).map((task, i) => (
              <div key={task.id || i} className="v2-task-row">
                <div className="v2-task-row__check" aria-hidden="true" />
                <div className="v2-task-row__body">
                  <div className="v2-task-row__title">{task.title || task.titre || task.name || "Tâche"}</div>
                  <div className="v2-task-row__meta">
                    {(task.urgency || task.priority) && (
                      <Badge variant={urgencyVariant(task)}>
                        {task.urgency || task.priority}
                      </Badge>
                    )}
                    {(task.dueDate || task.deadline) && (
                      <span>{new Date(task.dueDate || task.deadline).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Block: Demandes clubs */}
        <div className="v2-card">
          <div className="v2-block-head">
            <span className="v2-block-head__title">Demandes clubs</span>
            {!loadingReq && openRequests.length > 0 && (
              <span className="v2-block-head__count">{openRequests.length} ouvertes</span>
            )}
            <span className="v2-block-head__link" onClick={() => onNavigate("demandes")}>Tout voir</span>
          </div>
          <hr className="v2-divider" />
          {loadingReq ? (
            <div style={{ padding: "10px 16px" }}>
              <Skeleton /><Skeleton w="75%" /><Skeleton w="85%" />
            </div>
          ) : openRequests.length === 0 ? (
            <div className="v2-empty">
              <div className="v2-empty__title">Aucune demande ouverte</div>
            </div>
          ) : (
            openRequests.slice(0, 4).map((req, i) => (
              <div key={req.id || i} className="v2-demand-row">
                <div className="v2-demand-row__body">
                  <div className="v2-demand-row__title">{req.title || req.titre || req.name || "Demande"}</div>
                  <div className="v2-demand-row__meta">
                    {req.club && <span>{req.club}</span>}
                    {(req.createdAt || req.date) && (
                      <span>{new Date(req.createdAt || req.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                    )}
                  </div>
                </div>
                <div className="v2-demand-row__status">
                  <Badge variant={statusVariant(req)}>{statusLabel(req)}</Badge>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Block: Objectifs actifs */}
        <div className="v2-card">
          <div className="v2-block-head">
            <span className="v2-block-head__title">Objectifs actifs</span>
            <span className="v2-block-head__link" onClick={() => onNavigate("objectifs")}>Voir tous</span>
          </div>
          <hr className="v2-divider" />
          {loadingObj ? (
            <div style={{ padding: "10px 16px" }}>
              <Skeleton /><Skeleton w="70%" />
            </div>
          ) : activeObjectives.length === 0 ? (
            <div className="v2-empty">
              <div className="v2-empty__title">Aucun objectif actif</div>
              <div className="v2-empty__sub">Créez votre premier objectif</div>
            </div>
          ) : (
            activeObjectives.slice(0, 3).map((obj, i) => {
              const pct = Math.min(100, Math.max(0, Number(obj.progress || obj.progression || 0)));
              return (
                <div key={obj.id || i} className="v2-obj-item">
                  <div className="v2-obj-item__row">
                    <span className="v2-obj-item__name">{obj.title || obj.titre || obj.name || "Objectif"}</span>
                    <Badge variant="blue">{pct}%</Badge>
                  </div>
                  <div className="v2-progress-row">
                    <div className="v2-progress">
                      <div className="v2-progress__bar" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="v2-progress-row__pct">{pct}%</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Block: Validations en attente */}
        <div className="v2-card">
          <div className="v2-block-head">
            <span className="v2-block-head__title">Validations en attente</span>
            {!loadingPub && pendingValidations.length > 0 && (
              <span className="v2-block-head__count">{pendingValidations.length}</span>
            )}
            <span className="v2-block-head__link" onClick={() => onNavigate("contenus")}>Voir tout</span>
          </div>
          <hr className="v2-divider" />
          {loadingPub ? (
            <div style={{ padding: "10px 16px" }}>
              <Skeleton /><Skeleton w="80%" />
            </div>
          ) : pendingValidations.length === 0 ? (
            <div className="v2-empty">
              <div className="v2-empty__title">Aucune validation en attente</div>
            </div>
          ) : (
            pendingValidations.slice(0, 4).map((pub, i) => (
              <div key={pub.id || i} className="v2-demand-row">
                <div className="v2-demand-row__body">
                  <div className="v2-demand-row__title">{pub.title || pub.titre || pub.caption || "Contenu"}</div>
                  <div className="v2-demand-row__meta">
                    {pub.platform && <span>{pub.platform}</span>}
                    {pub.club && <span>{pub.club}</span>}
                  </div>
                </div>
                <div className="v2-demand-row__status">
                  <Badge variant="yellow">À valider</Badge>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Block: Calendrier 7 jours */}
        <div className="v2-card">
          <div className="v2-block-head">
            <span className="v2-block-head__title">Calendrier</span>
            <span className="v2-block-head__link" onClick={() => onNavigate("calendrier")}>Voir tout</span>
          </div>
          <hr className="v2-divider" />
          {loadingCal ? (
            <div style={{ padding: "12px 16px" }}>
              <Skeleton h={100} />
            </div>
          ) : (
            <MiniCalendar events={events} />
          )}
        </div>

        {/* Block: KPI flash */}
        <div className="v2-card">
          <div className="v2-block-head">
            <span className="v2-block-head__title">KPI flash</span>
            <span className="v2-block-head__link" onClick={() => onNavigate("kpi")}>Tout voir</span>
          </div>
          <hr className="v2-divider" />
          {loadingKpi ? (
            <div style={{ padding: "12px 16px" }}>
              <Skeleton /><Skeleton w="60%" />
            </div>
          ) : (
            <KpiFlash reporting={reporting} />
          )}
        </div>

      </div>
    </div>
  );
}
