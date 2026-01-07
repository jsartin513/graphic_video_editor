// Video merging workflow functionality

import { getFileName, escapeHtml, formatDuration, getDirectoryName } from './utils.js';

export function initializeMergeWorkflow(state, domElements, fileHandling, splitVideo) {
  const {
    prepareMergeBtn,
    previewScreen,
    previewList,
    backBtn,
    mergeBtn,
    fileListContainer,
    dropZone,
    progressScreen,
    progressBar,
    progressText,
    progressDetails,
    outputDestinationPath,
    selectOutputDestinationBtn,
    useDefaultDestinationBtn
  } = domElements;

  // Load preferences on initialization
  let userPreferences = null;
  async function loadUserPreferences() {
    try {
      userPreferences = await window.electronAPI.loadPreferences();
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  }
  
  // Initialize preferences
  loadUserPreferences();

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
      // Map error and show user-friendly dialog
      const mappedError = await window.electronAPI.mapError(error.message || String(error));
      showErrorDialog(mappedError);
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
    
    // Check if we have multiple directories (for display purposes)
    const directories = new Set(state.videoGroups.map(g => {
      let dir = '';
      if (g.directory) {
        dir = g.directory;
      } else if (g.files.length > 0) {
        const parts = g.files[0].split(/[/\\]/);
        dir = parts.slice(0, -1).join('/'); // All parts except filename
      }
      // Normalize path separators so Set comparison is consistent across platforms
      return dir.replace(/\\/g, '/');
    }));
    const hasMultipleDirectories = directories.size > 1;
    
    previewList.innerHTML = '';
    
    for (let i = 0; i < state.videoGroups.length; i++) {
      const group = state.videoGroups[i];
      const previewItem = createPreviewItem(group, i, hasMultipleDirectories);
      previewList.appendChild(previewItem);
    }
  }

  // Create preview item
  function createPreviewItem(group, index, showDirectory = false) {
    const item = document.createElement('div');
    item.className = 'preview-item';
    
    const inputFilesList = group.files.map(f => {
      const name = getFileName(f);
      return `<div class="input-file">${escapeHtml(name)}</div>`;
    }).join('');

    // Get directory name for display (use group.directory if available, otherwise extract from first file)
    let directoryName = '';
    if (showDirectory) {
      if (group.directory) {
        // Extract just the directory name from the full path, ignoring empty segments
        const parts = group.directory.split(/[/\\]/).filter(Boolean);
        if (parts.length > 0) {
          directoryName = parts[parts.length - 1];
        } else {
          // Handle root or otherwise ambiguous directories with a short, friendly label
          directoryName = 'root';
        }
      } else if (group.files.length > 0) {
        directoryName = getDirectoryName(group.files[0]);
      }
    }
    const directoryDisplay = directoryName ? `<span class="preview-item-directory">📁 ${escapeHtml(directoryName)}</span>` : '';
    
    // Create recent patterns dropdown
    let patternsDatalist = '';
    if (userPreferences && userPreferences.recentFilenamePatterns && userPreferences.recentFilenamePatterns.length > 0) {
      const datalistId = `patterns-${index}`;
      const options = userPreferences.recentFilenamePatterns.map(pattern => 
        `<option value="${escapeHtml(pattern.replace(/\.MP4$/i, ''))}">`
      ).join('');
      patternsDatalist = `<datalist id="${datalistId}">${options}</datalist>`;
    }
    
    item.innerHTML = `
      <div class="preview-item-header">
        <div class="preview-item-info">
          <h3>Session ${group.sessionId} ${directoryDisplay}</h3>
          <span class="preview-item-meta">${group.files.length} file${group.files.length !== 1 ? 's' : ''} • ${formatDuration(group.totalDuration)}</span>
        </div>
      </div>
      <div class="preview-item-body">
        <div class="filename-edit">
          <label>Output Filename:</label>
          <div class="filename-input-container">
            <input type="text" 
                   class="filename-input" 
                   data-index="${index}"
                   list="patterns-${index}"
                   value="${escapeHtml(group.outputFilename)}"
                   placeholder="PROCESSED${group.sessionId}.MP4">
            ${patternsDatalist}
            <span class="filename-hint">.MP4</span>
          </div>
          <div class="filename-help">
            <small>💡 Use date tokens: {date}, {year}, {month}, {day}</small>
          </div>
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
    
    // Validate filename on blur and apply date tokens
    input.addEventListener('blur', async (e) => {
      let value = e.target.value.trim();
      if (!value) {
        value = `PROCESSED${group.sessionId}`;
      }
      // Remove .MP4 if present
      value = value.replace(/\.MP4$/i, '');
      
      // Store the original pattern before token replacement for preferences
      const originalPattern = value;
      
      // Apply date tokens if any
      if (value.includes('{')) {
        try {
          const dateFormat = userPreferences?.preferredDateFormat || 'YYYY-MM-DD';
          const result = await window.electronAPI.applyDateTokens(value, null, dateFormat);
          if (result && result.result) {
            value = result.result;
          }
        } catch (error) {
          console.error('Error applying date tokens:', error);
        }
      }
      
      // Remove invalid characters but preserve hyphens and underscores
      // This happens after date token replacement to preserve date formatting
      value = value.replace(/[^a-zA-Z0-9_\-]/g, '_');
      state.videoGroups[index].outputFilename = value + '.MP4';
      e.target.value = value;
      
      // Save the original pattern (with tokens) to preferences, not the replaced value
      // This allows users to reuse patterns with date tokens
      try {
        await window.electronAPI.saveFilenamePattern(originalPattern);
        // Reload preferences to get updated list
        await loadUserPreferences();
      } catch (error) {
        console.error('Error saving pattern:', error);
      }
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
      const mappedError = await window.electronAPI.mapError(error.message || String(error));
      showErrorDialog(mappedError);
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
      const mappedError = await window.electronAPI.mapError(error.message || String(error));
      showErrorDialog(mappedError);
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
    const totalCount = results.length;
    
    // Update progress screen title to show completion
    const progressTitle = document.querySelector('.progress-content h2');
    if (progressTitle) {
      progressTitle.textContent = failCount === 0 ? '✓ Merge Complete!' : 'Merge Finished';
    }
    
    // Update progress bar to 100%
    progressBar.style.width = '100%';
    progressText.textContent = failCount === 0 
      ? `Successfully merged ${successCount} video${successCount !== 1 ? 's' : ''}` 
      : `Completed: ${successCount} succeeded, ${failCount} failed`;
    
    // Build results HTML with improved design
    let resultsHtml = `
      <div class="completion-summary">
        <div class="completion-icon" role="img" aria-label="${failCount === 0 ? 'Success' : 'Warning'}">${failCount === 0 ? '✅' : '⚠️'}</div>
        <h3 class="completion-title">${failCount === 0 ? 'Workflow Complete!' : 'Merge Finished'}</h3>
        <p class="completion-description">
          ${failCount === 0 
            ? `All ${successCount} video${successCount !== 1 ? 's were' : ' was'} merged successfully and saved to the output folder.`
            : `${successCount} of ${totalCount} video${totalCount !== 1 ? 's' : ''} merged successfully. ${failCount} failed.`
          }
        </p>
      </div>
      
      <div class="results-section">
        <div class="results-summary">
          <div class="summary-stat">
            <span class="stat-value">${successCount}</span>
            <span class="stat-label">Succeeded</span>
          </div>
          ${failCount > 0 ? `
          <div class="summary-stat error-stat">
            <span class="stat-value">${failCount}</span>
            <span class="stat-label">Failed</span>
          </div>
          ` : ''}
          <div class="summary-stat">
            <span class="stat-value">${totalCount}</span>
            <span class="stat-label">Total</span>
          </div>
        </div>
        
        <div class="output-location">
          <div class="location-label">Output Location:</div>
          <div class="location-path">${escapeHtml(outputDir)}</div>
        </div>
        
        ${successCount > 0 ? `
        <div class="results-list">
          <h4>Merged Videos:</h4>
          <div class="result-items">
        ` : ''}
    `;
    
    // Add successful results with split buttons
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.success) {
        const filename = getFileName(result.outputPath);
        resultsHtml += `
          <div class="result-item success">
            <span class="result-icon">✓</span>
            <span class="result-name">${escapeHtml(filename)}</span>
            <button class="btn-split-video" data-index="${i}" data-video-path="${escapeHtml(result.outputPath)}" data-video-name="${escapeHtml(filename)}">
              ✂️ Split
            </button>
          </div>
        `;
      }
    }
    
    if (successCount > 0) {
      resultsHtml += `</div></div>`;
    }
    
    // Add failed results if any
    if (failCount > 0) {
      resultsHtml += `
        <div class="results-list error-list">
          <h4>Failed Merges:</h4>
          <div class="result-items">
      `;
      
      for (const result of results) {
        if (!result.success) {
          resultsHtml += `
            <div class="result-item error">
              <span class="result-icon">✗</span>
              <span class="result-name">Session ${result.sessionId}: ${escapeHtml(result.error)}</span>
            </div>
          `;
        }
      }
      
      resultsHtml += `</div></div>`;
    }
    
    resultsHtml += `
      </div>
      
      <div class="results-actions">
        <button id="openFolderBtn" class="btn btn-primary btn-large">
          <span class="btn-icon">📂</span>
          View Files in Finder
        </button>
        <button id="newMergeBtn" class="btn btn-secondary btn-large">
          <span class="btn-icon">➕</span>
          Merge More Videos
        </button>
      </div>
    `;
    
    progressDetails.innerHTML = resultsHtml;
    progressDetails.classList.add('completion-results');
    
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
    
    const newMergeBtn = document.getElementById('newMergeBtn');
    if (newMergeBtn) {
      newMergeBtn.addEventListener('click', () => {
        state.selectedFiles = [];
        state.videoGroups = [];
        state.currentScreen = 'fileList';
        progressScreen.style.display = 'none';
        fileListContainer.style.display = 'none';
        dropZone.style.display = 'block';
        
        // Reset progress screen
        progressBar.style.width = '0%';
        progressText.textContent = 'Preparing...';
        progressDetails.innerHTML = '';
        progressDetails.classList.remove('completion-results');
        
        const progressTitle = document.querySelector('.progress-content h2');
        if (progressTitle) {
          progressTitle.textContent = 'Merging Videos';
        }
        
        fileHandling.updateFileList();
      });
    }

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

