type NavWithBadge = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

let flashId: ReturnType<typeof setInterval> | null = null;
let originalTitle = '';

function stopFlash() {
  if (flashId) { clearInterval(flashId); flashId = null; }
  if (originalTitle) { document.title = originalTitle; originalTitle = ''; }
}

function flashTitle(text: string) {
  if (typeof document === 'undefined') return;
  if (!originalTitle) originalTitle = document.title;
  if (flashId) clearInterval(flashId);
  // 즉시 표시 후 깜빡임 시작 (카톡 웹처럼 탭 제목 교차 표시)
  document.title = text;
  let on = false;
  flashId = setInterval(() => {
    document.title = on ? text : originalTitle;
    on = !on;
  }, 1000);
}

function setBadge() {
  const nav = navigator as NavWithBadge;
  // 인자 없이 호출 → 숫자 없는 빨간 점만 표시
  if (nav.setAppBadge) void nav.setAppBadge();
}

function clearBadge() {
  const nav = navigator as NavWithBadge;
  if (nav.clearAppBadge) void nav.clearAppBadge();
}

// 앱 포커스 시 뱃지·타이틀 초기화
if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => { stopFlash(); clearBadge(); });
}

export function sendNotification(title: string, body: string) {
  if (typeof document === 'undefined') return;
  flashTitle(`🔔 ${title}`);
  // PWA 설치 시 작업표시줄 아이콘 뱃지 (setAppBadge API)
  setBadge();
  // OS 토스트 알림 (브라우저/PWA 아이콘 깜빡임 포함)
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: '/icon-192.png', tag: 'csora', silent: false });
    } catch {
      // SW 환경 등에서 실패 시 무시
    }
  }
}

export async function requestNotificationPermission(): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}
