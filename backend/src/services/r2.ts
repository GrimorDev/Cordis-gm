import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { config } from '../config';

// ── R2 client ─────────────────────────────────────────────────────────────────
// Aktywny tylko gdy ACCESS_KEY_ID i SECRET są ustawione
const hasCredentials = !!(config.r2.accessKeyId && config.r2.secretAccessKey && config.r2.endpoint);

export const r2Client = hasCredentials
  ? new S3Client({
      region: 'auto',
      endpoint: config.r2.endpoint,
      credentials: {
        accessKeyId:     config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    })
  : null;

export const r2Enabled = !!r2Client;

// ── Presigned URL TTL ────────────────────────────────────────────────────────
// Pliki serwowane przez /api/files/* → backend generuje signed URL i robi redirect
// TTL 1h — klient dostaje redirect, przeglądarka cachuje plik lokalnie
const SIGNED_URL_TTL = 3600; // 1 godzina

/**
 * Generuje pre-signed GET URL dla klucza w R2.
 * Używane przez /api/files/* do serwowania plików bez publicznego bucketu.
 */
export async function getR2SignedUrl(key: string, downloadFilename?: string): Promise<string> {
  if (!r2Client || !config.r2.bucket) throw new Error('R2 not configured');
  const cmd = new GetObjectCommand({
    Bucket: config.r2.bucket,
    Key:    key,
    // Gdy podana nazwa → przeglądarka zapisze plik pod tą nazwą (navigation, bez CORS)
    ...(downloadFilename ? {
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(downloadFilename)}"`,
    } : {}),
  });
  return getSignedUrl(r2Client, cmd, { expiresIn: SIGNED_URL_TTL });
}

/**
 * Upload buffer do R2. Zwraca { url, key, deduplicated }.
 * url = ścieżka wewnętrzna /api/files/<key> (serwowana przez backend z pre-signed redirect).
 * Jeśli R2_PUBLIC_URL ustawione (custom CDN domain) → używa bezpośredniego URL.
 * Key = SHA-256 pliku → automatyczna deduplication.
 */
export async function uploadToR2(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<{ url: string; key: string; deduplicated: boolean }> {
  if (!r2Client || !config.r2.bucket) {
    throw new Error('R2 not configured — brak credentials');
  }

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const ext  = originalName.split('.').pop()?.toLowerCase() || 'bin';
  const key  = `uploads/${hash}.${ext}`;

  // Deduplication: jeśli obiekt już istnieje w R2 → pomijamy upload
  let deduplicated = false;
  try {
    await r2Client.send(new HeadObjectCommand({ Bucket: config.r2.bucket, Key: key }));
    deduplicated = true;
  } catch {
    // Nie istnieje → uploadujemy
    await r2Client.send(new PutObjectCommand({
      Bucket:      config.r2.bucket,
      Key:         key,
      Body:        buffer,
      ContentType: mimeType,
    }));
  }

  // URL: custom CDN domain (jeśli ustawione) lub ścieżka przez backend proxy
  const url = config.r2.publicUrl
    ? `${config.r2.publicUrl}/${key}`   // np. https://cdn.cordyn.pl/uploads/hash.ext
    : `/api/files/${key}`;              // proxy przez backend z pre-signed redirect

  return { url, key, deduplicated };
}

/** Usuwa obiekt z R2 (ignoruje błędy 404) */
export async function deleteFromR2(key: string): Promise<void> {
  if (!r2Client || !config.r2.bucket) return;
  try {
    await r2Client.send(new DeleteObjectCommand({ Bucket: config.r2.bucket, Key: key }));
  } catch { /* ignore */ }
}
