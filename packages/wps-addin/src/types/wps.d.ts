// Minimal WPS JS API surface used by this add-in. Real API lives at the global
// `wps` object inside WPS Office. When running outside WPS (browser), it's
// undefined and we fall back to download/iframe behaviour.

declare global {
  interface Window {
    wps?: WpsApi;
  }
}

export interface WpsApi {
  PresentationApplication?: () => WpsPresentationApp;
  WpsApplication?: () => unknown;
  EtApplication?: () => unknown;
}

export interface WpsPresentationApp {
  ActivePresentation: WpsPresentation;
  ActiveWindow?: { View?: { Slide?: WpsSlide } };
}

export interface WpsPresentation {
  Slides: { Item: (i: number) => WpsSlide; Count: number };
}

export interface WpsSlide {
  SlideIndex: number;
  Shapes: WpsShapes;
}

export interface WpsShapes {
  AddMediaObject2: (
    file: string,
    linkToFile: boolean,
    saveWithDocument: boolean,
    left: number,
    top: number,
    width?: number,
    height?: number,
  ) => unknown;
  AddPicture: (
    file: string,
    linkToFile: boolean,
    saveWithDocument: boolean,
    left: number,
    top: number,
    width?: number,
    height?: number,
  ) => unknown;
}

export {};
