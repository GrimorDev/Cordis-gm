import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import { config } from '../config';

// ── R2 client (null when not configured) ─────────────────────────────────────
export const r2Client = config.r2.endpoint
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

/**
 * Upload buffer to R2. Returns public URL.
 * Key is SHA-256 hash of content → automatic deduplication.
 * Returns { url, key, deduplicated }
 */
export async function uploadToR2(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<{ url: string; key: string; deduplicated: boolean }> {
  if (!r2Client || !config.r2.bucket || !config.r2.publicUrl) {
    throw new Error('R2 not configured');
  }

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const ext = originalName.split('.').pop()?.toLowerCase() || 'bin';
  const key = `uploads/${hash}.${ext}`;

  // Check dedup — if object exists in R2 we skip upload
  let deduplicated = false;
  try {
    await r2Client.send(new HeadObjectCommand({ Bucket: config.r2.bucket, Key: key }));
    deduplicated = true; // already exists
  } catch {
    // Not found → upload
    await r2Client.send(new PutObjectCommand({
      Bucket:      config.r2.bucket,
      Key:         key,
      Body:        buffer,
      ContentType: mimeType,
    }));
  }

  const url = `${config.r2.publicUrl}/${key}`;
  return { url, key, deduplicated };
}

/** Delete object from R2 (ignores errors if not found) */
export async function deleteFromR2(key: string): Promise<void> {
  if (!r2Client || !config.r2.bucket) return;
  try {
    await r2Client.send(new DeleteObjectCommand({ Bucket: config.r2.bucket, Key: key }));
  } catch { /* ignore */ }
}
