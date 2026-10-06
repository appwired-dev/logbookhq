"use client";

import { Component, useCallback, useEffect, useState, type ReactNode } from "react";

/**
 * Guards a WebGL widget (the route globes) so it can never take its page down.
 *
 * WebGL can be missing or refused at any time: iOS Lockdown Mode, GPU
 * blocklists, low-memory phones, a browser that has blocked WebGL after
 * earlier context losses. react-globe.gl / three.js throw while creating the
 * renderer in those cases, and an unguarded throw there unmounts the whole
 * route into app/app/error.tsx. So:
 *  - probe for a context before mounting the widget at all;
 *  - catch anything the widget throws while rendering or in its effects;
 *  - let the widget report a lost context after it is up (`onUnavailable`).
 * Any of the three swaps in `fallback`.
 */
export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext(); // give the probe context back
    return true;
  } catch {
    return false;
  }
}

/** Catches a throw inside the WebGL widget instead of letting it reach the route boundary. */
export class GlobeBoundary extends Component<{ onError: () => void; fallback?: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}

export function WebGLGate({ fallback, children }: {
  /** Shown when WebGL is missing, the widget throws, or its context is lost. */
  fallback: ReactNode;
  /** Render prop: call `onUnavailable` from a webglcontextlost listener. */
  children: (onUnavailable: () => void) => ReactNode;
}) {
  // null until probed on the client (no WebGL on the server render).
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => setOk(webglAvailable()), []);
  const onUnavailable = useCallback(() => setOk(false), []);
  if (ok === null) return null;
  if (!ok) return <>{fallback}</>;
  return (
    <GlobeBoundary onError={onUnavailable} fallback={fallback}>
      {children(onUnavailable)}
    </GlobeBoundary>
  );
}
