import { escapeHtml, escapeAttr } from './utils.js';
import { checkForUpdates } from './updateNotification.js';

function dispatchPreferencesUpdated(preferences) {
  window.dispatchEvent(new CustomEvent('preferences-updated', { detail: preferences }));
}

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function initializeSettings() {
  const modal = document.getElementById('settingsModal');
  const openBtn = document.getElementById('openSettingsBtn');
  const closeBtn = document.getElementById('closeSettingsModalBtn');
  const closeFooterBtn = document.getElementById('closeSettingsBtn');
  const templateList = document.getElementById('settingsTemplateList');
  const dateFormatSelect = document.getElementById('settingsDateFormatSelect');
  const templateNameInput = document.getElementById('settingsTemplateNameInput');
  const templatePatternInput = document.getElementById('settingsTemplatePatternInput');
  const saveTemplateBtn = document.getElementById('settingsSaveTemplateBtn');
  const addTemplateBtn = document.getElementById('settingsAddTemplateBtn');
  const appVersionEl = document.getElementById('settingsAppVersion');
  const updateHintEl = document.getElementById('settingsUpdateHint');
  const checkUpdatesBtn = document.getElementById('settingsCheckUpdatesBtn');
  const debugLoggingCheckbox = document.getElementById('settingsDebugLoggingCheckbox');
  const defaultTemplateSelect = document.getElementById('settingsDefaultTemplateSelect');
  const defaultPatternInput = document.getElementById('settingsDefaultPatternInput');
  const saveDefaultPatternBtn = document.getElementById('settingsSaveDefaultPatternBtn');

  let editingTemplateName = null;
  let appInfo = null;
  let currentPreferences = null;
  let previousFocus = null;
  let settingsOpenInProgress = false;

  function isModalVisible() {
    return modal && modal.style.display !== 'none';
  }

  function getFocusableElements() {
    if (!modal) return [];
    return Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
      (el) => !el.disabled && el.getAttribute('aria-hidden') !== 'true'
    );
  }

  function onSettingsKeyDown(e) {
    if (!isModalVisible()) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      hideModal();
      return;
    }

    if (e.key !== 'Tab') return;

    const focusable = getFocusableElements();
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function hideModal() {
    if (modal) modal.style.display = 'none';
    document.removeEventListener('keydown', onSettingsKeyDown, true);
    editingTemplateName = null;
    if (templateNameInput) templateNameInput.value = '';
    if (templatePatternInput) templatePatternInput.value = '';
    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus();
    }
    previousFocus = null;
  }

  function showModal() {
    if (!modal || isModalVisible()) return;
    previousFocus = document.activeElement;
    modal.style.display = 'flex';
    document.addEventListener('keydown', onSettingsKeyDown, true);
    const focusable = getFocusableElements();
    (focusable[0] || closeBtn)?.focus();
  }

  async function loadAppInfo() {
    if (!window.electronAPI.getAppInfo) {
      if (appVersionEl) appVersionEl.textContent = 'Version (development build)';
      return;
    }
    try {
      appInfo = await window.electronAPI.getAppInfo();
      if (appVersionEl) {
        const label = appInfo?.isPackaged
          ? `Version ${appInfo.version}`
          : `Version ${appInfo?.version || 'dev'} (development build)`;
        appVersionEl.textContent = label;
      }
      if (updateHintEl) {
        if (appInfo?.isPackaged && !appInfo?.hasUpdateFeed) {
          updateHintEl.hidden = false;
          updateHintEl.textContent =
            'This install cannot update inside the app. Download the latest fat DMG from GitHub Releases and replace Video Merger in Applications.';
        } else {
          updateHintEl.hidden = true;
          updateHintEl.textContent = '';
        }
      }
    } catch (error) {
      console.error('Error loading app info:', error);
      if (appVersionEl) appVersionEl.textContent = 'Version unknown';
    }
  }

  async function loadDebugLoggingState() {
    if (!debugLoggingCheckbox || !window.electronAPI?.getDebugMode) return;
    try {
      const result = await window.electronAPI.getDebugMode();
      if (result?.success) {
        debugLoggingCheckbox.checked = Boolean(result.debugMode);
      } else if (currentPreferences) {
        debugLoggingCheckbox.checked = Boolean(currentPreferences.debugMode);
      }
    } catch (error) {
      console.error('Error loading debug mode:', error);
    }
  }

  async function handleDebugLoggingChange() {
    if (!debugLoggingCheckbox || !window.electronAPI?.setDebugMode) return;
    const enabled = debugLoggingCheckbox.checked;
    try {
      const result = await window.electronAPI.setDebugMode(enabled);
      if (result?.success === false) {
        debugLoggingCheckbox.checked = !enabled;
        alert(result.error || 'Could not update debug logging.');
      }
    } catch (error) {
      console.error('Error setting debug mode:', error);
      debugLoggingCheckbox.checked = !enabled;
      alert('Could not update debug logging.');
    }
  }

  async function loadAndRender() {
    try {
      await loadAppInfo();
      currentPreferences = await window.electronAPI.loadPreferences();
      renderDateFormats(currentPreferences);
      renderDefaultPatternControls(currentPreferences);
      renderTemplateList(currentPreferences);
      await loadDebugLoggingState();
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  function renderDefaultPatternControls(prefs) {
    if (defaultTemplateSelect) {
      const templates = prefs.eventTemplates || [];
      defaultTemplateSelect.innerHTML = '<option value="">— Custom pattern —</option>';
      for (const t of templates) {
        const opt = document.createElement('option');
        opt.value = t.pattern;
        opt.textContent = t.name;
        opt.dataset.templateName = t.name;
        defaultTemplateSelect.appendChild(opt);
      }
      const last = prefs.lastUsedPattern || '';
      if (last) {
        const match = templates.find((t) => t.pattern === last);
        defaultTemplateSelect.value = match ? match.pattern : '';
      }
    }
    if (defaultPatternInput) {
      defaultPatternInput.value = prefs.lastUsedPattern || '';
    }
  }

  async function saveDefaultPatternFromForm() {
    const pattern = defaultPatternInput?.value.trim();
    if (!pattern) {
      alert('Enter a default filename pattern.');
      return;
    }
    let templateName = null;
    if (defaultTemplateSelect?.value) {
      const opt = defaultTemplateSelect.options[defaultTemplateSelect.selectedIndex];
      templateName = opt?.dataset?.templateName || opt?.textContent?.trim() || null;
    }
    try {
      const result = await window.electronAPI.setDefaultFilenamePattern(pattern, templateName);
      if (result?.success === false) {
        alert(result.error || 'Could not save default pattern.');
        return;
      }
      currentPreferences = result.preferences;
      dispatchPreferencesUpdated(currentPreferences);
      renderDefaultPatternControls(currentPreferences);
    } catch (error) {
      console.error('Error saving default pattern:', error);
      alert('Could not save default pattern.');
    }
  }

  function renderDateFormats(prefs) {
    if (!dateFormatSelect) return;
    const formats = prefs.dateFormats || [];
    dateFormatSelect.innerHTML = '';
    for (const item of formats) {
      const opt = document.createElement('option');
      opt.value = item.format;
      opt.textContent = item.name;
      dateFormatSelect.appendChild(opt);
    }
    dateFormatSelect.value = prefs.preferredDateFormat || 'YYYY-MM-DD';
  }

  function renderTemplateList(prefs) {
    if (!templateList) return;
    const templates = prefs.eventTemplates || [];
    if (templates.length === 0) {
      templateList.innerHTML = '<p class="settings-empty-hint">No templates yet.</p>';
      return;
    }
    templateList.innerHTML = templates.map((t) => `
      <div class="settings-template-item" role="listitem" data-name="${escapeAttr(t.name)}">
        <div class="settings-template-info">
          <strong>${escapeHtml(t.name)}</strong>
          <span class="settings-template-pattern">${escapeHtml(t.pattern)}</span>
        </div>
        <div class="settings-template-actions">
          <button type="button" class="btn btn-text btn-small settings-edit-template" data-name="${escapeAttr(t.name)}" aria-label="Edit ${escapeAttr(t.name)}">Edit</button>
          <button type="button" class="btn btn-text btn-small settings-delete-template" data-name="${escapeAttr(t.name)}" aria-label="Delete ${escapeAttr(t.name)}">Delete</button>
        </div>
      </div>
    `).join('');

    templateList.querySelectorAll('.settings-edit-template').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name');
        const template = templates.find((t) => t.name === name);
        if (!template) return;
        editingTemplateName = template.name;
        if (templateNameInput) templateNameInput.value = template.name;
        if (templatePatternInput) templatePatternInput.value = template.pattern;
        templateNameInput?.focus();
      });
    });

    templateList.querySelectorAll('.settings-delete-template').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const name = btn.getAttribute('data-name');
        if (!name) return;
        if (!confirm(`Delete template "${name}"?`)) return;
        try {
          const result = await window.electronAPI.deleteEventTemplate(name);
          if (result?.success === false) {
            alert(result.error || 'Could not delete template.');
            return;
          }
          currentPreferences = result.preferences;
          dispatchPreferencesUpdated(currentPreferences);
          renderTemplateList(currentPreferences);
          renderDefaultPatternControls(currentPreferences);
          if (editingTemplateName === name) {
            editingTemplateName = null;
            if (templateNameInput) templateNameInput.value = '';
            if (templatePatternInput) templatePatternInput.value = '';
          }
        } catch (error) {
          console.error('Error deleting template:', error);
          alert('Could not delete template.');
        }
      });
    });
  }

  async function saveTemplateFromForm() {
    const name = templateNameInput?.value.trim();
    const pattern = templatePatternInput?.value.trim();
    if (!name || !pattern) {
      alert('Enter both a template name and pattern.');
      return;
    }
    try {
      const originalName = editingTemplateName || undefined;
      const result = await window.electronAPI.saveEventTemplate(name, pattern, originalName);
      if (result?.success === false) {
        alert(result.error || 'Could not save template.');
        return;
      }
      currentPreferences = result.preferences;
      dispatchPreferencesUpdated(currentPreferences);
      renderTemplateList(currentPreferences);
      renderDefaultPatternControls(currentPreferences);
      editingTemplateName = null;
      if (templateNameInput) templateNameInput.value = '';
      if (templatePatternInput) templatePatternInput.value = '';
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Could not save template.');
    }
  }

  async function handleDateFormatChange() {
    const format = dateFormatSelect?.value;
    if (!format) return;
    try {
      const result = await window.electronAPI.setDateFormat(format);
      if (result?.preferences) {
        currentPreferences = result.preferences;
        dispatchPreferencesUpdated(currentPreferences);
      }
    } catch (error) {
      console.error('Error setting date format:', error);
    }
  }

  if (openBtn) {
    openBtn.addEventListener('click', async () => {
      if (isModalVisible() || settingsOpenInProgress) return;
      settingsOpenInProgress = true;
      try {
        await loadAndRender();
        showModal();
      } finally {
        settingsOpenInProgress = false;
      }
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', hideModal);
  if (closeFooterBtn) closeFooterBtn.addEventListener('click', hideModal);

  if (saveTemplateBtn) {
    saveTemplateBtn.addEventListener('click', () => saveTemplateFromForm());
  }

  if (addTemplateBtn) {
    addTemplateBtn.addEventListener('click', () => {
      editingTemplateName = null;
      if (templateNameInput) templateNameInput.value = '';
      if (templatePatternInput) templatePatternInput.value = '';
      templateNameInput?.focus();
    });
  }

  if (dateFormatSelect) {
    dateFormatSelect.addEventListener('change', () => handleDateFormatChange());
  }

  if (defaultTemplateSelect) {
    defaultTemplateSelect.addEventListener('change', () => {
      const pattern = defaultTemplateSelect.value;
      if (pattern && defaultPatternInput) {
        defaultPatternInput.value = pattern;
      }
    });
  }

  if (saveDefaultPatternBtn) {
    saveDefaultPatternBtn.addEventListener('click', () => saveDefaultPatternFromForm());
  }

  if (debugLoggingCheckbox) {
    debugLoggingCheckbox.addEventListener('change', () => handleDebugLoggingChange());
  }

  if (checkUpdatesBtn) {
    checkUpdatesBtn.addEventListener('click', async () => {
      if (appInfo?.isPackaged && !appInfo?.hasUpdateFeed) {
        await window.electronAPI.openExternal(
          appInfo.releasesLatestUrl || 'https://github.com/jsartin513/graphic_video_editor/releases/latest'
        );
        return;
      }
      await checkForUpdates();
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) hideModal();
    });
  }

  return {
    openSettings: async () => {
      if (isModalVisible() || settingsOpenInProgress) return;
      settingsOpenInProgress = true;
      try {
        await loadAndRender();
        showModal();
      } finally {
        settingsOpenInProgress = false;
      }
    }
  };
}
