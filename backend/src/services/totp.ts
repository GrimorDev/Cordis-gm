import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const ISSUER = 'Cordyn';

export function generateTotpSecret(username: string): { secret: string; otpauth_url: string } {
  const secret = authenticator.generateSecret();
  const otpauth_url = authenticator.keyuri(username, ISSUER, secret);
  return { secret, otpauth_url };
}

export async function generateQrCode(otpauth_url: string): Promise<string> {
  return QRCode.toDataURL(otpauth_url);
}

export function verifyTotpCode(secret: string, token: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

export function generateBackupCodes(): string[] {
  return Array.from({ length: 10 }, () => {
    const bytes = crypto.randomBytes(5);
    const hex = bytes.toString('hex').toUpperCase();
    return `${hex.slice(0, 5)}-${hex.slice(5)}`;
  });
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map(code => bcrypt.hash(code, 10)));
}

export async function verifyBackupCode(code: string, hashedCodes: string[]): Promise<number | null> {
  for (let i = 0; i < hashedCodes.length; i++) {
    if (await bcrypt.compare(code, hashedCodes[i])) return i;
  }
  return null;
}
