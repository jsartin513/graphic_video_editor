// Main renderer process entry point
// Orchestrates all UI modules and manages shared state

import { initializeFileHandling } from './fileHandling.js';
import { initializeMergeWorkflow } from './mergeWorkflow.js';
import { initializeSplitVideo } from './splitVideo.js';
import { initializePrerequisites } from './prerequisites.js';
import { initializeKeyboardShortcuts, formatShortcut } from './keyboardShortcuts.js';
import { initializeUndoRedo } from './undoRedo.js';

// Shared application state
const state = {
  selectedFiles: [],
  videoGroups: [],
  currentScreen: 'fileList', // 'fileList', 'preview', 'progress'
  selectedOutputDestination: null, // null means use default
  selectedGroups: new Set(), // Track which groups are selected for batch merge
  stopOnError: true // Stop batch processing on error by default
};

// DOM element references
const domElements = {
  // File selection
  selectFilesBtn: document.getElementById('selectFilesBtn'),
  selectFolderBtn: document.getElementById('selectFolderBtn'),
  dropZone: document.getElementById('dropZone'),
  fileListContainer: document.getElementById('fileListContainer'),
  fileList: document.getElementById('fileList'),
  fileCount: document.getElementById('fileCount'),
  prepareMergeBtn: document.getElementById('prepareMergeBtn'),
  
  // Preview screen
  previewScreen: document.getElementById('previewScreen'),
  previewList: document.getElementById('previewList'),
  backBtn: document.getElementById('backBtn'),
  mergeBtn: document.getElementById('mergeBtn'),
  
  // Progress screen
  progressScreen: document.getElementById('progressScreen'),
  progressBar: document.getElementById('progressBar'),
  progressText: document.getElementById('progressText'),
  progressDetails: document.getElementById('progressDetails'),
  
  // Output destination
  outputDestinationPath: document.getElementById('outputDestinationPath'),
  selectOutputDestinationBtn: document.getElementById('selectOutputDestinationBtn'),
  useDefaultDestinationBtn: document.getElementById('useDefaultDestinationBtn'),
  
  // Prerequisites modal
  prerequisitesModal: document.getElementById('prerequisitesModal'),
  installBtn: document.getElementById('installBtn'),
  checkAgainBtn: document.getElementById('checkAgainBtn'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  installProgress: document.getElementById('installProgress'),
  installProgressBar: document.getElementById('installProgressBar'),
  installProgressText: document.getElementById('installProgressText'),
  installResult: document.getElementById('installResult'),
  ffmpegStatus: document.getElementById('ffmpegStatus'),
  ffprobeStatus: document.getElementById('ffprobeStatus'),
  brewStatus: document.getElementById('brewStatus'),

  // Split Video Modal
  splitVideoModal: document.getElementById('splitVideoModal'),
  closeSplitModalBtn: document.getElementById('closeSplitModalBtn'),
  splitVideoName: document.getElementById('splitVideoName'),
  splitVideoDuration: document.getElementById('splitVideoDuration'),
  segmentMinutes: document.getElementById('segmentMinutes'),
  splitPreview: document.getElementById('splitPreview'),
  cancelSplitBtn: document.getElementById('cancelSplitBtn'),
  executeSplitBtn: document.getElementById('executeSplitBtn'),
  splitProgress: document.getElementById('splitProgress'),
  splitProgressBar: document.getElementById('splitProgressBar'),
  splitProgressText: document.getElementById('splitProgressText'),
  splitResult: document.getElementById('splitResult'),
  
  // Undo/Redo
  undoBtn: document.getElementById('undoBtn'),
  redoBtn: document.getElementById('redoBtn')
};

// Initialize modules (fileHandling and mergeWorkflow will be updated with undoRedo after it's created)
const splitVideo = initializeSplitVideo(domElements, state);
const prerequisites = initializePrerequisites(domElements);

// Create a closure that will access modules from outer scope
// This allows us to reference modules that are defined later
let fileHandling, mergeWorkflow;
function createUpdateStateCallback() {
  return (restoredState) => {
    // Update UI when state is restored
    // Use variables from outer scope at call time
    if (fileHandling && typeof fileHandling.updateFileList === 'function') {
      fileHandling.updateFileList();
    }
    if (restoredState.videoGroups && restoredState.videoGroups.length > 0) {
      if (mergeWorkflow && typeof mergeWorkflow.updatePreviewList === 'function') {
        mergeWorkflow.updatePreviewList();
      }
    }
    // Update file count
    const fileCount = document.getElementById('fileCount');
    if (fileCount) {
      fileCount.textContent = `${restoredState.selectedFiles.length} file${restoredState.selectedFiles.length !== 1 ? 's' : ''}`;
    }
  };
}

// Initialize undo/redo with callback that will access modules via closure
const undoRedo = initializeUndoRedo(state, createUpdateStateCallback(), domElements);

// Now initialize modules with undoRedo reference
fileHandling = initializeFileHandling(state, domElements, undoRedo);
mergeWorkflow = initializeMergeWorkflow(state, domElements, fileHandling, splitVideo, undoRedo);

// Initialize keyboard shortcuts
const keyboardShortcuts = initializeKeyboardShortcuts(state, domElements, {
  cancelMerge: mergeWorkflow?.cancelMerge || (() => {
    // Fallback: try to cancel via IPC if available
    if (window.electronAPI?.cancelMerge) {
      window.electronAPI.cancelMerge();
    }
  })
});

// Update shortcut hints dynamically based on platform
function updateShortcutHints() {
  const shortcutElements = document.querySelectorAll('.btn-shortcut');
  shortcutElements.forEach(el => {
    const button = el.closest('button');
    if (!button) return;
    
    // Map button IDs to shortcuts
    const shortcutMap = {
      'selectFilesBtn': 'O',
      'selectFolderBtn': 'D',
      'prepareMergeBtn': 'M',
      'backBtn': 'Esc',
      'mergeBtn': 'Enter'
    };
    
    const buttonId = button.id;
    if (shortcutMap[buttonId]) {
      const key = shortcutMap[buttonId];
      if (key === 'Esc' || key === 'Enter') {
        el.textContent = key;
      } else {
        el.textContent = formatShortcut(key);
      }
    }
  });
}

  // Wire up undo/redo button handlers
  if (domElements.undoBtn) {
    domElements.undoBtn.addEventListener('click', () => undoRedo.performUndo());
  }
  if (domElements.redoBtn) {
    domElements.redoBtn.addEventListener('click', () => undoRedo.performRedo());
  }

  // Wire up undo/redo button handlers
if (domElements.undoBtn) {
  domElements.undoBtn.addEventListener('click', () => undoRedo.performUndo());
}
if (domElements.redoBtn) {
  domElements.redoBtn.addEventListener('click', () => undoRedo.performRedo());
}

// Update shortcuts when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateShortcutHints);
} else {
  updateShortcutHints();
}

// Make state accessible for debugging
window.appState = state;
