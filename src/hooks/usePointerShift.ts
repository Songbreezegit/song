import { useState, useCallback } from 'react';

interface PointerShiftConfig {
  maxOffset?: number;
  dampening?: number;
}

export function usePointerShift(config: PointerShiftConfig = {}) {
  const { maxOffset = 3, dampening = 0.1 } = config;
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (typeof window === 'undefined') return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (!window.matchMedia('(pointer: fine)').matches) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = (e.clientX - centerX) * dampening;
      const deltaY = (e.clientY - centerY) * dampening;

      const clampedX = Math.max(-maxOffset, Math.min(maxOffset, deltaX));
      const clampedY = Math.max(-maxOffset, Math.min(maxOffset, deltaY));

      setOffset({ x: clampedX, y: clampedY });
    },
    [maxOffset, dampening]
  );

  const handleMouseLeave = useCallback(() => {
    setOffset({ x: 0, y: 0 });
  }, []);

  return {
    offset,
    handleMouseMove,
    handleMouseLeave,
    style: {
      transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
      transition: offset.x === 0 && offset.y === 0 ? 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1)' : 'transform 80ms ease-out',
    },
  };
}
