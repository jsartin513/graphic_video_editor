// Store selected files
let selectedFiles = [];
let videoGroups = [];
let currentScreen = 'fileList'; // 'fileList', 'preview', 'progress'
let selectedOutputDestination = null; // null means use default

// DOM elements
const selectFilesBtn = document.getElementById('selectFilesBtn');
const selectFolderBtn = document.getElementById('selectFolderBtn');
const dropZone = document.getElementById('dropZone');
const fileListContainer = document.getElementById('fileListContainer');
const fileList = document.getElementById('fileList');
const fileCount = document.getElementById('fileCount');
const prepareMergeBtn = document.getElementById('prepareMergeBtn');
const previewScreen = document.getElementById('previewScreen');
const previewList = document.getElementById('previewList');
const backBtn = document.getElementById('backBtn');
const mergeBtn = document.getElementById('mergeBtn');
const progressScreen = document.getElementById('progressScreen');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const progressDetails = document.getElementById('progressDetails');

// Prerequisites modal elements
const prerequisitesModal = document.getElementById('prerequisitesModal');
const installBtn = document.getElementById('installBtn');
const checkAgainBtn = document.getElementById('checkAgainBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const installProgress = document.getElementById('installProgress');
const installProgressBar = document.getElementById('installProgressBar');
const installProgressText = document.getElementById('installProgressText');
const installResult = document.getElementById('installResult');
const ffmpegStatus = document.getElementById('ffmpegStatus');
const ffprobeStatus = document.getElementById('ffprobeStatus');
const brewStatus = document.getElementById('brewStatus');

// Output destination elements
const outputDestinationPath = document.getElementById('outputDestinationPath');
const selectOutputDestinationBtn = document.getElementById('selectOutputDestinationBtn');
const useDefaultDestinationBtn = document.getElementById('useDefaultDestinationBtn');

// Video file extensions
const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.m4v', '.MP4', '.MOV', '.AVI', '.MKV', '.M4V'];

// Initialize event listeners
selectFilesBtn.addEventListener('click', handleSelectFiles);
selectFolderBtn.addEventListener('click', handleSelectFolder);
prepareMergeBtn.addEventListener('click', handlePrepareMerge);
backBtn.addEventListener('click', handleBack);
mergeBtn.addEventListener('click', handleMerge);

// Output destination listeners
selectOutputDestinationBtn.addEventListener('click', handleSelectOutputDestination);
useDefaultDestinationBtn.addEventListener('click', handleUseDefaultDestination);

// Prerequisites modal listeners
installBtn.addEventListener('click', handleInstallPrerequisites);
checkAgainBtn.addEventListener('click', handleCheckPrerequisites);
closeModalBtn.addEventListener('click', () => {
  prerequisitesModal.style.display = 'none';
});

// Initialize split video modal elements and event listeners
closeSplitModalBtn = document.getElementById('closeSplitModalBtn');
cancelSplitBtn = document.getElementById('cancelSplitBtn');
executeSplitBtn = document.getElementById('executeSplitBtn');

if (closeSplitModalBtn) {
  closeSplitModalBtn.addEventListener('click', closeSplitVideoModal);
}
if (cancelSplitBtn) {
  cancelSplitBtn.addEventListener('click', closeSplitVideoModal);
}
if (executeSplitBtn) {
  executeSplitBtn.addEventListener('click', executeVideoSplit);
}

// Listen for prerequisites missing event
window.electronAPI.onPrerequisitesMissing((event, status) => {
  showPrerequisitesModal(status);
});

// Drag and drop handlers
dropZone.addEventListener('dragover', handleDragOver);
dropZone.addEventListener('dragleave', handleDragLeave);
dropZone.addEventListener('drop', handleDrop);
dropZone.addEventListener('click', () => selectFilesBtn.click());

// File selection handlers
async function handleSelectFiles() {
  try {
    const result = await window.electronAPI.selectFiles();
    if (!result.canceled && result.files.length > 0) {
      addFiles(result.files);
    }
  } catch (error) {
    console.error('Error selecting files:', error);
  }
}

async function handleSelectFolder() {
  try {
    const result = await window.electronAPI.selectFolder();
    if (!result.canceled && result.files.length > 0) {
      addFiles(result.files);
    }
  } catch (error) {
    console.error('Error selecting folder:', error);
  }
}

// Drag and drop handlers
function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove('drag-over');
}

