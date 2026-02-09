import { useRef, useCallback, useEffect } from 'react';

interface MomentumScrollOptions {
  friction?: number;
  onScroll?: (scrollTop: number, velocity: number) => void;
}

export function useMomentumScroll(options: MomentumScrollOptions = {}) {
  const { friction = 0.92, onScroll } = options;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startScrollTop = useRef(0);
  const velocity = useRef(0);
  const lastY = useRef(0);
  const lastTime = useRef(0);
  const animationFrame = useRef<number | null>(null);
  const velocityHistory = useRef<{ y: number; time: number }[]>([]);

  const stopMomentum = useCallback(() => {
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
  }, []);

  const animateMomentum = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (Math.abs(velocity.current) < 0.5) {
      velocity.current = 0;
      return;
    }

    container.scrollTop += velocity.current;
    velocity.current *= friction;

    if (onScroll) {
      onScroll(container.scrollTop, velocity.current);
    }

    animationFrame.current = requestAnimationFrame(animateMomentum);
  }, [friction, onScroll]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;

    stopMomentum();
    isDragging.current = true;
    startY.current = e.clientY;
    startScrollTop.current = container.scrollTop;
    lastY.current = e.clientY;
    lastTime.current = Date.now();
    velocityHistory.current = [];
    
    container.setPointerCapture(e.pointerId);
    container.style.cursor = 'grabbing';
    container.style.userSelect = 'none';
  }, [stopMomentum]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    
    const container = containerRef.current;
    if (!container) return;

    const currentY = e.clientY;
    const deltaY = currentY - startY.current;
    
    container.scrollTop = startScrollTop.current - deltaY;

    const now = Date.now();
    const timeDelta = now - lastTime.current;
    
    if (timeDelta > 0) {
      const currentVelocity = (lastY.current - currentY) / timeDelta * 16;
      velocityHistory.current.push({ y: currentVelocity, time: now });
      
      if (velocityHistory.current.length > 5) {
        velocityHistory.current.shift();
      }
    }

    lastY.current = currentY;
    lastTime.current = now;

    if (onScroll) {
      onScroll(container.scrollTop, 0);
    }
  }, [onScroll]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    
    const container = containerRef.current;
    if (!container) return;

    isDragging.current = false;
    container.releasePointerCapture(e.pointerId);
    container.style.cursor = 'grab';
    container.style.userSelect = '';

    if (velocityHistory.current.length > 0) {
      const recentVelocities = velocityHistory.current.slice(-3);
      const avgVelocity = recentVelocities.reduce((sum, v) => sum + v.y, 0) / recentVelocities.length;
      velocity.current = -avgVelocity * 1.5;

      if (Math.abs(velocity.current) > 1) {
        animateMomentum();
      }
    }
  }, [animateMomentum]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    stopMomentum();
    
    const container = containerRef.current;
    if (!container) return;

    e.preventDefault();
    
    velocity.current = e.deltaY * 0.3;
    animateMomentum();
  }, [stopMomentum, animateMomentum]);

  useEffect(() => {
    return () => {
      stopMomentum();
    };
  }, [stopMomentum]);

  return {
    containerRef,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerLeave: handlePointerUp,
      onWheel: handleWheel,
    },
    stopMomentum,
  };
}
