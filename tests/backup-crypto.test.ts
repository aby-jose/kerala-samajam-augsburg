// tests/backup-crypto.test.ts
import { describe, expect, it } from "vitest";
import { encryptBuffer, decryptBuffer } from "../scripts/lib/backup-crypto";

const KEY = "0".repeat(64); // 32-byte all-zero key, fine for a unit test
const OTHER_KEY = "1".repeat(64);

describe("backup encryption", () => {
  it("round-trips plaintext through encrypt/decrypt", () => {
    const plaintext = Buffer.from(JSON.stringify({ hello: "world", n: 42 }));
    const encrypted = encryptBuffer(plaintext, KEY);
    const decrypted = decryptBuffer(encrypted, KEY);
    expect(decrypted.toString("utf-8")).toBe(plaintext.toString("utf-8"));
  });

  it("produces different ciphertext each time (random IV)", () => {
    const plaintext = Buffer.from("same input");
    const a = encryptBuffer(plaintext, KEY);
    const b = encryptBuffer(plaintext, KEY);
    expect(a.equals(b)).toBe(false);
  });

  it("fails to decrypt with the wrong key", () => {
    const encrypted = encryptBuffer(Buffer.from("secret"), KEY);
    expect(() => decryptBuffer(encrypted, OTHER_KEY)).toThrow();
  });

  it("fails to decrypt tampered ciphertext", () => {
    const encrypted = encryptBuffer(Buffer.from("secret"), KEY);
    encrypted[encrypted.length - 1] ^= 0xff; // flip the last byte
    expect(() => decryptBuffer(encrypted, KEY)).toThrow();
  });

  it("rejects a key that isn't 32 bytes", () => {
    expect(() => encryptBuffer(Buffer.from("x"), "tooshort")).toThrow();
  });
});
