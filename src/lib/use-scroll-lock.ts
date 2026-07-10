import { useEffect, useRef } from 'react';

export function useScrollLock(locked: boolean) {
  const savedY = useRef(0);
  useEffect(() => {
    if (!locked) return;
    savedY.current = window.scrollY;
    const { style } = document.body;
    style.position = 'fixed';
    style.top = `-${savedY.current}px`;
    style.left = '0';
    style.right = '0';
    style.width = '100%';
    return () => {
      const y = savedY.current;
      const { style: s } = document.body;
      s.position = '';
      s.top = '';
      s.left = '';
      s.right = '';
      s.width = '';
      // instant로 1프레임 flash 방지
      window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
    };
  }, [locked]);
}
