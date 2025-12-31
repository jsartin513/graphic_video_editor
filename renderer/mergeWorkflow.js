// Video merging workflow functionality

import { getFileName, escapeHtml, formatDuration } from './utils.js';

export function initializeMergeWorkflow(state, domElements, fileHandling, splitVideo) {
  const {
    prepareMergeBtn,
    previewScreen,
    previewList,
    backBtn,
    mergeBtn,
    fileListContainer,
    progressScreen,
    progressBar,
    progressText,
    progressDetails,
    outputDestinationPath,
    selectOutputDestinationBtn,
    useDefaultDestinationBtn
  } = domElements;

  // Handle Prepare Merge button
  async function handlePrepareMerge() {
    if (state.selectedFiles.length === 0) return;
    
    try {
      // Analyze videos and group by session ID
      state.videoGroups = await window.electronAPI.analyzeVideos(state.selectedFiles);
      
      if (state.videoGroups.length === 0) {
        alert('No GoPro video files found. Please select files matching GoPro naming patterns:\n- GX??????.MP4\n- GP??????.MP4\n- GOPR????.MP4');
        return;
      }
      
      // Calculate durations for each group
      let hasDurations = false;
      for (const group of state.videoGroups) {
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
      if (!hasDurations && state.videoGroups.length > 0) {
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
    state.currentScreen = 'preview';
    fileListContainer.style.display = 'none';
    previewScreen.style.display = 'block';
    
    // Reset output destination to default when showing preview
    state.selectedOutputDestination = null;
    updateOutputDestinationDisplay();
    
    previewList.innerHTML = '';
    
    for (let i = 0; i < state.videoGroups.length; i++) {
      const group = state.videoGroups[i];
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
        state.videoGroups[index].outputFilename = cleanValue + '.MP4';
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
      state.videoGroups[index].outputFilename = value + '.MP4';
      e.target.value = value;
    });
    
    return item;
  }

  // Handle Back button
  function handleBack() {
    state.currentScreen = 'fileList';
    previewScreen.style.display = 'none';
    fileListContainer.style.display = 'block';
  }

  // Handle output destination selection
  async function handleSelectOutputDestination() {
    try {
      const result = await window.electronAPI.selectOutputDestination();
      if (!result.canceled && result.path) {
        state.selectedOutputDestination = result.path;
        updateOutputDestinationDisplay();
      }
    } catch (error) {
      console.error('Error selecting output destination:', error);
      alert('Error selecting output destination: ' + error.message);
    }
  }

  // Handle use default destination
  function handleUseDefaultDestination() {
    state.selectedOutputDestination = null;
    updateOutputDestinationDisplay();
  }

  // Update output destination display
  function updateOutputDestinationDisplay() {
    if (state.selectedOutputDestination) {
      outputDestinationPath.textContent = state.selectedOutputDestination;
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
    if (state.videoGroups.length === 0) return;
    
    // Validate all filenames
    for (const group of state.videoGroups) {
      if (!group.outputFilename || !group.outputFilename.trim()) {
        alert('Please provide a filename for all videos.');
        return;
      }
    }
    
    // Get output directory (use custom if selected, otherwise default)
    let outputDir;
    try {
      if (state.selectedOutputDestination) {
        // Use custom output destination (already ensured to exist by dialog)
        outputDir = state.selectedOutputDestination;
      } else {
        // Use default (merged_videos subfolder)
        outputDir = await window.electronAPI.getOutputDirectory(state.videoGroups[0].files[0]);
      }
    } catch (error) {
      alert('Error creating output directory: ' + error.message);
      return;
    }
    
    // Show progress screen
    showProgressScreen();
    
    const results = [];
    let completed = 0;
    
    for (let i = 0; i < state.videoGroups.length; i++) {
      const group = state.videoGroups[i];
      const outputPath = outputDir + '/' + group.outputFilename;
      
      updateProgress(i, state.videoGroups.length, `Merging Session ${group.sessionId}...`);
      
      try {
        await window.electronAPI.mergeVideos(group.files, outputPath);
        results.push({ success: true, sessionId: group.sessionId, outputPath });
        completed++;
        updateProgress(i + 1, state.videoGroups.length, `Completed Session ${group.sessionId}`);
      } catch (error) {
        console.error(`Error merging session ${group.sessionId}:`, error);
        results.push({ success: false, sessionId: group.sessionId, error: error.message });
        updateProgress(i + 1, state.videoGroups.length, `Failed Session ${group.sessionId}`);
      }
    }
    
    updateProgress(state.videoGroups.length, state.videoGroups.length, 'All videos processed');
    
    // Show results
    showMergeResults(results, outputDir);
  }

  // Show progress screen
  function showProgressScreen() {
    state.currentScreen = 'progress';
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
    for (let i = 0; i < current && i < state.videoGroups.length; i++) {
      const status = i < current - 1 ? '✓' : '⏳';
      details.push(`${status} Session ${state.videoGroups[i].sessionId}`);
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
      state.selectedFiles = [];
      state.videoGroups = [];
      state.currentScreen = 'fileList';
      progressScreen.style.display = 'none';
      fileListContainer.style.display = 'none';
      fileHandling.updateFileList();
    });

    // Add event listeners for split video buttons
    document.querySelectorAll('.btn-split-video').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const videoPath = e.target.getAttribute('data-video-path');
        const videoName = e.target.getAttribute('data-video-name');
        splitVideo.showSplitVideoModal(videoPath, videoName, outputDir);
      });
    });
  }

  // Attach event listeners
  prepareMergeBtn.addEventListener('click', handlePrepareMerge);
  backBtn.addEventListener('click', handleBack);
  mergeBtn.addEventListener('click', handleMerge);
  selectOutputDestinationBtn.addEventListener('click', handleSelectOutputDestination);
  useDefaultDestinationBtn.addEventListener('click', handleUseDefaultDestination);

  return { updateOutputDestinationDisplay };
}

