// modules/hand-tracking.js
// Detecta a mão com MediaPipe e desenha uma silhueta preenchida no overlay.

const FINGER_PATHS = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [0, 9, 10, 11, 12],
  [0, 13, 14, 15, 16],
  [0, 17, 18, 19, 20],
];

function isPalmFacingCamera(hand, minimumRatio) {
  const wrist = hand[0];
  const indexBase = hand[5];
  const pinkyBase = hand[17];
  const firstVector = {
    x: indexBase.x - wrist.x,
    y: indexBase.y - wrist.y,
    z: indexBase.z - wrist.z,
  };
  const secondVector = {
    x: pinkyBase.x - wrist.x,
    y: pinkyBase.y - wrist.y,
    z: pinkyBase.z - wrist.z,
  };
  const projectedArea = Math.abs(firstVector.x * secondVector.y - firstVector.y * secondVector.x);
  const normal = {
    x: firstVector.y * secondVector.z - firstVector.z * secondVector.y,
    y: firstVector.z * secondVector.x - firstVector.x * secondVector.z,
    z: firstVector.x * secondVector.y - firstVector.y * secondVector.x,
  };
  const palmArea = Math.hypot(normal.x, normal.y, normal.z);

  return palmArea > 0 && projectedArea / palmArea >= minimumRatio;
}

function drawSilhouette(ctx, hand, width, height, config) {
  const point = (index) => ({
    x: hand[index].x * width,
    y: hand[index].y * height,
  });
  const wrist = point(0);
  const indexBase = point(5);
  const pinkyBase = point(17);
  const palmWidth = Math.hypot(indexBase.x - pinkyBase.x, indexBase.y - pinkyBase.y);

  ctx.fillStyle = config.fillColor;
  ctx.strokeStyle = config.fillColor;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(wrist.x, wrist.y);
  ctx.lineTo(indexBase.x, indexBase.y);
  ctx.lineTo(point(9).x, point(9).y);
  ctx.lineTo(point(13).x, point(13).y);
  ctx.lineTo(pinkyBase.x, pinkyBase.y);
  ctx.closePath();
  ctx.lineWidth = palmWidth * 0.72;
  ctx.stroke();
  ctx.fill();

  for (const path of FINGER_PATHS) {
    const points = path.map(point);
    const fingerWidth = path[0] === 0 && path[1] === 1 ? palmWidth * 0.28 : palmWidth * 0.22;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const current of points.slice(1)) ctx.lineTo(current.x, current.y);
    ctx.lineWidth = fingerWidth;
    ctx.stroke();
  }
}

export function createHandTrackingModule(options = {}) {
  const config = {
    maxNumHands: 2,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.65,
    minPalmFacingRatio: 0.55,
    fillColor: 'rgba(18, 13, 16, 0.9)',
    outlineColor: 'rgba(255, 255, 255, 0.85)',
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
        if (isPalmFacingCamera(hand, config.minPalmFacingRatio)) {
          drawSilhouette(silhouetteCtx, hand, canvas.width, canvas.height, config);
          hasVisibleHand = true;
        }
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
