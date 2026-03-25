import QRCode from "qrcode";
import { customAlphabet } from "nanoid";

const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const nanoid = customAlphabet(alphabet, 8);

export function generateTicketId() {
  return `KSA-${nanoid()}`;
}

export async function generateQrDataUrl(ticketId: string) {
  const url = `${process.env.SITE_URL}/verify/${ticketId}`;
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });
    return dataUrl;
  } catch (err) {
    console.error("QR Generation Error:", err);
    throw new Error("Failed to generate QR code");
  }
}
