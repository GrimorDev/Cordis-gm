import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { uploadToR2, r2Enabled } from './r2';

function randomFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
}

function writeToDisk(buffer: Buffer, folder: string, originalName: string): string {
  const filename = randomFilename(originalName);
  const dir = path.join(config.uploads.dir, folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/uploads/${folder}/${filename}`;
}

/**
 * Saves an uploaded file — R2 if configured (primary, the VPS disk only has
 * 75GB), else local disk. If a configured R2 upload fails, falls back to
 * disk for that single file rather than failing the request.
 */
export async function saveUploadedFile(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
  folder: string,
): Promise<{ url: string; r2Key: string | null }> {
  if (r2Enabled) {
    try {
      const { url, key } = await uploadToR2(buffer, mimeType, originalName);
      return { url, r2Key: key };
    } catch (err: any) {
      console.warn(`[storage] R2 upload failed, falling back to disk: ${err?.message}`);
    }
  }
  return { url: writeToDisk(buffer, folder, originalName), r2Key: null };
}

/**
 * Best-effort cleanup of a previously-saved LOCAL DISK file when it's being
 * replaced (e.g. new avatar/banner/icon). R2 objects are content-addressed
 * (SHA-256, see uploadToR2) and deduplicated, so another record may point at
 * the same key — we never delete those here.
 */
export async function deleteOldDiskFile(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const m = url.match(/^\/uploads\/(.+)$/);
  if (!m) return;
  try {
    await fs.promises.unlink(path.join(config.uploads.dir, m[1]));
  } catch { /* best-effort cleanup */ }
}
