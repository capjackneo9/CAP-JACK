import "server-only";
import { Readable } from "node:stream";
import { openUpload } from "./storage";

/** Stream an upload with HTTP Range support (needed for seeking in the decks). */
export async function streamUpload(req: Request, key: string, mime: string): Promise<Response> {
  const f = await openUpload(key);
  const range = req.headers.get("range");
  const headers: Record<string, string> = { "Content-Type": mime, "Accept-Ranges": "bytes", "Cache-Control": "private, no-store" };
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m?.[1] ? Number(m[1]) : 0;
    const end = m?.[2] ? Math.min(Number(m[2]), f.size - 1) : f.size - 1;
    if (start >= f.size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${f.size}` } });
    return new Response(Readable.toWeb(f.stream(start, end)) as ReadableStream, {
      status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${f.size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(Readable.toWeb(f.stream()) as ReadableStream, { headers: { ...headers, "Content-Length": String(f.size) } });
}