async function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove('drag-over');

  const files = Array.from(e.dataTransfer.files);
  const paths = files.map(file => file.path);

  if (paths.length > 0) {
    try {
      // Send paths to main process to handle folders and filter video files
      const videoFiles = await window.electronAPI.processDroppedPaths(paths);
      if (videoFiles.length > 0) {
        addFiles(videoFiles);
      }
    } catch (error) {
      console.error('Error processing dropped files:', error);
    }
  }
}


// Add files to the list (avoid duplicates)
function addFiles(newFiles) {
  const uniqueFiles = newFiles.filter(file => !selectedFiles.includes(file));
  selectedFiles.push(...uniqueFiles);
  updateFileList();
}

// Remove a file from the list
function removeFile(filePath) {
  selectedFiles = selectedFiles.filter(file => file !== filePath);
  updateFileList();
}

// Update the file list display
async function updateFileList() {
  if (selectedFiles.length === 0) {
    fileListContainer.style.display = 'none';
    prepareMergeBtn.style.display = 'none';
    return;
  }

  fileListContainer.style.display = 'block';
  prepareMergeBtn.style.display = 'block';
  fileCount.textContent = `${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}`;
  fileList.innerHTML = '';

  // Sort files by name for better organization
  const sortedFiles = [...selectedFiles].sort();

  for (const filePath of sortedFiles) {
    const fileItem = await createFileItem(filePath);
    fileList.appendChild(fileItem);
  }
}

// Create a file item element
async function createFileItem(filePath) {
  const item = document.createElement('div');
  item.className = 'file-item';

  const fileName = getFileName(filePath);
  const metadata = await window.electronAPI.getFileMetadata(filePath);

  item.innerHTML = `
    <div class="file-info">
      <div class="file-name">${escapeHtml(fileName)}</div>
      <div class="file-path">${escapeHtml(filePath)}</div>
      ${metadata ? `
        <div class="file-meta">
          <span>Size: ${metadata.sizeFormatted}</span>
          <span>Modified: ${formatDate(metadata.modified)}</span>
        </div>
      ` : ''}
    </div>
    <div class="file-actions">
      <button class="btn-remove" data-file="${escapeHtml(filePath)}">Remove</button>
    </div>
  `;

  // Add remove button handler
  const removeBtn = item.querySelector('.btn-remove');
  removeBtn.addEventListener('click', () => removeFile(filePath));

  return item;
}

// Helper functions
function getFileName(filePath) {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1];
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return 'Unknown';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Handle Prepare Merge button
async function handlePrepareMerge() {
  if (selectedFiles.length === 0) return;
  
  try {
    // Analyze videos and group by session ID
    videoGroups = await window.electronAPI.analyzeVideos(selectedFiles);
    
    if (videoGroups.length === 0) {
      alert('No GoPro video files found. Please select files matching GoPro naming patterns:\n- GX??????.MP4\n- GP??????.MP4\n- GOPR????.MP4');
      return;
    }
    
    // Calculate durations for each group
    let hasDurations = false;
    for (const group of videoGroups) {
      let totalDuration = 0;
      for (const filePath of group.files) {
        try {
          const duration = await window.electronAPI.getVideoDuration(filePath);
          if (duration > 0) {
            hasDurations = true;
          }
          totalDuration += duration;
        } catch (error) {
          console.error(`Error getting duration for ${filePath}:`, error);
        }
      }
      group.totalDuration = totalDuration;
    }
    
    // Warn if no durations were found (likely ffprobe not installed)
    if (!hasDurations && videoGroups.length > 0) {
      console.warn('Could not retrieve video durations. ffprobe may not be installed.');
    }
    
    // Show preview screen
    showPreviewScreen();
  } catch (error) {
    console.error('Error preparing merge:', error);
    alert('Error analyzing videos: ' + error.message);
  }
}

// Show preview screen
function showPreviewScreen() {
  currentScreen = 'preview';
  fileListContainer.style.display = 'none';
  previewScreen.style.display = 'block';
  
  // Reset output destination to default when showing preview
  selectedOutputDestination = null;
  updateOutputDestinationDisplay();
  
  previewList.innerHTML = '';
  
  for (let i = 0; i < videoGroups.length; i++) {
    const group = videoGroups[i];
    const previewItem = createPreviewItem(group, i);
    previewList.appendChild(previewItem);
  }
}

