// Bridge to WPS JS API. Outside WPS we fall back to browser download so the
// add-in still demos in a normal browser.

function getPresentation(): unknown | null {
  const wps = window.wps;
  if (!wps?.PresentationApplication) return null;
  try {
    return wps.PresentationApplication();
  } catch {
    return null;
  }
}

function activeSlide(): { Shapes: any; SlideIndex: number } | null {
  const app = getPresentation() as any;
  if (!app) return null;
  const view = app.ActiveWindow?.View;
  if (view?.Slide) return view.Slide;
  const slides = app.ActivePresentation?.Slides;
  if (slides?.Count > 0) return slides.Item(1);
  return null;
}

export function isInWps(): boolean {
  return getPresentation() !== null;
}

export async function insertVideoToSlide(videoUrl: string): Promise<void> {
  const slide = activeSlide();
  if (!slide) {
    window.open(videoUrl, "_blank");
    return;
  }
  slide.Shapes.AddMediaObject2(videoUrl, false, true, 80, 80, 480, 270);
}

export async function insertImageToSlide(imageUrl: string): Promise<void> {
  const slide = activeSlide();
  if (!slide) {
    window.open(imageUrl, "_blank");
    return;
  }
  slide.Shapes.AddPicture(imageUrl, false, true, 80, 80, 320, 320);
}

// Best-effort: register a callback so that when the user enters slideshow
// mode, the overlay launcher fires. WPS event surface varies by version, so
// we wrap in try/catch and let the UI fall back to a manual button.
export function onSlideShowBegin(cb: () => void): () => void {
  const app = getPresentation() as any;
  if (!app?.SlideShowBegin) return () => {};
  try {
    const handler = (): void => cb();
    app.SlideShowBegin.connect(handler);
    return () => {
      try {
        app.SlideShowBegin.disconnect(handler);
      } catch {
        /* noop */
      }
    };
  } catch {
    return () => {};
  }
}
