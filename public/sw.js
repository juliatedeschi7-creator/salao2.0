self.addEventListener('push', function (event) {
  if (!event.data) return;

  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/logo.png',
      badge: data.badge || '/logo.png',
      data: {
        url: data.url || '/'
      }
    })
  );
});

self.addEventListener('push', function (event) {
  if (!event.data) return
  const data = event.data.json()

  event.waitUntil(
    self.registration.showNotification(data.title || 'Nova notificação', {
      body: data.body || '',
      icon: data.icon || '/logo.png',
      badge: '/logo.png',
      tag: data.tag || 'default',
      data: { url: data.url || '/' },
      vibrate: [200, 100, 200],
    })
  )
})

      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});