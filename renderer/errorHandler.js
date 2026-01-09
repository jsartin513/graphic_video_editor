/**
 * Enhanced Error Handler Module
 * Provides better error messages with context, categorization, and actionable suggestions
 */

// Simple HTML escape function
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Error categories
export const ERROR_CATEGORIES = {
  FILE_SYSTEM: 'file_system',
  FFMPEG: 'ffmpeg',
  PERMISSIONS: 'permissions',
  VALIDATION: 'validation',
  NETWORK: 'network',
  UNKNOWN: 'unknown'
};

// Error type mappings
const ERROR_PATTERNS = {
  [ERROR_CATEGORIES.FILE_SYSTEM]: [
    /ENOENT|no such file|file not found|does not exist/i,
    /EACCES|permission denied|access denied/i,
    /EMFILE|too many open files/i,
    /ENOSPC|no space left|disk full/i,
    /EISDIR|is a directory/i
  ],
  [ERROR_CATEGORIES.FFMPEG]: [
    /ffmpeg|ffprobe/i,
    /codec|encoding|decoding/i,
    /invalid.*format|unsupported.*format/i,
    /stream.*not found/i
  ],
  [ERROR_CATEGORIES.PERMISSIONS]: [
    /permission denied|EACCES|access denied/i,
    /read-only|write.*protected/i
  ],
  [ERROR_CATEGORIES.VALIDATION]: [
    /invalid|required|missing|empty/i
  ]
};

/**
 * Categorize an error based on its message
 * @param {Error|string} error - The error object or message
 * @returns {string} Error category
 */
function categorizeError(error) {
  const message = typeof error === 'string' ? error : (error.message || String(error));
  
  for (const [category, patterns] of Object.entries(ERROR_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(message))) {
      return category;
    }
  }
  
  return ERROR_CATEGORIES.UNKNOWN;
}

/**
 * Get user-friendly error message with context
 * @param {Error|string} error - The error object or message
 * @param {Object} context - Additional context (file path, operation, etc.)
 * @returns {Object} Enhanced error info
 */
export function enhanceError(error, context = {}) {
  const originalMessage = typeof error === 'string' ? error : (error.message || String(error));
  const category = categorizeError(error);
  
  const enhanced = {
    original: originalMessage,
    category,
    context,
    userMessage: originalMessage,
    suggestions: [],
    severity: 'error'
  };
  
  // Provide contextual messages and suggestions based on category
  switch (category) {
    case ERROR_CATEGORIES.FILE_SYSTEM:
      if (/ENOENT|no such file|not found/.test(originalMessage)) {
        enhanced.userMessage = 'File or folder not found';
        enhanced.suggestions.push('Check that the file path is correct');
        enhanced.suggestions.push('Ensure the file hasn\'t been moved or deleted');
        if (context.filePath) {
          enhanced.userMessage += `: ${context.filePath}`;
        }
      } else if (/ENOSPC|no space|disk full/.test(originalMessage)) {
        enhanced.userMessage = 'Not enough disk space';
        enhanced.suggestions.push('Free up space on your disk');
        enhanced.suggestions.push('Try selecting a different output location');
        enhanced.severity = 'warning';
      } else if (/EISDIR|is a directory/.test(originalMessage)) {
        enhanced.userMessage = 'Expected a file but got a directory';
        enhanced.suggestions.push('Select individual video files, not folders');
      } else {
        enhanced.userMessage = `File system error: ${originalMessage}`;
        enhanced.suggestions.push('Check file permissions');
        enhanced.suggestions.push('Ensure the file is not in use by another program');
      }
      break;
      
    case ERROR_CATEGORIES.FFMPEG:
      enhanced.userMessage = 'Video processing error';
      if (/ffmpeg.*not found|ffprobe.*not found/.test(originalMessage)) {
        enhanced.userMessage = 'FFmpeg is not installed';
        enhanced.suggestions.push('Install FFmpeg using the prerequisites installer');
        enhanced.suggestions.push('Or run: brew install ffmpeg (macOS)');
      } else if (/codec|encoding/.test(originalMessage)) {
        enhanced.userMessage = 'Video codec error';
        enhanced.suggestions.push('The video format may not be supported');
        enhanced.suggestions.push('Try converting the video to MP4 format first');
      } else if (/invalid.*format|unsupported/.test(originalMessage)) {
        enhanced.userMessage = 'Unsupported video format';
        enhanced.suggestions.push('Ensure the file is a valid video file');
        enhanced.suggestions.push('Supported formats: MP4, MOV, AVI, MKV, M4V');
      } else {
        enhanced.suggestions.push('Check that the video files are not corrupted');
        enhanced.suggestions.push('Try re-encoding the videos');
      }
      break;
      
    case ERROR_CATEGORIES.PERMISSIONS:
      enhanced.userMessage = 'Permission denied';
      enhanced.suggestions.push('Check file and folder permissions');
      enhanced.suggestions.push('Ensure you have read access to input files');
      enhanced.suggestions.push('Ensure you have write access to the output folder');
      if (context.outputPath) {
        enhanced.userMessage += `: Cannot write to ${context.outputPath}`;
      }
      break;
      
    case ERROR_CATEGORIES.VALIDATION:
      enhanced.userMessage = originalMessage;
      enhanced.severity = 'warning';
      break;
      
    default:
      enhanced.userMessage = originalMessage;
      enhanced.suggestions.push('Check the console for more details');
      enhanced.suggestions.push('Try the operation again');
  }
  
  return enhanced;
}

