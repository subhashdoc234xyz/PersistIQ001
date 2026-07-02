import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  signInWithPopup,
  signInAnonymously,
  User 
} from "firebase/auth";
import { auth, googleProvider, githubProvider } from "../lib/firebase";

interface AuthContextType {
  currentUser: any; // Allow real Firebase user or custom local guest user object
  loading: boolean;
  logout: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithGithub: () => Promise<void>;
  loginAsGuest: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Keep real authenticated user if present
      if (user) {
        setCurrentUser(user);
      } else {
        // Only clear if not in custom mock guest session
        setCurrentUser((prev: any) => {
          if (prev?.uid === "guest-user-session") {
            return prev;
          }
          return null;
        });
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const loginWithGithub = async () => {
    await signInWithPopup(auth, githubProvider);
  };

  const loginAsGuest = async () => {
    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.warn("Firebase Anonymous Auth failed or disabled. Falling back to local Guest User.", error);
      const mockGuest = {
        uid: "guest-user-session",
        email: "guest@persistiq.io",
        displayName: "Guest User",
        isAnonymous: true
      };
      setCurrentUser(mockGuest);
    }
  };

  const logout = async () => {
    if (currentUser?.uid === "guest-user-session") {
      setCurrentUser(null);
    } else {
      await signOut(auth);
    }
  };

  const value = {
    currentUser,
    loading,
    logout,
    loginWithGoogle,
    loginWithGithub,
    loginAsGuest
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
