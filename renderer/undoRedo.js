/**
 * Undo/Redo Module
 * Manages state history for undo/redo functionality
 */

export class UndoRedoManager {
  constructor(maxHistorySize = 50) {
    this.history = [];
    this.currentIndex = -1;
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Add a new state to the history
   * @param {Object} state - The state to save
   * @param {string} action - Description of the action
   */
  addState(state, action) {
    // Remove any states after current index (when redo was available but user did new action)
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    // Add new state
    this.history.push({
      state: this.deepClone(state),
      action: action,
      timestamp: Date.now()
    });
    
    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    } else {
      this.currentIndex = this.history.length - 1;
    }
  }

  /**
   * Get the previous state (undo)
   * @returns {Object|null} Previous state or null if no history
   */
  undo() {
    if (!this.canUndo()) {
      return null;
    }
    this.currentIndex--;
    return this.history[this.currentIndex].state;
  }

  /**
   * Get the next state (redo)
   * @returns {Object|null} Next state or null if no redo available
   */
  redo() {
    if (!this.canRedo()) {
      return null;
    }
    this.currentIndex++;
    return this.history[this.currentIndex].state;
  }

  /**
   * Check if undo is available
   * @returns {boolean}
   */
  canUndo() {
    return this.currentIndex > 0;
  }

  /**
   * Check if redo is available
   * @returns {boolean}
   */
  canRedo() {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Get the current state
   * @returns {Object|null}
   */
  getCurrentState() {
    if (this.currentIndex < 0 || this.currentIndex >= this.history.length) {
      return null;
    }
    return this.history[this.currentIndex].state;
  }

  /**
   * Get the last action description
   * @returns {string|null}
   */
  getLastAction() {
    if (this.currentIndex < 0 || this.currentIndex >= this.history.length) {
      return null;
    }
    return this.history[this.currentIndex].action;
  }

  /**
   * Clear all history
   */
  clear() {
    this.history = [];
    this.currentIndex = -1;
  }

  /**
   * Deep clone an object
   * @param {Object} obj - Object to clone
   * @returns {Object} Cloned object
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
}

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