/**
 * Show an enhanced error message to the user
 * @param {Error|string|Object} error - The error (can be enhanced error object)
 * @param {Object} context - Additional context
 * @param {Function} callback - Optional callback for retry/actions
 */
export function showError(error, context = {}, callback = null) {
  // If error is already an enhanced object, use it directly
  const enhanced = (error && typeof error === 'object' && error.userMessage) 
    ? { ...error, context: { ...(error.context || {}), ...context } }
    : enhanceError(error, context);
  
  // Merge context suggestions if provided
  const finalContext = { ...enhanced.context, ...context };
  const finalSuggestions = context.suggestions || enhanced.suggestions || [];
  
  // Create error modal/dialog
  const errorModal = document.createElement('div');
  errorModal.className = 'error-modal';
  errorModal.setAttribute('role', 'dialog');
  errorModal.setAttribute('aria-labelledby', 'error-title');
  errorModal.innerHTML = `
    <div class="error-modal-content">
      <div class="error-modal-header">
        <span class="error-icon" aria-hidden="true">${enhanced.severity === 'warning' ? '⚠️' : '❌'}</span>
        <h2 id="error-title" class="error-title">${escapeHtml(enhanced.userMessage)}</h2>
        <button class="error-close" aria-label="Close error dialog">&times;</button>
      </div>
      <div class="error-modal-body">
        ${finalContext.operation ? `<p class="error-context"><strong>Operation:</strong> ${escapeHtml(finalContext.operation)}</p>` : ''}
        ${finalContext.filePath ? `<p class="error-context"><strong>File:</strong> <code>${escapeHtml(finalContext.filePath)}</code></p>` : ''}
        ${finalContext.sessionId ? `<p class="error-context"><strong>Session:</strong> ${escapeHtml(finalContext.sessionId)}</p>` : ''}
        
        ${finalSuggestions.length > 0 ? `
          <div class="error-suggestions">
            <h3>Suggestions:</h3>
            <ul>
              ${finalSuggestions.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        
        ${enhanced.original && enhanced.original !== enhanced.userMessage ? `
          <details class="error-details">
            <summary>Technical details</summary>
            <pre class="error-technical">${escapeHtml(enhanced.original)}</pre>
          </details>
        ` : ''}
      </div>
      <div class="error-modal-footer">
        ${callback ? `<button class="btn btn-secondary error-retry">Retry</button>` : ''}
        <button class="btn btn-primary error-close-btn">Close</button>
      </div>
    </div>
  `;
  
  // Add to document
  document.body.appendChild(errorModal);
  
  // Close handlers
  const closeError = () => {
    errorModal.remove();
  };
  
  errorModal.querySelector('.error-close').addEventListener('click', closeError);
  errorModal.querySelector('.error-close-btn').addEventListener('click', closeError);
  errorModal.addEventListener('click', (e) => {
    if (e.target === errorModal) {
      closeError();
    }
  });
  
  // Retry handler
  if (callback) {
    errorModal.querySelector('.error-retry').addEventListener('click', () => {
      closeError();
      callback();
    });
  }
  
  // Focus management
  errorModal.querySelector('.error-close-btn').focus();
}

/**
 * Show a warning message (less severe than error)
 * @param {string} message - Warning message
 * @param {Object} context - Additional context
 */
export function showWarning(message, context = {}) {
  showError(message, { ...context, severity: 'warning' });
}

/**
 * Replace standard alert with enhanced error display
 * @param {string} message - Alert message
 * @param {string} type - 'error' or 'warning'
 */
export function enhancedAlert(message, type = 'error') {
  if (type === 'warning') {
    showWarning(message);
  } else {
    showError(message);
  }
}

