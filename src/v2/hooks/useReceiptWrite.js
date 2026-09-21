/**
 * useReceiptWrite — helpers d'écriture pour la collection Firestore native stockReceipts.
 * P4 scope : createReceipt, submitReceipt, validateReceiptTx, rejectReceipt.
 *
 * Schéma canonique stockMovements créé par validateReceiptTx :
 *   { id, type:"reception", direction:"in", qty:receivedQty,
 *     itemId, variantId, clubId, campaignId, eventId, receiptId, by, at }
 *
 * Schéma canonique stockLevels mis à jour par validateReceiptTx :
 *   { id:"${itemId}_${variantId}_${clubId}", itemId, variantId, clubId,
 *     quantity, lastMovementId, lastMovementAt, updatedAt, updatedBy }
 *
 * La transaction de validation est atomique et idempotente grâce à la garde movementId.
 * receivedQty = 0 crée un mouvement qty:0 — la garde movementId reste valide.
 */
import { doc, setDoc, updateDoc, collection, runTransaction } from "firebase/firestore";
import { db } from "../../firebase";

const COLL_RECEIPTS  = "stockReceipts";
const COLL_MOVEMENTS = "stockMovements";
const COLL_LEVELS    = "stockLevels";

/**
 * Crée une réception attendue (admin uniquement).
 * L'id Firestore est généré avant l'écriture et inclus dans le document.
 *
 * @param {{ itemId, variantId, clubId, plannedQty, campaignId?, eventId? }} formData
 * @param {number} appId  id utilisateur admin connecté
 * @returns {Promise<string>} id Firestore de la réception créée
 */
export async function createReceipt(formData, appId) {
  if (!formData.itemId)    throw new Error("Article obligatoire.");
  if (!formData.variantId) throw new Error("Variante obligatoire.");
  if (!formData.clubId)    throw new Error("Club obligatoire.");

  const plannedQty = Number(formData.plannedQty);
  if (isNaN(plannedQty) || plannedQty < 0)
    throw new Error("La quantité prévue doit être un nombre positif ou nul.");

  const newRef = doc(collection(db, COLL_RECEIPTS));
  const now    = new Date().toISOString();

  await setDoc(newRef, {
    id:            newRef.id,
    itemId:        formData.itemId,
    variantId:     formData.variantId,
    clubId:        formData.clubId,
    campaignId:    formData.campaignId    || null,
    eventId:       formData.eventId       || null,
    plannedQty,
    receivedQty:   null,
    delta:         null,
    deltaNote:     "",
    status:        "pending",
    createdAt:     now,
    createdBy:     appId,
    submittedAt:   null,
    submittedBy:   null,
    validatedAt:   null,
    validatedBy:   null,
    rejectedAt:    null,
    rejectedBy:    null,
    rejectionNote: "",
    movementId:    null,
  });

  return newRef.id;
}

/**
 * Soumet la saisie des quantités reçues par l'équipe.
 * Règles : receivedQty >= 0, note obligatoire si delta !== 0.
 *
 * @param {string} receiptId
 * @param {number} receivedQty    quantité réellement reçue
 * @param {string} deltaNote      note d'écart (obligatoire si delta !== 0)
 * @param {number} plannedQty     quantité prévue (pour calculer delta côté client)
 * @param {string} authUid        Firebase Auth UID de l'utilisateur soumettant
 */
export async function submitReceipt(receiptId, receivedQty, deltaNote, plannedQty, authUid) {
  const qty = Number(receivedQty);
  if (isNaN(qty) || qty < 0)
    throw new Error("La quantité reçue doit être un nombre positif ou nul.");

  const delta = qty - Number(plannedQty);
  if (delta !== 0 && !(deltaNote || "").trim())
    throw new Error("Une note d'écart est obligatoire quand la quantité reçue diffère de la quantité prévue.");

  await updateDoc(doc(db, COLL_RECEIPTS, receiptId), {
    receivedQty:  qty,
    delta,
    deltaNote:    (deltaNote || "").trim(),
    status:       "submitted",
    submittedAt:  new Date().toISOString(),
    submittedBy:  authUid,
  });
}

/**
 * Valide une réception soumise — transaction atomique.
 *
 * Opérations dans la transaction :
 *   1. Vérifier statut === "submitted" et movementId === null (garde)
 *   2. Lire le niveau de stock courant
 *   3. Créer un mouvement de type reception (qty: receivedQty, direction: "in")
 *   4. Mettre à jour stockLevels (quantity, lastMovementId, lastMovementAt)
 *   5. Marquer la réception validée et poser movementId
 *
 * @param {string} receiptId
 * @param {number} appId   id admin validant
 * @returns {Promise<string>} id du mouvement créé
 */
export async function validateReceiptTx(receiptId, appId) {
  const receiptRef = doc(db, COLL_RECEIPTS, receiptId);
  const newMovRef  = doc(collection(db, COLL_MOVEMENTS)); // id pré-généré hors tx

  await runTransaction(db, async (tx) => {
    // 1 — Lire la réception
    const receiptSnap = await tx.get(receiptRef);
    if (!receiptSnap.exists()) throw new Error("Réception introuvable.");
    const receipt = receiptSnap.data();

    // 2 — Gardes
    if (receipt.status !== "submitted")
      throw new Error("La réception n'est pas en attente de validation.");
    if (receipt.movementId !== null)
      throw new Error("Cette réception a déjà été validée.");

    // 3 — Lire le niveau de stock courant (peut ne pas exister)
    const levelId   = `${receipt.itemId}_${receipt.variantId}_${receipt.clubId}`;
    const levelRef  = doc(db, COLL_LEVELS, levelId);
    const levelSnap = await tx.get(levelRef);
    const currentQty = levelSnap.exists() ? (levelSnap.data().quantity ?? 0) : 0;

    const now = new Date().toISOString();

    // 4 — Créer le mouvement (ledger append-only)
    tx.set(newMovRef, {
      id:         newMovRef.id,
      type:       "reception",
      direction:  "in",
      qty:        receipt.receivedQty,   // jamais delta
      itemId:     receipt.itemId,
      variantId:  receipt.variantId,
      clubId:     receipt.clubId,
      campaignId: receipt.campaignId,
      eventId:    receipt.eventId,
      receiptId,
      by:         appId,
      at:         now,
    });

    // 5 — Mettre à jour le niveau de stock
    tx.set(levelRef, {
      id:             levelId,
      itemId:         receipt.itemId,
      variantId:      receipt.variantId,
      clubId:         receipt.clubId,
      quantity:       currentQty + receipt.receivedQty,
      lastMovementId: newMovRef.id,
      lastMovementAt: now,
      updatedAt:      now,
      updatedBy:      appId,
    }, { merge: true });

    // 6 — Valider la réception + poser movementId (garde double-validation)
    tx.update(receiptRef, {
      status:      "validated",
      movementId:  newMovRef.id,
      validatedAt: now,
      validatedBy: appId,
    });
  });

  return newMovRef.id;
}

/**
 * Rejette une réception soumise (admin uniquement).
 * État terminal — aucune transition possible depuis "rejected".
 *
 * @param {string} receiptId
 * @param {string} rejectionNote  note de rejet obligatoire
 * @param {number} appId
 */
export async function rejectReceipt(receiptId, rejectionNote, appId) {
  if (!(rejectionNote || "").trim())
    throw new Error("Une note de rejet est obligatoire.");

  await updateDoc(doc(db, COLL_RECEIPTS, receiptId), {
    status:        "rejected",
    rejectedAt:    new Date().toISOString(),
    rejectedBy:    appId,
    rejectionNote: rejectionNote.trim(),
  });
}
