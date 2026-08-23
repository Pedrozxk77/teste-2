// modules/object-detection.js
// PLACEHOLDER — a lógica real (TensorFlow.js / COCO-SSD) entra numa fase futura.

export const objectDetectionModule = {
  id: 'object-detection',
  label: 'Reconhecimento de objeto',
  defaultEnabled: false,

  init() {
    console.log('[object-detection] módulo iniciado (placeholder)');
  },

  onFrame({ ctx }) {
    ctx.save();
    ctx.font = '28px sans-serif';
    ctx.fillStyle = 'rgba(234, 88, 12, 0.9)';
    ctx.fillText('📦 Object detection (placeholder)', 24, 100);
    ctx.restore();
  },

  onDisable() {
    console.log('[object-detection] desativado');
  },
};
