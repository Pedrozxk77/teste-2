// modules/object-detection.js
// Detecta pessoas e objetos comuns usando TensorFlow.js + COCO-SSD.

export function createObjectDetectionModule(options = {}) {
  const config = {
    minScore: 0.55,
    maxDetections: 20,
    announceIntervalMs: 4500,
    focalLengthPixels: 700,
    announceDistanceChangeMeters: 0.7,
    modelBase: 'lite_mobilenet_v2',
    boxColor: '#f97316',
    personColor: '#22c55e',
    ...options,
  };
  let detector = null;
  let video = null;
  let predictions = [];
  let loading = false;
  let processing = false;
  let lastAnnouncement = '';
  let lastAnnouncementAt = 0;

  const objectWidthsMeters = {
    bicycle: 0.6,
    bottle: 0.07,
    cup: 0.08,
    laptop: 0.32,
    mouse: 0.06,
    person: 0.45,
    'cell phone': 0.075,
    handbag: 0.3,
    backpack: 0.32,
    suitcase: 0.45,
    car: 1.8,
    bus: 2.5,
    truck: 2.5,
    chair: 0.5,
    bench: 1.2,
    tv: 0.9,
  };

  const objectNames = {
    person: 'pessoa',
    'cell phone': 'celular',
    laptop: 'computador',
    backpack: 'mochila',
    bottle: 'garrafa',
    chair: 'cadeira',
    car: 'carro',
    bicycle: 'bicicleta',
  };

  const estimateDistance = (prediction) => {
    const [, , width, height] = prediction.bbox;
    const referenceSize = prediction.class === 'person' ? height : width;
    const knownSize = prediction.class === 'person'
      ? 1.7
      : objectWidthsMeters[prediction.class] || 0.25;
    if (!referenceSize) return null;
    return Math.max(0.3, (knownSize * config.focalLengthPixels) / referenceSize);
  };

  const formatDistance = (distance) => distance < 10
    ? `${distance.toFixed(1)} m`
    : `${Math.round(distance)} m`;

  const announceDetections = (nextPredictions) => {
    if (!('speechSynthesis' in window) || !nextPredictions.length) return;

    const now = Date.now();
    const closest = nextPredictions
      .map((prediction) => ({ prediction, distance: estimateDistance(prediction) }))
      .filter((item) => item.distance !== null)
      .sort((first, second) => first.distance - second.distance)[0];
    if (!closest) return;

    const name = objectNames[closest.prediction.class] || closest.prediction.class;
    const distanceText = formatDistance(closest.distance);
    const message = `${name} a aproximadamente ${distanceText}`;
    const isSameTarget = lastAnnouncement.startsWith(`${name} a`);
    const distanceChanged = isSameTarget
      && Math.abs(closest.distance - Number(lastAnnouncement.match(/([\d.]+) m/)?.[1] || 0)) >= config.announceDistanceChangeMeters;
    if (now - lastAnnouncementAt < config.announceIntervalMs && !distanceChanged) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'pt-BR';
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
    lastAnnouncement = message;
    lastAnnouncementAt = now;
  };

  const loadDetector = async () => {
    if (!window.cocoSsd) throw new Error('COCO-SSD não foi carregado.');
    detector = await window.cocoSsd.load({ base: config.modelBase });
  };

  return {
    id: 'object-detection',
    label: 'Reconhecimento de objeto',
    defaultEnabled: false,

    async init({ video: cameraVideo }) {
      video = cameraVideo;
      predictions = [];
      lastAnnouncement = '';
      lastAnnouncementAt = 0;
      if (loading || detector) return;

      loading = true;
      try {
        await loadDetector();
      } finally {
        loading = false;
      }
    },

    onFrame({ canvas, ctx }) {
      if (!detector || !video || video.readyState < 2 || processing) return;

      processing = true;
      detector.detect(video).then((nextPredictions) => {
        predictions = nextPredictions
          .filter((prediction) => prediction.score >= config.minScore)
          .slice(0, config.maxDetections);
        announceDetections(predictions);
        processing = false;
      }).catch((error) => {
        processing = false;
        console.warn('[object-detection] erro ao analisar a câmera:', error);
      });

      ctx.save();
      ctx.font = '600 14px sans-serif';
      ctx.textBaseline = 'top';
      for (const prediction of predictions) {
        const [x, y, width, height] = prediction.bbox;
        const isPerson = prediction.class === 'person';
        const color = isPerson ? config.personColor : config.boxColor;
        const distance = estimateDistance(prediction);
        const name = objectNames[prediction.class] || prediction.class;
        const label = `${name} ${Math.round(prediction.score * 100)}%${distance ? ` - ${formatDistance(distance)}` : ''}`;

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);

        const labelWidth = ctx.measureText(label).width + 12;
        const labelY = Math.max(0, y - 22);
        ctx.fillStyle = color;
        ctx.fillRect(x, labelY, labelWidth, 22);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, x + 6, labelY + 4);
      }
      ctx.restore();
    },

    onDisable() {
      predictions = [];
      processing = false;
      detector = null;
      video = null;
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      lastAnnouncement = '';
      lastAnnouncementAt = 0;
    },
  };
}

export const objectDetectionModule = createObjectDetectionModule();
