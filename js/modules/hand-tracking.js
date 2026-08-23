// modules/hand-tracking.js
// PLACEHOLDER — a lógica real (MediaPipe Hands) entra numa fase futura.
// Por enquanto só desenha um texto no canvas para confirmar que o módulo
// está sendo chamado quando ativado.

export const handTrackingModule = {
  id: 'hand-tracking',
  label: 'Reconhecimento de mão',
  defaultEnabled: false,

  init() {
    console.log('[hand-tracking] módulo iniciado (placeholder)');
  },

  onFrame({ ctx }) {
    ctx.save();
    ctx.font = '28px sans-serif';
    ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
    ctx.fillText('✋ Hand tracking (placeholder)', 24, 60);
    ctx.restore();
  },

  onDisable() {
    console.log('[hand-tracking] desativado');
  },
};
