import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDsl7R4EAHI-u6SdgyAqvO725GX8Hnoq5U",
  authDomain: "esprit-padel-communication.firebaseapp.com",
  projectId: "esprit-padel-communication",
  storageBucket: "esprit-padel-communication.firebasestorage.app",
  messagingSenderId: "407619706622",
  appId: "1:407619706622:web:c748b160827c34dee34faf",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