// Create preview item
function createPreviewItem(group, index) {
  const item = document.createElement('div');
  item.className = 'preview-item';
  
  const inputFilesList = group.files.map(f => {
    const name = getFileName(f);
    return `<div class="input-file">${escapeHtml(name)}</div>`;
  }).join('');
  
  item.innerHTML = `
    <div class="preview-item-header">
      <div class="preview-item-info">
        <h3>Session ${group.sessionId}</h3>
        <span class="preview-item-meta">${group.files.length} file${group.files.length !== 1 ? 's' : ''} • ${formatDuration(group.totalDuration)}</span>
      </div>
    </div>
    <div class="preview-item-body">
      <div class="filename-edit">
        <label>Output Filename:</label>
        <input type="text" 
               class="filename-input" 
               data-index="${index}"
               value="${escapeHtml(group.outputFilename)}"
               placeholder="PROCESSED${group.sessionId}.MP4">
        <span class="filename-hint">.MP4</span>
      </div>
      <div class="input-files">
        <label>Input Files:</label>
        <div class="input-files-list">${inputFilesList}</div>
      </div>
    </div>
  `;
  
  // Add input change handler
  const input = item.querySelector('.filename-input');
  input.addEventListener('input', (e) => {
    const value = e.target.value.trim();
    if (value) {
      // Remove .MP4 extension if user added it
      const cleanValue = value.replace(/\.MP4$/i, '');
      videoGroups[index].outputFilename = cleanValue + '.MP4';
    }
  });
  
  // Validate filename on blur
  input.addEventListener('blur', (e) => {
    let value = e.target.value.trim();
    if (!value) {
      value = `PROCESSED${group.sessionId}`;
    }
    // Remove invalid characters and spaces
    value = value.replace(/[^a-zA-Z0-9_\-]/g, '_');
    // Remove .MP4 if present
    value = value.replace(/\.MP4$/i, '');
    videoGroups[index].outputFilename = value + '.MP4';
    e.target.value = value;
  });
  
  return item;
}

// Handle Back button
function handleBack() {
  currentScreen = 'fileList';
  previewScreen.style.display = 'none';
  fileListContainer.style.display = 'block';
}

// Handle output destination selection
async function handleSelectOutputDestination() {
  try {
    const result = await window.electronAPI.selectOutputDestination();
    if (!result.canceled && result.path) {
      selectedOutputDestination = result.path;
      updateOutputDestinationDisplay();
    }
  } catch (error) {
    console.error('Error selecting output destination:', error);
    alert('Error selecting output destination: ' + error.message);
  }
}

// Handle use default destination
function handleUseDefaultDestination() {
  selectedOutputDestination = null;
  updateOutputDestinationDisplay();
}

// Update output destination display
function updateOutputDestinationDisplay() {
  if (selectedOutputDestination) {
    outputDestinationPath.textContent = selectedOutputDestination;
    outputDestinationPath.classList.add('custom-path');
    useDefaultDestinationBtn.style.display = 'inline-block';
  } else {
    outputDestinationPath.textContent = 'Using default location (merged_videos subfolder)';
    outputDestinationPath.classList.remove('custom-path');
    useDefaultDestinationBtn.style.display = 'none';
  }
}

// Handle Merge button
async function handleMerge() {
  if (videoGroups.length === 0) return;
  
  // Validate all filenames
  for (const group of videoGroups) {
    if (!group.outputFilename || !group.outputFilename.trim()) {
      alert('Please provide a filename for all videos.');
      return;
    }
  }
  
  // Get output directory (use custom if selected, otherwise default)
  let outputDir;
  try {
    if (selectedOutputDestination) {
      // Use custom output destination (already ensured to exist by dialog)
      outputDir = selectedOutputDestination;
    } else {
      // Use default (merged_videos subfolder)
      outputDir = await window.electronAPI.getOutputDirectory(videoGroups[0].files[0]);
    }
  } catch (error) {
    alert('Error creating output directory: ' + error.message);
    return;
  }
  
  // Show progress screen
  showProgressScreen();
  
  const results = [];
  let completed = 0;
  
  for (let i = 0; i < videoGroups.length; i++) {
    const group = videoGroups[i];
    const outputPath = outputDir + '/' + group.outputFilename;
    
    updateProgress(i, videoGroups.length, `Merging Session ${group.sessionId}...`);
    
    try {
      await window.electronAPI.mergeVideos(group.files, outputPath);
      results.push({ success: true, sessionId: group.sessionId, outputPath });
      completed++;
      updateProgress(i + 1, videoGroups.length, `Completed Session ${group.sessionId}`);
    } catch (error) {
      console.error(`Error merging session ${group.sessionId}:`, error);
      results.push({ success: false, sessionId: group.sessionId, error: error.message });
      updateProgress(i + 1, videoGroups.length, `Failed Session ${group.sessionId}`);
    }
  }
  
  updateProgress(videoGroups.length, videoGroups.length, 'All videos processed');
  
  // Show results
  showMergeResults(results, outputDir);
}

