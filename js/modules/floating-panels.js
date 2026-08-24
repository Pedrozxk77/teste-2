// modules/floating-panels.js
// Gerencia janelas web posicionáveis sobre a experiência da câmera.

const DEFAULT_PAGE = 'https://www.youtube.com';

function normalizeUrl(value) {
  const text = value.trim();
  if (!text) return DEFAULT_PAGE;
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text}`;
}

export function createFloatingPanelsModule(options = {}) {
  const config = {
    maxWindows: 4,
    ...options,
  };
  let overlay = null;
  let toolbar = null;
  let windows = new Set();
  let nextWindowId = 1;

  const focusWindow = (windowEl) => {
    const highest = Math.max(...[...windows].map((item) => Number(item.style.zIndex) || 0), 14);
    windowEl.style.zIndex = String(highest + 1);
  };

  const applyDepth = (windowEl, value) => {
    const depth = Number(value);
    windowEl.dataset.depth = String(depth);
    windowEl.style.transform = `translateZ(${depth * 24}px) scale(${1 + depth * 0.015})`;
    windowEl.style.opacity = String(1 - Math.abs(depth) * 0.025);
  };

  const closeWindow = (windowEl) => {
    windows.delete(windowEl);
    windowEl.remove();
  };

  const makeDraggable = (windowEl, bar) => {
    let drag = null;
    bar.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button, input')) return;
      focusWindow(windowEl);
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: windowEl.offsetLeft,
        top: windowEl.offsetTop,
      };
      windowEl.classList.add('is-dragging');
      bar.setPointerCapture(event.pointerId);
    });
    bar.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      windowEl.style.left = `${Math.max(0, drag.left + event.clientX - drag.startX)}px`;
      windowEl.style.top = `${Math.max(0, drag.top + event.clientY - drag.startY)}px`;
    });
    bar.addEventListener('pointerup', () => {
      drag = null;
      windowEl.classList.remove('is-dragging');
    });
  };

  const makeResizable = (windowEl, handle) => {
    let resize = null;
    handle.addEventListener('pointerdown', (event) => {
      focusWindow(windowEl);
      resize = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        width: windowEl.offsetWidth,
        height: windowEl.offsetHeight,
      };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    handle.addEventListener('pointermove', (event) => {
      if (!resize || event.pointerId !== resize.pointerId) return;
      windowEl.style.width = `${Math.max(280, resize.width + event.clientX - resize.startX)}px`;
      windowEl.style.height = `${Math.max(190, resize.height + event.clientY - resize.startY)}px`;
    });
    handle.addEventListener('pointerup', () => {
      resize = null;
    });
  };

  const createWindow = (url = DEFAULT_PAGE) => {
    if (!overlay || windows.size >= config.maxWindows) return;
    const windowEl = document.createElement('article');
    windowEl.className = 'floating-window';
    windowEl.style.left = `${Math.min(80 + windows.size * 28, window.innerWidth - 460)}px`;
    windowEl.style.top = `${Math.min(90 + windows.size * 28, window.innerHeight - 350)}px`;
    windowEl.style.zIndex = String(20 + nextWindowId);
    windowEl.dataset.windowId = String(nextWindowId);

    const bar = document.createElement('div');
    bar.className = 'floating-window__bar';
    const urlInput = document.createElement('input');
    urlInput.className = 'floating-window__url';
    urlInput.value = url;
    urlInput.type = 'url';
    urlInput.title = 'Endereço da página';
    const goButton = document.createElement('button');
    goButton.type = 'button';
    goButton.textContent = 'Ir';
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.textContent = '×';
    closeButton.title = 'Fechar janela';
    bar.append(urlInput, goButton, closeButton);

    const frame = document.createElement('iframe');
    frame.className = 'floating-window__frame';
    frame.src = normalizeUrl(url);
    frame.title = 'Página web flutuante';
    frame.referrerPolicy = 'no-referrer';
    frame.allow = 'accelerometer; autoplay; clipboard-read; clipboard-write; encrypted-media; gyroscope; picture-in-picture';

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'floating-window__resize';
    resizeHandle.title = 'Redimensionar janela';
    const depthInput = document.createElement('input');
    depthInput.className = 'floating-window__depth';
    depthInput.type = 'range';
    depthInput.min = '-10';
    depthInput.max = '10';
    depthInput.value = '0';
    depthInput.title = 'Profundidade';

    const navigate = () => {
      const target = normalizeUrl(urlInput.value);
      urlInput.value = target;
      frame.src = target;
    };
    goButton.addEventListener('click', navigate);
    urlInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') navigate();
    });
    closeButton.addEventListener('click', () => closeWindow(windowEl));
    windowEl.addEventListener('pointerdown', () => focusWindow(windowEl));
    depthInput.addEventListener('input', () => applyDepth(windowEl, depthInput.value));

    windowEl.append(bar, frame, resizeHandle, depthInput);
    overlay.appendChild(windowEl);
    windows.add(windowEl);
    nextWindowId += 1;
    makeDraggable(windowEl, bar);
    makeResizable(windowEl, resizeHandle);
    applyDepth(windowEl, 0);
  };

  return {
    id: 'floating-panels',
    label: 'Painéis flutuantes',
    defaultEnabled: false,

    init({ overlay: floatingOverlay }) {
      overlay = floatingOverlay;
      if (!overlay) throw new Error('Camada de janelas flutuantes não encontrada.');
      toolbar = document.createElement('div');
      toolbar.className = 'floating-toolbar';
      const newWindowButton = document.createElement('button');
      newWindowButton.type = 'button';
      newWindowButton.textContent = '+ Janela web';
      newWindowButton.addEventListener('click', () => createWindow());
      toolbar.appendChild(newWindowButton);
      overlay.appendChild(toolbar);
      createWindow();
    },

    onDisable() {
      for (const windowEl of windows) windowEl.remove();
      windows.clear();
      toolbar?.remove();
      toolbar = null;
      overlay = null;
    },
  };
}

export const floatingPanelsModule = createFloatingPanelsModule();
