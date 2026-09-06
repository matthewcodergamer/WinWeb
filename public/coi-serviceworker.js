/* WinWeb compatibility cleanup service worker.
 * The previous COI shim could reload before the app rendered on iPhone Safari.
 * Keep this path temporarily so existing registrations can update and unregister cleanly.
 */
if (typeof window === 'undefined') {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => {
    event.waitUntil(self.registration.unregister());
  });
}
