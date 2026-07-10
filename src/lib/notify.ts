let flashId: ReturnType<typeof setInterval> | null = null;
let originalTitle = '';

function stopFlash() {
  if (flashId) { clearInterval(flashId); flashId = null; }
  if (originalTitle) { document.title = originalTitle; originalTitle = ''; }
}

export function flashTitle(text: string) {
  if (typeof document === 'undefined') return;
  if (!originalTitle) originalTitle = document.title;
  if (flashId) clearInterval(flashId);
  let on = true;
  flashId = setInterval(() => {
    document.title = on ? text : originalTitle;
    on = !on;
  }, 700);
  window.addEventListener('focus', stopFlash, { once: true });
}

export function sendNotification(title: string, body: string) {
  if (typeof document === 'undefined') return;
  // 타이틀 플래시는 항상 실행 (탭 포커스 여부 무관)
  flashTitle(`🔔 ${title}`);
  // OS 알림: 브라우저가 포커스 억제 여부 자체 판단
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: '/icon-192.png', tag: 'csora', silent: false });
    } catch {
      // 일부 환경(SW 필요)에서 실패 시 무시
    }
  }
}

export async function requestNotificationPermission(): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}
