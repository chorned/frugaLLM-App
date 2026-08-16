import React, { ReactNode } from 'react';
import { useCanvasLogic } from '../hooks/useCanvasLogic';

interface CanvasProps {
  children?: ReactNode;
  canvasLogic: ReturnType<typeof useCanvasLogic>;
  terminalMode: boolean;
  autoScale: number;
}

export const Canvas: React.FC<CanvasProps> = ({ children, canvasLogic, terminalMode, autoScale }) => {
  const {
    pan,
    zoom,
    isDragging,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleCanvasClick,
    handleWheel
  } = canvasLogic;

  return (
    <div 
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseUp}
      onClick={handleCanvasClick}
      onWheel={handleWheel}
      style={{ 
        flexGrow: 1, position: 'relative', 
        cursor: isDragging ? 'grabbing' : 'grab',
        display: terminalMode ? 'none' : 'block'
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        transform: `scale(${autoScale}) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        transformOrigin: 'center center',
        pointerEvents: 'none'
      }}>
        {children}
      </div>
    </div>
  );
};
