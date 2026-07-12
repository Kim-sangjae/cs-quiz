type NavWithBadge = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

// 모바일은 백그라운드 시 오프라인 판정 → 알림 받을 상황이 없어 알림 기능 전체 비활성화
const isMobile =
  typeof navigator !== 'undefined' && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);

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

// 앱 포커스 시 뱃지·타이틀 초기화 + 알림용 서비스워커 등록 (PC 전용)
if (typeof window !== 'undefined' && !isMobile) {
  window.addEventListener('focus', () => { stopFlash(); clearBadge(); });
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.register('/sw.js').catch(() => { /* 미지원 환경 무시 */ });
  }
}

function showOsNotification(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body, icon: '/icon-192.png', tag: 'csora' };
  const fallback = () => {
    try { new Notification(title, opts); } catch { /* Android 등 미지원 시 무시 */ }
  };
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration()
      .then((reg) => { if (reg) return reg.showNotification(title, opts); fallback(); })
      .catch(fallback);
  } else {
    fallback();
  }
}

export function sendNotification(title: string, body: string) {
  if (typeof document === 'undefined' || isMobile) return;
  flashTitle(`🔔 ${title}`);
  // PWA 설치 시 작업표시줄 아이콘 뱃지 (setAppBadge API)
  setBadge();
  // OS 토스트 알림 (모바일은 SW showNotification, PC는 Notification 생성자 fallback)
  showOsNotification(title, body);
}

export async function requestNotificationPermission(): Promise<void> {
  if (typeof window === 'undefined' || isMobile || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}
