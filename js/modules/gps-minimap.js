// modules/gps-minimap.js
// Mantém geolocalização e orientação isoladas do restante da aplicação.

const DEFAULT_OPTIONS = {
  size: 176,
  padding: 20,
  zoomMeters: 80,
};

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const corner = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + corner, y);
  ctx.arcTo(x + width, y, x + width, y + height, corner);
  ctx.arcTo(x + width, y + height, x, y + height, corner);
  ctx.arcTo(x, y + height, x, y, corner);
  ctx.arcTo(x, y, x + width, y, corner);
  ctx.closePath();
}

function formatCoordinate(value) {
  return Number.isFinite(value) ? value.toFixed(5) : '--';
}

export function createGpsMinimapModule(options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let position = null;
  let positionError = null;
  let heading = null;
  let watchId = null;
  let orientationHandler = null;
  let trail = [];
  let destination = null;
  let route = null;
  let routeRequestId = 0;

  const onPosition = (nextPosition) => {
    position = nextPosition;
    positionError = null;
    trail = [...trail, nextPosition].slice(-40);
    updateRoute();
  };

  const onPositionError = (error) => {
    positionError = error;
  };

  const updateRoute = async () => {
    if (!position || !destination) {
      route = null;
      return;
    }

    const requestId = ++routeRequestId;
    const { longitude, latitude } = position.coords;
    const url = `${OSRM_URL}/${longitude},${latitude};${destination.longitude},${destination.latitude}`
      + '?overview=full&geometries=geojson';

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`OSRM respondeu ${response.status}`);
      const data = await response.json();
      if (requestId === routeRequestId) route = data.routes?.[0] || null;
    } catch (error) {
      if (requestId === routeRequestId) {
        route = null;
        console.warn('[gps-minimap] não foi possível calcular a rota:', error);
      }
    }
  };

  const onOrientation = (event) => {
    const compassHeading = Number(event.webkitCompassHeading);
    const alpha = Number(event.alpha);

    if (Number.isFinite(compassHeading)) {
      heading = normalizeDegrees(compassHeading);
    } else if (Number.isFinite(alpha)) {
      heading = normalizeDegrees(360 - alpha);
    }
  };

  const requestOrientationPermission = async () => {
    const OrientationEvent = window.DeviceOrientationEvent;
    if (!OrientationEvent) return;

    if (typeof OrientationEvent.requestPermission === 'function') {
      try {
        const permission = await OrientationEvent.requestPermission();
        if (permission !== 'granted') return;
      } catch (error) {
        console.warn('[gps-minimap] permissão da bússola recusada:', error);
        return;
      }
    }

    orientationHandler = onOrientation;
    window.addEventListener('deviceorientation', orientationHandler, true);
  };

  return {
    id: 'gps-minimap',
    label: 'GPS e minimapa',
    defaultEnabled: false,

    async init() {
      position = null;
      positionError = null;
      heading = null;
      trail = [];
      route = null;

      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 10000,
        });
      } else {
        positionError = { code: 0 };
      }

      await requestOrientationPermission();
    },

    async searchPlaces(query) {
      const text = query.trim();
      if (!text) return [];

      const params = new URLSearchParams({
        q: text,
        format: 'jsonv2',
        limit: '5',
        countrycodes: 'br',
        'accept-language': 'pt-BR',
      });
      const response = await fetch(`${NOMINATIM_URL}?${params}`);
      if (!response.ok) throw new Error(`Nominatim respondeu ${response.status}`);
      return response.json();
    },

    setDestination(place) {
      const latitude = Number(place.lat);
      const longitude = Number(place.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('Destino inválido.');
      }

      destination = {
        latitude,
        longitude,
        label: place.display_name || `${latitude}, ${longitude}`,
      };
      route = null;
      updateRoute();
    },

    clearDestination() {
      destination = null;
      route = null;
      routeRequestId += 1;
    },

    getDestination() {
      return destination;
    },

    onFrame({ canvas, ctx }) {
      if (!canvas.width || !canvas.height) return;

      const size = Math.min(config.size, canvas.width - config.padding * 2);
      const x = canvas.width - size - config.padding;
      const y = config.padding;
      const center = size / 2;
      const radius = size * 0.38;
      const latitude = position?.coords.latitude;
      const longitude = position?.coords.longitude;

      ctx.save();
      drawRoundedRect(ctx, x, y, size, size, 16);
      ctx.fillStyle = 'rgba(8, 15, 18, 0.82)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(134, 239, 172, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x + center, y + center, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#bbf7d0';
      ctx.fillText('N', x + center, y + 18);

      if (position && trail.length > 1) {
        const metersPerLatitude = 111320;
        const metersPerLongitude = metersPerLatitude * Math.cos((latitude * Math.PI) / 180);
        const toMapPoint = (item) => ({
          x: x + center + ((item.coords.longitude - longitude) * metersPerLongitude * radius) / config.zoomMeters,
          y: y + center - ((item.coords.latitude - latitude) * metersPerLatitude * radius) / config.zoomMeters,
        });

        ctx.save();
        ctx.beginPath();
        ctx.arc(x + center, y + center, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.beginPath();
        trail.forEach((item, index) => {
          const point = toMapPoint(item);
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.strokeStyle = '#86efac';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }

      if (position && route?.geometry?.coordinates?.length) {
        const metersPerLatitude = 111320;
        const metersPerLongitude = metersPerLatitude * Math.cos((latitude * Math.PI) / 180);
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + center, y + center, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.beginPath();
        route.geometry.coordinates.forEach(([routeLongitude, routeLatitude], index) => {
          const pointX = x + center + ((routeLongitude - longitude) * metersPerLongitude * radius) / config.zoomMeters;
          const pointY = y + center - ((routeLatitude - latitude) * metersPerLatitude * radius) / config.zoomMeters;
          if (index === 0) ctx.moveTo(pointX, pointY);
          else ctx.lineTo(pointX, pointY);
        });
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.moveTo(x + center, y + center - 13);
      ctx.lineTo(x + center + 6, y + center + 7);
      ctx.lineTo(x + center, y + center + 4);
      ctx.lineTo(x + center - 6, y + center + 7);
      ctx.closePath();
      ctx.fillStyle = '#22c55e';
      ctx.fill();

      if (heading !== null) {
        const angle = (heading * Math.PI) / 180;
        ctx.save();
        ctx.translate(x + center, y + center);
        ctx.rotate(-angle);
        ctx.beginPath();
        ctx.moveTo(0, -radius + 11);
        ctx.lineTo(-4, -radius + 23);
        ctx.lineTo(4, -radius + 23);
        ctx.closePath();
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
        ctx.restore();
      }

      ctx.textAlign = 'left';
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#fff';
      const status = position
        ? `${formatCoordinate(latitude)}, ${formatCoordinate(longitude)}`
        : positionError
          ? 'GPS indisponível'
          : 'Obtendo localização...';
      ctx.fillText(status, x + 10, y + size - 22);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.fillText(
        destination ? `Destino: ${route ? `${(route.distance / 1000).toFixed(1)} km` : 'calculando...'}` : (heading === null ? 'Bússola indisponível' : `${Math.round(heading)}°`),
        x + 10,
        y + size - 9,
      );
      ctx.restore();
    },

    onDisable() {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (orientationHandler) {
        window.removeEventListener('deviceorientation', orientationHandler, true);
      }
      watchId = null;
      orientationHandler = null;
      position = null;
      positionError = null;
      heading = null;
      trail = [];
      destination = null;
      route = null;
      routeRequestId += 1;
    },
  };
}

export const gpsMinimapModule = createGpsMinimapModule();
