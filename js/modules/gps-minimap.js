// modules/gps-minimap.js
// PLACEHOLDER — a lógica real (Geolocation API + bússola) entra numa fase futura.

export const gpsMinimapModule = {
  id: 'gps-minimap',
  label: 'GPS e minimapa',
  defaultEnabled: false,

  init() {
    console.log('[gps-minimap] módulo iniciado (placeholder)');
  },

  onFrame({ ctx }) {
    ctx.save();
    ctx.font = '28px sans-serif';
    ctx.fillStyle = 'rgba(22, 163, 74, 0.9)';
    ctx.fillText('🧭 GPS / minimapa (placeholder)', 24, 140);
    ctx.restore();
  },

  onDisable() {
    console.log('[gps-minimap] desativado');
  },
};
