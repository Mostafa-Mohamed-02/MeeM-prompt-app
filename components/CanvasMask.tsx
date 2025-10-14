import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Mask } from '../types';

interface CanvasMaskProps {
  imageUrl: string;
  onMaskChange: (mask: Mask) => void;
  disabled: boolean;
  imageRef: React.RefObject<HTMLImageElement>;
  mask?: Mask | null;
}

const CanvasMask: React.FC<CanvasMaskProps> = ({ imageUrl, onMaskChange, disabled, imageRef, mask: propsMask }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentMask, setCurrentMask] = useState<Mask | null>(null);

  const getCoords = (e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    // Handle cases where rect has no size to avoid division by zero
    if (rect.width === 0 || rect.height === 0) {
      return { x: 0, y: 0 };
    }
    
    // Calculate mouse position relative to the canvas, accounting for CSS scaling from hover effects
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDrawing(true);
    setStartPos(getCoords(e));
    setCurrentMask(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !startPos) return;
    const currentPos = getCoords(e);
    const mask: Mask = {
      x: Math.min(startPos.x, currentPos.x),
      y: Math.min(startPos.y, currentPos.y),
      width: Math.abs(startPos.x - currentPos.x),
      height: Math.abs(startPos.y - currentPos.y),
    };
    setCurrentMask(mask);
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentMask && currentMask.width > 5 && currentMask.height > 5) {
      onMaskChange(currentMask);
    } else {
      setCurrentMask(null); // Discard tiny boxes
    }
    setStartPos(null);
  };

  // When parent-provided mask changes, sync it into the canvas so saved masks are visible
  useEffect(() => {
    setCurrentMask(propsMask ?? null);
  }, [propsMask]);

  // When disabled, clear any transient mask drawn locally so the canvas visually clears
  // Note: do NOT clear currentMask when disabled; keep visuals visible while drawing is disabled.

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!currentMask) return;

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(currentMask.x, currentMask.y, currentMask.width, currentMask.height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(currentMask.x, currentMask.y, currentMask.width, currentMask.height);

  }, [currentMask]);

  useEffect(() => {
    draw();
  }, [draw, currentMask]);
  
  // Resize canvas to match image display size
  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (canvas && image) {
      const resizeObserver = new ResizeObserver(() => {
        canvas.width = image.clientWidth;
        canvas.height = image.clientHeight;
        draw();
      });
      resizeObserver.observe(image);
      return () => resizeObserver.disconnect();
    }
  }, [imageUrl, imageRef, draw]);

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <img
        ref={imageRef}
        src={imageUrl}
        alt="Mask preview"
        className="max-w-full max-h-full object-contain pointer-events-none"
        // Ensure image is loaded before we try to get its dimensions
        onLoad={() => {
           const canvas = canvasRef.current;
           const image = imageRef.current;
           if(canvas && image) {
               canvas.width = image.clientWidth;
               canvas.height = image.clientHeight;
           }
        }}
      />
      <canvas
        ref={canvasRef}
        className={`absolute w-full h-full ${disabled ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
};

export default CanvasMask;