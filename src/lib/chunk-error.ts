// 배포 직후 예전 탭에 남아있던 청크 파일명이 서버에서 사라져 발생하는 ChunkLoadError를
// 감지해서 한 번만 자동 새로고침시키기 위한 공용 유틸
const RELOAD_FLAG_KEY = 'chunk-error-reloaded';

export function isChunkLoadError(err: { name?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  const text = `${err.name ?? ''} ${err.message ?? ''}`;
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module/i.test(text);
}

// 이미 한 번 자동 새로고침을 시도했으면 무한 루프 방지를 위해 재시도하지 않음. 새로고침을 실제로 시작했으면 true
export function reloadOnceForChunkError(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG_KEY)) return false;
    sessionStorage.setItem(RELOAD_FLAG_KEY, '1');
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

// 정상적으로 페이지가 렌더링된 시점에 호출 — 다음에 또 배포돼서 에러가 나면 다시 한 번 재시도를 허용
export function clearChunkErrorFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_FLAG_KEY);
  } catch {
    /* ignore */
  }
}
