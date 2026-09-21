const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const SAMPLE_SESSION_ID = '0534';

function dispatchPreferencesUpdated(preferences) {
  window.dispatchEvent(new CustomEvent('preferences-updated', { detail: preferences }));
}

function isModalVisible(modal) {
  return modal && modal.style.display !== 'none';
}

function waitForPrerequisitesResolved() {
  const modal = document.getElementById('prerequisitesModal');
  if (!modal) return Promise.resolve();

  if (modal.style.display === 'none' || !modal.style.display) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (modal.style.display === 'none') {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
  });
}

export function initializeDefaultsSetup() {
  const modal = document.getElementById('defaultsSetupModal');
  const dateFormatSelect = document.getElementById('defaultsSetupDateFormatSelect');
  const templateSelect = document.getElementById('defaultsSetupTemplateSelect');
  const customNameInput = document.getElementById('defaultsSetupCustomNameInput');
  const customPatternInput = document.getElementById('defaultsSetupCustomPatternInput');
  const previewEl = document.getElementById('defaultsSetupPreview');
  const saveBtn = document.getElementById('defaultsSetupSaveBtn');
  const skipBtn = document.getElementById('defaultsSetupSkipBtn');
  const closeBtn = document.getElementById('defaultsSetupCloseBtn');
  const weekCountInput = document.getElementById('defaultsSetupWeekCountInput');

  let previousFocus = null;
  let loadedTemplates = [];
  let checkScheduled = false;

  if (!modal) return;

  function getFocusableElements() {
    return Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
      (el) => !el.disabled && el.getAttribute('aria-hidden') !== 'true'
    );
  }

  function onKeyDown(e) {
    if (!isModalVisible(modal)) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleSkip();
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
    modal.style.display = 'none';
    document.removeEventListener('keydown', onKeyDown, true);
    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus();
    }
    previousFocus = null;
  }

  function showModal() {
    previousFocus = document.activeElement;
    modal.style.display = 'flex';
    document.addEventListener('keydown', onKeyDown, true);
    const focusable = getFocusableElements();
    (focusable[0] || saveBtn)?.focus();
  }

  function getSelectedPattern() {
    const templatePattern = templateSelect?.value?.trim();
    if (templatePattern) {
      const opt = templateSelect?.options[templateSelect.selectedIndex];
      const templateName = opt?.textContent?.trim() || '';
      return { pattern: templatePattern, templateName, templatePattern: templatePattern };
    }
    const customPattern = customPatternInput?.value?.trim();
    if (customPattern) {
      const customName = customNameInput?.value?.trim() || 'My template';
      return { pattern: customPattern, templateName: customName, templatePattern: customPattern };
    }
    const first = loadedTemplates[0];
    if (first) {
      return { pattern: first.pattern, templateName: first.name, templatePattern: first.pattern };
    }
    return { pattern: '{date} {sessionId}', templateName: null, templatePattern: '{date} {sessionId}' };
  }

  async function updatePreview() {
    if (!previewEl) return;
    const dateFormat = dateFormatSelect?.value || 'YYYY-MM-DD';
    const { pattern } = getSelectedPattern();
    const count = weekCountInput?.value?.trim() || '3';
    let resolved = pattern.replace(/\{sessionId\}/gi, SAMPLE_SESSION_ID);
    try {
      const result = await window.electronAPI.applyDateTokens(resolved, null, dateFormat, { count });
      if (result?.result) resolved = result.result;
    } catch {
      // keep partial resolution
    }
    previewEl.textContent = resolved;
  }

  async function loadForm() {
    const prefs = await window.electronAPI.loadPreferences();
    loadedTemplates = prefs.eventTemplates || [];

    if (dateFormatSelect) {
      dateFormatSelect.innerHTML = '';
      for (const item of prefs.dateFormats || []) {
        const opt = document.createElement('option');
        opt.value = item.format;
        opt.textContent = item.name;
        dateFormatSelect.appendChild(opt);
      }
      dateFormatSelect.value = prefs.preferredDateFormat || 'YYYY-MM-DD';
    }

    if (templateSelect) {
      templateSelect.innerHTML = '<option value="">— Custom pattern below —</option>';
      for (const t of loadedTemplates) {
        const opt = document.createElement('option');
        opt.value = t.pattern;
        opt.textContent = t.name;
        templateSelect.appendChild(opt);
      }
      if (loadedTemplates.length > 0) {
        templateSelect.value = loadedTemplates[0].pattern;
      }
    }

    if (weekCountInput && prefs.lastWeekCount) {
      weekCountInput.value = prefs.lastWeekCount;
    } else if (weekCountInput) {
      weekCountInput.value = '3';
    }

    const showWeek = getSelectedPattern().pattern.includes('{count}');
    if (weekCountInput?.parentElement) {
      weekCountInput.parentElement.hidden = !showWeek;
    }

    await updatePreview();
  }

  function onTemplateOrPatternChange() {
    const pattern = getSelectedPattern().pattern;
    if (weekCountInput?.parentElement) {
      weekCountInput.parentElement.hidden = !pattern.includes('{count}');
    }
    updatePreview();
  }

  async function handleSave() {
    const dateFormat = dateFormatSelect?.value;
    const { pattern, templateName, templatePattern } = getSelectedPattern();
    if (!pattern) {
      alert('Choose a template or enter a filename pattern.');
      return;
    }
    try {
      const result = await window.electronAPI.completeDefaultsSetup({
        skipped: false,
        dateFormat,
        pattern,
        templateName,
        templatePattern
      });
      if (result?.preferences) {
        dispatchPreferencesUpdated(result.preferences);
      }
      hideModal();
    } catch (error) {
      console.error('Error saving defaults:', error);
      alert('Could not save defaults. Try again.');
    }
  }

  async function handleSkip() {
    try {
      const result = await window.electronAPI.completeDefaultsSetup({ skipped: true });
      if (result?.preferences) {
        dispatchPreferencesUpdated(result.preferences);
      }
      hideModal();
    } catch (error) {
      console.error('Error skipping defaults setup:', error);
      hideModal();
    }
  }

  async function maybeShowSetup() {
    const { show } = await window.electronAPI.shouldShowDefaultsSetup();
    if (!show || isModalVisible(modal)) return;
    await loadForm();
    showModal();
  }

  async function scheduleSetupCheck() {
    if (checkScheduled) return;
    checkScheduled = true;
    await waitForPrerequisitesResolved();
    await maybeShowSetup();
    checkScheduled = false;
  }

  if (saveBtn) saveBtn.addEventListener('click', () => handleSave());
  if (skipBtn) skipBtn.addEventListener('click', () => handleSkip());
  if (closeBtn) closeBtn.addEventListener('click', () => handleSkip());

  if (dateFormatSelect) dateFormatSelect.addEventListener('change', () => updatePreview());
  if (templateSelect) templateSelect.addEventListener('change', () => onTemplateOrPatternChange());
  if (customPatternInput) customPatternInput.addEventListener('input', () => onTemplateOrPatternChange());
  if (customNameInput) customNameInput.addEventListener('input', () => updatePreview());
  if (weekCountInput) weekCountInput.addEventListener('input', () => updatePreview());

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      e.stopPropagation();
    }
  });

  setTimeout(() => scheduleSetupCheck(), 1200);

  if (window.electronAPI.onPrerequisitesMissing) {
    window.electronAPI.onPrerequisitesMissing(() => {
      waitForPrerequisitesResolved().then(() => scheduleSetupCheck());
    });
  }
}
