import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, GithubAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBZs7RTWoinSURT5R3D9iNp5ReLPHn2y-k",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "sigma-yew-7khb0.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "sigma-yew-7khb0",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "sigma-yew-7khb0.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "918899233185",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:918899233185:web:8923ab89965342b0e1bbe0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();
