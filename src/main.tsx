import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('app-notice', { detail: 'Hay una nueva version disponible. Cierra y abre la app para actualizar sin perder datos.' }));
  },
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent('app-notice', { detail: 'La app quedo lista para usarse sin conexion.' }));
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
