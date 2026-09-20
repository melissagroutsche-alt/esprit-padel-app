/**
 * useStockData — hooks read-only pour les collections Firestore natives du module Stock.
 *
 * Ces collections utilisent l'API Firestore collection/query/onSnapshot native —
 * elles ne passent PAS par le pattern appdata/{key} → { value: [] } de V1.
 *
 * Chaque hook retourne { data, loading, error } :
 *   loading  true pendant l'attachement du listener
 *   data     tableau (jamais null) — [] si collection vide ou inexistante
 *   error    objet Error ou null — permission-denied conservé pour diagnostic
 *
 * Aucune écriture. Aucune création de document. Aucun effet de bord Firestore.
 */
import { useState, useEffect, useRef } from "react";
import { collection, query, onSnapshot, where, orderBy } from "firebase/firestore";
import { db } from "../../firebase";

// ── Noms des collections Firestore natives ─────────────────────────────────
const COLL = {
  ITEMS:       "stockItems",
  LEVELS:      "stockLevels",
  RECEIPTS:    "stockReceipts",
  MOVEMENTS:   "stockMovements",
  INVENTORIES: "stockInventories",
};

// ── Hook générique — collection entière ───────────────────────────────────

/**
 * Attache un listener onSnapshot sur une collection Firestore native.
 * Gère proprement : chargement initial, collection vide, permission-denied.
 *
 * @param {string} collName  Nom de la collection Firestore
 * @param {import("firebase/firestore").QueryConstraint[]} constraints
 * @returns {{ data: Array, loading: boolean, error: Error|null }}
 */
function useCollection(collName, constraints = []) {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const unsubRef = useRef(null);

  useEffect(() => {
    if (!collName || !db) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let q;
    try {
      const ref = collection(db, collName);
      q = constraints.length > 0 ? query(ref, ...constraints) : query(ref);
    } catch (err) {
      setError(err);
      setLoading(false);
      return;
    }

    unsubRef.current = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setData(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        // Conserver l'erreur — notamment permission-denied — pour diagnostic.
        // L'interface affiche [] mais le hook expose l'erreur.
        setError(err);
        setData([]);
        setLoading(false);
      }
    );

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [collName]); // constraints intentionnellement exclu — recalculé par le parent à chaque render

  return { data, loading, error };
}

// ── Hooks publics ──────────────────────────────────────────────────────────

/**
 * Tous les articles de stock.
 * Filtre optionnel par campagne ou événement.
 *
 * @param {{ campaignId?: string, eventId?: string }} [filters]
 */
export function useStockItems(filters = {}) {
  const constraints = [];
  if (filters.campaignId) constraints.push(where("campaignId", "==", filters.campaignId));
  if (filters.eventId)    constraints.push(where("eventId",    "==", filters.eventId));
  const { data, loading, error } = useCollection(COLL.ITEMS, constraints);
  return { items: data, loading, error };
}

/**
 * Niveaux de stock courants.
 * Filtre optionnel par itemId et/ou clubId.
 *
 * @param {{ itemId?: string, clubId?: string }} [filters]
 */
export function useStockLevels(filters = {}) {
  const constraints = [];
  if (filters.itemId)  constraints.push(where("itemId",  "==", filters.itemId));
  if (filters.clubId)  constraints.push(where("clubId",  "==", filters.clubId));
  const { data, loading, error } = useCollection(COLL.LEVELS, constraints);
  return { levels: data, loading, error };
}

/**
 * Réceptions.
 * Filtre optionnel par clubId, campaignId, eventId et/ou status.
 *
 * @param {{ clubId?: string, campaignId?: string, eventId?: string, status?: string }} [filters]
 */
