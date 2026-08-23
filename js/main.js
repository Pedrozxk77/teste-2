// main.js
// Ponto de entrada: registra todos os módulos e inicia o gerenciador.

import { ModuleManager } from './core.js';
import { cameraModule } from './modules/camera.js';
import { handTrackingModule } from './modules/hand-tracking.js';
import { objectDetectionModule } from './modules/object-detection.js';
import { gpsMinimapModule } from './modules/gps-minimap.js';
import { floatingPanelsModule } from './modules/floating-panels.js';

const video = document.getElementById('camera-feed');
const canvas = document.getElementById('overlay-canvas');
const startBtn = document.getElementById('start-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const settingsList = document.getElementById('settings-list');
const statusEl = document.getElementById('status');
const destinationForm = document.getElementById('destination-form');
const destinationInput = document.getElementById('destination-input');
const destinationResults = document.getElementById('destination-results');
const destinationMessage = document.getElementById('destination-message');
const clearDestinationBtn = document.getElementById('clear-destination');

const manager = new ModuleManager(video, canvas);

// Ordem de registro: câmera primeiro (sempre ativa), depois os módulos opcionais.
manager.register(cameraModule);
manager.register(handTrackingModule);
manager.register(objectDetectionModule);
manager.register(gpsMinimapModule);
manager.register(floatingPanelsModule);

function showStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.background = isError ? 'rgba(185, 28, 28, 0.85)' : 'rgba(0, 0, 0, 0.6)';
  statusEl.classList.remove('hidden');
}

function hideStatusSoon() {
  setTimeout(() => statusEl.classList.add('hidden'), 2000);
}

function renderSettingsList() {
  settingsList.innerHTML = '';
  for (const mod of manager.list()) {
    const row = document.createElement('label');
    row.className = 'settings-row';

    const text = document.createElement('span');
    text.textContent = mod.label;

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = mod.enabled;
    toggle.disabled = mod.locked;

    toggle.addEventListener('change', () => {
      manager.toggle(mod.id, toggle.checked);
    });

    row.appendChild(text);
    row.appendChild(toggle);
    settingsList.appendChild(row);
  }
}

const gpsModule = manager.modules.get('gps-minimap');

destinationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = destinationInput.value.trim();
  if (!query) return;

  destinationResults.innerHTML = '';
  destinationMessage.textContent = 'Buscando lugares...';

  try {
    const places = await gpsModule.searchPlaces(query);
    if (!places.length) {
      destinationMessage.textContent = 'Nenhum lugar encontrado.';
      return;
    }

    destinationMessage.textContent = 'Selecione um resultado:';
    for (const place of places) {
      const resultBtn = document.createElement('button');
      resultBtn.type = 'button';
      resultBtn.className = 'destination-result';
      resultBtn.textContent = place.display_name;
      resultBtn.addEventListener('click', () => {
        manager.toggle('gps-minimap', true);
        gpsModule.setDestination(place);
        destinationResults.innerHTML = '';
        destinationMessage.textContent = `Destino: ${place.display_name}`;
        clearDestinationBtn.style.display = 'block';
      });
      destinationResults.appendChild(resultBtn);
    }
  } catch (error) {
    console.error('[destination] erro na busca:', error);
    destinationMessage.textContent = 'Não foi possível buscar o lugar.';
  }
});

clearDestinationBtn.addEventListener('click', () => {
  gpsModule.clearDestination();
  destinationMessage.textContent = 'Busque um endereço ou ponto de interesse.';
  clearDestinationBtn.style.display = 'none';
});

// Sempre que um módulo for ligado/desligado (inclusive automaticamente, por erro),
// a lista de configurações se atualiza sozinha.
manager.onChange(renderSettingsList);

settingsBtn.addEventListener('click', () => {
  settingsPanel.classList.toggle('hidden');
});

startBtn.addEventListener('click', async () => {
  startBtn.classList.add('hidden');
  showStatus('Iniciando câmera...');

  // A câmera precisa do gesto de clique do usuário (exigência do navegador),
  // então disparamos a inicialização dela aqui, dentro do handler do botão.
  const cam = manager.modules.get('camera');
  if (!cam._initialized) {
    manager._safeInit(cam);
  }

  // Espera um instante para o init assíncrono da câmera resolver antes de checar erro
  setTimeout(() => {
    if (cam.enabled) {
      showStatus('Câmera conectada ✓');
      hideStatusSoon();
    } else {
      showStatus('Não foi possível acessar a câmera. Verifique as permissões.', true);
    }
  }, 800);

  manager.start();
  renderSettingsList();
});
