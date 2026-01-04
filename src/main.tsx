import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";
import "./i18n/config";

// Register service worker - auto-update silently on next page load
registerSW({
  onNeedRefresh() {
    // New version available - will apply on next refresh/reload
    console.log('[PWA] New version available, will update on next reload');
  },
  onOfflineReady() {
    console.log('[PWA] App ready for offline use');
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
