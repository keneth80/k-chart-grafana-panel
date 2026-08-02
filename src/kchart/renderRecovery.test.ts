import {
  KChartRenderFailure,
  assertWebglRenderSurface,
  readableError,
  rendererForChartType,
  renderWithRendererFallback,
  resolveRenderer,
  supportsWebglFallback,
} from './renderRecovery';

describe('renderRecovery', () => {
  it('selects Canvas when WebGL is unavailable for supported chart types', () => {
    expect(resolveRenderer('line', 'webgl', false)).toEqual({
      requestedRenderer: 'webgl',
      activeRenderer: 'canvas',
      didFallback: true,
    });
    expect(resolveRenderer('scatter', 'webgl', false).activeRenderer).toBe('canvas');
  });

  it('does not change supported Line and Scatter renderers', () => {
    expect(resolveRenderer('line', 'svg', false).activeRenderer).toBe('svg');
    expect(supportsWebglFallback('column', 'webgl')).toBe(false);
  });

  it('normalizes stale renderer selections for fixed-renderer chart types', () => {
    expect(rendererForChartType('column', 'webgl')).toBe('svg');
    expect(rendererForChartType('area', 'canvas')).toBe('svg');
    expect(rendererForChartType('candlestick', 'webgl')).toBe('canvas');
    expect(resolveRenderer('column', 'webgl', true)).toEqual({
      requestedRenderer: 'webgl',
      activeRenderer: 'svg',
      didFallback: false,
    });

    const render = jest.fn(() => 'controller');
    expect(renderWithRendererFallback('candlestick', 'webgl', render, jest.fn(), true).value).toBe('controller');
    expect(render).toHaveBeenCalledWith('canvas');
  });

  it('retries a failed WebGL render with Canvas', () => {
    const reset = jest.fn();
    const render = jest.fn((renderer: string) => {
      if (renderer === 'webgl') {
        throw new Error('WebGL context lost');
      }
      return 'controller';
    });

    expect(renderWithRendererFallback('line', 'webgl', render, reset, true)).toEqual(
      expect.objectContaining({
        value: 'controller',
        requestedRenderer: 'webgl',
        activeRenderer: 'canvas',
        didFallback: true,
      })
    );
    expect(render).toHaveBeenCalledTimes(2);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('surfaces a fatal error when both WebGL and Canvas fail', () => {
    expect(() =>
      renderWithRendererFallback(
        'line',
        'webgl',
        () => {
          throw new Error('failed');
        },
        jest.fn(),
        true
      )
    ).toThrow(KChartRenderFailure);
  });

  it('does not retry non-WebGL render failures', () => {
    const render = jest.fn(() => {
      throw new Error('SVG failed');
    });

    expect(() => renderWithRendererFallback('line', 'svg', render, jest.fn(), true)).toThrow(KChartRenderFailure);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('normalizes unknown errors for diagnostics', () => {
    expect(readableError(new Error('broken shader'))).toBe('broken shader');
    expect(readableError('failed')).toBe('Unknown rendering error');
  });

  it('returns every healthy WebGL series canvas', () => {
    const container = document.createElement('div');
    const context = {
      CURRENT_PROGRAM: 0x8b8d,
      getParameter: () => ({}),
      isContextLost: () => false,
    } as unknown as WebGLRenderingContext;
    for (let index = 0; index < 2; index += 1) {
      const canvas = document.createElement('canvas');
      canvas.className = `kchart-webgl-canvas-${index}`;
      jest.spyOn(canvas, 'getContext').mockReturnValue(context);
      container.append(canvas);
    }

    expect(assertWebglRenderSurface(container)).toHaveLength(2);
  });

  it('rejects a missing, unavailable, or lost WebGL render surface', () => {
    const container = document.createElement('div');
    expect(() => assertWebglRenderSurface(container)).toThrow('did not create');

    const canvas = document.createElement('canvas');
    canvas.className = 'kchart-webgl-canvas-0';
    const getContext = jest.spyOn(canvas, 'getContext').mockReturnValue(null);
    container.append(canvas);
    expect(() => assertWebglRenderSurface(container)).toThrow('is unavailable');

    getContext.mockReturnValue({ isContextLost: () => true } as WebGLRenderingContext);
    expect(() => assertWebglRenderSurface(container)).toThrow('is unavailable');

    getContext.mockReturnValue({
      CURRENT_PROGRAM: 0x8b8d,
      getParameter: () => null,
      isContextLost: () => false,
    } as unknown as WebGLRenderingContext);
    expect(() => assertWebglRenderSurface(container)).toThrow('did not commit');
  });
});
