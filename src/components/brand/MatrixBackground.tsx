"use client";
import { useEffect, useRef } from "react";

/**
 * Matrix-inspired falling glyphs with NCVR station IDs. Sits behind content,
 * low opacity, pauses when hidden, and renders a single static frame for
 * prefers-reduced-motion.
 */
const GLYPHS = "01NCVR｜ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ0123456789";
const IDS = ["NCVR", "88.NITE", "CAP.JACK", "VIBE//19", "AFTER.DARK", "ATL.SOUL", "24/7"];

export function MatrixBackground({ intensity = 0.5 }: { intensity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const size = 16;
    let cols = 0;
    let drops: number[] = [];
    let raf = 0;
    let last = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(window.innerWidth / size);
      drops = Array.from({ length: cols }, () => Math.random() * -60);
    };
    resize();
    window.addEventListener("resize", resize);

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (t - last < 60 || document.hidden) return; // ~16fps, cheap
      last = t;
      ctx.fillStyle = "rgba(7, 11, 30, 0.12)";
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.font = `${size - 2}px ui-monospace, monospace`;
      for (let i = 0; i < cols; i++) {
        if (Math.random() > intensity) continue;
        const y = drops[i] * size;
        const id = Math.random() < 0.004;
        if (id) {
          ctx.fillStyle = "rgba(212, 175, 55, 0.7)";
          ctx.fillText(IDS[Math.floor(Math.random() * IDS.length)], i * size, y);
        } else {
          ctx.fillStyle = Math.random() < 0.06 ? "rgba(180, 255, 170, 0.75)" : "rgba(57, 255, 20, 0.45)";
          ctx.fillText(GLYPHS[Math.floor(Math.random() * GLYPHS.length)], i * size, y);
        }
        if (y > window.innerHeight && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };

    if (reduce) {
      ctx.font = `${size - 2}px ui-monospace, monospace`;
      ctx.fillStyle = "rgba(57, 255, 20, 0.18)";
      for (let i = 0; i < cols; i++) for (let j = 0; j < 8; j++) if (Math.random() < 0.25) ctx.fillText(GLYPHS[(i * j) % GLYPHS.length], i * size, Math.random() * window.innerHeight);
    } else {
      raf = requestAnimationFrame(frame);
    }
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [intensity]);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 opacity-40" />;
}
