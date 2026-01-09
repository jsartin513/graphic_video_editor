/**
 * Error Dialog Component
 * Displays user-friendly error messages with actionable suggestions
 */

/**
 * Simple HTML escape function to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Show an error dialog with user-friendly message and suggestions
 * @param {Object} errorInfo - Mapped error information
 * @param {string} errorInfo.userMessage - User-friendly error title
 * @param {string} errorInfo.suggestion - Brief explanation
 * @param {string[]} errorInfo.fixes - Array of suggested fixes
 * @param {string} errorInfo.code - Error code
 * @param {string} errorInfo.technicalDetails - Technical error details
 */
function showErrorDialog(errorInfo) {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'error-dialog-overlay';
  
  // Create dialog
  const dialog = document.createElement('div');
  dialog.className = 'error-dialog';
  
  // Build dialog content
  let dialogHTML = `
    <div class="error-dialog-header">
      <span class="error-dialog-icon">⚠️</span>
      <h2>${escapeHtml(errorInfo.userMessage)}</h2>
    </div>
    
    <div class="error-dialog-content">
      <p class="error-suggestion">${escapeHtml(errorInfo.suggestion)}</p>
      
      <div class="error-fixes">
        <h3>What you can try:</h3>
        <ul>
  `;
  
  errorInfo.fixes.forEach(fix => {
    dialogHTML += `<li>${escapeHtml(fix)}</li>`;
  });
  
  dialogHTML += `
        </ul>
      </div>
      
      <div class="error-technical">
        <details>
          <summary>Show Technical Details</summary>
          <div class="technical-content">
            <p><strong>Error Code:</strong> ${escapeHtml(errorInfo.code)}</p>
            <pre>${escapeHtml(errorInfo.technicalDetails)}</pre>
          </div>
        </details>
      </div>
    </div>
    
    <div class="error-dialog-footer">
      <button class="btn-secondary" id="error-help-btn">Get Help</button>
      <button class="btn-primary" id="error-close-btn">OK</button>
    </div>
  `;
  
  dialog.innerHTML = dialogHTML;
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  
  // Add event listeners
  const closeBtn = document.getElementById('error-close-btn');
  const helpBtn = document.getElementById('error-help-btn');
  
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(overlay);
  });
  
  helpBtn.addEventListener('click', () => {
    // Open troubleshooting guide
    window.electronAPI.openExternal('https://github.com/jsartin513/graphic_video_editor/blob/main/TROUBLESHOOTING.md');
  });
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
  
  // Close on Escape key
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
}

/**
 * Show a simple error alert (fallback for when dialog can't be shown)
 * @param {Object} errorInfo - Mapped error information
 */
function showSimpleError(errorInfo) {
  let message = `${errorInfo.userMessage}\n\n${errorInfo.suggestion}\n\nWhat you can try:\n`;
  errorInfo.fixes.forEach((fix, i) => {
    message += `${i + 1}. ${fix}\n`;
  });
  alert(message);
}

// Make functions available globally for use in other scripts
window.showErrorDialog = showErrorDialog;
window.showSimpleError = showSimpleError;
