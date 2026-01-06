import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initSentry } from "./lib/sentry";
import "./index.css";
import "./i18n/config";

// Initialize Sentry error tracking
initSentry();

// Register service worker - auto-update silently on next page load
registerSW({
  onNeedRefresh() {
    // New version available - will apply on next refresh/reload
    console.log('[PWA] New version available, will update on next reload');
  },
  onOfflineReady() {
    console.log('[PWA] App ready for offline use');
  },
  onRegisteredSW(swUrl) {
    console.log('[PWA] SW registered:', swUrl);
  },
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
