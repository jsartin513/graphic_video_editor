/**
 * Undo/Redo Module
 * Manages state history for undo/redo functionality
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { UndoRedoManager } = require('../src/undo-redo-manager');
export { UndoRedoManager };

/**
 * Initialize undo/redo functionality
 * @param {Object} state - Application state object
 * @param {Function} updateStateCallback - Callback to update state
 * @param {Object} domElements - DOM element references
 * @returns {Object} Undo/redo controls
 */
export function initializeUndoRedo(state, updateStateCallback, domElements) {
  const manager = new UndoRedoManager();
  
  // Save initial state
  manager.addState({
    selectedFiles: [...state.selectedFiles],
    videoGroups: JSON.parse(JSON.stringify(state.videoGroups || []))
  }, 'Initial state');

  /**
   * Save current state to history
   * @param {string} action - Description of the action
   */
  function saveState(action) {
    manager.addState({
      selectedFiles: [...state.selectedFiles],
      videoGroups: JSON.parse(JSON.stringify(state.videoGroups || []))
    }, action);
    updateUndoRedoButtons();
  }

  /**
   * Restore state from history
   * @param {Object} savedState - State to restore
   */
  function restoreState(savedState) {
    if (!savedState) return;
    
    // Update state
    state.selectedFiles = [...savedState.selectedFiles];
    state.videoGroups = JSON.parse(JSON.stringify(savedState.videoGroups || []));
    
    // Call update callback
    updateStateCallback(state);
    updateUndoRedoButtons();
  }

  /**
   * Perform undo operation
   */
  function performUndo() {
    if (!manager.canUndo()) return;
    
    const previousState = manager.undo();
    restoreState(previousState);
  }

  /**
   * Perform redo operation
   */
  function performRedo() {
    if (!manager.canRedo()) return;
    
    const nextState = manager.redo();
    restoreState(nextState);
  }

  /**
   * Update undo/redo button states
   */
  function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    if (undoBtn) {
      undoBtn.disabled = !manager.canUndo();
      undoBtn.setAttribute('aria-disabled', !manager.canUndo());
      if (manager.canUndo()) {
        const action = manager.history[manager.currentIndex - 1]?.action || 'Undo';
        undoBtn.title = `Undo: ${action}`;
      } else {
        undoBtn.title = 'Nothing to undo';
      }
    }
    
    if (redoBtn) {
      redoBtn.disabled = !manager.canRedo();
      redoBtn.setAttribute('aria-disabled', !manager.canRedo());
      if (manager.canRedo()) {
        const action = manager.history[manager.currentIndex + 1]?.action || 'Redo';
        redoBtn.title = `Redo: ${action}`;
      } else {
        redoBtn.title = 'Nothing to redo';
      }
    }
  }

  // Set up keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Check for Cmd+Z (macOS) or Ctrl+Z (Windows/Linux)
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      performUndo();
    }
    
    // Check for Cmd+Shift+Z or Ctrl+Shift+Z (redo)
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey && !e.altKey) {
      e.preventDefault();
      performRedo();
    }
    
    // Also support Cmd+Y or Ctrl+Y (alternative redo on Windows)
    if ((e.metaKey || e.ctrlKey) && e.key === 'y' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      performRedo();
    }
  });

  // Initialize button states
  updateUndoRedoButtons();

  return {
    saveState,
    performUndo,
    performRedo,
    updateButtons: updateUndoRedoButtons,
    canUndo: () => manager.canUndo(),
    canRedo: () => manager.canRedo(),
    clear: () => manager.clear()
  };
}

