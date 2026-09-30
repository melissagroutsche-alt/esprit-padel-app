"use strict";

// Firebase Admin — initialisé une seule fois (warm lambda).
// Les credentials viennent exclusivement des variables d'environnement Netlify.
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
  // Netlify stocke les clés PEM avec des \n littéraux → on les restaure.
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined;

  if (!projectId || !clientEmail || !privateKey) {
    return null; // configuration manquante → signalé à la requête
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

exports.handler = async function (event) {
  // 1. Méthode
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Méthode non autorisée. Utilisez POST." });
  }

  // 2. Configuration Firebase Admin
  const app = getAdminApp();
  if (!app) {
    // Ne pas exposer les noms des variables manquantes en production.
    return json(503, {
      error: "Service temporairement indisponible. Contactez l'administrateur.",
    });
  }

  // 3. Corps JSON
  let payload;
  try {
    if (!event.body || !event.body.trim()) {
      throw new Error("Corps vide.");
    }
    payload = JSON.parse(event.body);
  } catch {
    return json(400, {
      error: "Corps de la requête invalide. JSON attendu.",
    });
  }

  // P8.1 — infrastructure uniquement.
  // La logique métier (validation du token, écriture Firestore) sera ajoutée en P8.4.
  return json(200, { ok: true, received: Object.keys(payload) });
};
