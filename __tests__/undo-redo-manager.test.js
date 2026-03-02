/**
 * Tests for src/undo-redo-manager.js
 */

const { UndoRedoManager } = require('../src/undo-redo-manager');

describe('UndoRedoManager', () => {
  let manager;

  beforeEach(() => {
    manager = new UndoRedoManager(10);
  });

  describe('addState', () => {
    it('adds state to history', () => {
      manager.addState({ files: ['a.mp4'] }, 'Add file');
      expect(manager.getCurrentState()).toEqual({ files: ['a.mp4'] });
      expect(manager.getLastAction()).toBe('Add file');
    });

    it('limits history size', () => {
      for (let i = 0; i < 15; i++) {
        manager.addState({ n: i }, `Action ${i}`);
      }
      expect(manager.history.length).toBe(10);
    });
  });

  describe('undo/redo', () => {
    it('undo restores previous state', () => {
      manager.addState({ files: [] }, 'Initial');
      manager.addState({ files: ['a.mp4'] }, 'Add a');
      manager.addState({ files: ['a.mp4', 'b.mp4'] }, 'Add b');

      const prev = manager.undo();
      expect(prev).toEqual({ files: ['a.mp4'] });
      expect(manager.getCurrentState()).toEqual({ files: ['a.mp4'] });
    });

    it('redo restores next state', () => {
      manager.addState({ n: 1 }, '1');
      manager.addState({ n: 2 }, '2');
      manager.undo();
      const next = manager.redo();
      expect(next).toEqual({ n: 2 });
    });

    it('undo clears redo branch', () => {
      manager.addState({ n: 1 }, '1');
      manager.addState({ n: 2 }, '2');
      manager.addState({ n: 3 }, '3');
      manager.undo();
      manager.undo();
      manager.addState({ n: 99 }, 'New'); // replaces future states
      expect(manager.canRedo()).toBe(false);
      expect(manager.getCurrentState()).toEqual({ n: 99 });
    });

    it('undo returns null when no history', () => {
      expect(manager.undo()).toBeNull();
    });

    it('redo returns null when at end', () => {
      manager.addState({ n: 1 }, '1');
      expect(manager.redo()).toBeNull();
    });
  });

  describe('canUndo/canRedo', () => {
    it('canUndo is false with one state', () => {
      manager.addState({ n: 1 }, '1');
      expect(manager.canUndo()).toBe(false);
    });

    it('canUndo is true with multiple states', () => {
      manager.addState({ n: 1 }, '1');
      manager.addState({ n: 2 }, '2');
      expect(manager.canUndo()).toBe(true);
    });

    it('canRedo is false at end', () => {
      manager.addState({ n: 1 }, '1');
      expect(manager.canRedo()).toBe(false);
    });

    it('canRedo is true after undo', () => {
      manager.addState({ n: 1 }, '1');
      manager.addState({ n: 2 }, '2');
      manager.undo();
      expect(manager.canRedo()).toBe(true);
    });
  });

  describe('clear', () => {
    it('clears history', () => {
      manager.addState({ n: 1 }, '1');
      manager.clear();
      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(false);
      expect(manager.getCurrentState()).toBeNull();
    });
  });

  describe('deepClone', () => {
    it('clones state so mutations do not affect history', () => {
      const state = { files: ['a.mp4'] };
      manager.addState(state, 'Add');
      manager.addState({ files: ['a.mp4', 'b.mp4'] }, 'Add b');
      state.files.push('mutated');
      manager.undo();
      expect(manager.getCurrentState().files).toEqual(['a.mp4']);
    });
  });
});
