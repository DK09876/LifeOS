// Google OAuth configuration and helpers
// Uses Google Identity Services for client-side OAuth

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

export interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  accessToken: string;
  expiresAt: number;
}

// Store auth state in localStorage
const AUTH_STORAGE_KEY = 'lifeos_google_auth';

export function getStoredAuth(): GoogleUser | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;

    const user = JSON.parse(stored) as GoogleUser;

    // Check if token is expired
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

// Initialize Google Identity Services
export function initGoogleAuth(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Cannot init Google Auth on server'));
      return;
    }

    // Check if already loaded
    if (window.google?.accounts) {
      resolve();
      return;
    }

    // Load the Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

// Sign in with Google
export function signInWithGoogle(): Promise<GoogleUser> {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts) {
      reject(new Error('Google Identity Services not loaded'));
      return;
    }

    if (!GOOGLE_CLIENT_ID) {
      reject(new Error('Google Client ID not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in your environment.'));
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: async (response: { access_token?: string; error?: string; expires_in?: number }) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }

        if (!response.access_token) {
          reject(new Error('No access token received'));
          return;
        }

        try {
          // Fetch user info
          const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
              Authorization: `Bearer ${response.access_token}`,
            },
          });

          if (!userInfoResponse.ok) {
            throw new Error('Failed to fetch user info');
          }

          const userInfo = await userInfoResponse.json();

          const user: GoogleUser = {
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            accessToken: response.access_token,
            expiresAt: Date.now() + (response.expires_in || 3600) * 1000,
          };

          storeAuth(user);
          resolve(user);
        } catch (error) {
          reject(error);
        }
      },
    });

    tokenClient.requestAccessToken();
  });
}

// Sign out
export function signOut(): void {
  const user = getStoredAuth();
  if (user && window.google?.accounts) {
    window.google.accounts.oauth2.revoke(user.accessToken, () => {
      console.log('Token revoked');
    });
  }
  clearAuth();
}

// Refresh token if needed (re-authenticate)
export async function refreshTokenIfNeeded(): Promise<GoogleUser | null> {
  const user = getStoredAuth();

  // If no user or token not expiring soon, return current user
  if (!user) return null;

  // If token expires in more than 5 minutes, it's still valid
  if (user.expiresAt - Date.now() > 5 * 60 * 1000) {
    return user;
  }

  // Token is expiring soon, need to re-authenticate
  try {
    return await signInWithGoogle();
  } catch {
    return null;
  }
}

// Type declarations for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string; expires_in?: number }) => void;
          }) => {
            requestAccessToken: () => void;
          };
          revoke: (token: string, callback: () => void) => void;
        };
      };
    };
  }
}
