/**
 * Undo/Redo state manager (pure logic, no DOM)
 */

class UndoRedoManager {
  constructor(maxHistorySize = 50) {
    this.history = [];
    this.currentIndex = -1;
    this.maxHistorySize = maxHistorySize;
  }

  addState(state, action) {
    this.history = this.history.slice(0, this.currentIndex + 1);

    this.history.push({
      state: this.deepClone(state),
      action: action,
      timestamp: Date.now()
    });

    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    } else {
      this.currentIndex = this.history.length - 1;
    }
  }

  undo() {
    if (!this.canUndo()) {
      return null;
    }
    this.currentIndex--;
    return this.history[this.currentIndex].state;
  }

  redo() {
    if (!this.canRedo()) {
      return null;
    }
    this.currentIndex++;
    return this.history[this.currentIndex].state;
  }

  canUndo() {
    return this.currentIndex > 0;
  }

  canRedo() {
    return this.currentIndex < this.history.length - 1;
  }

  getCurrentState() {
    if (this.currentIndex < 0 || this.currentIndex >= this.history.length) {
      return null;
    }
    return this.history[this.currentIndex].state;
  }

  getLastAction() {
    if (this.currentIndex < 0 || this.currentIndex >= this.history.length) {
      return null;
    }
    return this.history[this.currentIndex].action;
  }

  clear() {
    this.history = [];
    this.currentIndex = -1;
  }

  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
}

module.exports = { UndoRedoManager };
