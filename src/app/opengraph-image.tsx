import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'CSORA — 7개 영역 CS 기초 지식을 20문제로 점검하세요';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const CATEGORIES = ['자료구조', '알고리즘', '운영체제', '네트워크', 'DB', '컴퓨터 구조', '소프트웨어공학'];

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          padding: '0 80px',
        }}
      >
        <div style={{ color: '#10b981', fontSize: 18, fontWeight: 600, marginBottom: 24, letterSpacing: '0.1em' }}>
          CSORA
        </div>
        <div style={{ color: '#ffffff', fontSize: 64, fontWeight: 700, letterSpacing: '-1px', marginBottom: 20, textAlign: 'center', lineHeight: 1.1 }}>
          CS 기초 지식을
        </div>
        <div style={{ color: '#ffffff', fontSize: 64, fontWeight: 700, letterSpacing: '-1px', marginBottom: 32, textAlign: 'center', lineHeight: 1.1 }}>
          20문제로 점검하세요
        </div>
        <div style={{ color: '#737373', fontSize: 22, marginBottom: 56, textAlign: 'center' }}>
          7개 영역 · 즉시 해설 · 오답 복습
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {CATEGORIES.map((cat) => (
            <div
              key={cat}
              style={{
                background: '#1a1a1a',
                border: '1px solid #262626',
                borderRadius: 8,
                padding: '8px 18px',
                color: '#a3a3a3',
                fontSize: 18,
              }}
            >
              {cat}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
