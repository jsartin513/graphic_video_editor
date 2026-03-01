// Main renderer process entry point
// Orchestrates all UI modules and manages shared state

import { initializeFileHandling } from './fileHandling.js';
import { initializeMergeWorkflow } from './mergeWorkflow.js';
import { initializeTrimVideo } from './trimVideo.js';
import { initializeKeyboardShortcuts, updateShortcutHints } from './keyboardShortcuts.js';
import { getFileName, getDirectoryPath } from './utils.js';
import { initializeFailedOperations } from './failedOperations.js';

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
  splitVideoBtn: document.getElementById('splitVideoBtn'),
  dropZone: document.getElementById('dropZone'),
  fileListContainer: document.getElementById('fileListContainer'),
  fileList: document.getElementById('fileList'),
  fileCount: document.getElementById('fileCount'),
  prepareMergeBtn: document.getElementById('prepareMergeBtn'),
  
  // SD Card notification
  sdCardNotification: document.getElementById('sdCardNotification'),
  sdCardName: document.getElementById('sdCardName'),
  openSDCardBtn: document.getElementById('openSDCardBtn'),
  loadSDCardBtn: document.getElementById('loadSDCardBtn'),
  dismissSDCardBtn: document.getElementById('dismissSDCardBtn'),
  
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

  // Failed Operations Modal
  viewFailedBtn: document.getElementById('viewFailedBtn'),
  failedOpsModal: document.getElementById('failedOpsModal'),
  closeFailedOpsModalBtn: document.getElementById('closeFailedOpsModalBtn'),
  closeFailedOpsBtn: document.getElementById('closeFailedOpsBtn'),
  failedOpsList: document.getElementById('failedOpsList'),
  noFailedOps: document.getElementById('noFailedOps'),
  clearAllFailedBtn: document.getElementById('clearAllFailedBtn'),
  failedBadge: document.getElementById('failedBadge')
};

// Lazy-loaded modules (code splitting)
let splitVideoModule = null;
let prerequisitesModule = null;

async function loadSplitVideoModule() {
  if (!splitVideoModule) {
    const module = await import('./splitVideo.js');
    splitVideoModule = module.initializeSplitVideo(domElements, state);
  }
  return splitVideoModule;
}

async function loadPrerequisitesModule() {
  if (!prerequisitesModule) {
    const module = await import('./prerequisites.js');
    prerequisitesModule = module.initializePrerequisites(domElements);
  }
  return prerequisitesModule;
}

// Initialize core modules (always loaded)
const trimVideo = initializeTrimVideo(domElements, state);
const fileHandling = initializeFileHandling(state, domElements, trimVideo);
const failedOperations = initializeFailedOperations(domElements);
const mergeWorkflow = initializeMergeWorkflow(state, domElements, fileHandling, loadSplitVideoModule, trimVideo, failedOperations);

// Set up lazy loading for prerequisites
window.electronAPI.onPrerequisitesMissing(async (event, status) => {
  const prerequisites = await loadPrerequisitesModule();
  prerequisites.showPrerequisitesModal(status);
});

// Split Video button (start screen) - lazy loads splitVideo on first click
const splitVideoBtn = document.getElementById('splitVideoBtn');
if (splitVideoBtn) {
  splitVideoBtn.addEventListener('click', async () => {
    try {
      const result = await window.electronAPI.selectFiles();
      if (result.canceled || !result.files?.length) return;
      const videoPath = result.files[0];
      const videoName = getFileName(videoPath);
      const outputDir = getDirectoryPath(videoPath);
      const splitVideo = await loadSplitVideoModule();
      splitVideo.showSplitVideoModal(videoPath, videoName, outputDir);
    } catch (error) {
      console.error('Error opening split video:', error);
    }
  });
}

// Initialize keyboard shortcuts
const keyboardShortcuts = initializeKeyboardShortcuts(state, domElements, {
  cancelMerge: mergeWorkflow?.cancelMerge || (() => {
    // Fallback: try to cancel via IPC if available
    if (window.electronAPI?.cancelMerge) {
      window.electronAPI.cancelMerge();
    }
  })
});

// Update keyboard shortcut hints to show platform-specific shortcuts
updateShortcutHints();

// Make state accessible for debugging
window.appState = state;

// SD Card Detection
let currentSDCard = null;

// Listen for SD card detection events
window.electronAPI.onSDCardDetected((sdCard) => {
  console.log('SD card detected:', sdCard);
  currentSDCard = sdCard;
  showSDCardNotification(sdCard);
});

window.electronAPI.onSDCardRemoved((sdCard) => {
  console.log('SD card removed:', sdCard);
  if (currentSDCard && currentSDCard.name === sdCard.name) {
    hideSDCardNotification();
    currentSDCard = null;
  }
});

function showSDCardNotification(sdCard) {
  domElements.sdCardName.textContent = sdCard.name;
  domElements.sdCardNotification.style.display = 'block';
}

function hideSDCardNotification() {
  domElements.sdCardNotification.style.display = 'none';
}

// SD Card notification actions
domElements.openSDCardBtn.addEventListener('click', async () => {
  if (currentSDCard) {
    try {
      await window.electronAPI.openSDCardDirectory(currentSDCard.path);
    } catch (error) {
      console.error('Error opening SD card directory:', error);
    }
  }
});

domElements.loadSDCardBtn.addEventListener('click', async () => {
  if (currentSDCard) {
    try {
      const result = await window.electronAPI.loadSDCardFiles(currentSDCard.path);
      if (result.success && result.files.length > 0) {
        // Add files to the file list using the fileHandling module
        for (const file of result.files) {
          if (!state.selectedFiles.includes(file)) {
            state.selectedFiles.push(file);
          }
        }
        fileHandling.updateFileList();
        hideSDCardNotification();
      } else {
        console.log('No video files found on SD card');
      }
    } catch (error) {
      console.error('Error loading SD card files:', error);
    }
  }
});

domElements.dismissSDCardBtn.addEventListener('click', () => {
  hideSDCardNotification();
});
