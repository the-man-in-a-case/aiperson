// Open the avatar overlay window. In WPS we try the加载项 dialog API; in a
// regular browser we fall back to window.open. The overlay opens a route that
// renders just the avatar tile + mic control, designed to sit on top of the
// slideshow.

import type { LiveSessionResponse } from "@aiperson/shared";

const CHANNEL_NAME = "aiperson-overlay";

export interface OverlayPayload {
  sessionId: string;
  rtcInfo: LiveSessionResponse;
  personaLabel?: string;
}

const STORAGE_KEY = "aiperson_overlay_payload";

export function publishOverlayPayload(payload: OverlayPayload): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  try {
    new BroadcastChannel(CHANNEL_NAME).postMessage({ type: "init", payload });
  } catch {
    /* ignore */
  }
}

export function readOverlayPayload(): OverlayPayload | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OverlayPayload;
  } catch {
    return null;
  }
}

export function openOverlayWindow(): void {
  const url = `${location.origin}${location.pathname}?pane=overlay`;
  const features =
    "width=380,height=280,menubar=no,toolbar=no,location=no,status=no,resizable=yes,alwaysRaised=yes";

  const wps = (window as any).wps;
  if (wps?.OpenDialog) {
    try {
      wps.OpenDialog("aiperson_overlay", url, {
        width: 380,
        height: 280,
        decoration: false,
        topmost: true,
      });
      return;
    } catch {
      /* fall through */
    }
  }
  window.open(url, "aiperson_overlay", features);
}
