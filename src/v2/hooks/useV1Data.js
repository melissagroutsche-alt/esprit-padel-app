/**
 * useV1Data — hooks read-only pour les collections Firestore V1.
 * Lit les clés `appdata/{key}` au format V1 : { value: [...], updatedAt: ... }
 * Aucune écriture. Aucune migration. Source unique : Firestore V1.
 */
import { useState, useEffect, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

function useFirestoreRead(key) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef(null);

  useEffect(() => {
    if (!key || !db) {
      setLoading(false);
      return;
    }
    // Attach listener
    try {
      unsubRef.current = onSnapshot(doc(db, "appdata", key), (snap) => {
        if (snap.exists()) {
          const raw = snap.data().value;
          setData(raw !== undefined ? raw : null);
        } else {
          setData(null);
        }
        setLoading(false);
      }, () => {
        // Permission error or offline — fail gracefully
        setData(null);
        setLoading(false);
      });
    } catch {
      setData(null);
      setLoading(false);
    }
    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [key]);

  return { data, loading };
}

/* ── Exports nommés par collection ── */

export function useUsers() {
  const { data, loading } = useFirestoreRead("ep:users");
  return { users: data || [], loading };
}

export function useTasks() {
  const { data, loading } = useFirestoreRead("ep:tasks");
  return { tasks: data || [], loading };
}

export function useRequests() {
  const { data, loading } = useFirestoreRead("ep:requests");
  return { requests: data || [], loading };
}

export function usePublications() {
  const { data, loading } = useFirestoreRead("ep:publications");
  return { publications: data || [], loading };
}

export function useObjectives() {
  const { data, loading } = useFirestoreRead("ep:objectives");
  return { objectives: data || [], loading };
}

export function useProjects() {
  const { data, loading } = useFirestoreRead("ep:projects");
  return { projects: data || [], loading };
}

export function useCalendarEvents() {
  const { data, loading } = useFirestoreRead("ep:events");
  return { events: data || [], loading };
}

export function useReporting() {
  const { data, loading } = useFirestoreRead("ep:reporting");
  return { reporting: data || [], loading };
}

export function useClubs() {
  const { data, loading } = useFirestoreRead("ep:clubs");
  return { clubs: data || [], loading };
}

/* ── Helpers ── */

/**
 * Retourne les tâches à traiter aujourd'hui pour un appId donné.
 * Critères : non terminée ET (échéance ≤ aujourd'hui OU urgence haute).
 */
export function filterTodayTasks(tasks, appId) {
  if (!Array.isArray(tasks)) return [];
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return tasks.filter((t) => {
    if (!t) return false;
    const done = t.status === "done" || t.status === "completed" || t.status === "terminé" || t.done === true;
    if (done) return false;
    const mine = !t.assignedTo || t.assignedTo === appId;
    if (!mine) return false;
    const isUrgent = t.urgency === "haute" || t.urgency === "high" || t.priority === "high" || t.priority === "haute";
    const hasDue = t.dueDate || t.deadline || t.date;
    if (hasDue) {
      const d = new Date(hasDue);
      if (!isNaN(d.getTime()) && d <= today) return true;
    }
    if (isUrgent) return true;
    return false;
  });
}

/**
 * Retourne les demandes clubs ouvertes (non clôturées, non refusées).
 */
export function filterOpenRequests(requests) {
  if (!Array.isArray(requests)) return [];
  const closed = ["clôturée", "closed", "refusée", "refused", "rejected"];
  return requests.filter((r) => r && !closed.includes((r.status || "").toLowerCase()));
}

/**
 * Retourne les publications en attente de validation.
 */
export function filterPendingValidations(publications) {
  if (!Array.isArray(publications)) return [];
  return publications.filter((p) => {
    if (!p) return false;
    const s = (p.status || p.statut || "").toLowerCase();
    return s === "review" || s === "à valider" || s === "pending" || s === "review_pending";
  });
}

/**
 * Retourne les objectifs actifs.
 */
export function filterActiveObjectives(objectives) {
  if (!Array.isArray(objectives)) return [];
  return objectives.filter((o) => {
    if (!o) return false;
    const s = (o.status || o.statut || "").toLowerCase();
    return s === "actif" || s === "active" || s === "en cours" || (!s && !o.archived);
  });
}
