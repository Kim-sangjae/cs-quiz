'use client';

import { useEffect } from 'react';
import { isChunkLoadError, reloadOnceForChunkError, clearChunkErrorFlag } from '@/lib/chunk-error';

// 라우트 전환 프리페치 중 실패한 청크 로드는 React 에러 바운더리(error.tsx)를 안 거치고
// unhandledrejection으로만 올라오는 경우가 있어 별도로 감지해 자동 새로고침한다
export default function ChunkErrorHandler() {
  useEffect(() => {
    clearChunkErrorFlag();

    function handleRejection(e: PromiseRejectionEvent) {
      if (isChunkLoadError(e.reason)) reloadOnceForChunkError();
    }
    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, []);

  return null;
}
