"use client";

import { Component, type ReactNode } from "react";

/**
 * Local error boundary for the 3D view: a failed download of the 3D module (weak network) or a lost WebGL context
 * shows a short message and hands back to the 2D editor instead of taking the whole studio down.
 */
export class Viewer3DBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.error(JSON.stringify({ level: "error", event: "viewer3d_failed", message: error instanceof Error ? error.message : String(error) }));
    this.props.onFail();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
