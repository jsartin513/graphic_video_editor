// Main renderer process entry point
// Orchestrates all UI modules and manages shared state

import { initializeFileHandling } from './fileHandling.js';
import { initializeMergeWorkflow } from './mergeWorkflow.js';
import { initializeSplitVideo } from './splitVideo.js';
import { initializePrerequisites } from './prerequisites.js';
import { initializeKeyboardShortcuts } from './keyboardShortcuts.js';

// Shared application state
const state = {
  selectedFiles: [],
  videoGroups: [],
  currentScreen: 'fileList', // 'fileList', 'preview', 'progress'
  selectedOutputDestination: null // null means use default
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
  splitResult: document.getElementById('splitResult')
};

// Initialize all modules
const fileHandling = initializeFileHandling(state, domElements);
const splitVideo = initializeSplitVideo(domElements, state);
const mergeWorkflow = initializeMergeWorkflow(state, domElements, fileHandling, splitVideo);
const prerequisites = initializePrerequisites(domElements);

// Initialize keyboard shortcuts with handlers
const keyboardHandlers = {
  selectFiles: () => domElements.selectFilesBtn.click(),
  selectFolder: () => domElements.selectFolderBtn.click(),
  prepareMerge: () => {
    if (domElements.prepareMergeBtn.style.display !== 'none' && !domElements.prepareMergeBtn.disabled) {
      domElements.prepareMergeBtn.click();
    }
  },
  merge: () => {
    if (domElements.mergeBtn && !domElements.mergeBtn.disabled) {
      domElements.mergeBtn.click();
    }
  },
  goBack: () => {
    if (domElements.backBtn && domElements.previewScreen.style.display !== 'none') {
      domElements.backBtn.click();
    }
  },
  closeModal: () => {
    // Close prerequisites modal if open
    if (domElements.prerequisitesModal && domElements.prerequisitesModal.style.display !== 'none') {
      domElements.prerequisitesModal.style.display = 'none';
    }
    // Close split video modal if open
    else if (domElements.splitVideoModal && domElements.splitVideoModal.style.display !== 'none') {
      domElements.splitVideoModal.style.display = 'none';
      // Reset split modal state
      const splitProgress = document.getElementById('splitProgress');
      const splitResult = document.getElementById('splitResult');
      if (splitProgress) splitProgress.style.display = 'none';
      if (splitResult) splitResult.style.display = 'none';
    }
  },
  savePreferences: () => {
    // Placeholder for future preferences saving functionality
    console.log('Save preferences shortcut triggered (not yet implemented)');
  }
};

const keyboardShortcuts = initializeKeyboardShortcuts(domElements, keyboardHandlers);

// Make state accessible for debugging
window.appState = state;
window.keyboardShortcuts = keyboardShortcuts;
