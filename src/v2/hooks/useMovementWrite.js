/**
 * useMovementWrite — mouvements manuels P5 (admin uniquement).
 *
 * Schéma stockMovements étendu (compatible P4 "reception") :
 *   { id, type, direction, qty, itemId, variantId, clubId,
 *     campaignId, eventId, reason, transferId, by, at }
 *
 *   type      : "manual_in" | "manual_out" | "transfer_out" | "transfer_in"
 *   direction : "in" | "out"
 *   qty       : toujours > 0 (direction encode le sens)
 *   reason    : obligatoire pour out et transfer
 *   transferId: même valeur sur les deux legs d'un transfert ; null sinon
 *   by        : appId admin
 *   at        : ISO timestamp
 *
 * Contrainte de stock négatif : refusée dans la transaction pour "out" et "transfer_out".
 * Pour "manual_in" : aucune contrainte.
 *
 * Ledger stockMovements : append-only (update/delete: false en règles Firestore).
 */
import { doc, collection, runTransaction } from "firebase/firestore";
import { db } from "../../firebase";

const COLL_MOVEMENTS = "stockMovements";
const COLL_LEVELS    = "stockLevels";

function levelId(itemId, variantId, clubId) {
  return `${itemId}_${variantId}_${clubId}`;
}

function nowISO() {
  return new Date().toISOString();
}

/**
 * Saisie d'une entrée ou d'une sortie manuelle (1 mouvement, 1 level).
 *
 * @param {{ itemId, variantId, clubId, campaignId?, eventId?, qty, reason?, type }} formData
 *   type doit être "manual_in" ou "manual_out"
 * @param {string|number} by  appId de l'admin
 * @returns {Promise<string>} id du mouvement créé
 */
export async function createManualMovement(formData, by) {
  const { itemId, variantId, clubId, campaignId = null, eventId = null, qty, reason = "", type } = formData;

  if (!itemId)   throw new Error("Article obligatoire.");
  if (!variantId) throw new Error("Variante obligatoire.");
  if (!clubId)   throw new Error("Club obligatoire.");
  if (!type || (type !== "manual_in" && type !== "manual_out"))
    throw new Error("Type de mouvement invalide.");

  const qtyNum = Number(qty);
  if (!Number.isFinite(qtyNum) || qtyNum <= 0)
    throw new Error("La quantité doit être un nombre entier positif.");

  if (type === "manual_out" && !(reason || "").trim())
    throw new Error("Un motif est obligatoire pour une sortie.");

  const direction = type === "manual_in" ? "in" : "out";
  const movRef    = doc(collection(db, COLL_MOVEMENTS));
  const lvlRef    = doc(db, COLL_LEVELS, levelId(itemId, variantId, clubId));

  await runTransaction(db, async (tx) => {
    const lvlSnap   = await tx.get(lvlRef);
    const currentQty = lvlSnap.exists() ? (lvlSnap.data().quantity ?? 0) : 0;

    if (direction === "out" && currentQty < qtyNum) {
      throw new Error(
        `Stock insuffisant : ${currentQty} disponible(s), sortie demandée : ${qtyNum}.`
      );
    }

    const now = nowISO();
    const newQty = direction === "in" ? currentQty + qtyNum : currentQty - qtyNum;

    tx.set(movRef, {
      id:         movRef.id,
      type,
      direction,
      qty:        qtyNum,
      itemId,
      variantId,
      clubId,
      campaignId,
      eventId,
      reason:     (reason || "").trim(),
      transferId: null,
      by,
      at:         now,
    });

    tx.set(lvlRef, {
      id:             levelId(itemId, variantId, clubId),
      itemId,
      variantId,
      clubId,
      quantity:       newQty,
      lastMovementId: movRef.id,
      lastMovementAt: now,
      updatedAt:      now,
      updatedBy:      by,
    }, { merge: true });
  });

  return movRef.id;
}

/**
 * Transfert inter-clubs (2 mouvements + 2 levels en une seule transaction).
 *
 * @param {{ itemId, variantId, clubFromId, clubToId, campaignId?, eventId?, qty, reason? }} formData
 * @param {string|number} by  appId de l'admin
 * @returns {Promise<string>} transferId commun aux deux mouvements
 */
export async function createTransfer(formData, by) {
  const { itemId, variantId, clubFromId, clubToId, campaignId = null, eventId = null, qty, reason = "" } = formData;

  if (!itemId)    throw new Error("Article obligatoire.");
  if (!variantId) throw new Error("Variante obligatoire.");
  if (!clubFromId) throw new Error("Club source obligatoire.");
  if (!clubToId)   throw new Error("Club destination obligatoire.");
  if (clubFromId === clubToId) throw new Error("Club source et destination identiques.");

  const qtyNum = Number(qty);
  if (!Number.isFinite(qtyNum) || qtyNum <= 0)
    throw new Error("La quantité doit être un nombre entier positif.");

  if (!(reason || "").trim())
    throw new Error("Un motif est obligatoire pour un transfert.");

  const outRef    = doc(collection(db, COLL_MOVEMENTS));
  const inRef     = doc(collection(db, COLL_MOVEMENTS));
  const transferId = outRef.id; // id partagé entre les deux legs
  const lvlFromRef = doc(db, COLL_LEVELS, levelId(itemId, variantId, clubFromId));
  const lvlToRef   = doc(db, COLL_LEVELS, levelId(itemId, variantId, clubToId));

  await runTransaction(db, async (tx) => {
    const [fromSnap, toSnap] = await Promise.all([tx.get(lvlFromRef), tx.get(lvlToRef)]);
    const fromQty = fromSnap.exists() ? (fromSnap.data().quantity ?? 0) : 0;
    const toQty   = toSnap.exists()   ? (toSnap.data().quantity   ?? 0) : 0;

    if (fromQty < qtyNum) {
      throw new Error(
        `Stock insuffisant au club source : ${fromQty} disponible(s), transfert demandé : ${qtyNum}.`
      );
    }

    const now = nowISO();
    const reasonTrimmed = reason.trim();

    // Mouvement OUT sur club source
    tx.set(outRef, {
      id: outRef.id, type: "transfer_out", direction: "out", qty: qtyNum,
      itemId, variantId, clubId: clubFromId, campaignId, eventId,
      reason: reasonTrimmed, transferId, by, at: now,
    });

    // Mouvement IN sur club destination
    tx.set(inRef, {
      id: inRef.id, type: "transfer_in", direction: "in", qty: qtyNum,
      itemId, variantId, clubId: clubToId, campaignId, eventId,
      reason: reasonTrimmed, transferId, by, at: now,
    });

    // Level source -qty
    tx.set(lvlFromRef, {
      id: levelId(itemId, variantId, clubFromId),
      itemId, variantId, clubId: clubFromId,
      quantity: fromQty - qtyNum,
      lastMovementId: outRef.id, lastMovementAt: now, updatedAt: now, updatedBy: by,
    }, { merge: true });

    // Level destination +qty
    tx.set(lvlToRef, {
      id: levelId(itemId, variantId, clubToId),
      itemId, variantId, clubId: clubToId,
      quantity: toQty + qtyNum,
      lastMovementId: inRef.id, lastMovementAt: now, updatedAt: now, updatedBy: by,
    }, { merge: true });
  });

  return transferId;
}
