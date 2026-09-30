"use strict";

const crypto = require("crypto");

// Firebase Admin — initialisé une seule fois (warm lambda).
let adminApp = null;

function getAdminApp() {
  if (adminApp) return adminApp;

  const admin = require("firebase-admin");
  if (admin.apps.length) {
    adminApp = admin.apps[0];
    return adminApp;
  }

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined;

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  adminApp = admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
  return adminApp;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// Génère un token de 256 bits d'entropie cryptographique.
// Utilisé à la fois comme ID Firestore et comme partie du lien public.
// URL-safe : hexadécimal 64 caractères, aucun caractère spécial.
function generateSecureToken() {
  return crypto.randomBytes(32).toString("hex");
}

exports.handler = async function (event) {
  // 1. Méthode
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Méthode non autorisée. Utilisez POST." });
  }

  // 2. Configuration Firebase Admin
  const app = getAdminApp();
  if (!app) {
    return json(503, {
      error: "Service temporairement indisponible. Contactez l'administrateur.",
    });
  }

  const admin    = require("firebase-admin");
  const db       = admin.firestore();
  const authSvc  = admin.auth();

  // 3. Extraction et vérification du Firebase ID token
  const authHeader = event.headers && event.headers["authorization"];
  const bearerToken = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!bearerToken) {
    return json(401, { error: "Token d'authentification manquant." });
  }

  let decodedToken;
  try {
    decodedToken = await authSvc.verifyIdToken(bearerToken);
  } catch {
    return json(401, { error: "Token d'authentification invalide ou expiré." });
  }

  // 4. Vérification du claim admin — pattern strict du projet
  if (!("admin" in decodedToken) || decodedToken.admin !== true) {
    return json(403, { error: "Action réservée aux administrateurs." });
  }

  // 4b. Vérification de l'appId — doit être un entier valide (claim Firebase)
  if (typeof decodedToken.appId !== "number" || !Number.isInteger(decodedToken.appId)) {
    return json(500, { error: "Configuration du compte invalide. Contactez l'administrateur." });
  }

  // 5. Lecture du receiptId depuis le corps
  let payload;
  try {
    if (!event.body || !event.body.trim()) throw new Error("Corps vide.");
    payload = JSON.parse(event.body);
  } catch {
    return json(400, { error: "Corps de la requête invalide. JSON attendu." });
  }

  const { receiptId } = payload;
  if (!receiptId || typeof receiptId !== "string" || !receiptId.trim()) {
    return json(400, { error: "Champ 'receiptId' obligatoire." });
  }

  // 6. Vérification de la réception côté Firestore Admin
  const receiptRef  = db.collection("stockReceipts").doc(receiptId.trim());
  const receiptSnap = await receiptRef.get();

  if (!receiptSnap.exists) {
    return json(404, { error: "Réception introuvable." });
  }

  // 7. Vérification statut pending
  const receipt = receiptSnap.data();
  if (receipt.status !== "pending") {
    return json(409, {
      error: "Impossible de générer un lien : la réception n'est plus en attente.",
      status: receipt.status,
    });
  }

  // 8. Création du token
  let tokenId, expiresAt;
  try {
    tokenId = generateSecureToken();
    const now = new Date();
    expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await db.collection("receptionTokens").doc(tokenId).set({
      id:        tokenId,
      receiptId: receiptId.trim(),
      createdAt: now.toISOString(),
      createdBy: decodedToken.appId, // entier vérifié au point 4b, jamais issu du body
      expiresAt: expiresAt.toISOString(),
      usedAt:    null,
      revoked:   false,
      revokedAt: null,
      revokedBy: null,
    });
  } catch {
    return json(500, { error: "Erreur lors de la création du lien. Réessayez." });
  }

  return json(201, {
    tokenId,
    receiptId: receiptId.trim(),
    expiresAt: expiresAt.toISOString(),
  });
};
