import { escapeHtml, escapeAttr } from './utils.js';

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

  let editingTemplateName = null;
  let currentPreferences = null;
  let previousFocus = null;

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
    if (!modal) return;
    previousFocus = document.activeElement;
    modal.style.display = 'flex';
    document.addEventListener('keydown', onSettingsKeyDown, true);
    const focusable = getFocusableElements();
    (focusable[0] || closeBtn)?.focus();
  }

  async function loadAndRender() {
    try {
      currentPreferences = await window.electronAPI.loadPreferences();
      renderDateFormats(currentPreferences);
      renderTemplateList(currentPreferences);
    } catch (error) {
      console.error('Error loading settings:', error);
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
      <div class="settings-template-item" data-name="${escapeAttr(t.name)}">
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
      await loadAndRender();
      showModal();
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

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) hideModal();
    });
  }

  return {
    openSettings: async () => {
      await loadAndRender();
      showModal();
    }
  };
}
