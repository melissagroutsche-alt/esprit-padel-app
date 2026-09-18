import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
} from "firebase/auth";
import { auth } from "../firebase";

/**
 * Connecte un utilisateur Firebase.
 * @param {string} email
 * @param {string} password
 * @param {boolean} rememberMe - true → persistence locale (survit au rechargement) ; false → session uniquement
 * @returns {Promise<import("firebase/auth").UserCredential>}
 */
export async function loginUser(email, password, rememberMe = false) {
  await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
  return signInWithEmailAndPassword(auth, email.toLowerCase().trim(), password);
}

/**
 * Déconnecte l'utilisateur courant.
 * @returns {Promise<void>}
 */
export async function logoutUser() {
  return signOut(auth);
}

/**
 * Envoie un email de réinitialisation de mot de passe via Firebase.
 * Firebase gère l'envoi nativement — aucune infrastructure email supplémentaire.
 * @param {string} email
 * @param {string} [continueUrl] - URL de redirection après reset (optionnel)
 * @returns {Promise<void>}
 */
export async function resetPassword(email, continueUrl) {
  const actionCodeSettings = continueUrl
    ? { url: continueUrl, handleCodeInApp: false }
    : undefined;
  return sendPasswordResetEmail(auth, email.toLowerCase().trim(), actionCodeSettings);
}

/**
 * Lit le Custom Claim appId depuis le token Firebase de l'utilisateur connecté.
 * Ce claim associe l'UID Firebase à l'ID entier métier existant dans Firestore.
 * @param {import("firebase/auth").User} user
 * @returns {Promise<number|null>}
 */
export async function getAppId(user) {
  if (!user) return null;
  const tokenResult = await user.getIdTokenResult();
  const raw = tokenResult.claims.appId;
  return raw != null ? Number(raw) : null;
}

export { auth };
