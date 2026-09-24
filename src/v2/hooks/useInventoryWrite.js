/**
 * useInventoryWrite — inventaires physiques P6.
 *
 * Schéma canonique stockInventories :
 *   { id, itemId, variantId, clubId, campaignId, eventId,
 *     countedQty, note, status,
 *     createdAt, createdBy,
 *     validatedAt, validatedBy, movementId,
 *     rejectedAt, rejectedBy, rejectNote }
 *
 * Schéma stockMovements créé par validateInventoryTx :
 *   { id, type:"adjustment", direction:"in"|"out", qty,
 *     itemId, variantId, clubId, campaignId, eventId,
 *     reason, inventoryId, by, at }
 *
 * Convention delta=0 : mouvement adjustment qty:0 direction:"in" créé
 * systématiquement — garantit movementId non-null pour la garde d'idempotence.
 *
 * Règles Firestore (P6) :
 *   create  : tout utilisateur authentifié
 *   update/delete : admin uniquement
 */
import { doc, collection, setDoc, updateDoc, runTransaction } from "firebase/firestore";
import { db } from "../../firebase";

const COLL_INVENTORIES = "stockInventories";
const COLL_MOVEMENTS   = "stockMovements";
const COLL_LEVELS      = "stockLevels";

function levelId(itemId, variantId, clubId) {
  return `${itemId}_${variantId}_${clubId}`;
}

function nowISO() {
  return new Date().toISOString();
}

/**
 * Crée un inventaire en statut pending.
 *
 * @param {{ itemId, variantId, clubId, campaignId?, eventId?, countedQty, note? }} formData
 * @param {string|number} by  appId ou uid du créateur
 * @returns {Promise<string>} id du document créé
 */
export async function createInventory(formData, by) {
  const { itemId, variantId, clubId, campaignId = null, eventId = null, countedQty, note = "" } = formData;

  if (!itemId)    throw new Error("Article obligatoire.");
  if (!variantId) throw new Error("Variante obligatoire.");
  if (!clubId)    throw new Error("Club obligatoire.");

  const qty = Number(countedQty);
  if (!Number.isFinite(qty) || qty < 0)
    throw new Error("La quantité comptée doit être un nombre positif ou nul.");

  const newRef = doc(collection(db, COLL_INVENTORIES));
  const now    = nowISO();

  await setDoc(newRef, {
    id:           newRef.id,
    itemId,
    variantId,
    clubId,
    campaignId,
    eventId,
    countedQty:   qty,
    note:         (note || "").trim(),
    status:       "pending",
    createdAt:    now,
    createdBy:    by,
    validatedAt:  null,
    validatedBy:  null,
    movementId:   null,
    rejectedAt:   null,
    rejectedBy:   null,
    rejectNote:   "",
  });

  return newRef.id;
}

/**
 * Valide un inventaire — transaction atomique.
 *
 * 1. Lit l'inventaire et vérifie status==="pending" + movementId===null
 * 2. Lit stockLevels courant (currentQty=0 si absent)
 * 3. Crée stockMovements adjustment (qty=0 si delta=0 — trace d'audit)
 * 4. stockLevels.quantity = countedQty (affectation directe)
 * 5. Inventaire → validated + movementId + validatedAt/By
 *
 * @param {string} inventoryId
 * @param {string|number} by  appId de l'admin
 * @returns {Promise<string>} id du mouvement créé
 */
export async function validateInventoryTx(inventoryId, by) {
  const invRef    = doc(db, COLL_INVENTORIES, inventoryId);
  const newMovRef = doc(collection(db, COLL_MOVEMENTS));

  await runTransaction(db, async (tx) => {
    const invSnap = await tx.get(invRef);
    if (!invSnap.exists()) throw new Error("Inventaire introuvable.");

    const inv = invSnap.data();
    if (inv.status !== "pending")
      throw new Error("Cet inventaire n'est pas en attente de validation.");
    if (inv.movementId !== null)
      throw new Error("Cet inventaire a déjà été validé.");

    const lvlId  = levelId(inv.itemId, inv.variantId, inv.clubId);
    const lvlRef = doc(db, COLL_LEVELS, lvlId);
    const lvlSnap = await tx.get(lvlRef);
    const currentQty = lvlSnap.exists() ? (lvlSnap.data().quantity ?? 0) : 0;

    const delta     = inv.countedQty - currentQty;
    const direction = delta >= 0 ? "in" : "out";
    const qty       = Math.abs(delta);
    const now       = nowISO();
    const reason    = delta === 0
      ? "Inventaire validé — aucun écart"
      : `Inventaire validé — écart : ${delta > 0 ? "+" : ""}${delta}`;

    // Mouvement adjustment (systématique, même qty=0)
    tx.set(newMovRef, {
      id:           newMovRef.id,
      type:         "adjustment",
      direction,
      qty,
      itemId:       inv.itemId,
      variantId:    inv.variantId,
      clubId:       inv.clubId,
      campaignId:   inv.campaignId,
      eventId:      inv.eventId,
      reason,
      inventoryId,
      transferId:   null,
      by,
      at:           now,
    });

    // StockLevel = countedQty (affectation directe, idempotente)
    tx.set(lvlRef, {
      id:             lvlId,
      itemId:         inv.itemId,
      variantId:      inv.variantId,
      clubId:         inv.clubId,
      quantity:       inv.countedQty,
      lastMovementId: newMovRef.id,
      lastMovementAt: now,
      updatedAt:      now,
      updatedBy:      by,
    }, { merge: true });

    // Inventaire validé
    tx.update(invRef, {
      status:      "validated",
      movementId:  newMovRef.id,
      validatedAt: now,
      validatedBy: by,
    });
  });

  return newMovRef.id;
}

/**
 * Rejette un inventaire pending (admin uniquement).
 * Aucun mouvement créé, aucun level modifié.
 *
 * @param {string} inventoryId
 * @param {string} rejectNote  motif de rejet
 * @param {string|number} by  appId de l'admin
 */
export async function rejectInventory(inventoryId, rejectNote, by) {
  if (!(rejectNote || "").trim())
    throw new Error("Un motif de rejet est obligatoire.");

  const invRef = doc(db, COLL_INVENTORIES, inventoryId);
  await updateDoc(invRef, {
    status:      "rejected",
    rejectedAt:  nowISO(),
    rejectedBy:  by,
    rejectNote:  rejectNote.trim(),
  });
}
