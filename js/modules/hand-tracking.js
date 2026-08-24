// modules/hand-tracking.js
// Detecta a mão com MediaPipe e desenha uma silhueta preenchida no overlay.

const HAND_CONTOUR = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

function drawSmoothContour(ctx, points) {
  if (points.length < 3) return;

  ctx.beginPath();
  const first = points[0];
  const second = points[1];
  ctx.moveTo((first.x + second.x) / 2, (first.y + second.y) / 2);

  for (let index = 1; index <= points.length; index += 1) {
    const current = points[index % points.length];
    const next = points[(index + 1) % points.length];
    const midpointX = (current.x + next.x) / 2;
    const midpointY = (current.y + next.y) / 2;
    ctx.quadraticCurveTo(current.x, current.y, midpointX, midpointY);
  }
  ctx.closePath();
}

export function createHandTrackingModule(options = {}) {
  const config = {
    maxNumHands: 2,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.65,
    fillColor: 'rgba(18, 13, 16, 0.9)',
    outlineColor: 'rgba(255, 255, 255, 0.85)',
    ...options,
  };
  let hands = null;
  let video = null;
  let landmarks = [];
  let processing = false;

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

      processing = true;
      hands.send({ image: video }).catch((error) => {
        processing = false;
        console.warn('[hand-tracking] erro ao processar a câmera:', error);
      });

      for (const hand of landmarks) {
        const points = HAND_CONTOUR.map((index) => ({
          x: hand[index].x * canvas.width,
          y: hand[index].y * canvas.height,
        }));

        ctx.save();
        ctx.shadowColor = 'rgba(255, 255, 255, 0.65)';
        ctx.shadowBlur = 8;
        drawSmoothContour(ctx, points);
        ctx.fillStyle = config.fillColor;
        ctx.fill();
        ctx.strokeStyle = config.outlineColor;
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      }
    },

    onDisable() {
      landmarks = [];
      processing = false;
      if (hands) hands.close();
      hands = null;
      video = null;
    },
  };
}

export const handTrackingModule = createHandTrackingModule();
