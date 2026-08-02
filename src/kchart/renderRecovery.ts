import type { KChartChartType, KChartRenderer } from '../types';

export type KChartRenderPhase = 'render' | 'update' | 'resize';

export interface KChartRendererResolution {
  requestedRenderer: KChartRenderer;
  activeRenderer: KChartRenderer;
  didFallback: boolean;
}

export interface KChartRenderAttempt<T> extends KChartRendererResolution {
  value: T;
  primaryError?: unknown;
}

export class KChartRenderFailure extends Error {
  constructor(
    message: string,
    readonly phase: KChartRenderPhase,
    readonly requestedRenderer: KChartRenderer,
    readonly primaryError: unknown,
    readonly fallbackError?: unknown
  ) {
    super(message);
    this.name = 'KChartRenderFailure';
  }
}

export const supportsWebglFallback = (chartType: KChartChartType, renderer: KChartRenderer): boolean =>
  renderer === 'webgl' && (chartType === 'line' || chartType === 'scatter');

export const rendererForChartType = (chartType: KChartChartType, requestedRenderer: KChartRenderer): KChartRenderer => {
  if (chartType === 'column' || chartType === 'area') {
    return 'svg';
  }
  if (chartType === 'candlestick') {
    return 'canvas';
  }
  return requestedRenderer;
};

export const detectWebglAvailability = (): boolean => {
  if (typeof document === 'undefined') {
    return false;
  }

  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl');
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    return context !== null;
  } catch {
    return false;
  }
};

export const assertWebglRenderSurface = (container: ParentNode): HTMLCanvasElement[] => {
  const canvases = Array.from(container.querySelectorAll<HTMLCanvasElement>('canvas[class*="kchart-webgl-canvas"]'));
  if (canvases.length === 0) {
    throw new Error('KChart did not create a WebGL render surface.');
  }

  for (const canvas of canvases) {
    const context = canvas.getContext('webgl');
    if (!context || context.isContextLost()) {
      throw new Error('KChart WebGL render surface is unavailable.');
    }
    if (!context.getParameter(context.CURRENT_PROGRAM)) {
      throw new Error('KChart WebGL renderer did not commit a shader program.');
    }
  }

  return canvases;
};

export const resolveRenderer = (
  chartType: KChartChartType,
  requestedRenderer: KChartRenderer,
  webglAvailable?: boolean
): KChartRendererResolution => {
  const compatibleRenderer = rendererForChartType(chartType, requestedRenderer);
  const webglRequested = supportsWebglFallback(chartType, compatibleRenderer);
  const didFallback = webglRequested && !(webglAvailable ?? detectWebglAvailability());
  return {
    requestedRenderer,
    activeRenderer: didFallback ? 'canvas' : compatibleRenderer,
    didFallback,
  };
};

export const renderWithRendererFallback = <T>(
  chartType: KChartChartType,
  requestedRenderer: KChartRenderer,
  render: (renderer: KChartRenderer) => T,
  reset: () => void = () => undefined,
  webglAvailable?: boolean
): KChartRenderAttempt<T> => {
  const resolution = resolveRenderer(chartType, requestedRenderer, webglAvailable);

  try {
    return {
      ...resolution,
      value: render(resolution.activeRenderer),
    };
  } catch (primaryError) {
    if (!supportsWebglFallback(chartType, resolution.activeRenderer)) {
      throw new KChartRenderFailure('KChart could not render this panel.', 'render', requestedRenderer, primaryError);
    }

    reset();
    try {
      return {
        requestedRenderer,
        activeRenderer: 'canvas',
        didFallback: true,
        primaryError,
        value: render('canvas'),
      };
    } catch (fallbackError) {
      throw new KChartRenderFailure(
        'KChart could not render this panel with WebGL or Canvas.',
        'render',
        requestedRenderer,
        primaryError,
        fallbackError
      );
    }
  }
};

export const readableError = (error: unknown): string =>
  error instanceof Error && error.message.trim() ? error.message : 'Unknown rendering error';
