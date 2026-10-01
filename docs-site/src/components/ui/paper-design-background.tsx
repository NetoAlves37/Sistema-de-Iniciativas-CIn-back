'use client';

import { Dithering } from '@paper-design/shaders-react';

interface PaperDesignBackgroundProps {
  className?: string;
}

export function PaperDesignBackground({ className = '' }: PaperDesignBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={[
        'pointer-events-none absolute inset-0 flex items-end overflow-hidden',
        className,
      ].join(' ')}
    >
      <Dithering
        colorBack="#ffffff"
        colorFront="#dc2626"
        speed={0.3}
        shape="wave"
        type="4x4"
        pxSize={3}
        scale={1.1}
        style={{
          height: '50%',
          width: '100%',
        }}
      />
    </div>
  );
}
