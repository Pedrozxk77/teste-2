// core.js
// Gerenciador central de módulos. Cada funcionalidade (mão, objeto, GPS, painéis)
// é registrada aqui como um módulo independente, que pode ser ligado/desligado
// sem afetar os demais.

export class ModuleManager {
  constructor(videoEl, canvasEl, mapEl = null) {
    this.video = videoEl;
    this.canvas = canvasEl;
    this.map = mapEl;
    this.ctx = canvasEl.getContext('2d');
    this.modules = new Map();
    this.running = false;
    this._onChangeCallbacks = [];
  }

  // Contexto compartilhado que cada módulo recebe em init() e onFrame()
  getContext() {
    return { video: this.video, canvas: this.canvas, ctx: this.ctx, map: this.map };
  }

  // Registra um novo módulo. O estado salvo no localStorage (se existir)
  // tem prioridade sobre defaultEnabled.
  register(module) {
    if (this.modules.has(module.id)) {
      console.warn(`Módulo "${module.id}" já registrado — ignorando duplicata.`);
      return;
    }

    const saved = localStorage.getItem(`module:${module.id}`);
    module.enabled = saved !== null ? saved === 'true' : !!module.defaultEnabled;
    module._initialized = false;
    module._locked = !!module.locked; // módulos "locked" (ex: câmera) não podem ser desativados pela UI

    this.modules.set(module.id, module);

    if (module.enabled) {
      this._safeInit(module);
    }
  }

  _safeInit(module) {
    if (module._initialized || !module.init) {
      module._initialized = true;
      return;
    }

    // init() pode ser síncrono ou assíncrono (ex: câmera usa await getUserMedia).
    // Tratamos os dois casos, sempre isolando o erro no módulo que falhou.
    try {
      const result = module.init(this.getContext());
      if (result && typeof result.then === 'function') {
        result
          .then(() => {
            module._initialized = true;
          })
          .catch((err) => {
            console.error(`[${module.id}] erro ao inicializar (async) — módulo desativado:`, err);
            module.enabled = false;
            localStorage.setItem(`module:${module.id}`, 'false');
            this._notifyChange();
          });
      } else {
        module._initialized = true;
      }
    } catch (err) {
      console.error(`[${module.id}] erro ao inicializar — módulo desativado:`, err);
      module.enabled = false;
      localStorage.setItem(`module:${module.id}`, 'false');
    }
  }

  // Liga/desliga um módulo específico em tempo real (chamado pela UI de configurações)
  toggle(id, enabled) {
    const module = this.modules.get(id);
    if (!module) return;
    if (module._locked) return; // ignora tentativa de desativar módulo travado (ex: câmera)

    module.enabled = enabled;
    localStorage.setItem(`module:${id}`, String(enabled));

    if (enabled) {
      this._safeInit(module);
    } else if (module.onDisable) {
      try {
        module.onDisable();
      } catch (err) {
        console.error(`[${id}] erro ao desativar:`, err);
      }
    }

    this._notifyChange();
  }

  onChange(callback) {
    this._onChangeCallbacks.push(callback);
  }

  _notifyChange() {
    for (const cb of this._onChangeCallbacks) {
      try { cb(this.list()); } catch (e) { console.error(e); }
    }
  }

  // Lista os módulos registrados (usado pra construir a UI de configurações)
  list() {
    return Array.from(this.modules.values()).map(m => ({
      id: m.id,
      label: m.label || m.id,
      enabled: m.enabled,
      locked: m._locked,
    }));
  }

  resizeCanvasToVideo() {
    if (this.video.videoWidth && this.canvas.width !== this.video.videoWidth) {
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
    }
  }

  start() {
    if (this.running) return;
    this.running = true;

    const loop = () => {
      if (!this.running) return;

      this.resizeCanvasToVideo();
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      for (const module of this.modules.values()) {
        if (!module.enabled || !module.onFrame) continue;

        // ISOLAMENTO DE ERROS: um módulo que falhar aqui é desativado
        // automaticamente, sem derrubar o loop nem os outros módulos.
        try {
          module.onFrame(this.getContext());
        } catch (err) {
          console.error(`[${module.id}] travou durante onFrame — desativando este módulo:`, err);
          module.enabled = false;
          localStorage.setItem(`module:${module.id}`, 'false');
          this._notifyChange();
        }
      }

      requestAnimationFrame(loop);
    };

    loop();
  }

  stop() {
    this.running = false;
  }
}
