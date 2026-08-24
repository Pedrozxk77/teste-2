// modules/hand-tracking.js
// Detecta a mão com MediaPipe e desenha o esqueleto padrão no overlay.

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

function drawHandLines(ctx, hand, width, height, config) {
  const point = (index) => ({
    x: hand[index].x * width,
    y: hand[index].y * height,
  });

  ctx.strokeStyle = config.outlineColor;
  ctx.lineWidth = config.outlineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [startIndex, endIndex] of HAND_CONNECTIONS) {
    const start = point(startIndex);
    const end = point(endIndex);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  ctx.fillStyle = config.pointColor;
  for (let index = 0; index < 21; index += 1) {
    const current = point(index);
    ctx.beginPath();
    ctx.arc(current.x, current.y, config.pointRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function createHandTrackingModule(options = {}) {
  const config = {
    maxNumHands: 2,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.65,
    outlineColor: 'rgba(180, 180, 180, 0.95)',
    pointColor: 'rgba(210, 210, 210, 0.95)',
    outlineWidth: 2,
    pointRadius: 3,
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
