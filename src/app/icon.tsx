import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            color: '#10b981',
            fontSize: 220,
            fontWeight: 700,
            fontFamily: 'sans-serif',
            letterSpacing: '-8px',
          }}
        >
          CS
        </div>
      </div>
    ),
    { ...size }
  );
}
