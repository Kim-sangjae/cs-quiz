import { describe, it, expect } from 'vitest';
import { escapeHtml } from './mailer';

describe('escapeHtml', () => {
  it('스크립트 태그를 무해화한다', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    );
  });

  it('img onerror 인젝션을 무해화한다', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
    );
  });

  it('일반 텍스트는 그대로 둔다', () => {
    expect(escapeHtml('안녕하세요 문의드립니다')).toBe('안녕하세요 문의드립니다');
  });

  it('앰퍼샌드를 먼저 이스케이프해 이중 이스케이프를 방지한다', () => {
    expect(escapeHtml('A & B < C')).toBe('A &amp; B &lt; C');
  });
});
