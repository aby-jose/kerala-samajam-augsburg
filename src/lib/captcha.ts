import { nanoid } from "nanoid";

// Persist the store across hot reloads in development
const globalForCaptcha = globalThis as unknown as {
  captchaStore: Map<string, { code: string; expires: number }>;
};

const captchaStore = globalForCaptcha.captchaStore ?? new Map<string, { code: string; expires: number }>();

if (process.env.NODE_ENV !== "production") globalForCaptcha.captchaStore = captchaStore;

export function generateCaptcha() {
  const id = nanoid();
  // Generate a 6-character random alphanumeric code
  // Using a more reliable way to get 6 characters
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed similar looking chars like 0, O, I, 1
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  const expires = Date.now() + 1000 * 60 * 5; // 5 minutes expiration
  
  captchaStore.set(id, { code, expires });
  
  // Clean up expired captchas occasionally
  if (captchaStore.size > 1000) {
    const now = Date.now();
    for (const [key, val] of captchaStore.entries()) {
      if (val.expires < now) captchaStore.delete(key);
    }
  }

  return { id, code };
}

export function verifyCaptcha(id: string, code: string) {
  if (!id || !code) return false;
  
  const stored = captchaStore.get(id);
  if (!stored) return false;
  
  const isExpired = stored.expires < Date.now();
  captchaStore.delete(id); // Use once only
  
  if (isExpired) return false;
  
  // Robust case-insensitive comparison with trimming
  return stored.code.trim().toUpperCase() === code.trim().toUpperCase();
}
