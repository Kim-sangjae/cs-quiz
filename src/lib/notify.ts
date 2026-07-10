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
  if (document.hasFocus()) return;
  flashTitle(`🔔 ${title}`);
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icon-192.png', tag: 'csora' });
  }
}

export async function requestNotificationPermission(): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}