// Show progress screen
function showProgressScreen() {
  currentScreen = 'progress';
  previewScreen.style.display = 'none';
  progressScreen.style.display = 'block';
  progressBar.style.width = '0%';
}

// Update progress
function updateProgress(current, total, message) {
  const percentage = Math.min((current / total) * 100, 100);
  progressBar.style.width = `${percentage}%`;
  progressText.textContent = message;
  
  const details = [];
  for (let i = 0; i < current && i < videoGroups.length; i++) {
    const status = i < current - 1 ? '✓' : '⏳';
    details.push(`${status} Session ${videoGroups[i].sessionId}`);
  }
  if (details.length > 0) {
    progressDetails.innerHTML = details.join('<br>');
  }
}

// Show merge results
function showMergeResults(results, outputDir) {
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  let resultsHtml = `
    <h3>Merge Complete!</h3>
    <p><strong>${successCount}</strong> video${successCount !== 1 ? 's' : ''} merged successfully</p>
  `;
  
  if (failCount > 0) {
    resultsHtml += `<p><strong>${failCount}</strong> failed</p>`;
  }
  
  resultsHtml += `
    <div class="results-list">
      <h4>Results:</h4>
  `;
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.success) {
      const filename = getFileName(result.outputPath);
      resultsHtml += `
        <div class="result-item success">
          <span>✓ ${escapeHtml(filename)}</span>
          <button class="btn-split-video" data-index="${i}" data-video-path="${escapeHtml(result.outputPath)}" data-video-name="${escapeHtml(filename)}">
            ✂️ Split
          </button>
        </div>
      `;
    } else {
      resultsHtml += `<div class="result-item error">✗ Session ${result.sessionId}: ${escapeHtml(result.error)}</div>`;
    }
  }
  
  resultsHtml += `
    </div>
    <div class="results-actions">
      <button id="openFolderBtn" class="btn btn-primary">Open Output Folder</button>
      <button id="newMergeBtn" class="btn btn-secondary">Start New Merge</button>
    </div>
  `;
  
  progressDetails.innerHTML = resultsHtml;
  
  // Add event listeners
  const openFolderBtn = document.getElementById('openFolderBtn');
  if (openFolderBtn) {
    openFolderBtn.addEventListener('click', async () => {
      try {
        await window.electronAPI.openFolder(outputDir);
      } catch (error) {
        alert(`Output folder: ${outputDir}`);
      }
    });
  }
  
  document.getElementById('newMergeBtn').addEventListener('click', () => {
    selectedFiles = [];
    videoGroups = [];
    currentScreen = 'fileList';
    progressScreen.style.display = 'none';
    fileListContainer.style.display = 'none';
    updateFileList();
  });

  // Add event listeners for split video buttons
  document.querySelectorAll('.btn-split-video').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const videoPath = e.target.getAttribute('data-video-path');
      const videoName = e.target.getAttribute('data-video-name');
      showSplitVideoModal(videoPath, videoName, outputDir);
    });
  });
}

// Store merge results for split modal
let currentMergeResults = null;
let currentOutputDir = null;

