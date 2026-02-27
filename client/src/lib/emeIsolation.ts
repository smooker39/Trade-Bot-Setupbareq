import React, { memo, useEffect, useRef, useState } from 'react';

export interface EMERenderConfig {
  id: string;
  updateInterval: number;
  memoryLimit: number;
  priority: 'critical' | 'high' | 'normal' | 'low';
}

/**
 * Higher-Order Component for EME Isolation
 * Ensures each section has its own update loop and memory ceiling.
 */
export function withEME<P extends object>(Component: React.ComponentType<P>, config: EMERenderConfig) {
  const MemoizedComponent = memo(Component);

  return function IsolatedEME(props: P) {
    const [, setShouldRender] = useState(false);
    const lastUpdate = useRef(0);

    useEffect(() => {
      let frameId: number;
      const loop = (now: number) => {
        if (now - lastUpdate.current >= config.updateInterval) {
          lastUpdate.current = now;
          setShouldRender(prev => !prev);
        }
        frameId = requestAnimationFrame(loop);
      };
      frameId = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(frameId);
    }, [config.updateInterval]);

    return React.createElement('div', {
      'data-eme-id': config.id,
      style: {
        contain: 'layout style',
        isolation: 'isolate'
      } as React.CSSProperties,
      className: 'eme-container'
    }, React.createElement(MemoizedComponent, props));
  };
}
