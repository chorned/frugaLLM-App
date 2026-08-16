import { useState, useRef, useEffect, RefObject } from 'react';

export function useCanvasLogic(
  canvasRef: RefObject<HTMLDivElement>,
  onNodeClick?: (e: any, nodeId: string) => void,
  onCanvasClick?: () => void
) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const dragDistance = useRef(0);
  const [containerSize, setContainerSize] = useState({ width: 1024, height: 768 });

  // Resize observer to auto-scale canvas elements
  useEffect(() => {
    if (!canvasRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, [canvasRef]);

  const handleCanvasMouseDown = (e: any) => {
    // Disabled dragging / panning
    setIsDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    dragDistance.current = 0;
  };

  const handleWheel = (e: any) => {
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
