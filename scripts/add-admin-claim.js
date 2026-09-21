/**
 * Script ponctuel — Ajout du Custom Claim admin sur un compte Firebase Auth
 * Esprit Padel Communication OS — Sécurité V2
 *
 * Usage :
 *   node scripts/add-admin-claim.js --uid <UID_FIREBASE>        ← ajoute admin: true
 *   node scripts/add-admin-claim.js --uid <UID_FIREBASE> --dry-run
 *   node scripts/add-admin-claim.js --uid <UID_FIREBASE> --remove  ← retire uniquement admin
 *
 * Ce script :
 *   - Récupère les Custom Claims existants (notamment appId)
 *   - Affiche AVANT / APRÈS sans rien modifier en dry-run
 *   - Conserve tous les claims existants — seul admin est ajouté ou retiré
 *   - Demande une confirmation explicite avant toute écriture
 *   - Ne contient aucun UID, email ou secret hardcodé
 *
 * Prérequis :
 *   - scripts/serviceAccountKey.json présent (jamais commité)
 *   - firebase-admin disponible via functions/node_modules (déjà installé dans le projet)
 *     → aucune installation supplémentaire requise dans scripts/
 *     → pour installer manuellement si functions/ non disponible :
 *       cd functions && npm install
 */

const path = require("path");

// firebase-admin résolu depuis functions/node_modules — infrastructure partagée du projet.
// Aucun npm install requis dans scripts/ ; cd functions && npm install suffit si absent.
const FIREBASE_ADMIN_PATH = path.resolve(__dirname, "../functions/node_modules/firebase-admin");
const readline = require("readline");

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "serviceAccountKey.json");

// ── Parsing des arguments CLI ──────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const result = { uid: null, dryRun: false, remove: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--uid" && args[i + 1]) {
      result.uid = args[i + 1];
      i++;
    } else if (args[i] === "--dry-run") {
      result.dryRun = true;
    } else if (args[i] === "--remove") {
      result.remove = true;
    }
  }

  return result;
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

function printClaims(label, claims) {
  console.log(`  ${label} : ${claims ? JSON.stringify(claims) : "(aucun claim)"}`);
}

async function run() {
  const { uid, dryRun, remove } = parseArgs();

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  Script Admin Claim — Esprit Padel");
  console.log(`  Mode : ${dryRun ? "DRY-RUN (aucune modification)" : remove ? "SUPPRESSION admin" : "AJOUT admin: true"}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  if (!uid) {
    console.error("❌  UID manquant. Usage : node add-admin-claim.js --uid <UID_FIREBASE>");
    console.error("    L'UID est disponible dans Firebase Console → Authentication → colonne UID.");
    process.exit(1);
  }

  // firebase-admin chargé depuis functions/node_modules (infrastructure partagée du projet)
  let getApps, initializeApp, cert, getAuth;
  try {
    ({ getApps, initializeApp, cert } = require(path.join(FIREBASE_ADMIN_PATH, "lib/app")));
    ({ getAuth }                       = require(path.join(FIREBASE_ADMIN_PATH, "lib/auth")));
  } catch {
    console.error("❌  firebase-admin introuvable dans functions/node_modules.");
    console.error("    Exécuter : cd functions && npm install");
    process.exit(1);
  }

  let serviceAccount;
  try {
    serviceAccount = require(SERVICE_ACCOUNT_PATH);
  } catch {
    console.error("❌  scripts/serviceAccountKey.json introuvable.");
    console.error("    Télécharger depuis Firebase Console → Project Settings → Service accounts");
    process.exit(1);
  }

  if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount) });
  }

  // ── Récupérer les claims existants ──────────────────────────────────────
  let userRecord;
  try {
    userRecord = await getAuth().getUser(uid);
  } catch (err) {
    console.error(`❌  Utilisateur introuvable pour UID : ${uid}`);
    console.error(`    Erreur : ${err.message}`);
    process.exit(1);
  }

  const existingClaims = userRecord.customClaims || {};

  // ── Calculer les nouveaux claims ─────────────────────────────────────────
  let newClaims;
  if (remove) {
    // Retirer uniquement admin, conserver tout le reste
    const { admin: _removed, ...rest } = existingClaims;
    newClaims = rest;
  } else {
    // Ajouter admin: true, conserver tout le reste (notamment appId)
    newClaims = { ...existingClaims, admin: true };
  }

  // ── Afficher avant / après ───────────────────────────────────────────────
  console.log(`  Email    : ${userRecord.email || "(non renseigné)"}`);
  console.log(`  UID      : ${uid}`);
  console.log("");
  printClaims("AVANT", existingClaims);
  printClaims("APRÈS", newClaims);
  console.log("");

  if (dryRun) {
    console.log("[DRY-RUN terminé — aucune modification effectuée]\n");
    return;
  }

  // ── Confirmation explicite ────────────────────────────────────────────────
  const action = remove ? "retirer le claim admin de" : "ajouter admin: true à";
  const answer = await confirm(
    `⚠️  Confirmer : ${action} l'utilisateur ${userRecord.email || uid} ? [oui/non] : `
  );

  if (answer !== "oui") {
    console.log("\nAnnulé. Aucune modification effectuée.\n");
    process.exit(0);
  }

  // ── Appliquer ─────────────────────────────────────────────────────────────
  try {
    await getAuth().setCustomUserClaims(uid, newClaims);
    console.log(`\n✅  Custom Claims mis à jour pour ${userRecord.email || uid}`);
    printClaims("Résultat", newClaims);
    console.log("\nℹ️  L'utilisateur doit se reconnecter (ou forcer getIdToken(true))");
    console.log("   pour que le nouveau claim soit pris en compte dans l'application.\n");
  } catch (err) {
    console.error(`\n❌  Erreur lors de la mise à jour : ${err.message}\n`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Erreur fatale :", err);
  process.exit(1);
});
