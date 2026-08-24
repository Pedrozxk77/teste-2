// modules/hand-tracking.js
// Detecta a mão com MediaPipe e desenha o contorno em cinza no overlay.

// Ordem do contorno externo: os vales entre os dedos ficam preservados.
const HAND_CONTOUR = [
  0, 1, 2, 3, 4,
  8, 7, 6, 5,
  12, 11, 10, 9,
  16, 15, 14, 13,
  20, 19, 18, 17,
];

function drawHandLines(ctx, hand, width, height, config) {
  const point = (index) => ({
    x: hand[index].x * width,
    y: hand[index].y * height,
  });

  ctx.beginPath();
  for (let index = 0; index < HAND_CONTOUR.length; index += 1) {
    const current = point(HAND_CONTOUR[index]);
    if (index === 0) ctx.moveTo(current.x, current.y);
    else ctx.lineTo(current.x, current.y);
  }
  ctx.closePath();
  ctx.strokeStyle = config.outlineColor;
  ctx.lineWidth = config.outlineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function createHandTrackingModule(options = {}) {
  const config = {
    maxNumHands: 2,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.65,
    outlineColor: 'rgba(180, 180, 180, 0.95)',
    outlineWidth: 4,
    ...options,
  };
  let hands = null;
  let video = null;
  let landmarks = [];
  let processing = false;
  let silhouetteCanvas = null;

  const onResults = (results) => {
    landmarks = results.multiHandLandmarks || [];
    processing = false;
  };

  return {
    id: 'hand-tracking',
    label: 'Reconhecimento de mão',
    defaultEnabled: false,

    async init(context) {
      video = context.video;
      landmarks = [];
      silhouetteCanvas = document.createElement('canvas');

      if (!window.Hands) {
        throw new Error('MediaPipe Hands não foi carregado.');
      }

      hands = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });
      hands.setOptions({
        maxNumHands: config.maxNumHands,
        modelComplexity: 1,
        minDetectionConfidence: config.minDetectionConfidence,
        minTrackingConfidence: config.minTrackingConfidence,
      });
      hands.onResults(onResults);
    },

    onFrame({ canvas, ctx }) {
      if (!hands || !video || video.readyState < 2 || processing) return;

      if (silhouetteCanvas.width !== canvas.width || silhouetteCanvas.height !== canvas.height) {
        silhouetteCanvas.width = canvas.width;
        silhouetteCanvas.height = canvas.height;
      }

      processing = true;
      hands.send({ image: video }).catch((error) => {
        processing = false;
        console.warn('[hand-tracking] erro ao processar a câmera:', error);
      });

      const silhouetteCtx = silhouetteCanvas.getContext('2d');
      silhouetteCtx.clearRect(0, 0, canvas.width, canvas.height);
      let hasVisibleHand = false;
      for (const hand of landmarks) {
        drawHandLines(silhouetteCtx, hand, canvas.width, canvas.height, config);
        hasVisibleHand = true;
      }

      if (hasVisibleHand) {
        ctx.save();
        ctx.shadowColor = config.outlineColor;
        ctx.shadowBlur = 5;
        ctx.drawImage(silhouetteCanvas, 0, 0);
        ctx.restore();
        ctx.drawImage(silhouetteCanvas, 0, 0);
      }
    },

    onDisable() {
      landmarks = [];
      processing = false;
      if (hands) hands.close();
      hands = null;
      video = null;
      silhouetteCanvas = null;
    },
  };
}

export const handTrackingModule = createHandTrackingModule();
