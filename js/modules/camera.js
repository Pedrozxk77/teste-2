// modules/camera.js
// Módulo base: obtém o stream da câmera traseira e alimenta o <video>.
// É "locked" (travado) porque sem ele nenhum outro módulo funciona.

export const cameraModule = {
  id: 'camera',
  label: 'Câmera (obrigatório)',
  defaultEnabled: true,
  locked: true,

  async init({ video }) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Este navegador não suporta acesso à câmera.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    video.srcObject = stream;
    await new Promise((resolve) => {
      video.onloadedmetadata = () => resolve();
    });
  },

  // A câmera não desenha nada no canvas — só fornece o vídeo de fundo.
  onFrame() {},
};
