/**
 * In-app bug report flow — opens pre-filled GitHub issue.
 */

let pendingErrorInfo = null;

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * @param {object|null} errorInfo - Mapped error from error-mapper shape
 */
export function setBugReportErrorContext(errorInfo) {
  pendingErrorInfo = errorInfo || null;
}

export function clearBugReportErrorContext() {
  pendingErrorInfo = null;
}

function getBugReportModalElements() {
  return {
    overlay: document.getElementById('bugReportModal'),
    description: document.getElementById('bugReportDescription'),
    status: document.getElementById('bugReportStatus'),
    submitBtn: document.getElementById('bugReportSubmitBtn'),
    cancelBtn: document.getElementById('bugReportCancelBtn'),
    closeBtn: document.getElementById('closeBugReportModalBtn')
  };
}

function hideBugReportModal() {
  const { overlay, status } = getBugReportModalElements();
  if (overlay) overlay.style.display = 'none';
  if (status) {
    status.textContent = '';
    status.hidden = true;
  }
}

/**
 * @param {object} options
 * @param {object|null} options.errorInfo
 */
export function showBugReportModal(options = {}) {
  const errorInfo = options.errorInfo !== undefined ? options.errorInfo : pendingErrorInfo;
  const { overlay, description, status, submitBtn } = getBugReportModalElements();
  if (!overlay) return;

  if (description && !description.value && errorInfo?.userMessage) {
    description.value = errorInfo.userMessage;
  }
  if (status) {
    status.textContent = '';
    status.hidden = true;
  }
  if (submitBtn) submitBtn.disabled = false;
  overlay.style.display = 'flex';
  description?.focus();
}

async function submitBugReport() {
  const { description, status, submitBtn } = getBugReportModalElements();
  if (!window.electronAPI?.openBugReport) {
    if (status) {
      status.textContent = 'Bug reporting is not available in this build.';
      status.hidden = false;
    }
    return;
  }

  const userDescription = description?.value?.trim() || '';
  const errorInfo = pendingErrorInfo;

  if (submitBtn) submitBtn.disabled = true;
  if (status) {
    status.textContent = 'Preparing report…';
    status.hidden = false;
  }

  try {
    const result = await window.electronAPI.openBugReport({
      userDescription,
      errorInfo: errorInfo
        ? {
            userMessage: errorInfo.userMessage,
            suggestion: errorInfo.suggestion,
            code: errorInfo.code,
            technicalDetails: errorInfo.technicalDetails
          }
        : null
    });

    if (result?.success) {
      if (status) {
        status.textContent =
          'Opened GitHub in your browser. The full report was copied to your clipboard — paste it if the issue form looks incomplete.';
        status.hidden = false;
      }
      setTimeout(() => {
        hideBugReportModal();
        clearBugReportErrorContext();
        if (description) description.value = '';
      }, 2500);
    } else {
      if (status) {
        status.textContent = result?.error || 'Could not open bug report.';
        status.hidden = false;
      }
      if (submitBtn) submitBtn.disabled = false;
    }
  } catch (err) {
    if (status) {
      status.textContent = err?.message || 'Could not open bug report.';
      status.hidden = false;
    }
    if (submitBtn) submitBtn.disabled = false;
  }
}

export function initializeBugReport() {
  const { overlay, submitBtn, cancelBtn, closeBtn } = getBugReportModalElements();

  document.getElementById('settingsReportBugBtn')?.addEventListener('click', () => {
    showBugReportModal({ errorInfo: null });
  });

  submitBtn?.addEventListener('click', () => submitBugReport());
  cancelBtn?.addEventListener('click', hideBugReportModal);
  closeBtn?.addEventListener('click', hideBugReportModal);

  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) hideBugReportModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay?.style.display === 'flex') {
      hideBugReportModal();
    }
  });
}

/**
 * Wire Report a bug on a dialog footer (pass button element).
 * @param {HTMLButtonElement} button
 * @param {object|null} errorInfo
 */
export function wireReportBugButton(button, errorInfo) {
  if (!button) return;
  button.addEventListener('click', () => {
    setBugReportErrorContext(errorInfo);
    showBugReportModal({ errorInfo });
  });
}

export { escapeHtml };
