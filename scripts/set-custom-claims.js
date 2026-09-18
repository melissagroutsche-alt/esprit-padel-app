/**
 * Script ponctuel — Attribution des Custom Claims Firebase Auth
 * Phase 2.1 — Esprit Padel Communication OS
 *
 * Usage :
 *   node scripts/set-custom-claims.js --dry-run   ← affiche le mapping sans rien modifier
 *   node scripts/set-custom-claims.js              ← exécute après confirmation manuelle
 *
 * Prérequis :
 *   1. Avoir un fichier serviceAccountKey.json dans scripts/ (téléchargé depuis Firebase Console)
 *      Firebase Console → Project Settings → Service accounts → Generate new private key
 *      ⚠️  Ne jamais committer ce fichier (il est dans .gitignore)
 *   2. npm install firebase-admin (dans ce dossier ou à la racine)
 *
 * Ce script :
 *   - Affiche le mapping complet email / UID Firebase / appId / nom Firestore AVANT toute action
 *   - Ne modifie AUCUNE donnée Firestore
 *   - N'attribue que le Custom Claim { appId: N } sur chaque utilisateur Firebase Auth
 *   - Ne déduit jamais un appId automatiquement — chaque ligne est explicite et contrôlable
 */

// firebase-admin est chargé dynamiquement uniquement en mode réel (pas en dry-run)
const path = require("path");
const readline = require("readline");

// ─────────────────────────────────────────────────────────────────────────────
// MAPPING À REMPLIR AVANT EXÉCUTION
// Renseigner : email Firebase Auth, UID Firebase (copié depuis Firebase Console),
// appId entier (ID dans Firestore), nom affiché pour vérification visuelle.
//
// ⚠️  NE PAS déduire l'UID automatiquement. Copier chaque UID manuellement
//     depuis Firebase Console → Authentication → colonne "UID utilisateur".
// ─────────────────────────────────────────────────────────────────────────────
const USER_MAPPING = [
  {
    email:       "melissa@espritpadel.com",
    uid:         "9XH8zIo072SwzpHb4v3X4vtZ63w1",
    appId:       1,
    displayName: "Mélissa Dupont",
  },
  // Ajouter les autres utilisateurs ici au fur et à mesure de leur création Firebase Auth.
];

// ─────────────────────────────────────────────────────────────────────────────

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "serviceAccountKey.json");
const DRY_RUN = process.argv.includes("--dry-run");

function validateMapping(mapping) {
  const errors = [];
  const seenUids = new Set();
  const seenAppIds = new Set();

  mapping.forEach((entry, i) => {
    if (!entry.email) errors.push(`Ligne ${i + 1} : email manquant`);
    if (!entry.uid || entry.uid === "FIREBASE_UID_ICI") errors.push(`Ligne ${i + 1} (${entry.email}) : UID non renseigné`);
    if (entry.appId == null || typeof entry.appId !== "number") errors.push(`Ligne ${i + 1} (${entry.email}) : appId doit être un entier`);
    if (seenUids.has(entry.uid)) errors.push(`UID en double : ${entry.uid}`);
    if (seenAppIds.has(entry.appId)) errors.push(`appId en double : ${entry.appId}`);
    seenUids.add(entry.uid);
    seenAppIds.add(entry.appId);
  });

  return errors;
}

function printMapping(mapping) {
  console.log("\n┌─────────────────────────────────────────────────────────────────────┐");
  console.log("│  MAPPING À APPLIQUER — vérifier chaque ligne avant de continuer     │");
  console.log("├────────────────────────────────┬────────────────────────┬─────┬─────┤");
  console.log("│ Email                          │ UID Firebase           │ ID  │ Nom │");
  console.log("├────────────────────────────────┼────────────────────────┼─────┼─────┤");
  mapping.forEach((u) => {
    const email = u.email.padEnd(30).slice(0, 30);
    const uid = u.uid.padEnd(22).slice(0, 22);
    const appId = String(u.appId).padEnd(3);
    const name = (u.displayName || "").slice(0, 20);
    console.log(`│ ${email} │ ${uid} │ ${appId} │ ${name} │`);
  });
  console.log("└────────────────────────────────┴────────────────────────┴─────┴─────┘\n");
}

async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function run() {
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  Script Custom Claims — Phase 2.1 — Esprit Padel");
  console.log(`  Mode : ${DRY_RUN ? "DRY-RUN (aucune modification)" : "EXÉCUTION RÉELLE"}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  if (USER_MAPPING.length === 0) {
    console.error("❌  USER_MAPPING est vide. Renseigner le mapping dans le script avant d'exécuter.");
    process.exit(1);
  }

  const errors = validateMapping(USER_MAPPING);
  if (errors.length > 0) {
    console.error("❌  Erreurs de validation :");
    errors.forEach((e) => console.error(`   - ${e}`));
    process.exit(1);
  }

  printMapping(USER_MAPPING);

  console.log("\nAction exacte que le script effectuerait :");
  USER_MAPPING.forEach((u) => {
    console.log(`  admin.auth().setCustomUserClaims("${u.uid}", { appId: ${u.appId} })`);
  });

  if (DRY_RUN) {
    console.log("\n[DRY-RUN terminé — aucune modification Firebase Auth ni Firestore effectuée]\n");
    return;
  }

  const answer = await confirm(
    `\n⚠️  Attribuer le Custom Claim appId à ${USER_MAPPING.length} utilisateur(s) Firebase Auth ? [oui/non] : `
  );
  if (answer !== "oui") {
    console.log("\nAnnulé. Aucune modification effectuée.\n");
    process.exit(0);
  }

  // firebase-admin chargé uniquement ici, jamais en dry-run
  let admin;
  try {
    admin = require("firebase-admin");
  } catch {
    console.error("\n❌  firebase-admin non installé. Exécuter : npm install firebase-admin\n");
    process.exit(1);
  }

  let serviceAccount;
  try {
    serviceAccount = require(SERVICE_ACCOUNT_PATH);
  } catch {
    console.error(`\n❌  Fichier serviceAccountKey.json introuvable dans scripts/`);
    console.error("    Télécharger depuis Firebase Console → Project Settings → Service accounts\n");
    process.exit(1);
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }

  console.log("\nApplication des Custom Claims :");
  for (const user of USER_MAPPING) {
    try {
      await admin.auth().setCustomUserClaims(user.uid, { appId: user.appId });
      console.log(`  ✅  ${user.email} → appId: ${user.appId}`);
    } catch (err) {
      console.error(`  ❌  ${user.email} → ERREUR : ${err.message}`);
    }
  }

  console.log("\nℹ️  Les utilisateurs doivent se reconnecter (ou forcer un refresh token)");
  console.log("   pour que le nouveau Custom Claim soit pris en compte dans l'application.\n");
}

run().catch((err) => {
  console.error("Erreur fatale :", err);
  process.exit(1);
});
