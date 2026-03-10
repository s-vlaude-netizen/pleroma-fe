export const showDesktopNotification = async (rootState, desktopNotificationOpts) => {
  if (!('Notification' in window && window.Notification.permission === 'granted')) return
  if (rootState.statuses.notifications.desktopNotificationSilence) { return }

  // we in mobile?
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      return registration.showNotification(desktopNotificationOpts.title, desktopNotificationOpts);
    } catch (err) {
      console.error("Service Worker failed me:", err);
    }
  }

  // or maybe not?
  return new window.Notification(desktopNotificationOpts.title, desktopNotificationOpts)
}
