/**
 * Upload validation by magic bytes (never trust the browser-supplied MIME type).
 */
export type DetectedType =
  | { kind: "audio"; mime: "audio/mpeg" | "audio/wav" | "audio/flac" | "audio/ogg" | "audio/mp4" | "audio/aac"; ext: string }
  | { kind: "image"; mime: "image/jpeg" | "image/png" | "image/webp"; ext: string };

export function detectFileType(buf: Uint8Array): DetectedType | null {
  const b = buf;
  const ascii = (o: number, n: number) => String.fromCharCode(...b.slice(o, o + n));
  if (b.length < 12) return null;
  if (ascii(0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0)) {
    // MPEG audio frame sync with a layer set (0xFFF1/0xFFF9 are AAC ADTS, handled below)
    if (!(b[0] === 0xff && (b[1] & 0xf6) === 0xf0)) return { kind: "audio", mime: "audio/mpeg", ext: "mp3" };
  }
  if (b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return { kind: "audio", mime: "audio/aac", ext: "aac" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") return { kind: "audio", mime: "audio/wav", ext: "wav" };
  if (ascii(0, 4) === "fLaC") return { kind: "audio", mime: "audio/flac", ext: "flac" };
  if (ascii(0, 4) === "OggS") return { kind: "audio", mime: "audio/ogg", ext: "ogg" };
  if (ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4);
    if (["M4A ", "M4B ", "mp42", "isom", "dash"].includes(brand)) return { kind: "audio", mime: "audio/mp4", ext: "m4a" };
  }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: "image", mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && ascii(1, 3) === "PNG") return { kind: "image", mime: "image/png", ext: "png" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return { kind: "image", mime: "image/webp", ext: "webp" };
  return null;
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export type DetectedVideo = { kind: "video"; mime: "video/mp4" | "video/webm"; ext: string };
export type DetectedPdf = { kind: "pdf"; mime: "application/pdf"; ext: "pdf" };

/** MP4/MOV-family (ftyp box, non-audio brand) or WebM/Matroska (EBML header). */
export function detectVideo(b: Uint8Array): DetectedVideo | null {
  if (b.length < 12) return null;
  const ascii = (o: number, n: number) => String.fromCharCode(...b.slice(o, o + n));
  if (ascii(4, 4) === "ftyp" && !["M4A ", "M4B ", "M4P "].includes(ascii(8, 4))) return { kind: "video", mime: "video/mp4", ext: "mp4" };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: "video", mime: "video/webm", ext: "webm" };
  return null;
}

export function detectPdf(b: Uint8Array): DetectedPdf | null {
  return b.length >= 5 && String.fromCharCode(...b.slice(0, 5)) === "%PDF-" ? { kind: "pdf", mime: "application/pdf", ext: "pdf" } : null;
}

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_PAD_BYTES = 15 * 1024 * 1024;
