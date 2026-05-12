export class LevelPersistence {
  constructor({ ui, plan, debugPanel, getLevelJSON, loadPlanJSON }) {
    this.ui = ui;
    this.plan = plan;
    this.debugPanel = debugPanel;
    this.getLevelJSON = getLevelJSON;
    this.loadPlanJSON = loadPlanJSON;
    this.currentSaveFilename = null;
    this.currentLevelName = 'Untitled level';
    this.autosaveTimer = null;
    this.autosaveInFlight = null;
    this.syncLevelNameInput();
  }

  makeLevelJSON(extra = {}) {
    return {
      version: 1,
      name: this.currentLevelName,
      ...extra,
      ...this.plan.toJSON(),
    };
  }

  setAutosaveStatus(text) {
    if (this.ui.autosaveStatus) this.ui.autosaveStatus.textContent = text;
  }

  scheduleAutosave(_reason = 'edit') {
    if (this.autosaveTimer) window.clearTimeout(this.autosaveTimer);
    this.setAutosaveStatus('Autosave pending...');
    this.autosaveTimer = window.setTimeout(() => {
      this.autosaveTimer = null;
      this.saveCurrentLevel({ manual: false });
    }, 850);
  }

  async saveCurrentLevel({ manual = false, saveAs = false } = {}) {
    if (this.autosaveInFlight) await this.autosaveInFlight.catch(() => null);
    this.currentLevelName = this.getLevelNameInputValue();
    const level = this.getLevelJSON();
    const started = new Date();
    const targetFilename = safeLevelFilename(this.currentLevelName);
    const filename = !saveAs && this.currentSaveFilename === targetFilename ? this.currentSaveFilename : null;
    this.setAutosaveStatus(saveAs ? 'Saving as...' : manual ? 'Saving...' : 'Autosaving...');
    this.autosaveInFlight = fetch('/api/levels', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        filename,
        level,
      }),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || `${response.status} ${response.statusText}`);
        this.currentSaveFilename = payload.metadata.filename;
        this.currentLevelName = payload.metadata.name;
        this.syncLevelNameInput();
        this.setAutosaveStatus(`Saved ${this.currentSaveFilename} at ${started.toLocaleTimeString()}`);
        return payload.metadata;
      })
      .catch((error) => {
        this.setAutosaveStatus(`Save failed: ${error.message}`);
        throw error;
      })
      .finally(() => {
        this.autosaveInFlight = null;
      });

    try {
      return await this.autosaveInFlight;
    } catch (error) {
      if (manual) this.debugPanel.log(`Could not save level: ${error.message}`);
      return null;
    }
  }

  async openLevelFilesModal() {
    this.ui.levelFilesModal.hidden = false;
    await this.refreshLevelFiles();
  }

  closeLevelFilesModal() {
    this.ui.levelFilesModal.hidden = true;
  }

  async refreshLevelFiles() {
    this.ui.levelFilesList.textContent = 'Loading saved levels...';
    try {
      const payload = await fetch('/api/levels', { headers: { accept: 'application/json' } }).then((response) => response.json());
      this.renderLevelFiles(payload.levels || []);
    } catch (error) {
      this.ui.levelFilesList.textContent = `Could not load saved levels: ${error.message}`;
    }
  }

  renderLevelFiles(levels) {
    this.ui.levelFilesList.innerHTML = '';
    if (!levels.length) {
      const empty = document.createElement('div');
      empty.className = 'agent-message';
      empty.textContent = 'No saved levels yet. Make an edit or click Save now.';
      this.ui.levelFilesList.appendChild(empty);
      return;
    }

    for (const file of levels) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'level-file';
      const body = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = file.name || file.filename;
      const detail = document.createElement('small');
      detail.textContent = `${file.filename} | ${file.shapeCount} shapes | floors ${formatFloors(file.floors)} | modified ${formatFileTime(file.modifiedAt)}`;
      body.append(title, detail);
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = formatBytes(file.size);
      button.append(body, meta);
      button.addEventListener('click', () => this.loadSavedLevel(file.filename));
      this.ui.levelFilesList.appendChild(button);
    }
  }

  async loadSavedLevel(filename) {
    try {
      const payload = await fetch(`/api/levels?file=${encodeURIComponent(filename)}`, { headers: { accept: 'application/json' } }).then((response) =>
        response.json()
      );
      if (payload.error) throw new Error(payload.error);
      await this.loadPlanJSON(payload.level, { filename: payload.metadata.filename, autosave: false });
      this.closeLevelFilesModal();
      this.setAutosaveStatus(`Loaded ${payload.metadata.filename}`);
    } catch (error) {
      this.debugPanel.log(`Could not load saved level: ${error.message}`);
    }
  }

  setLoadedLevel({ data, filename }) {
    this.currentSaveFilename = filename;
    this.currentLevelName = data?.name || filename?.replace(/\.json$/i, '') || this.currentLevelName || 'Untitled level';
    this.syncLevelNameInput();
  }

  getLevelNameInputValue() {
    const value = String(this.ui.levelName?.value || '').trim();
    return value || this.currentLevelName || 'Untitled level';
  }

  syncLevelNameInput() {
    if (this.ui.levelName) this.ui.levelName.value = this.currentLevelName || 'Untitled level';
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatFloors(floors) {
  return Array.isArray(floors) && floors.length ? floors.join(', ') : '-';
}

function formatFileTime(value) {
  if (!value) return 'unknown';
  return new Date(value).toLocaleString();
}

function safeLevelFilename(name) {
  const raw = String(name || '').trim().split(/[\\/]/).pop() || '';
  const base = raw.replace(/\.json$/i, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${base || 'Untitled-level'}.json`;
}
