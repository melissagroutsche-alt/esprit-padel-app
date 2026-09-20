import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  useCalendarEvents, useTasks, usePublications,
  useMeetings, useMetricool, useClubs,
  useProjects, useRequests,
} from "../hooks/useV1Data";

/* ── Pastel color tokens per source ── */
const C = {
  event:       { bg: "#BFDBFE", text: "#1E3A8A", border: "#93C5FD" }, // bleu
  task:        { bg: "#FDE68A", text: "#78350F", border: "#FCD34D" }, // jaune
  publication: { bg: "#FED7AA", text: "#7C2D12", border: "#FDBA74" }, // orange
  meeting:     { bg: "#BBF7D0", text: "#064E3B", border: "#86EFAC" }, // vert
  metricool:   { bg: "#E9D5FF", text: "#581C87", border: "#D8B4FE" }, // violet
  project:     { bg: "#FBCFE8", text: "#9D174D", border: "#F9A8D4" }, // rose
  request:     { bg: "#C7D2FE", text: "#3730A3", border: "#A5B4FC" }, // indigo
};

const SOURCE_LABELS = {
  event:        "Événements",
  publication:  "Publications",
  metricool:    "Metricool",
  project:      "Campagnes",
  meeting:      "Réunions",
  task:         "Tâches",
  request:      "Demandes clubs",
  marketing360: "Marketing 360°",
};

/* Ordre d'affichage des filtres actifs */
const FILTER_ORDER = ["event","publication","metricool","project","meeting","task","request"];

