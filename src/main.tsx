import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";
import "./i18n/config";

// Register service worker with update prompt
const updateSW = registerSW({
  onNeedRefresh() {
    // Show update notification to user
    if (confirm('Dostępna nowa wersja aplikacji. Odświeżyć teraz?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App ready for offline use');
  },
  onRegisteredSW(swUrl, registration) {
    console.log('[PWA] SW registered:', swUrl);
    // Check for updates every 5 minutes
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 5 * 60 * 1000);
    }
  },
});

createRoot(document.getElementById("root")!).render(<App />);
