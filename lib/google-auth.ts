// Google OAuth configuration and helpers
// Uses popup with callback page + localStorage events for token delivery

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

export interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  accessToken: string;
  expiresAt: number;
}

const AUTH_STORAGE_KEY = 'lifeos_google_auth';
const AUTH_CALLBACK_KEY = 'lifeos_auth_callback';

export function getStoredAuth(): GoogleUser | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;

    const user = JSON.parse(stored) as GoogleUser;

    if (Date.now() >= user.expiresAt) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export function storeAuth(user: GoogleUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

async function fetchUserInfo(accessToken: string, expiresIn: number): Promise<GoogleUser> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error('Failed to fetch user info');

  const userInfo = await response.json();

  const user: GoogleUser = {
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  storeAuth(user);
  return user;
}

// Sign in via popup → Google OAuth → callback page → localStorage event
export function signInWithGoogle(): Promise<GoogleUser> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Cannot sign in on server'));
      return;
    }

    if (!GOOGLE_CLIENT_ID) {
      reject(new Error('Google Client ID not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in your environment.'));
      return;
    }

    const redirectUri = `${window.location.origin}/oauth2callback.html`;
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: SCOPES,
      include_granted_scopes: 'true',
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

    const popup = window.open(authUrl, 'google-auth', 'width=500,height=600');

    if (!popup || popup.closed) {
      // Popup blocked — fall back to full-page redirect
      window.location.href = authUrl;
      return;
    }

    const cleanup = () => {
      window.removeEventListener('storage', onStorage);
      clearTimeout(timeout);
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Sign-in timed out'));
    }, 120000);

    function onStorage(e: StorageEvent) {
      if (e.key !== AUTH_CALLBACK_KEY || !e.newValue) return;
      cleanup();
      const hashParams = e.newValue;
      localStorage.removeItem(AUTH_CALLBACK_KEY);

      const tokenParams = new URLSearchParams(hashParams);
      const accessToken = tokenParams.get('access_token');
      const expiresIn = tokenParams.get('expires_in');

      if (!accessToken) {
        reject(new Error('No access token received'));
        return;
      }

      fetchUserInfo(accessToken, parseInt(expiresIn || '3600'))
        .then(resolve)
        .catch(reject);
    }

    window.addEventListener('storage', onStorage);
  });
}

// Handle redirect fallback — processes callback data left in localStorage
// (used when popup was blocked and page redirected instead)
export async function handleAuthRedirect(): Promise<GoogleUser | null> {
  if (typeof window === 'undefined') return null;

  const callbackData = localStorage.getItem(AUTH_CALLBACK_KEY);
  if (!callbackData) return null;

  try {
    localStorage.removeItem(AUTH_CALLBACK_KEY);
    const params = new URLSearchParams(callbackData);
    const accessToken = params.get('access_token');
    const expiresIn = params.get('expires_in');

    if (!accessToken) return null;

    return await fetchUserInfo(accessToken, parseInt(expiresIn || '3600'));
  } catch (error) {
    console.error('Failed to process auth callback:', error);
    return null;
  }
}

// Sign out
export function signOut(): void {
  clearAuth();
}

// Check if token is still valid
export function refreshTokenIfNeeded(): GoogleUser | null {
  const user = getStoredAuth();
  if (!user) return null;

  if (user.expiresAt - Date.now() > 5 * 60 * 1000) {
    return user;
  }

  clearAuth();
  return null;
}
