// true cuando la página corre dentro de la app Android (Capacitor) y no en un navegador
export const esApp = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

// Clase en <html> para ajustes de estilo exclusivos de la app
if (esApp) document.documentElement.classList.add('app-nativa');
