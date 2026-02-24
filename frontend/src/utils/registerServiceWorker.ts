export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });

      console.log('Service Worker registered successfully:', registration.scope);

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('New service worker available. Refresh to update.');
              // Optionally show a notification to the user
              if (confirm('Nova versão disponível! Deseja atualizar?')) {
                window.location.reload();
              }
            }
          });
        }
      });

      // Auto-update check every hour
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);

    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  } else {
    console.log('Service Workers are not supported in this browser.');
  }
}
