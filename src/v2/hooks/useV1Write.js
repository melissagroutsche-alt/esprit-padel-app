/**
 * useV1Write — helpers d'écriture pour les collections Firestore V1.
 * Cible exclusive : appdata/ep:campagnes
 * Structure V1 : { value: [...], updatedAt: Date.now() }
 *
 * Toutes les modifications partent de l'objet existant complet via spread
 * pour ne jamais détruire un champ non édité par V2.
 *
 * Pas de Storage dans cette passe. Pas de suppression.
 */
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";

const EP_CAMPAGNES = "ep:campagnes";

function uid() {
  return String(Date.now()) + String(Math.random()).slice(2, 8);
}

/**
 * Synchronise timeline → actions, identique à la logique V1.
 * Préserve clubStatus existant pour chaque action.
 * Clubs = tous les clubs fournis au moment du save.
 */
export function syncTimelineToActions(timeline, existingActions, clubs) {
  return (timeline || [])
    .filter(t => t.label && t.label.trim())
    .map(t => {
      const existing = (existingActions || []).find(a => String(a.id) === String(t.id));
      return {
        id: t.id,
        label: t.label,
        deadline: t.date || "",
        phase: t.phase,
        clubs: (clubs || []).map(c => c.id),
        clubStatus: existing?.clubStatus || {},
        done: t.done || false,
      };
    });
}

/**
 * Valeurs par défaut compatibles EMPTY_FORM() V1.
 * Utilisées à la création pour garantir la compatibilité.
 */
function defaultCampagne() {
  return {
    name: "",
    dateStart: "",
    dateEnd: "",
    persona: "",
    positioning: "",
    concept: "",
    signature: "",
    channels: [],
    hashtags: "",
    pushTitle: "",
    pushMessage: "",
    whatsappMessage: "",
    whatsappMessages: [],
    notifications: [],
    visuels: [],
    pdfName: "Campagne",
    published: false,
    channelNotes: {},
    links: [],
    visualLinks: [],
    visualsTodo: [],
    objectives: [],
    packs: [],
    products: "",
    carteClub: "",
    abonnements: "",
    cours: "",
    coursIndividuel: "",
    kpi: [],
    kpiData: {},
    kpiIndicators: [],
    kpiValues: {},
    targets: [],
    presentation: "",
    timeline: [
      { id: uid(), phase: "Avant",   label: "", date: "", done: false },
      { id: uid(), phase: "Pendant", label: "", date: "", done: false },
      { id: uid(), phase: "Après",   label: "", date: "", done: false },
    ],
    actions: [],
  };
}

/**
 * Crée une nouvelle campagne.
 * @param {Array}  campagnes  tableau courant (depuis useCampagnes hook)
 * @param {Object} formData   champs saisis par l'utilisateur
 * @param {string} appId      id de l'utilisateur connecté (owner)
 * @param {Array}  clubs      liste des clubs (pour sync actions)
 * @returns {Promise<string>} id de la nouvelle campagne
 */
export async function createCampagne(campagnes, formData, appId, clubs) {
  const newId = uid();
  const defaults = defaultCampagne();
  const syncedActions = syncTimelineToActions(
    formData.timeline || defaults.timeline,
    [],
    clubs
  );
  const newCamp = {
    ...defaults,
    ...formData,
    id: newId,
    actions: syncedActions,
    owner: appId,
    createdAt: new Date().toISOString(),
    published: false, // toujours brouillon à la création
  };
  const newArray = [...campagnes, newCamp];
  await setDoc(doc(db, "appdata", EP_CAMPAGNES), {
    value: newArray,
    updatedAt: Date.now(),
  });
  return newId;
}

/**
 * Modifie une campagne existante.
 * Part obligatoirement de l'objet existant pour préserver les champs inconnus.
 * @param {Array}  campagnes       tableau courant
 * @param {string} id              id de la campagne à modifier
 * @param {Object} patch           champs modifiés
 * @param {Array}  clubs           liste des clubs (pour sync actions si timeline modifiée)
 * @returns {Promise<void>}
 */
export async function updateCampagne(campagnes, id, patch, clubs) {
  const existing = campagnes.find(c => String(c.id) === String(id));
  if (!existing) throw new Error(`Campagne introuvable : ${id}`);

  // Si le patch contient une timeline, resynchroniser les actions
  let syncedActions = existing.actions;
  if (patch.timeline !== undefined) {
    syncedActions = syncTimelineToActions(patch.timeline, existing.actions, clubs);
  }

  const updated = {
    ...existing,
    ...patch,
    actions: syncedActions,
  };

  const newArray = campagnes.map(c => String(c.id) === String(id) ? updated : c);
  await setDoc(doc(db, "appdata", EP_CAMPAGNES), {
    value: newArray,
    updatedAt: Date.now(),
  });
}

/**
 * Bascule published d'une campagne (publier / repasser en brouillon).
 * @param {Array}  campagnes  tableau courant
 * @param {string} id         id de la campagne
 * @returns {Promise<void>}
 */
export async function togglePublished(campagnes, id) {
  const existing = campagnes.find(c => String(c.id) === String(id));
  if (!existing) throw new Error(`Campagne introuvable : ${id}`);
  const updated = { ...existing, published: !existing.published };
  const newArray = campagnes.map(c => String(c.id) === String(id) ? updated : c);
  await setDoc(doc(db, "appdata", EP_CAMPAGNES), {
    value: newArray,
    updatedAt: Date.now(),
  });
}
