'use client';
import { useEffect } from 'react';

const SKIP_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'OPTION']);

export default function DragScroll() {
  useEffect(() => {
    let dragging = false;
    let didDrag = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;
    let scroller: Element | null = null;

    function getScroller(el: Element | null): Element | null {
      let node = el;
      while (node && node !== document.documentElement) {
        const { overflowX, overflowY } = getComputedStyle(node);
        const canScrollX = (overflowX === 'auto' || overflowX === 'scroll') && node.scrollWidth > node.clientWidth;
        const canScrollY = (overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight;
        if (canScrollX || canScrollY) return node;
        node = node.parentElement;
      }
      const root = document.documentElement;
      if (root.scrollHeight > root.clientHeight || root.scrollWidth > root.clientWidth) return root;
      return null;
    }

    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return;
      const target = e.target as Element;
      if (SKIP_TAGS.has(target.tagName)) return;
      if (target.closest('button, a, input, textarea, select, [role="button"], [contenteditable]')) return;

      const s = getScroller(target);
      if (!s) return;

      dragging = true;
      didDrag = false;
      scroller = s;
      startX = e.clientX;
      startY = e.clientY;
      scrollLeft = s.scrollLeft;
      scrollTop = s.scrollTop;
    }

    function onMouseMove(e: MouseEvent) {
      if (!dragging || !scroller) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!didDrag && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      if (!didDrag) {
        didDrag = true;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
      }
      scroller.scrollLeft = scrollLeft - dx;
      scroller.scrollTop = scrollTop - dy;
    }

    function onMouseUp() {
      if (didDrag) {
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }
      dragging = false;
      didDrag = false;
      scroller = null;
    }

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return null;
}
