/**
 * useStockWrite — helpers d'écriture pour la collection Firestore native stockItems.
 * P3 scope : createStockItem, updateStockItem uniquement.
 *
 * Schéma canonique variante :
 *   { id, label, dimensions: { taille, genre, couleur, modele, annee, custom: {} },
 *     purchasePriceHT, salePriceTTC, alertThreshold, active }
 *
 * Schéma canonique financialRule :
 *   { type: "reversement", mode, amountPerUnit, rate, beneficiary, currency: "EUR" }
 *   → amountPerUnit non null si per_unit, rate non null si percentage.
 *
 * Aucun total / montant calculé n'est persisté.
 */
import { doc, setDoc, collection } from "firebase/firestore";
import { db } from "../../firebase";

const COLL_ITEMS = "stockItems";

function variantUid() {
  return "v" + String(Date.now()) + String(Math.random()).slice(2, 8);
}

function sanitizeVariant(v) {
  const dims = v.dimensions || {};
  return {
    id:    v.id || variantUid(),
    label: (v.label || "").trim(),
    dimensions: {
      taille:  (dims.taille  || "").trim(),
      genre:   (dims.genre   || "").trim(),
      couleur: (dims.couleur || "").trim(),
      modele:  (dims.modele  || "").trim(),
      annee:   dims.annee   || null,
      custom:  (dims.custom && typeof dims.custom === "object") ? { ...dims.custom } : {},
    },
    purchasePriceHT: v.purchasePriceHT != null && v.purchasePriceHT !== ""
      ? Number(v.purchasePriceHT) : null,
    salePriceTTC:    v.salePriceTTC    != null && v.salePriceTTC    !== ""
      ? Number(v.salePriceTTC)    : null,
    alertThreshold:  v.alertThreshold  != null && v.alertThreshold  !== ""
      ? Number(v.alertThreshold)  : 0,
    active: v.active !== false,
  };
}

function sanitizeFinancialRule(rule) {
  if (!rule || !rule.mode) return null;
  const base = {
    type:        "reversement",
    mode:        rule.mode,
    beneficiary: (rule.beneficiary || "").trim(),
    currency:    "EUR",
  };
  if (rule.mode === "per_unit") {
    return {
      ...base,
      amountPerUnit: rule.amountPerUnit != null && rule.amountPerUnit !== ""
        ? Number(rule.amountPerUnit) : null,
      rate: null,
    };
  }
  if (rule.mode === "percentage") {
    const raw = rule.rate != null && rule.rate !== "" ? Number(rule.rate) : null;
    // Normalise en décimal : si l'utilisateur saisit 10, on stocke 0.10
    const decimal = raw != null ? (raw > 1 ? raw / 100 : raw) : null;
    return {
      ...base,
      amountPerUnit: null,
      rate:          decimal,
    };
  }
  return null;
}

/**
 * Crée un nouvel article dans stockItems.
 * L'id Firestore est généré avant l'écriture et inclus dans le document.
 *
 * @param {Array}        existingItems  tableau courant (vérification unicité SKU)
 * @param {Object}       formData       champs saisis par l'admin
 * @param {string|number} appId         id utilisateur connecté
 * @returns {Promise<string>}           id Firestore du document créé
 */
export async function createStockItem(existingItems, formData, appId) {
  const name = (formData.name || "").trim();
  const sku  = (formData.sku  || "").trim().toUpperCase();

  if (!name) throw new Error("Le nom de l'article est obligatoire.");
  if (!sku)  throw new Error("Le SKU / référence est obligatoire.");
  if (!formData.campaignId && !formData.eventId) {
    throw new Error("L'article doit être lié à au moins une campagne ou un événement.");
  }

  const skuLower = sku.toLowerCase();
  const duplicate = (existingItems || []).find(
    item => (item.sku || "").toLowerCase() === skuLower
  );
  if (duplicate) {
    throw new Error(`Le SKU « ${sku} » est déjà utilisé par l'article « ${duplicate.name} ».`);
  }

  // Générer l'id AVANT le setDoc pour l'inclure dans le document
  const newRef = doc(collection(db, COLL_ITEMS));
  const now    = new Date().toISOString();

  const newItem = {
    id:            newRef.id,
    name,
    sku,
    category:      formData.category || "autre",
    unit:          formData.unit     || "pièce",
    campaignId:    formData.campaignId || null,
    eventId:       formData.eventId    || null,
    notes:         (formData.notes || "").trim(),
    financialRule: sanitizeFinancialRule(formData.financialRule),
    variants:      (formData.variants || []).map(sanitizeVariant),
    createdAt:     now,
    updatedAt:     now,
    createdBy:     appId,
  };

  await setDoc(newRef, newItem);
  return newRef.id;
}

/**
 * Met à jour un article existant (patch partiel via setDoc merge).
 *
 * @param {string}       itemId  id Firestore du document
 * @param {Object}       patch   champs à mettre à jour
 * @param {string|number} appId  id utilisateur connecté
 */
export async function updateStockItem(itemId, patch, appId) {
  if (!itemId) throw new Error("itemId manquant.");

  const updates = { ...patch, updatedAt: new Date().toISOString(), updatedBy: appId };

  if (patch.sku)           updates.sku           = patch.sku.trim().toUpperCase();
  if (patch.name)          updates.name          = patch.name.trim();
  if (patch.variants)      updates.variants      = patch.variants.map(sanitizeVariant);
  if ("financialRule" in patch) updates.financialRule = sanitizeFinancialRule(patch.financialRule);

  await setDoc(doc(db, COLL_ITEMS, itemId), updates, { merge: true });
}
