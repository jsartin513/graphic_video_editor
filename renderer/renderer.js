// Main renderer process entry point
// Orchestrates all UI modules and manages shared state

import { initializeFileHandling } from './fileHandling.js';
import { initializeMergeWorkflow } from './mergeWorkflow.js';
import { initializeSplitVideo } from './splitVideo.js';
import { initializePrerequisites } from './prerequisites.js';

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
  splitResult: document.getElementById('splitResult')
};

// Initialize all modules
const fileHandling = initializeFileHandling(state, domElements);
const splitVideo = initializeSplitVideo(domElements, state);
const mergeWorkflow = initializeMergeWorkflow(state, domElements, fileHandling, splitVideo);
const prerequisites = initializePrerequisites(domElements);

// Make state accessible for debugging
window.appState = state;
