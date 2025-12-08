import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('PRISMX PWA: Service Worker registered:', registration.scope);
      })
      .catch((error) => {
        console.log('PRISMX PWA: Service Worker registration failed:', error);
      });
  });
}

if (typeof window !== 'undefined') {
  const idle = (fn: () => void) => {
    const ric = (window as any).requestIdleCallback;
    if (typeof ric === 'function') ric(fn);
    else setTimeout(fn, 2000);
  };
  idle(() => {
    import('recharts').catch(() => {});
  });
}
