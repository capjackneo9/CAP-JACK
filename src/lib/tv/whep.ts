/**
 * Minimal WHEP (WebRTC-HTTP Egress Protocol) player for MediaMTX — sub-second
 * live video. Non-trickle: ICE candidates are gathered before the offer is
 * sent, so a single POST is all the signalling needed (works behind Caddy).
 */
export interface WhepSession { close: () => void; pc: RTCPeerConnection }

function waitFor(pc: RTCPeerConnection, done: () => boolean, events: Array<keyof RTCPeerConnectionEventMap>, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (done()) return resolve(true);
    const check = () => { if (done()) finish(true); };
    const timer = setTimeout(() => finish(false), ms);
    function finish(ok: boolean) {
      clearTimeout(timer);
      events.forEach((ev) => pc.removeEventListener(ev, check));
      resolve(ok);
    }
    events.forEach((ev) => pc.addEventListener(ev, check));
  });
}

export async function playWhep(url: string, video: HTMLVideoElement, opts: { timeoutMs?: number; onDrop?: () => void } = {}): Promise<WhepSession> {
  const pc = new RTCPeerConnection();
  try {
    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });
    const stream = new MediaStream();
    pc.ontrack = (e) => {
      stream.addTrack(e.track);
      if (video.srcObject !== stream) video.srcObject = stream;
    };
    await pc.setLocalDescription(await pc.createOffer());
    await waitFor(pc, () => pc.iceGatheringState === "complete", ["icegatheringstatechange"], 2000);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/sdp" }, body: pc.localDescription?.sdp ?? "" });
    if (res.status !== 201 && res.status !== 200) throw new Error(`WHEP ${res.status}`);
    await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
    const ok = await waitFor(pc, () => pc.connectionState === "connected", ["connectionstatechange"], opts.timeoutMs ?? 6000);
    if (!ok) throw new Error("WebRTC connection timed out");
    pc.addEventListener("connectionstatechange", () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") opts.onDrop?.();
    });
    return { pc, close: () => pc.close() };
  } catch (e) {
    pc.close();
    throw e;
  }
}
