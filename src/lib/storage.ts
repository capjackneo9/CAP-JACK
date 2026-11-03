import "server-only";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "./config";
import { detectFileType, detectPdf, detectVideo, MAX_IMAGE_BYTES, MAX_PDF_BYTES, type DetectedPdf, type DetectedType, type DetectedVideo } from "./files";

export class UploadError extends Error {}

const root = () => path.resolve(config.uploadDir);

/**
 * Validate (magic bytes + size) and persist an uploaded File outside the web root.
 * Returns a storage key relative to UPLOAD_DIR.
 */
type Expect = "audio" | "image" | "video" | "pdf";
const FORMATS: Record<Expect, string> = {
  audio: "MP3, WAV, FLAC, OGG, M4A/AAC", image: "JPG, PNG, WebP", video: "MP4 (H.264/AAC) or WebM", pdf: "PDF",
};

export async function saveUpload(file: File, expect: Expect, folder: string, maxBytes?: number): Promise<{ key: string; type: DetectedType | DetectedVideo | DetectedPdf; size: number }> {
  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) throw new UploadError(`Missing ${expect} file`);
  const limit = maxBytes ?? (expect === "image" ? MAX_IMAGE_BYTES : expect === "pdf" ? MAX_PDF_BYTES : expect === "video" ? config.maxVideoBytes : config.maxUploadBytes);
  if (file.size > limit) throw new UploadError(`${expect} file exceeds ${Math.round(limit / 1048576)} MB`);
  const buf = Buffer.from(await file.arrayBuffer());
  const head = buf.subarray(0, 64);
  const type = expect === "video" ? detectVideo(head) : expect === "pdf" ? detectPdf(head) : detectFileType(head);
  if (!type || type.kind !== expect) throw new UploadError(`Unsupported ${expect} format. Use ${FORMATS[expect]}.`);
  const safeFolder = folder.replace(/[^a-z0-9-]/gi, "");
  const key = `${safeFolder}/${randomUUID()}.${type.ext}`;
  await mkdir(path.join(root(), safeFolder), { recursive: true });
  await writeFile(path.join(root(), key), buf, { mode: 0o640 });
  return { key, type, size: buf.length };
}

export function resolveKey(key: string): string {
  const full = path.resolve(root(), key);
  if (!full.startsWith(root() + path.sep)) throw new UploadError("Invalid path");
  return full;
}

export async function openUpload(key: string) {
  const full = resolveKey(key);
  const s = await stat(full);
  return { size: s.size, stream: (start?: number, end?: number) => createReadStream(full, { start, end }) };
}
