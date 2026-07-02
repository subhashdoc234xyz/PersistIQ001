import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, GithubAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBZs7RTWoinSURT5R3D9iNp5ReLPHn2y-k",
  authDomain: "sigma-yew-7khb0.firebaseapp.com",
  projectId: "sigma-yew-7khb0",
  storageBucket: "sigma-yew-7khb0.firebasestorage.app",
  messagingSenderId: "918899233185",
  appId: "1:918899233185:web:8923ab89965342b0e1bbe0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();
