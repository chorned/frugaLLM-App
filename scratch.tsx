import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const Tooltip = ({ text }: { text: string }) => {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top - 8,
        left: rect.left + rect.width / 2
      });
      setShow(true);
    }
  };

  return (
    <span 
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShow(false)}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px', borderRadius: '50%', border: '1.5px solid #9ca3af', color: '#9ca3af', fontSize: '10px', fontWeight: 'bold', marginLeft: '6px', cursor: 'help' }}
    >
      i
      {show && createPortal(
        <div style={{
          position: 'fixed',
          top: coords.top,
          left: coords.left,
          transform: 'translate(-50%, -100%)',
          width: '200px',
          backgroundColor: '#111827',
          color: '#fff',
          textAlign: 'center',
          borderRadius: '4px',
          padding: '8px',
          zIndex: 9999,
          fontSize: '0.75rem',
          fontFamily: 'sans-serif',
          fontWeight: 'normal',
          pointerEvents: 'none',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
          textTransform: 'none'
        }}>
          {text}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            marginLeft: '-5px',
            borderWidth: '5px',
            borderStyle: 'solid',
            borderColor: '#111827 transparent transparent transparent'
          }} />
        </div>,
        document.body
      )}
    </span>
  );
};
