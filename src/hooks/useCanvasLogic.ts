import { useState, useRef, useEffect, RefObject } from 'react';

export function useCanvasLogic(
  canvasRef: RefObject<HTMLDivElement | null>,
  onNodeClick?: (_e: any, nodeId: string) => void,
  onCanvasClick?: () => void
) {
  const [pan] = useState({ x: 0, y: 0 });
  const [zoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const dragDistance = useRef(0);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>(() => {
    if (typeof window !== 'undefined' && window.innerWidth > 0 && window.innerHeight > 0) {
      return { width: window.innerWidth, height: window.innerHeight };
    }
    return { width: 1024, height: 768 };
  });

  const [canvasElement, setCanvasElement] = useState<HTMLDivElement | null>(canvasRef.current);

  // Sync canvasElement whenever canvasRef.current attaches or updates
  useEffect(() => {
    if (canvasRef.current !== canvasElement) {
      setCanvasElement(canvasRef.current);
    }
  });

  // Resize observer and window resize listener to dynamically update container dimensions
  useEffect(() => {
    const target = canvasElement || canvasRef.current;

    const updateDimensions = () => {
      if (target) {
        const rect = target.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setContainerSize({
            width: rect.width,
            height: rect.height
          });
          return;
        }
      }
      if (typeof window !== 'undefined' && window.innerWidth > 0 && window.innerHeight > 0) {
        setContainerSize({
          width: window.innerWidth,
          height: window.innerHeight
        });
      }
    };

    updateDimensions();

    const handleWindowResize = () => {
      updateDimensions();
    };

    window.addEventListener('resize', handleWindowResize);

    let ro: ResizeObserver | null = null;
    if (target && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            setContainerSize({
              width: entry.contentRect.width,
              height: entry.contentRect.height
            });
          }
        }
      });
      ro.observe(target);
    }

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      ro?.disconnect();
    };
  }, [canvasElement, canvasRef]);

  const handleCanvasMouseDown = (e: any) => {
    // Disabled dragging / panning
    setIsDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    dragDistance.current = 0;
  };

  const handleWheel = (_e: any) => {
    // Disabled zooming as requested by the user
    return;
  };

  const handleCanvasMouseMove = (e: any) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    dragDistance.current += Math.abs(dx) + Math.abs(dy);

    // Disabled panning as requested by the user
    // setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  const handleNodeClickInternal = (e: any, nodeId: string) => {
    e.stopPropagation();
    onNodeClick?.(e, nodeId);
  };

  const handleCanvasClickInternal = () => {
    if (dragDistance.current > 5) return; // Distinguish between drag and click
    onCanvasClick?.();
  };

  return {
    pan,
    zoom,
    isDragging,
    containerSize,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleCanvasClick: handleCanvasClickInternal,
    handleWheel,
    handleNodeClick: handleNodeClickInternal
  };
}
