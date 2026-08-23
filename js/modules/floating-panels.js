// modules/floating-panels.js
// PLACEHOLDER — a lógica real (giroscópio / DeviceOrientation) entra numa fase futura.

export const floatingPanelsModule = {
  id: 'floating-panels',
  label: 'Painéis flutuantes',
  defaultEnabled: false,

  init() {
    console.log('[floating-panels] módulo iniciado (placeholder)');
  },

  onFrame({ ctx }) {
    ctx.save();
    ctx.font = '28px sans-serif';
    ctx.fillStyle = 'rgba(147, 51, 234, 0.9)';
    ctx.fillText('🪟 Floating panels (placeholder)', 24, 180);
    ctx.restore();
  },

  onDisable() {
    console.log('[floating-panels] desativado');
  },
};
