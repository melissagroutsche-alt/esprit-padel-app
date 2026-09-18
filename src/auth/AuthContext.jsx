import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, getAppId } from "./authService";

/**
 * AuthContext — infrastructure pour la Phase 2.1.
 *
 * Fournit :
 *   firebaseUser  : objet User Firebase brut (ou null)
 *   appId         : ID entier métier (Custom Claim) lié à l'UID Firebase (ou null)
 *   authLoading   : true pendant l'initialisation Firebase Auth
 *
 * L'ancien système (loggedIn / currentUserId via localStorage) reste intact dans App.jsx.
 * Ce contexte coexiste sans l'interférer — il n'est pas encore branché à l'UI.
 * La connexion entre AuthContext et l'UI de login se fera à la Phase 2.1 suivante,
 * après validation de ce socle.
 */

const AuthContext = createContext({
  firebaseUser: null,
  appId: null,
  authLoading: true,
});

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [appId, setAppId] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const id = await getAppId(user);
        setAppId(id);
      } else {
        setAppId(null);
      }
      setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, appId, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