export function useStockReceipts(filters = {}) {
  const constraints = [];
  if (filters.clubId)     constraints.push(where("clubId",     "==", filters.clubId));
  if (filters.campaignId) constraints.push(where("campaignId", "==", filters.campaignId));
  if (filters.eventId)    constraints.push(where("eventId",    "==", filters.eventId));
  if (filters.status)     constraints.push(where("status",     "==", filters.status));
  const { data, loading, error } = useCollection(COLL.RECEIPTS, constraints);
  return { receipts: data, loading, error };
}

/**
 * Mouvements du ledger (append-only, jamais modifiés).
 * Filtre optionnel par itemId, variantId, clubId, campaignId, eventId, type.
 * Résultats triés par date décroissante si un filtre itemId est fourni.
 *
 * @param {{ itemId?: string, variantId?: string, clubId?: string, campaignId?: string, eventId?: string, type?: string }} [filters]
 */
export function useStockMovements(filters = {}) {
  const constraints = [];
  if (filters.itemId)     constraints.push(where("itemId",     "==", filters.itemId));
  if (filters.variantId)  constraints.push(where("variantId",  "==", filters.variantId));
  if (filters.clubId)     constraints.push(where("clubId",     "==", filters.clubId));
  if (filters.campaignId) constraints.push(where("campaignId", "==", filters.campaignId));
  if (filters.eventId)    constraints.push(where("eventId",    "==", filters.eventId));
  if (filters.type)       constraints.push(where("type",       "==", filters.type));
  // Tri chronologique descendant uniquement si au moins un champ de filtrage est fourni
  // (un orderBy sans filtre d'égalité ne nécessite pas d'index composite)
  if (Object.keys(filters).length > 0) {
    constraints.push(orderBy("at", "desc"));
  }
  const { data, loading, error } = useCollection(COLL.MOVEMENTS, constraints);
  return { movements: data, loading, error };
}

/**
 * Inventaires.
 * Filtre optionnel par clubId, campaignId, eventId, status.
 *
 * @param {{ clubId?: string, campaignId?: string, eventId?: string, status?: string }} [filters]
 */
export function useStockInventories(filters = {}) {
  const constraints = [];
  if (filters.clubId)     constraints.push(where("clubId",     "==", filters.clubId));
  if (filters.campaignId) constraints.push(where("campaignId", "==", filters.campaignId));
  if (filters.eventId)    constraints.push(where("eventId",    "==", filters.eventId));
  if (filters.status)     constraints.push(where("status",     "==", filters.status));
  const { data, loading, error } = useCollection(COLL.INVENTORIES, constraints);
  return { inventories: data, loading, error };
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Résout un clubId en objet club complet depuis le tableau clubs (ep:clubs).
 * Retourne undefined si le club n'est pas trouvé.
 *
 * @param {Array}  clubs   Tableau issu de useClubs() dans useV1Data.js
 * @param {string} clubId
 * @returns {Object|undefined}
 */
export function resolveClub(clubs, clubId) {
  if (!Array.isArray(clubs) || !clubId) return undefined;
  return clubs.find((c) => c.id === clubId || c.appId === clubId);
}

/**
 * Calcule le stock théorique d'une variante × club depuis les niveaux de stock.
 * isAlert = calculé, jamais persisté.
 *
 * @param {Array}  levels    Tableau issu de useStockLevels()
 * @param {Object} variant   Objet variante contenant alertThreshold
 * @param {string} itemId
 * @param {string} variantId
 * @param {string} clubId
 * @returns {{ quantity: number, isAlert: boolean } | null}
 */
export function resolveStockLevel(levels, variant, itemId, variantId, clubId) {
  if (!Array.isArray(levels)) return null;
  const levelId = `${itemId}_${variantId}_${clubId}`;
  const level = levels.find((l) => l.id === levelId);
  if (!level) return { quantity: 0, isAlert: variant ? 0 <= (variant.alertThreshold ?? 0) : false };
  const qty = level.quantity ?? 0;
  const threshold = variant?.alertThreshold ?? 0;
  return { quantity: qty, isAlert: qty <= threshold };
}