// Show split video modal
async function showSplitVideoModal(videoPath, videoName, outputDir) {
  const modal = document.getElementById('splitVideoModal');
  const videoNameEl = document.getElementById('splitVideoName');
  const videoDurationEl = document.getElementById('splitVideoDuration');
  const segmentMinutesEl = document.getElementById('segmentMinutes');
  const splitPreviewEl = document.getElementById('splitPreview');
  const executeBtn = document.getElementById('executeSplitBtn');
  const cancelBtn = document.getElementById('cancelSplitBtn');
  
  // Reset modal state
  segmentMinutesEl.value = '20';
  splitPreviewEl.textContent = 'Calculating...';
  executeBtn.disabled = false;
  executeBtn.style.display = 'inline-flex';
  cancelBtn.disabled = false;
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = closeSplitVideoModal;
  document.getElementById('splitProgress').style.display = 'none';
  document.getElementById('splitResult').style.display = 'none';
  
  videoNameEl.textContent = videoName;
  videoDurationEl.textContent = 'Loading...';
  
  // Get video duration
  try {
    const duration = await window.electronAPI.getVideoDuration(videoPath);
    videoDurationEl.textContent = formatDuration(duration);
    
    // Store for use in split handler
    modal.dataset.videoPath = videoPath;
    modal.dataset.videoDuration = duration;
    modal.dataset.outputDir = outputDir;
    
    // Update preview function
    const updatePreview = () => {
      const minutes = parseInt(segmentMinutesEl.value) || 20;
      if (minutes < 1) {
        splitPreviewEl.textContent = 'Please enter a duration of at least 1 minute';
        return;
      }
      const segmentSeconds = minutes * 60;
      const totalSeconds = duration;
      const numSegments = Math.ceil(totalSeconds / segmentSeconds);
      splitPreviewEl.textContent = `Will create ${numSegments} segment${numSegments !== 1 ? 's' : ''} of ${minutes} minute${minutes !== 1 ? 's' : ''} each`;
    };
    
    // Remove existing listener if any, then add new one
    const newSegmentMinutesEl = segmentMinutesEl.cloneNode(true);
    segmentMinutesEl.parentNode.replaceChild(newSegmentMinutesEl, segmentMinutesEl);
    newSegmentMinutesEl.addEventListener('input', updatePreview);
    updatePreview();
    
  } catch (error) {
    videoDurationEl.textContent = 'Unable to determine duration';
    console.error('Error getting video duration:', error);
    splitPreviewEl.textContent = 'Unable to calculate preview';
  }
  
  modal.style.display = 'flex';
}

// Close split modal
function closeSplitVideoModal() {
  document.getElementById('splitVideoModal').style.display = 'none';
  document.getElementById('splitProgress').style.display = 'none';
  document.getElementById('splitResult').style.display = 'none';
}

// Execute video split
async function executeVideoSplit() {
  const modal = document.getElementById('splitVideoModal');
  const videoPath = modal.dataset.videoPath;
  const totalDuration = parseFloat(modal.dataset.videoDuration);
  const outputDir = modal.dataset.outputDir;
  const segmentMinutes = parseInt(document.getElementById('segmentMinutes').value) || 20;
  const segmentSeconds = segmentMinutes * 60;
  
  // Calculate splits
  const splits = [];
  let currentTime = 0;
  let segmentNum = 1;
  
  while (currentTime < totalDuration) {
    const remaining = totalDuration - currentTime;
    const duration = Math.min(segmentSeconds, remaining);
    
    // Get base filename without extension
    const baseName = getFileName(videoPath).replace(/\.MP4$/i, '');
    const segmentFilename = `${baseName}_part${segmentNum.toString().padStart(2, '0')}.MP4`;
    
    splits.push({
      startTime: currentTime,
      duration: duration,
      filename: segmentFilename
    });
    
    currentTime += duration;
    segmentNum++;
  }
  
  // Show progress
  const progressDiv = document.getElementById('splitProgress');
  const progressBar = document.getElementById('splitProgressBar');
  const progressText = document.getElementById('splitProgressText');
  const resultDiv = document.getElementById('splitResult');
  const executeBtn = document.getElementById('executeSplitBtn');
  const cancelBtn = document.getElementById('cancelSplitBtn');
  
  executeBtn.disabled = true;
  cancelBtn.disabled = true;
  progressDiv.style.display = 'block';
  resultDiv.style.display = 'none';
  progressBar.style.width = '0%';
  progressText.textContent = `Splitting into ${splits.length} segments...`;
  
  // Create split output directory (use path separator for cross-platform)
  const pathParts = outputDir.split(/[\/\\]/);
  pathParts.push('split_videos');
  const splitOutputDir = pathParts.join('/');
  
  try {
    const result = await window.electronAPI.splitVideo(videoPath, splits, splitOutputDir);
    
    if (result.success) {
      progressBar.style.width = '100%';
      progressText.textContent = 'Split complete!';
      
      const successCount = result.results.filter(r => r.success).length;
      resultDiv.className = 'split-result success';
      resultDiv.innerHTML = `
        <p>✓ Successfully created ${successCount} of ${splits.length} segment${splits.length !== 1 ? 's' : ''}</p>
        <p>Output location: ${splitOutputDir}</p>
      `;
      resultDiv.style.display = 'block';
      
      // Update buttons
      executeBtn.style.display = 'none';
      cancelBtn.textContent = 'Close';
      cancelBtn.disabled = false;
      cancelBtn.onclick = () => {
        closeSplitVideoModal();
        // Optionally open the split output folder
        window.electronAPI.openFolder(splitOutputDir);
      };
    } else {
      throw new Error('Split failed');
    }
  } catch (error) {
    progressBar.style.width = '100%';
    progressText.textContent = 'Split failed!';
    resultDiv.className = 'split-result error';
    resultDiv.innerHTML = `<p>✗ Error: ${escapeHtml(error.message)}</p>`;
    resultDiv.style.display = 'block';
    executeBtn.disabled = false;
    cancelBtn.disabled = false;
  }
}

