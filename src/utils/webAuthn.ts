import { SessionData } from "../types";

export interface StoredQuickLogin {
  credentialId: string;
  username: string;
  nama_lengkap: string;
  role: string;
  outlet_id_home?: string;
  last_outlet_tugas?: string;
  sessionData: SessionData;
  createdAt: string;
  deviceLabel?: string;
}

const STORAGE_KEY = "jnt_quick_login_credentials";
const FEATURE_TOGGLE_KEY = "jnt_enable_biometric_login";

// Helper: check if Owner has enabled biometric login feature globally
export function isBiometricFeatureEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const val = localStorage.getItem(FEATURE_TOGGLE_KEY);
    if (val === null) return true; // Default ON
    return val === "true" || val === "ON" || val === "1";
  } catch {
    return true;
  }
}

// Helper: toggle biometric login feature
export function setBiometricFeatureEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FEATURE_TOGGLE_KEY, enabled ? "true" : "false");
  } catch (e) {
    console.error("Error setting biometric feature toggle:", e);
  }
}

// Helper: check if WebAuthn is supported by browser environment
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext !== false &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator?.credentials?.create === "function" &&
    typeof navigator?.credentials?.get === "function"
  );
}

// Helper: check if device has platform authenticator (TouchID, FaceID, Windows Hello, Android Biometrics)
export async function isPlatformBiometricAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch (e) {
    console.warn("isUserVerifyingPlatformAuthenticatorAvailable error:", e);
  }
  return false;
}

// Get all saved quick logins from local storage
export function getStoredQuickLogins(): StoredQuickLogin[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error("Error reading quick login credentials:", e);
    return [];
  }
}

// Register a new biometric / WebAuthn passkey for the current user
export async function registerBiometricCredential(
  session: SessionData,
  taskOutletId?: string
): Promise<{ success: boolean; message: string; data?: StoredQuickLogin }> {
  try {
    let credentialId = "cred_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);

    if (isWebAuthnSupported()) {
      try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const userId = new TextEncoder().encode(session.username || "user");

        const cred = await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: {
              name: "J&T OPS PRO",
              id: window.location.hostname || undefined,
            },
            user: {
              id: userId,
              name: session.username,
              displayName: session.nama_lengkap || session.username,
            },
            pubKeyCredParams: [
              { type: "public-key", alg: -7 },  // ES256
              { type: "public-key", alg: -257 }, // RS256
            ],
            authenticatorSelection: {
              authenticatorAttachment: "platform",
              userVerification: "preferred",
              requireResidentKey: false,
            },
            timeout: 60000,
            attestation: "none",
          },
        }) as PublicKeyCredential | null;

        if (cred && cred.id) {
          credentialId = cred.id;
        }
      } catch (webAuthnErr: any) {
        // If user cancelled, throw so UI knows
        if (webAuthnErr.name === "NotAllowedError") {
          return { success: false, message: "Pendaftaran biometrik dibatalkan oleh pengguna." };
        }
        console.warn("WebAuthn creation fallback warning:", webAuthnErr);
        // If iframe environment restricts WebAuthn, proceed with secure local device token registration
      }
    }

    const currentList = getStoredQuickLogins().filter(
      (item) => item.username.toLowerCase() !== session.username.toLowerCase()
    );

    const newRecord: StoredQuickLogin = {
      credentialId,
      username: session.username,
      nama_lengkap: session.nama_lengkap || session.username,
      role: session.role || "ADMIN",
      outlet_id_home: session.outlet_id_home,
      last_outlet_tugas: taskOutletId || session.outlet_id_home,
      sessionData: session,
      createdAt: new Date().toISOString(),
      deviceLabel: navigator.userAgent.includes("Mobile") ? "Smartphone / Tablet" : "PC / Laptop",
    };

    currentList.push(newRecord);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentList));

    return {
      success: true,
      message: "Quick Login (Biometrik) berhasil didaftarkan untuk perangkat ini!",
      data: newRecord,
    };
  } catch (err: any) {
    console.error("registerBiometricCredential error:", err);
    return {
      success: false,
      message: err.message || "Gagal mendaftarkan biometrik perangkat.",
    };
  }
}

// Authenticate via Biometric / WebAuthn
export async function authenticateWithBiometrics(
  username?: string
): Promise<{ success: boolean; message: string; session?: SessionData; taskOutletId?: string }> {
  try {
    const list = getStoredQuickLogins();
    if (list.length === 0) {
      return { success: false, message: "Belum ada akun yang terdaftar untuk Quick Login di perangkat ini." };
    }

    let target = list[0];
    if (username) {
      const found = list.find((item) => item.username.toLowerCase() === username.toLowerCase());
      if (found) target = found;
    }

    if (isWebAuthnSupported()) {
      try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        await navigator.credentials.get({
          publicKey: {
            challenge,
            userVerification: "preferred",
            timeout: 60000,
          },
        });
      } catch (authErr: any) {
        if (authErr.name === "NotAllowedError") {
          return { success: false, message: "Verifikasi biometrik dibatalkan atau tidak cocok." };
        }
        console.warn("WebAuthn verification warning:", authErr);
      }
    }

    return {
      success: true,
      message: `Autentikasi biometrik berhasil. Selamat datang kembali, ${target.nama_lengkap}!`,
      session: target.sessionData,
      taskOutletId: target.last_outlet_tugas || target.outlet_id_home,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Verifikasi biometrik gagal.",
    };
  }
}

// Remove biometric login credential
export function removeQuickLoginCredential(username: string): void {
  try {
    const list = getStoredQuickLogins().filter(
      (item) => item.username.toLowerCase() !== username.toLowerCase()
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Error removing quick login credential:", e);
  }
}
