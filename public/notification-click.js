self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const scopeUrl = new URL(self.registration.scope);
  const target = new URL(data.url || scopeUrl.href, scopeUrl.href);

  if (data.taskId && !target.searchParams.has('gtcTaskId')) target.searchParams.set('gtcTaskId', String(data.taskId));
  if ((data.type === 'test' || data.taskId) && !target.searchParams.has('gtcView')) target.searchParams.set('gtcView', 'tareas');

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existingClient = windowClients.find((client) => {
      const clientUrl = new URL(client.url);
      return clientUrl.origin === scopeUrl.origin && clientUrl.pathname.startsWith(scopeUrl.pathname);
    });

    if (existingClient) {
      if ('navigate' in existingClient) await existingClient.navigate(target.href);
      await existingClient.focus();
      return;
    }

    if (self.clients.openWindow) await self.clients.openWindow(target.href);
  })());
});
