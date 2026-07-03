import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  signInWithPopup,
  signInAnonymously,
  GithubAuthProvider,
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
        let capturedEmail = user.email;
        if (!capturedEmail && user.providerData) {
          for (const profile of user.providerData) {
            if (profile.email) {
              capturedEmail = profile.email;
              break;
            }
          }
        }
        if (!capturedEmail && user.providerData.some(p => p.providerId === 'github.com')) {
          capturedEmail = localStorage.getItem(`persistiq_github_email_${user.uid}`) || undefined;
        }
        
        setCurrentUser({
          ...user,
          email: capturedEmail || user.email
        });
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
    const result = await signInWithPopup(auth, googleProvider);
    let capturedEmail = result.user.email;
    if (!capturedEmail && result.user.providerData) {
      for (const profile of result.user.providerData) {
        if (profile.email) {
          capturedEmail = profile.email;
          break;
        }
      }
    }
    console.log("Google Login raw user.email:", result.user.email);
    console.log("Google Login capturedEmail:", capturedEmail);
  };

  const loginWithGithub = async () => {
    const result = await signInWithPopup(auth, githubProvider);
    let capturedEmail = result.user.email;
    
    // Capturing email from providerData fallback
    if (!capturedEmail && result.user.providerData) {
      for (const profile of result.user.providerData) {
        if (profile.email) {
          capturedEmail = profile.email;
          break;
        }
      }
    }

    // Fetch directly from GitHub API if still null
    const credential = GithubAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;
    if (!capturedEmail && accessToken) {
      try {
        const res = await fetch("https://api.github.com/user/emails", {
          headers: { Authorization: `token ${accessToken}` },
        });
        if (res.ok) {
          const emails = await res.json();
          const emailObj = Array.isArray(emails) ? emails.find(e => e.primary && e.verified) : null;
          if (emailObj) {
            capturedEmail = emailObj.email;
            localStorage.setItem(`persistiq_github_email_${result.user.uid}`, capturedEmail);
          } else {
            console.error("No verified primary email in GitHub response:", emails);
          }
        } else {
          console.error("GitHub /user/emails failed:", res.status);
        }
      } catch (err) {
        console.error("Failed to fetch email from GitHub:", err);
      }
    }

    console.log("GitHub Login raw user.email:", result.user.email);
    console.log("GitHub Login providerData:", result.user.providerData);
    console.log("GitHub Login capturedEmail:", capturedEmail);
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