/* ── Date utils ── */
const FR_DAYS   = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const FR_MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function startOfDay(d)   { const r = new Date(d); r.setHours(0,0,0,0); return r; }
function addDays(d, n)   { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function addMonths(d, n) { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; }
function isSameDay(a, b) { return a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function fmtISO(d)       { return d.toISOString().slice(0,10); }

function parseDate(s) {
  if (!s) return null;
  if (s instanceof Date) return isNaN(s.getTime()) ? null : s;
  if (s && typeof s === "object" && s.toDate) return s.toDate();
  if (s && typeof s === "object" && s.seconds) return new Date(s.seconds * 1000);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function getWeekStart(d) {
  const r = startOfDay(d);
  const day = r.getDay();
  r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day));
  return r;
}

function getMonthGridDates(year, month) {
  const first = new Date(year, month, 1);
  const start = getWeekStart(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/* Returns true when item is active on the given day (respects endDate for multi-day items) */
function itemCoversDay(item, d) {
  if (!item.date) return false;
  const s = startOfDay(item.date);
  const t = startOfDay(d);
  if (item.endDate) {
    const e = startOfDay(item.endDate);
    return t >= s && t <= e;
  }
  return isSameDay(s, t);
}

/* ── Club resolution ── */
function resolveClub(clubId, clubs) {
  if (!clubId) return null;
  if (clubs && clubs.length) {
    const c = clubs.find(x => String(x.id) === String(clubId));
    if (c) return c;
  }
  const known = { "1": "Saint-Priest", "2": "La Boisse", "3": "Mâcon" };
  const name = known[String(clubId)];
  return name ? { id: clubId, name, color: null } : null;
}

/* ════════════════════════════════════════════════════════
   NORMALIZERS — lecture seule, aucune écriture Firestore
   ════════════════════════════════════════════════════════ */

function normalizeEvents(events, clubs) {
  return (events || []).filter(Boolean).map(e => {
    const d = parseDate(e.date || e.startDate || e.start);
    if (!d) return null;
    return {
      id: `event-${e.id || Math.random()}`,
      sourceType: "event", sourceId: e.id,
      title: e.title || e.nom || e.name || "Événement",
      date: d, endDate: parseDate(e.endDate || e.end) || null,
      time: e.time || e.startTime || null,
      endTime: e.endTime || null,
      allDay: !e.time && !e.startTime,
      color: C.event,
      club: resolveClub(e.club || e.clubId, clubs),
      status: e.status || null, meta: e,
    };
  }).filter(Boolean);
}

function normalizeTasks(tasks, clubs) {
  return (tasks || []).filter(Boolean).map(t => {
    const d = parseDate(t.dueDate || t.deadline || t.date);
    if (!d) return null;
    return {
      id: `task-${t.id || Math.random()}`,
      sourceType: "task", sourceId: t.id,
      title: t.title || t.name || t.label || "Tâche",
      date: d, endDate: null,
      time: t.time || null, endTime: null,
      allDay: !t.time,
      color: C.task,
      club: resolveClub(t.club || t.clubId, clubs),
      status: t.status || null, meta: t,
    };
  }).filter(Boolean);
}

function normalizePublications(publications, clubs) {
  return (publications || []).filter(Boolean).map(p => {
    const d = parseDate(p.scheduledDate || p.publishDate || p.scheduledAt || p.date);
    if (!d) return null;
    const text = p.text || p.caption || "";
    return {
      id: `pub-${p.id || Math.random()}`,
      sourceType: "publication", sourceId: p.id,
      title: p.title || (text.slice(0, 40) + (text.length > 40 ? "…" : "")) || "Publication",
      date: d, endDate: null,
      time: p.time || null, endTime: null,
      allDay: !p.time,
      color: C.publication,
      club: resolveClub(p.club || p.clubId, clubs),
      status: p.status || p.statut || null, meta: p,
    };
  }).filter(Boolean);
}

function normalizeMeetings(meetings, clubs) {
  return (meetings || []).filter(Boolean).map(m => {
    const d = parseDate(m.date || m.startDate || m.start);
    if (!d) return null;
    return {
      id: `meeting-${m.id || Math.random()}`,
      sourceType: "meeting", sourceId: m.id,
      title: m.title || m.subject || m.objet || "Réunion",
      date: d, endDate: parseDate(m.endDate || m.end) || null,
      time: m.time || m.startTime || null,
      endTime: m.endTime || null,
      allDay: !m.time && !m.startTime,
      color: C.meeting,
      club: resolveClub(m.club || m.clubId, clubs),
      status: m.status || null, meta: m,
    };
  }).filter(Boolean);
}

/*
 * Metricool — ep:metricool-approvals
 * Structure : { items: [...], syncedAt, ok } ou tableau direct.
 * publicationDate : { dateTime: "ISO" } | { date: "YYYY-MM-DD" } | chaîne brute.
 *
 * NOTE DÉDUPLICATION : ep:publications et ep:metricool-approvals sont deux sources
 * distinctes. Aucune déduplication approximative (titre, date, texte) n'est appliquée.
 * Une déduplication fiable nécessitera un identifiant partagé entre les deux collections
 * (ex. metricoolId dans ep:publications). À implémenter dans une version ultérieure.
 */
function normalizeMetricool(data, clubs) {
  if (!data) return [];
  const items = Array.isArray(data) ? data : (data.items || []);
  return items.filter(Boolean).map(item => {
    const rawDate = item.publicationDate?.dateTime
      || item.publicationDate?.date
      || item.publicationDate;
    const d = parseDate(rawDate);
    if (!d) return null;
    const hasTime = !!(item.publicationDate?.dateTime);
    return {
      id: `metricool-${item.id || Math.random()}`,
      sourceType: "metricool", sourceId: item.id,
      title: (item.text || item.title || "Post").slice(0, 60),
      date: d, endDate: null,
      time: hasTime ? d.toTimeString().slice(0, 5) : null,
      endTime: null,
      allDay: !hasTime,
      color: C.metricool,
      club: resolveClub(item.club, clubs),
      status: item.status || null, meta: item,
    };
  }).filter(Boolean);
}

/*
 * Projets / Campagnes — ep:projects
 * Seuls les projets ayant une deadline ou une date de début sont inclus.
 * Si startDate + deadline : période multi-jours (endDate utilisé pour le rendu étendu).
 * Si deadline uniquement : point unique allDay.
 * createdAt n'est jamais utilisé comme date calendrier.
 */
function normalizeProjects(projects, clubs) {
  return (projects || []).filter(Boolean).map(p => {
    const deadline  = parseDate(p.deadline || p.dueDate || p.endDate);
    const startDate = parseDate(p.startDate || p.start);
    if (!deadline && !startDate) return null;
    const date    = startDate || deadline;
    const endDate = startDate && deadline ? deadline : null;
    return {
      id: `project-${p.id || Math.random()}`,
      sourceType: "project", sourceId: p.id,
      title: p.name || p.title || p.nom || "Campagne",
      date, endDate,
      time: null, endTime: null,
      allDay: true,
      color: C.project,
      club: resolveClub(p.club || p.clubId, clubs),
      status: p.status || p.statut || null, meta: p,
    };
  }).filter(Boolean);
}

/*
 * Demandes clubs — ep:requests
 * Apparaît dans le calendrier UNIQUEMENT si une deadline explicite est présente.
 * createdAt n'est PAS utilisé comme date calendrier : ce n'est pas une échéance.
 */
function normalizeRequests(requests, clubs) {
  return (requests || []).filter(Boolean).map(r => {
    const deadline = parseDate(r.deadline || r.dueDate);
    if (!deadline) return null; // pas de deadline = pas dans le calendrier
    return {
      id: `request-${r.id || Math.random()}`,
      sourceType: "request", sourceId: r.id,
      title: r.subject || r.titre || r.title || r.objet || "Demande",
      date: deadline, endDate: null,
      time: null, endTime: null,
      allDay: true,
      color: C.request,
      club: resolveClub(r.club || r.clubId, clubs),
      status: r.status || r.statut || null, meta: r,
    };
  }).filter(Boolean);
}

/* ── Filter ── */
function applyFilters(items, selectedClubs, selectedSources) {
  return items.filter(item => {
    if (selectedSources.size > 0 && !selectedSources.has(item.sourceType)) return false;
    if (selectedClubs.size > 0) {
      if (!item.club || !selectedClubs.has(String(item.club.id))) return false;
    }
    return true;
  });
}

/* ── Shared constants ── */
const HOUR_START = 7;
const HOUR_END   = 22;
const HOUR_H     = 56; // px per hour
const HOURS      = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

function timeToMins(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/* ════════════════════════════════════════════════════════
   ROOT COMPONENT
   ════════════════════════════════════════════════════════ */
export default function CalendrierV2({ appId, currentUser, onNavigate }) {
  const { events }       = useCalendarEvents();
  const { tasks }        = useTasks();
  const { publications } = usePublications();
  const { meetings }     = useMeetings();
  const { metricool }    = useMetricool();
  const { projects }     = useProjects();
  const { requests }     = useRequests();
  const { clubs }        = useClubs();

  const [view,            setView]           = useState("week");
  const [focusDate,       setFocusDate]      = useState(() => startOfDay(new Date()));
  const [miniMonth,       setMiniMonth]      = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selectedClubs,   setSelectedClubs]  = useState(new Set());
  const [selectedSources, setSelectedSources]= useState(new Set());
  const [popover,         setPopover]        = useState(null);
  const popoverRef = useRef(null);

  const allItems = useMemo(() => [
    ...normalizeEvents(events, clubs),
    ...normalizeTasks(tasks, clubs),
    ...normalizePublications(publications, clubs),
    ...normalizeMeetings(meetings, clubs),
    ...normalizeMetricool(metricool, clubs),
    ...normalizeProjects(projects, clubs),
    ...normalizeRequests(requests, clubs),
  ], [events, tasks, publications, meetings, metricool, projects, requests, clubs]);

  const filtered = useMemo(
    () => applyFilters(allItems, selectedClubs, selectedSources),
    [allItems, selectedClubs, selectedSources]
  );

  useEffect(() => {
    if (!popover) return;
    function close(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setPopover(null);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [popover]);

  function toggleClub(id) {
    setSelectedClubs(prev => {
      const next = new Set(prev);
      next.has(String(id)) ? next.delete(String(id)) : next.add(String(id));
      return next;
    });
  }
  function toggleSource(src) {
    setSelectedSources(prev => {
      const next = new Set(prev);
      next.has(src) ? next.delete(src) : next.add(src);
      return next;
    });
  }

  function navPrev() {
    if (view === "week")  setFocusDate(d => addDays(d, -7));
    if (view === "month") setFocusDate(d => addMonths(d, -1));
    if (view === "day")   setFocusDate(d => addDays(d, -1));
  }
  function navNext() {
    if (view === "week")  setFocusDate(d => addDays(d, 7));
    if (view === "month") setFocusDate(d => addMonths(d, 1));
    if (view === "day")   setFocusDate(d => addDays(d, 1));
  }
  function navToday() {
    const t = startOfDay(new Date());
    setFocusDate(t);
    setMiniMonth(new Date(t.getFullYear(), t.getMonth(), 1));
  }

  function openPopover(item, e) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setPopover({ item, x: rect.left, y: rect.bottom + 6 });
  }

  function headerTitle() {
    if (view === "month") return `${FR_MONTHS[focusDate.getMonth()]} ${focusDate.getFullYear()}`;
    if (view === "day")   return `${FR_DAYS[(focusDate.getDay() + 6) % 7]} ${focusDate.getDate()} ${FR_MONTHS[focusDate.getMonth()]}`;
    const ws = getWeekStart(focusDate), we = addDays(ws, 6);
    if (ws.getMonth() === we.getMonth()) return `${FR_MONTHS[ws.getMonth()]} ${ws.getFullYear()}`;
    return `${FR_MONTHS[ws.getMonth()].slice(0,3)} – ${FR_MONTHS[we.getMonth()].slice(0,3)} ${we.getFullYear()}`;
  }

  const clubList = clubs.length > 0
    ? clubs
    : [{ id: "1", name: "Saint-Priest" }, { id: "2", name: "La Boisse" }, { id: "3", name: "Mâcon" }];

  return (
    <div className="cal-root">
      {/* ── Left panel ── */}
      <aside className="cal-aside">
        <MiniCalendar
          month={miniMonth}
          focusDate={focusDate}
          items={filtered}
          onNavigate={d => { setFocusDate(startOfDay(d)); setView("day"); }}
          onMonthChange={setMiniMonth}
        />

        <div className="cal-filter-section">
          <div className="cal-filter-label">Clubs</div>
          {clubList.map(club => (
            <label key={club.id} className="cal-filter-item">
              <input type="checkbox" checked={selectedClubs.has(String(club.id))} onChange={() => toggleClub(club.id)} />
              <span className="cal-filter-dot" style={{ background: club.color || "var(--text-3)" }} />
              <span>{club.name}</span>
            </label>
          ))}
        </div>

        <div className="cal-filter-section">
          <div className="cal-filter-label">Sources</div>
          {FILTER_ORDER.map(src => (
            <label key={src} className="cal-filter-item">
              <input type="checkbox" checked={selectedSources.has(src)} onChange={() => toggleSource(src)} />
              <span className="cal-filter-dot" style={{ background: C[src].bg, border: `1.5px solid ${C[src].border}` }} />
              <span>{SOURCE_LABELS[src]}</span>
            </label>
          ))}
          <div className="cal-filter-item cal-filter-disconnected">
            <span style={{ width: 13, flexShrink: 0 }} />
            <span className="cal-filter-dot" style={{ background: "#E5E7EB", border: "1.5px solid #D1D5DB" }} />
            <span>{SOURCE_LABELS.marketing360}</span>
            <span className="cal-filter-badge">Bientôt</span>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="cal-main">
        <div className="cal-toolbar">
          <div className="cal-toolbar-left">
            <button className="cal-btn-today" onClick={navToday}>Aujourd'hui</button>
            <div className="cal-nav">
              <button className="cal-nav-btn" onClick={navPrev} aria-label="Précédent">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button className="cal-nav-btn" onClick={navNext} aria-label="Suivant">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
            <h2 className="cal-period-title">{headerTitle()}</h2>
          </div>
          <div className="cal-view-tabs">
            {[["day","Jour"],["week","Semaine"],["month","Mois"]].map(([v, label]) => (
              <button key={v} className={`cal-view-tab${view === v ? " active" : ""}`} onClick={() => setView(v)}>{label}</button>
            ))}
          </div>
        </div>

        {view === "week"  && <WeekView  focusDate={focusDate} items={filtered} onItemClick={openPopover} onDayClick={d => { setFocusDate(d); setView("day"); }} />}
        {view === "month" && <MonthView focusDate={focusDate} items={filtered} onItemClick={openPopover} onDayClick={d => { setFocusDate(d); setView("day"); }} />}
        {view === "day"   && <DayView   focusDate={focusDate} items={filtered} onItemClick={openPopover} />}
      </div>

      {popover && (
        <ItemPopover ref={popoverRef} item={popover.item} x={popover.x} y={popover.y} onClose={() => setPopover(null)} />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   MINI CALENDAR
   ════════════════════════════════════════════════════════ */
function MiniCalendar({ month, focusDate, items, onNavigate, onMonthChange }) {
  const year = month.getFullYear(), mon = month.getMonth();
  const dates = getMonthGridDates(year, mon);

  /* Mark dots for any day covered by an item (includes multi-day via itemCoversDay) */
  const busySet = useMemo(() => {
    const s = new Set();
    dates.forEach(d => {
      if (items.some(item => itemCoversDay(item, d))) s.add(fmtISO(d));
    });
    return s;
  }, [items, dates]);

  return (
    <div className="cal-mini">
      <div className="cal-mini-header">
        <button className="cal-mini-nav" onClick={() => onMonthChange(addMonths(month, -1))}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8.5 10.5L4.5 6.5l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span className="cal-mini-title">{FR_MONTHS[mon].slice(0,3)} {year}</span>
        <button className="cal-mini-nav" onClick={() => onMonthChange(addMonths(month, 1))}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M4.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
      <div className="cal-mini-grid">
        {FR_DAYS.map(d => <div key={d} className="cal-mini-dow">{d.slice(0,2)}</div>)}
        {dates.map((d, i) => (
          <button
            key={i}
            className={`cal-mini-day${isSameDay(d, new Date()) ? " today" : ""}${isSameDay(d, focusDate) ? " focus" : ""}${d.getMonth() !== mon ? " other" : ""}`}
            onClick={() => onNavigate(d)}
          >
            {d.getDate()}
            {busySet.has(fmtISO(d)) && <span className="cal-mini-dot" />}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   WEEK VIEW
   ════════════════════════════════════════════════════════ */
function WeekView({ focusDate, items, onItemClick, onDayClick }) {
  const weekStart = getWeekStart(focusDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  /* Timed items: only single-day, always use start date */
  const timed = useMemo(() => items.filter(x => !x.allDay && x.time), [items]);

  return (
    <div className="cal-week">
      <div className="cal-week-header">
        <div className="cal-gutter" />
        {days.map((d, i) => {
          const isT = isSameDay(d, new Date());
          return (
            <div key={i} className={`cal-week-dh${isT ? " today" : ""}`}>
              <button className="cal-week-dh-btn" onClick={() => onDayClick(d)}>
                <span className="cal-week-dow">{FR_DAYS[i]}</span>
                <span className={`cal-week-dnum${isT ? " today" : ""}`}>{d.getDate()}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* All-day zone — includes multi-day items that cover each day */}
      <div className="cal-allday-row">
        <div className="cal-gutter cal-allday-lbl">Journée</div>
        {days.map((d, i) => {
          const dayAllDay = items.filter(x => x.allDay && itemCoversDay(x, d));
          return (
            <div key={i} className="cal-allday-cell">
              {dayAllDay.map(item => (
                <button key={`${item.id}-${fmtISO(d)}`} className="cal-chip" style={{ background: item.color.bg, color: item.color.text, borderColor: item.color.border }} onClick={e => onItemClick(item, e)}>
                  {item.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <div className="cal-grid-wrap">
        <div className="cal-grid">
          <div className="cal-hours-col">
            {HOURS.map(h => <div key={h} className="cal-hour-lbl">{h}h</div>)}
          </div>
          {days.map((d, di) => {
            const isT = isSameDay(d, new Date());
            const dayTimed = timed.filter(x => isSameDay(x.date, d));
            return (
              <div key={di} className={`cal-day-col${isT ? " today" : ""}`}>
                {HOURS.map(h => <div key={h} className="cal-hline" style={{ top: (h - HOUR_START) * HOUR_H }} />)}
                {dayTimed.map(item => <TimedEvent key={item.id} item={item} onClick={e => onItemClick(item, e)} />)}
                {isT && <NowLine />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   MONTH VIEW
   ════════════════════════════════════════════════════════ */
function MonthView({ focusDate, items, onItemClick, onDayClick }) {
  const year = focusDate.getFullYear(), month = focusDate.getMonth();
  const dates = getMonthGridDates(year, month);

  return (
    <div className="cal-month">
      <div className="cal-month-header">
        {FR_DAYS.map(d => <div key={d} className="cal-month-dow">{d}</div>)}
      </div>
      <div className="cal-month-grid">
        {dates.map((d, i) => {
          const isT = isSameDay(d, new Date()), isF = isSameDay(d, focusDate), other = d.getMonth() !== month;
          /* Timed items: exact day only. All-day items: cover check (multi-day). */
          const dayTimed  = items.filter(x => !x.allDay && isSameDay(x.date, d));
          const dayAllDay = items.filter(x => x.allDay && itemCoversDay(x, d));
          const dayItems  = [...dayAllDay, ...dayTimed];
          const shown = dayItems.slice(0, 3), more = dayItems.length - shown.length;
          return (
            <div key={i} className={`cal-mcell${other ? " other" : ""}${isT ? " today" : ""}`} onClick={() => onDayClick(d)}>
              <div className={`cal-mnum${isT ? " today" : ""}${isF ? " focus" : ""}`}>{d.getDate()}</div>
              <div className="cal-mevents">
                {shown.map(item => (
                  <button key={`${item.id}-${fmtISO(d)}`} className="cal-mchip" style={{ background: item.color.bg, color: item.color.text }} onClick={e => { e.stopPropagation(); onItemClick(item, e); }}>
                    {item.title}
                  </button>
                ))}
                {more > 0 && <div className="cal-mmore">+{more} autre{more > 1 ? "s" : ""}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   DAY VIEW
   ════════════════════════════════════════════════════════ */
function DayView({ focusDate, items, onItemClick }) {
  /* All-day: any item that covers focusDate (includes multi-day ranges) */
  const allDay = useMemo(() => items.filter(x => x.allDay && itemCoversDay(x, focusDate)), [items, focusDate]);
  /* Timed: only exact start-day items */
  const timed  = useMemo(() => items.filter(x => !x.allDay && x.time && isSameDay(x.date, focusDate)), [items, focusDate]);
  const isT    = isSameDay(focusDate, new Date());

  return (
    <div className="cal-day">
      {allDay.length > 0 && (
        <div className="cal-day-allday">
          <div className="cal-gutter cal-allday-lbl">Journée</div>
          <div className="cal-day-allday-chips">
            {allDay.map(item => (
              <button key={item.id} className="cal-chip" style={{ background: item.color.bg, color: item.color.text, borderColor: item.color.border }} onClick={e => onItemClick(item, e)}>
                {item.title}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="cal-grid-wrap">
        <div className="cal-grid" style={{ gridTemplateColumns: "48px 1fr" }}>
          <div className="cal-hours-col">
            {HOURS.map(h => <div key={h} className="cal-hour-lbl">{h}h</div>)}
          </div>
          <div className={`cal-day-col${isT ? " today" : ""}`} style={{ borderLeft: "1px solid var(--border)" }}>
            {HOURS.map(h => <div key={h} className="cal-hline" style={{ top: (h - HOUR_START) * HOUR_H }} />)}
            {timed.map(item => <TimedEvent key={item.id} item={item} onClick={e => onItemClick(item, e)} />)}
            {isT && <NowLine />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Timed event block ── */
function TimedEvent({ item, onClick }) {
  const startMin = timeToMins(item.time) ?? (HOUR_START * 60);
  const endMin   = item.endTime ? timeToMins(item.endTime) : startMin + 60;
  const top      = ((startMin / 60) - HOUR_START) * HOUR_H;
  const height   = Math.max(((endMin - startMin) / 60) * HOUR_H, 22);
  return (
    <button
      className="cal-timed"
      style={{ top, height, background: item.color.bg, color: item.color.text, borderLeft: `3px solid ${item.color.border}` }}
      onClick={onClick}
    >
      <span className="cal-timed-time">{item.time}</span>
      <span className="cal-timed-title">{item.title}</span>
    </button>
  );
}

/* ── Current time line ── */
function NowLine() {
  const [top, setTop] = useState(() => ((new Date().getHours() * 60 + new Date().getMinutes()) / 60 - HOUR_START) * HOUR_H);
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      setTop(((now.getHours() * 60 + now.getMinutes()) / 60 - HOUR_START) * HOUR_H);
    }, 60000);
    return () => clearInterval(id);
  }, []);
  if (top < 0 || top > (HOUR_END - HOUR_START) * HOUR_H) return null;
  return <div className="cal-now-line" style={{ top }} />;
}

/* ════════════════════════════════════════════════════════
   POPOVER — adaptée au type de source
   ════════════════════════════════════════════════════════ */
const ItemPopover = React.forwardRef(function ItemPopover({ item, x, y, onClose }, ref) {
  const { sourceType, title, date, endDate, time, endTime, allDay, club, status, meta } = item;
  const col = item.color;

  const dateStr = date
    ? `${FR_DAYS[(date.getDay()+6)%7]} ${date.getDate()} ${FR_MONTHS[date.getMonth()]} ${date.getFullYear()}`
    : null;
  const endDateStr = endDate
    ? `${FR_DAYS[(endDate.getDay()+6)%7]} ${endDate.getDate()} ${FR_MONTHS[endDate.getMonth()]} ${endDate.getFullYear()}`
    : null;
  const timeStr = allDay ? "Toute la journée" : time ? (endTime ? `${time} – ${endTime}` : time) : null;

  const safeX = Math.min(x, (typeof window !== "undefined" ? window.innerWidth  : 800) - 300);
  const safeY = Math.min(y, (typeof window !== "undefined" ? window.innerHeight : 600) - 340);

  return (
    <div ref={ref} className="cal-popover" style={{ left: safeX, top: safeY }}>
      <div className="cal-pop-header" style={{ borderTop: `3px solid ${col.border}` }}>
        <span className="cal-pop-type" style={{ background: col.bg, color: col.text }}>{SOURCE_LABELS[sourceType] || sourceType}</span>
        <button className="cal-pop-close" onClick={onClose} aria-label="Fermer">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 2l9 9M11 2l-9 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
        </button>
      </div>
      <div className="cal-pop-body">
        <div className="cal-pop-title">{title}</div>

        {/* Champs communs */}
        {dateStr    && <PopRow label={endDateStr ? "Début"   : "Date"}    value={dateStr} />}
        {endDateStr && <PopRow label="Fin"     value={endDateStr} />}
        {timeStr    && <PopRow label="Horaire" value={timeStr} />}
        {club       && <PopRow label="Club"    value={club.name} />}
        {status     && <PopRow label="Statut"  value={status} />}

        {/* Événements */}
        {sourceType === "event" && <>
          {meta.location && <PopRow label="Lieu" value={meta.location} />}
        </>}

        {/* Tâches */}
        {sourceType === "task" && <>
          {meta.assignedTo && <PopRow label="Assigné" value={meta.assignedTo} />}
          {meta.project    && <PopRow label="Projet"  value={meta.project} />}
        </>}

        {/* Publications */}
        {sourceType === "publication" && <>
          {meta.networks && <PopRow label="Réseaux" value={Array.isArray(meta.networks) ? meta.networks.join(", ") : meta.networks} />}
        </>}

        {/* Réunions */}
        {sourceType === "meeting" && <>
          {meta.location     && <PopRow label="Lieu"         value={meta.location} />}
          {meta.participants && <PopRow label="Participants"  value={Array.isArray(meta.participants) ? meta.participants.join(", ") : meta.participants} />}
        </>}

        {/* Metricool */}
        {sourceType === "metricool" && <>
          {meta.networks && <PopRow label="Réseaux" value={Array.isArray(meta.networks) ? meta.networks.join(", ") : meta.networks} />}
          {meta.text && <div className="cal-pop-excerpt">{meta.text.slice(0, 120)}{meta.text.length > 120 ? "…" : ""}</div>}
        </>}

        {/* Campagnes / Projets */}
        {sourceType === "project" && <>
          {(meta.owner || meta.responsable) && <PopRow label="Responsable" value={meta.owner || meta.responsable} />}
          {meta.members && <PopRow label="Équipe" value={Array.isArray(meta.members) ? meta.members.join(", ") : meta.members} />}
          {meta.description && <div className="cal-pop-excerpt">{meta.description.slice(0, 120)}{meta.description.length > 120 ? "…" : ""}</div>}
        </>}

        {/* Demandes clubs */}
        {sourceType === "request" && <>
          {meta.assignedTo && <PopRow label="Assigné"     value={meta.assignedTo} />}
          {meta.description && <div className="cal-pop-excerpt">{meta.description.slice(0, 120)}{meta.description.length > 120 ? "…" : ""}</div>}
        </>}
      </div>
    </div>
  );
});

function PopRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="cal-pop-row">
      <span className="cal-pop-lbl">{label}</span>
      <span className="cal-pop-val">{value}</span>
    </div>
  );
}
