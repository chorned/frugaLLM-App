import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasLogic } from '../useCanvasLogic';

describe('useCanvasLogic Hook', () => {
  let mockResizeObserverCallback: any = null;
  let observeSpy: any;
  let disconnectSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    observeSpy = vi.fn();
    disconnectSpy = vi.fn();

    class MockResizeObserver {
      constructor(cb: any) {
        mockResizeObserverCallback = cb;
      }
      observe = observeSpy;
      unobserve = vi.fn();
      disconnect = disconnectSpy;
    }

    globalThis.ResizeObserver = MockResizeObserver as any;
  });

  it('initializes default pan, zoom, and container dimensions', () => {
    // Arrange
    const ref = { current: null };

    // Act
    const { result } = renderHook(() => useCanvasLogic(ref));

    // Assert
    expect(result.current.pan).toEqual({ x: 0, y: 0 });
    expect(result.current.zoom).toBe(1);
    expect(result.current.isDragging).toBe(false);
    expect(result.current.containerSize).toEqual({ width: 1024, height: 768 });
  });

  it('attaches ResizeObserver to canvas element and updates containerSize on resize', () => {
    // Arrange
    const dummyElement = document.createElement('div');
    const ref = { current: dummyElement };

    // Act
    const { result, unmount } = renderHook(() => useCanvasLogic(ref));

    // Assert: observer was attached
    expect(observeSpy).toHaveBeenCalledWith(dummyElement);

    // Act 2: Simulate resize callback
    act(() => {
      mockResizeObserverCallback([
        {
          contentRect: { width: 1920, height: 1080 },
        },
      ]);
    });

    // Assert: size updated
    expect(result.current.containerSize).toEqual({ width: 1920, height: 1080 });

    // Act 3: Unmount cleans up observer
    unmount();
    expect(disconnectSpy).toHaveBeenCalled();
  });

  it('handles node click with stopPropagation and callback propagation', () => {
    // Arrange
    const onNodeClick = vi.fn();
    const ref = { current: null };
    const { result } = renderHook(() => useCanvasLogic(ref, onNodeClick));

    const mockEvent = {
      stopPropagation: vi.fn(),
    };

    // Act
    act(() => {
      result.current.handleNodeClick(mockEvent, 'ollama-node');
    });

    // Assert
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
    expect(onNodeClick).toHaveBeenCalledWith(mockEvent, 'ollama-node');
  });

  it('triggers onCanvasClick when click happens without dragging (distance <= 5)', () => {
    // Arrange
    const onCanvasClick = vi.fn();
    const ref = { current: null };
    const { result } = renderHook(() => useCanvasLogic(ref, undefined, onCanvasClick));

    // Act: Mouse down, small move (<5px), mouse up, click in separate state dispatches
    act(() => {
      result.current.handleCanvasMouseDown({ clientX: 100, clientY: 100 });
    });
    act(() => {
      result.current.handleCanvasMouseMove({ clientX: 101, clientY: 102 });
    });
    act(() => {
      result.current.handleCanvasMouseUp();
    });
    act(() => {
      result.current.handleCanvasClick();
    });

    // Assert: Click fired
    expect(onCanvasClick).toHaveBeenCalledTimes(1);
  });

  it('suppresses onCanvasClick when dragging exceeds threshold (distance > 5)', () => {
    // Arrange
    const onCanvasClick = vi.fn();
    const ref = { current: null };
    const { result } = renderHook(() => useCanvasLogic(ref, undefined, onCanvasClick));

    // Act: Mouse down, large move (>5px), mouse up, click
    act(() => {
      result.current.handleCanvasMouseDown({ clientX: 100, clientY: 100 });
    });
    act(() => {
      result.current.handleCanvasMouseMove({ clientX: 150, clientY: 150 });
    });
    act(() => {
      result.current.handleCanvasMouseUp();
    });
    act(() => {
      result.current.handleCanvasClick();
    });

    // Assert: Click was suppressed due to drag threshold
    expect(onCanvasClick).not.toHaveBeenCalled();
  });
});
