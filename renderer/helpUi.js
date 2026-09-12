/** Shared help links and inline help toggles. */

export const USER_GUIDE_URL =
  'https://github.com/jsartin513/graphic_video_editor/blob/main/USER_GUIDE.md';

export function initializeHelpUi() {
  const openGuide = () => {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(USER_GUIDE_URL);
    }
  };

  document.getElementById('openHelpBtn')?.addEventListener('click', openGuide);
  document.getElementById('settingsOpenUserGuideBtn')?.addEventListener('click', openGuide);

  document.querySelectorAll('[data-help-target]').forEach((button) => {
    const targetId = button.getAttribute('data-help-target');
    if (!targetId) return;
    const panel = document.getElementById(targetId);
    if (!panel) return;

    button.addEventListener('click', () => {
      const isHidden = panel.hasAttribute('hidden');
      if (isHidden) {
        panel.removeAttribute('hidden');
        button.setAttribute('aria-expanded', 'true');
      } else {
        panel.setAttribute('hidden', '');
        button.setAttribute('aria-expanded', 'false');
      }
    });
  });
}
