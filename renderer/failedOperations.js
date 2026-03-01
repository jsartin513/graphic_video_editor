// Failed Operations Management
// Handles viewing and retrying failed merge operations

import { getFileName, escapeHtml, escapeAttr, getDirectoryPath } from './utils.js';

export function initializeFailedOperations(domElements) {
  const {
    viewFailedBtn,
    failedOpsModal,
    closeFailedOpsModalBtn,
    closeFailedOpsBtn,
    failedOpsList,
    noFailedOps,
    clearAllFailedBtn,
    failedBadge
  } = domElements;

  // Load and display failed operations count on startup
  updateFailedOperationsButton();

  // View Failed Operations button
  viewFailedBtn.addEventListener('click', async () => {
    await showFailedOperationsModal();
  });

  // Close modal buttons
  closeFailedOpsModalBtn.addEventListener('click', closeModal);
  closeFailedOpsBtn.addEventListener('click', closeModal);

  // Clear all failed operations
  clearAllFailedBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all failed operations?')) {
      try {
        await window.electronAPI.clearFailedOperations();
        await showFailedOperationsModal(); // Refresh the list
        updateFailedOperationsButton();
      } catch (error) {
        console.error('Error clearing failed operations:', error);
        alert('Error clearing failed operations: ' + error.message);
      }
    }
  });

  // Close modal on background click
  failedOpsModal.addEventListener('click', (e) => {
    if (e.target === failedOpsModal) {
      closeModal();
    }
  });

  // Close modal function
  function closeModal() {
    failedOpsModal.style.display = 'none';
  }

  // Show failed operations modal
  async function showFailedOperationsModal() {
    try {
      const failedOps = await window.electronAPI.getFailedOperations();
      
      if (!failedOps || failedOps.length === 0) {
        failedOpsList.style.display = 'none';
        noFailedOps.style.display = 'block';
        clearAllFailedBtn.style.display = 'none';
      } else {
        noFailedOps.style.display = 'none';
        failedOpsList.style.display = 'block';
        clearAllFailedBtn.style.display = 'inline-block';
        renderFailedOperations(failedOps);
      }
      
      failedOpsModal.style.display = 'flex';
    } catch (error) {
      console.error('Error loading failed operations:', error);
      alert('Error loading failed operations: ' + error.message);
    }
  }

  // Render failed operations list
  function renderFailedOperations(failedOps) {
    failedOpsList.innerHTML = '';
    
    // Sort by timestamp (most recent first)
    const sortedOps = [...failedOps].sort((a, b) => b.timestamp - a.timestamp);
    
    for (const op of sortedOps) {
      const item = createFailedOperationItem(op);
      failedOpsList.appendChild(item);
    }
  }

  // Create a failed operation item
  function createFailedOperationItem(op) {
    const item = document.createElement('div');
    item.className = 'failed-op-item';
    
    const timestamp = new Date(op.timestamp).toLocaleString();
    const outputFilename = getFileName(op.outputPath);
    const outputDir = getDirectoryPath(op.outputPath);
    const fileCount = op.files ? op.files.length : 0;
    const retryCount = op.retryCount || 0;
    
    item.innerHTML = `
      <div class="failed-op-header">
        <div class="failed-op-info">
          <h3 class="failed-op-title">Session ${escapeHtml(op.sessionId)}</h3>
          <p class="failed-op-meta">
            ${fileCount} file${fileCount !== 1 ? 's' : ''} • Failed ${timestamp}
            ${retryCount > 0 ? ` • ${retryCount} previous retry attempt${retryCount !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div class="failed-op-actions">
          <button class="btn btn-small btn-primary retry-btn" 
                  aria-label="Retry merge for session ${escapeAttr(op.sessionId)}">
            <span class="btn-icon" aria-hidden="true">🔄</span>
            Retry
          </button>
          <button class="btn btn-small btn-text remove-btn" 
                  aria-label="Remove failed operation for session ${escapeAttr(op.sessionId)}">
            ✕
          </button>
        </div>
      </div>
      <div class="failed-op-details">
        <p><strong>Output:</strong> ${escapeHtml(outputFilename)} <span class="output-path">(${escapeHtml(outputDir)})</span></p>
        <p><strong>Error:</strong> <span class="error-message">${escapeHtml(op.error || 'Unknown error')}</span></p>
        <details class="failed-op-files">
          <summary>View input files (${fileCount})</summary>
          <ul class="failed-op-file-list">
            ${
              Array.isArray(op.files)
                ? op.files.map(f => `<li>${escapeHtml(getFileName(f))}</li>`).join('')
                : '<li>(no input files recorded)</li>'
            }
          </ul>
        </details>
      </div>
    `;
    
    // Add event listeners
    const retryBtn = item.querySelector('.retry-btn');
    const removeBtn = item.querySelector('.remove-btn');
    
    retryBtn.addEventListener('click', async () => {
      await retryOperation(op);
    });
    
    removeBtn.addEventListener('click', async () => {
      await removeOperation(op.sessionId, op.outputPath);
    });
    
    return item;
  }

  // Retry a failed operation
  async function retryOperation(op) {
    try {
      // Validate operation data before using it
      if (!op || !Array.isArray(op.files) || op.files.length === 0) {
        console.error('Cannot retry failed operation: missing or invalid files array.', op);
        alert(
          'This failed operation cannot be retried because the associated file list is missing or invalid.\n\n' +
          'Please remove this entry from the Failed Operations list.'
        );
        await showFailedOperationsModal();
        return;
      }

      // Show confirmation first (before closing modal)
      const filesCount = op.files.length;
      const confirmed = confirm(
        `Retry merging Session ${op.sessionId}?\n\n` +
        `This will attempt to merge ${filesCount} file${filesCount !== 1 ? 's' : ''} again.`
      );
      
      if (!confirmed) {
        return; // Modal stays open so user can continue reviewing
      }

      closeModal();
      
      // Get the quality preference
      let selectedQuality = 'copy';
      try {
        const prefs = await window.electronAPI.loadPreferences();
        if (prefs && prefs.preferredQuality) {
          selectedQuality = prefs.preferredQuality;
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      }
      
      // Attempt the merge
      try {
        await window.electronAPI.mergeVideos(op.files, op.outputPath, selectedQuality);
        
        // Success! Remove from failed operations
        await window.electronAPI.removeFailedOperation(op.sessionId, op.outputPath);
        updateFailedOperationsButton();
        
        alert(`Successfully merged Session ${op.sessionId}!`);
      } catch (error) {
        console.error('Error retrying merge:', error);
        
        // Update the failed operation with new retry count
        await window.electronAPI.addFailedOperation({
          sessionId: op.sessionId,
          files: op.files,
          outputPath: op.outputPath,
          error: error.message,
          timestamp: Date.now()
        });
        
        alert(`Retry failed: ${error.message}`);
      }
    } catch (error) {
      console.error('Error in retry operation:', error);
      alert('Error retrying operation: ' + error.message);
    }
  }

  // Remove a failed operation
  async function removeOperation(sessionId, outputPath) {
    try {
      await window.electronAPI.removeFailedOperation(sessionId, outputPath);
      await showFailedOperationsModal(); // Refresh the list
      updateFailedOperationsButton();
    } catch (error) {
      console.error('Error removing failed operation:', error);
      alert('Error removing failed operation: ' + error.message);
    }
  }

  // Update the failed operations button visibility and badge
  async function updateFailedOperationsButton() {
    try {
      const failedOps = await window.electronAPI.getFailedOperations();
      
      if (failedOps && failedOps.length > 0) {
        viewFailedBtn.style.display = 'inline-flex';
        failedBadge.textContent = `View Failed Operations (${failedOps.length})`;
      } else {
        viewFailedBtn.style.display = 'none';
      }
    } catch (error) {
      console.error('Error updating failed operations button:', error);
      viewFailedBtn.style.display = 'none';
    }
  }

  // Return public API
  return {
    updateFailedOperationsButton
  };
}
