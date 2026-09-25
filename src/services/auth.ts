import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Workspace scopes requested by user & approved:
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');
// Keep select account option
provider.setCustomParameters({
  prompt: 'select_account',
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Listeners for token updates across the app
type TokenListener = (token: string | null, user: User | null) => void;
const tokenListeners = new Set<TokenListener>();

export function subscribeAuth(listener: TokenListener) {
  tokenListeners.add(listener);
  return () => {
    tokenListeners.delete(listener);
  };
}

function notifyListeners(user: User | null) {
  tokenListeners.forEach((fn) => fn(cachedAccessToken, user));
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
        notifyListeners(user);
      } else if (!isSigningIn) {
        // Cached token is in-memory only; if not present, user needs to re-authenticate or trigger signin
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
        notifyListeners(user);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
      notifyListeners(null);
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google Auth');
    }

    cachedAccessToken = credential.accessToken;
    notifyListeners(result.user);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: unknown) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  notifyListeners(null);
};