// Prerequisites functions
function showPrerequisitesModal(status) {
  // Update status icons
  ffmpegStatus.textContent = status.ffmpegFound ? '✓' : '❌';
  ffmpegStatus.className = 'status-icon ' + (status.ffmpegFound ? 'success' : 'error');
  
  ffprobeStatus.textContent = status.ffprobeFound ? '✓' : '❌';
  ffprobeStatus.className = 'status-icon ' + (status.ffprobeFound ? 'success' : 'error');
  
  brewStatus.textContent = status.brewFound ? '✓' : '❌';
  brewStatus.className = 'status-icon ' + (status.brewFound ? 'success' : 'error');
  
  // Show/hide install button based on Homebrew availability
  if (!status.brewFound) {
    installBtn.style.display = 'none';
    installBtn.parentElement.querySelector('p').textContent = 'Homebrew is required to install ffmpeg. Please install Homebrew first from https://brew.sh';
  } else {
    installBtn.style.display = 'inline-flex';
  }
  
  // Reset UI state
  installProgress.style.display = 'none';
  installResult.style.display = 'none';
  checkAgainBtn.style.display = 'none';
  installBtn.disabled = false;
  
  prerequisitesModal.style.display = 'flex';
}

async function handleCheckPrerequisites() {
  try {
    const status = await window.electronAPI.checkFFmpeg();
    if (status.installed) {
      installResult.innerHTML = '<div class="result-item success">✓ All prerequisites are installed!</div>';
      installResult.style.display = 'block';
      setTimeout(() => {
        prerequisitesModal.style.display = 'none';
      }, 2000);
    } else {
      showPrerequisitesModal(status);
    }
  } catch (error) {
    console.error('Error checking prerequisites:', error);
  }
}

async function handleInstallPrerequisites() {
  installBtn.disabled = true;
  installProgress.style.display = 'block';
  installProgressBar.style.width = '0%';
  installProgressText.textContent = 'Starting installation...';
  installResult.style.display = 'none';
  
  try {
    // Simulate progress (since we can't easily track brew install progress)
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 2;
      if (progress < 90) {
        installProgressBar.style.width = `${progress}%`;
        installProgressText.textContent = 'Installing ffmpeg... This may take a few minutes.';
      }
    }, 500);
    
    const result = await window.electronAPI.installPrerequisites();
    
    clearInterval(progressInterval);
    installProgressBar.style.width = '100%';
    
    if (result.success) {
      installProgressText.textContent = 'Installation complete!';
      installResult.innerHTML = `
        <div class="result-item success">
          ✓ ${result.message}
          ${result.version ? `<br>Installed version: ${result.version}` : ''}
        </div>
      `;
      installResult.style.display = 'block';
      checkAgainBtn.style.display = 'inline-flex';
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        handleCheckPrerequisites();
      }, 3000);
    } else {
      installProgressText.textContent = 'Installation failed';
      installResult.innerHTML = `
        <div class="result-item error">
          ✗ ${result.message}
          ${result.needsHomebrew ? '<br><br>Please install Homebrew first from <a href="https://brew.sh" target="_blank">brew.sh</a>' : ''}
        </div>
      `;
      installResult.style.display = 'block';
      installBtn.disabled = false;
      checkAgainBtn.style.display = 'inline-flex';
    }
  } catch (error) {
    clearInterval(progressInterval);
    installProgressText.textContent = 'Installation error';
    installResult.innerHTML = `<div class="result-item error">✗ Error: ${error.message}</div>`;
    installResult.style.display = 'block';
    installBtn.disabled = false;
  }
}


