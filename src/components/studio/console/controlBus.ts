"use client";
import { useEffect, useRef } from "react";
import type { ControlAction } from "@/lib/audio/midi";

/** Routes controller actions to the console section that owns each target. */
const bus = typeof window !== "undefined" ? new EventTarget() : null;

export function emitControl(a: ControlAction) {
  bus?.dispatchEvent(new CustomEvent<ControlAction>("ctl", { detail: a }));
}

export function useConsoleControl(prefixes: string[], handler: (a: ControlAction) => void) {
  const h = useRef(handler);
  h.current = handler;
  const key = prefixes.join("|");
  useEffect(() => {
    if (!bus) return;
    const list = key.split("|");
    const fn = (e: Event) => {
      const a = (e as CustomEvent<ControlAction>).detail;
      if (list.some((p) => a.target === p || a.target.startsWith(p + "."))) h.current(a);
    };
    bus.addEventListener("ctl", fn);
    return () => bus.removeEventListener("ctl", fn);
  }, [key]);
}
