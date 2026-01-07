// Keyboard shortcuts functionality

/**
 * Initialize keyboard shortcuts
 * @param {Object} state - Application state
 * @param {Object} domElements - DOM element references
 * @param {Object} callbacks - Object with callback functions for actions
 */
export function initializeKeyboardShortcuts(state, domElements, callbacks) {
  const {
    selectFilesBtn,
    selectFolderBtn,
    prepareMergeBtn,
    backBtn,
    mergeBtn
  } = domElements;

  // Detect platform (macOS uses Meta, others use Ctrl)
  // Check for macOS more reliably
  const isMac = (typeof process !== 'undefined' && process.platform === 'darwin') || 
                navigator.platform.toUpperCase().indexOf('MAC') >= 0 ||
                navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
  const modifierKey = isMac ? 'metaKey' : 'ctrlKey';
  const modifierDisplay = isMac ? '⌘' : 'Ctrl';

  // Helper to check if modifier is pressed
  function hasModifier(e) {
    return e[modifierKey] && !e.altKey && !e.shiftKey;
  }

  // Helper to check if no modifiers are pressed (except Shift)
  function isPlainKey(e, key) {
    return e.key === key && !e.ctrlKey && !e.metaKey && !e.altKey;
  }

  // Handle keyboard events
  function handleKeyDown(e) {
    // Don't trigger shortcuts when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      // Allow Escape to work in inputs to close dialogs
      if (e.key === 'Escape') {
        // Let it bubble up
        return;
      }
      // Allow Enter to work in inputs for filename editing
      if (e.key === 'Enter' && e.target.closest('.filename-input-container')) {
        // Let it bubble up to submit filename
        return;
      }
      return;
    }

    // Cmd+O / Ctrl+O - Open files dialog
    if (hasModifier(e) && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      if (selectFilesBtn && !selectFilesBtn.disabled) {
        selectFilesBtn.click();
      }
      return;
    }

    // Cmd+D / Ctrl+D - Open folder dialog
    if (hasModifier(e) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      if (selectFolderBtn && !selectFolderBtn.disabled) {
        selectFolderBtn.click();
      }
      return;
    }

    // Cmd+M / Ctrl+M - Prepare merge
    if (hasModifier(e) && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      if (prepareMergeBtn && prepareMergeBtn.style.display !== 'none' && !prepareMergeBtn.disabled) {
        prepareMergeBtn.click();
      }
      return;
    }

    // Enter - Start merge or prepare merge based on screen
    if (isPlainKey(e, 'Enter')) {
      e.preventDefault();
      if (state.currentScreen === 'fileList' && prepareMergeBtn && prepareMergeBtn.style.display !== 'none') {
        prepareMergeBtn.click();
      } else if (state.currentScreen === 'preview' && mergeBtn && !mergeBtn.disabled) {
        mergeBtn.click();
      }
      return;
    }

    // Escape - Go back or cancel
    if (e.key === 'Escape') {
      e.preventDefault();
      if (state.currentScreen === 'preview' && backBtn && !backBtn.disabled) {
        backBtn.click();
      } else if (state.currentScreen === 'progress') {
        // Cancel merge if in progress
        if (callbacks && callbacks.cancelMerge) {
          callbacks.cancelMerge();
        }
      }
      return;
    }
  }

  // Add event listener
  document.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Get platform-specific modifier key display
 * @returns {string} Display string for modifier key (⌘ or Ctrl)
 */
export function getModifierDisplay() {
  const isMac = (typeof process !== 'undefined' && process.platform === 'darwin') || 
                navigator.platform.toUpperCase().indexOf('MAC') >= 0 ||
                navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
  return isMac ? '⌘' : 'Ctrl';
}

/**
 * Format keyboard shortcut for display
 * @param {string} key - The key name
 * @param {boolean} useModifier - Whether to include modifier
 * @returns {string} Formatted shortcut (e.g., "⌘O" or "Ctrl+O")
 */
export function formatShortcut(key, useModifier = true) {
  const modifier = useModifier ? getModifierDisplay() : '';
  const isMac = (typeof process !== 'undefined' && process.platform === 'darwin') || 
                navigator.platform.toUpperCase().indexOf('MAC') >= 0 ||
                navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
  const separator = isMac ? '' : '+';
  return modifier ? `${modifier}${separator}${key.toUpperCase()}` : key.toUpperCase();
}

/**
 * Update keyboard shortcut hints in the UI
 * Call this on page load to set platform-specific shortcuts
 */
export function updateShortcutHints() {
  // Update button shortcuts
  const shortcuts = {
    'selectFilesBtn': formatShortcut('O'),
    'selectFolderBtn': formatShortcut('D'),
    'prepareMergeBtn': `${formatShortcut('M')} or Enter`
  };

  Object.keys(shortcuts).forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
      const shortcutSpan = btn.querySelector('.btn-shortcut');
      if (shortcutSpan) {
        shortcutSpan.textContent = shortcuts[btnId];
      }
    }
  });
}

