/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

interface PushNotificationData {
  title?: string;
  body?: string;
  icon?: string;
  url?: string;
  tag?: string;
}

// Push notification handler
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received');
  
  const data: PushNotificationData = event.data?.json() ?? {};
  
  const options: NotificationOptions = {
    body: data.body || '',
    icon: data.icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: { url: data.url || '/admin' },
    tag: data.tag || 'reservation',
    requireInteraction: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Powiadomienie', options)
  );
});

// Notification click handler - open URL with reservationCode
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  
  event.notification.close();
  
  const url = event.notification.data?.url || '/admin';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window open
      for (const client of windowClients) {
        if (client.url.includes('/admin') && 'focus' in client) {
          return client.focus().then(() => {
            if ('navigate' in client) {
              return (client as WindowClient).navigate(url);
            }
          });
        }
      }
      // Open new window if no admin window is open
      return self.clients.openWindow(url);
    })
  );
});

// Service worker install event
self.addEventListener('install', () => {
  console.log('[SW] Service Worker installing');
  self.skipWaiting();
});

// Service worker activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activating');
  event.waitUntil(self.clients.claim());
});

export {};
