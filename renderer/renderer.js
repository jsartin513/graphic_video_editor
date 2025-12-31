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
  brewStatus: document.getElementById('brewStatus')
};
