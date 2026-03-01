// Video merging workflow functionality

import { getFileName, escapeHtml, escapeAttr, formatDuration, getDirectoryName } from './utils.js';

export function initializeMergeWorkflow(state, domElements, fileHandling, loadSplitVideoModule, trimVideo, failedOperations) {
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
      if (userPreferences && userPreferences.preferredQuality) {
        selectedQuality = userPreferences.preferredQuality;
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  }
  
  // Initialize preferences
  loadUserPreferences();
  
  // Quality selection state
  let selectedQuality = 'copy'; // Default to copy (fastest)

  // Handle Prepare Merge button
  async function handlePrepareMerge() {
    if (state.selectedFiles.length === 0) return;
    
    try {
      // Ensure preferences are loaded before applying export settings
      await loadUserPreferences();

      // Analyze videos and group by session ID
      state.videoGroups = await window.electronAPI.analyzeVideos(state.selectedFiles);
      
      if (state.videoGroups.length === 0) {
        alert('No GoPro video files found. Please select files matching GoPro naming patterns:\n- GX??????.MP4\n- GP??????.MP4\n- GOPR????.MP4');
        return;
      }
      
      // Calculate durations and file sizes for each group
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
        
        // Calculate total input file size
        try {
          const sizeData = await window.electronAPI.getTotalFileSize(group.files);
          group.totalInputSize = sizeData.totalBytes;
          group.totalInputSizeFormatted = sizeData.totalSizeFormatted;
          
          // Estimate output size: For `-c copy`, output size is roughly the sum of input sizes
          // (may be slightly different due to container overhead, but close enough for estimation)
          group.estimatedOutputSize = sizeData.totalBytes;
          group.estimatedOutputSizeFormatted = sizeData.totalSizeFormatted;
        } catch (error) {
          console.error(`Error getting file sizes for group ${group.sessionId}:`, error);
          group.totalInputSize = 0;
          group.totalInputSizeFormatted = 'Unknown';
          group.estimatedOutputSize = 0;
          group.estimatedOutputSizeFormatted = 'Unknown';
        }
      }
      
      // Warn if no durations were found (likely ffprobe not installed)
      if (!hasDurations && state.videoGroups.length > 0) {
        console.warn('Could not retrieve video durations. ffprobe may not be installed.');
      }
      
      // Show preview screen
      showPreviewScreen();
      
      // Load and set quality preference
      if (userPreferences && userPreferences.preferredQuality) {
        const qualitySelect = document.getElementById('qualitySelect');
        if (qualitySelect) {
          qualitySelect.value = userPreferences.preferredQuality;
          selectedQuality = userPreferences.preferredQuality;
        }
      }
    } catch (error) {
      console.error('Error preparing merge:', error);
      alert('Error analyzing videos: ' + error.message);
    }
  }

  // Track whether multiple directories are present (used by renderPreviewList)
  let hasMultipleDirectories = false;

  // Render (or re-render) the preview list, preserving current selections
  function renderPreviewList() {
    // Save selected groups by sessionId so selections survive a reorder
    const selectedSessions = new Set(
      Array.from(state.selectedGroups)
        .map(i => state.videoGroups[i]?.sessionId)
        .filter(id => id !== undefined)
    );

    previewList.innerHTML = '';
    state.selectedGroups.clear();

    for (let i = 0; i < state.videoGroups.length; i++) {
      const group = state.videoGroups[i];
      if (selectedSessions.has(group.sessionId)) {
        state.selectedGroups.add(i);
      }
      const previewItem = createPreviewItem(group, i, hasMultipleDirectories);
      previewList.appendChild(previewItem);
    }

    updateBatchControls();
  }

  // Show preview screen
  function showPreviewScreen() {
    state.currentScreen = 'preview';
    fileListContainer.style.display = 'none';
    previewScreen.style.display = 'block';
    
    // Load saved output destination preference
    if (userPreferences && userPreferences.lastOutputDestination) {
      state.selectedOutputDestination = userPreferences.lastOutputDestination;
    } else {
      state.selectedOutputDestination = null;
    }
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
    hasMultipleDirectories = directories.size > 1;

    // Initialize all groups as selected by default
    state.selectedGroups.clear();
    for (let i = 0; i < state.videoGroups.length; i++) {
      state.selectedGroups.add(i);
    }

    renderPreviewList();
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
    
    // Make item draggable for reordering
    item.draggable = true;
    item.dataset.index = index;
    
    item.innerHTML = `
      <div class="preview-item-header">
        <label class="preview-item-checkbox-label">
          <input type="checkbox" 
                 class="preview-item-checkbox" 
                 data-index="${index}"
                 ${state.selectedGroups.has(index) ? 'checked' : ''}
                 aria-label="Select Session ${group.sessionId} for batch merge">
          <div class="preview-item-info">
            <h3>Session ${group.sessionId} ${directoryDisplay}</h3>
            <span class="preview-item-meta">
              ${group.files.length} file${group.files.length !== 1 ? 's' : ''} • ${formatDuration(group.totalDuration)}
              ${group.totalInputSizeFormatted && group.totalInputSizeFormatted !== 'Unknown' ? ` • Input: ${group.totalInputSizeFormatted}` : ''}
              ${group.estimatedOutputSizeFormatted && group.estimatedOutputSizeFormatted !== 'Unknown' ? ` • Est. Output: ${group.estimatedOutputSizeFormatted}` : ''}
            </span>
          </div>
        </label>
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
    
    // Add checkbox change handler for batch selection
    const checkbox = item.querySelector('.preview-item-checkbox');
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        state.selectedGroups.add(index);
      } else {
        state.selectedGroups.delete(index);
      }
      updateBatchControls();
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

    // Drag-to-reorder event handlers
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
      item.classList.add('dragging');
      state.draggedGroupIndex = index;
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      document.querySelectorAll('.preview-item.drag-over-item').forEach(el => {
        el.classList.remove('drag-over-item');
      });
      delete state.draggedGroupIndex;
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (state.draggedGroupIndex !== undefined && state.draggedGroupIndex !== index) {
        item.classList.add('drag-over-item');
      }
    });

    item.addEventListener('dragleave', (e) => {
      if (!item.contains(e.relatedTarget)) {
        item.classList.remove('drag-over-item');
      }
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      item.classList.remove('drag-over-item');

      if (state.draggedGroupIndex !== undefined && state.draggedGroupIndex !== index) {
        const draggedGroup = state.videoGroups[state.draggedGroupIndex];
        state.videoGroups.splice(state.draggedGroupIndex, 1);
        // Adjust target index if the dragged item was before it (splice shifts indices down by 1)
        const insertIndex = state.draggedGroupIndex < index ? index - 1 : index;
        state.videoGroups.splice(insertIndex, 0, draggedGroup);
        renderPreviewList();
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
        
        // Save the selected output destination to preferences
        try {
          await window.electronAPI.setLastOutputDestination(result.path);
          if (userPreferences) userPreferences.lastOutputDestination = result.path;
        } catch (prefError) {
          console.error('Error saving output destination preference:', prefError);
        }
      }
    } catch (error) {
      console.error('Error selecting output destination:', error);
      alert('Error selecting output destination: ' + error.message);
    }
  }

  // Handle use default destination
  async function handleUseDefaultDestination() {
    state.selectedOutputDestination = null;
    updateOutputDestinationDisplay();
    
    // Clear the saved output destination preference
    try {
      await window.electronAPI.setLastOutputDestination(null);
      if (userPreferences) userPreferences.lastOutputDestination = null;
    } catch (error) {
      console.error('Error clearing output destination preference:', error);
    }
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

  // Handle Merge button (merge all groups)
  async function handleMerge() {
    // Merge all groups
    await handleBatchMerge(Array.from({ length: state.videoGroups.length }, (_, i) => i));
  }
  
  // Apply date tokens and update state from DOM (ensures tokens are resolved even if Merge clicked while cursor still in input)
  async function syncAndApplyTokensFromInputs(indicesToMerge) {
    for (const index of indicesToMerge) {
      const input = document.querySelector(`.filename-input[data-index="${index}"]`);
      const group = state.videoGroups[index];
      let value = input ? input.value.trim() : (group.outputFilename || '').replace(/\.MP4$/i, '');
      if (!value) value = `PROCESSED${group.sessionId}`;
      value = value.replace(/\.MP4$/i, '');

      if (value.includes('{')) {
        try {
          const dateFormat = userPreferences?.preferredDateFormat || 'YYYY-MM-DD';
          const result = await window.electronAPI.applyDateTokens(value, null, dateFormat);
          if (result && result.result) value = result.result;
        } catch (error) {
          console.error('Error applying date tokens:', error);
        }
      }
      value = value.replace(/[^a-zA-Z0-9_\-]/g, '_');
      group.outputFilename = value + '.MP4';
    }
  }

  // Handle Merge Selected button (batch merge)
  async function handleBatchMerge(selectedIndices = null) {
    const indicesToMerge = selectedIndices || Array.from(state.selectedGroups).sort((a, b) => a - b);
    
    if (indicesToMerge.length === 0) {
      alert('Please select at least one video group to merge.');
      return;
    }
    
    // Sync from DOM and apply tokens before validating (handles Merge clicked while cursor still in filename input)
    await syncAndApplyTokensFromInputs(indicesToMerge);
    
    // Validate filenames for selected groups only
    for (const index of indicesToMerge) {
      const group = state.videoGroups[index];
      if (!group.outputFilename || !group.outputFilename.trim()) {
        alert(`Please provide a filename for Session ${group.sessionId}.`);
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
        outputDir = await window.electronAPI.getOutputDirectory(state.videoGroups[indicesToMerge[0]].files[0]);
      }
    } catch (error) {
      alert('Error creating output directory: ' + error.message);
      return;
    }
    
    // Show progress screen
    showProgressScreen();
    
    // Set up real-time progress listener (will be used during merge)
    let currentGroupIndex = 0;
    let currentGroup = null;
    const progressListener = (progressData) => {
      if (currentGroup) {
        updateRealTimeProgress(currentGroupIndex, state.videoGroups.length, currentGroup, progressData);
      }
    };
    window.electronAPI.onMergeProgress(progressListener);
    
    const results = [];
    let completed = 0;
    let failed = 0;
    
    for (let i = 0; i < indicesToMerge.length; i++) {
      const index = indicesToMerge[i];
      const group = state.videoGroups[index];
      const outputPath = `${outputDir.replace(/[/\\]$/, '')}/${group.outputFilename}`;
      currentGroupIndex = i;
      currentGroup = group;
      
      updateProgress(i, indicesToMerge.length, `Merging Session ${group.sessionId}... (${i + 1}/${indicesToMerge.length})`);
      
      try {
        await window.electronAPI.mergeVideos(group.files, outputPath, selectedQuality);
        results.push({ success: true, sessionId: group.sessionId, outputPath });
        completed++;
        updateProgress(i + 1, indicesToMerge.length, `Completed Session ${group.sessionId} (${i + 1}/${indicesToMerge.length})`);
      } catch (error) {
        console.error(`Error merging session ${group.sessionId}:`, error);
        const failedResult = { 
          success: false, 
          sessionId: group.sessionId, 
          error: error.message,
          files: group.files,
          outputPath
        };
        results.push(failedResult);
        
        // Save failed operation for recovery
        try {
          await window.electronAPI.addFailedOperation({
            sessionId: group.sessionId,
            files: group.files,
            outputPath,
            error: error.message,
            timestamp: Date.now()
          });
        } catch (err) {
          console.error('Error saving failed operation:', err);
        }
        failed++;
        updateProgress(i + 1, indicesToMerge.length, `Failed Session ${group.sessionId} (${i + 1}/${indicesToMerge.length})`);
        
        // Stop on error if configured
        if (state.stopOnError) {
          updateProgress(indicesToMerge.length, indicesToMerge.length, `Batch stopped due to error in Session ${group.sessionId}`);
          break;
        }
      }
    }
    
    // Clean up progress listener
    currentGroup = null;
    window.electronAPI.removeMergeProgressListener();
    
    const statusText = failed > 0 
      ? `Batch complete: ${completed} succeeded, ${failed} failed`
      : `All ${completed} videos processed successfully`;
    updateProgress(state.videoGroups.length, state.videoGroups.length, statusText);
    
    // Update failed operations button visibility
    if (failedOperations && failedOperations.updateFailedOperationsButton) {
      failedOperations.updateFailedOperationsButton();
    }
    
    // Show results
    await showMergeResults(results, outputDir);
  }
  
  // Update batch controls based on selection
  function updateBatchControls() {
    const selectedCount = state.selectedGroups.size;
    const totalCount = state.videoGroups.length;
    
    // Update merge button text
    const mergeBtn = document.getElementById('mergeBtn');
    if (mergeBtn) {
      if (selectedCount === totalCount) {
        mergeBtn.textContent = 'Merge All Videos';
      } else if (selectedCount > 0) {
        mergeBtn.textContent = `Merge Selected (${selectedCount})`;
      } else {
        mergeBtn.textContent = 'Merge Videos';
      }
    }
    
    // Show/hide merge selected button
    const mergeSelectedBtn = document.getElementById('mergeSelectedBtn');
    if (mergeSelectedBtn) {
      if (selectedCount > 0 && selectedCount < totalCount) {
        mergeSelectedBtn.style.display = 'inline-flex';
      } else {
        mergeSelectedBtn.style.display = 'none';
      }
    }
  }

  // Show progress screen
  function showProgressScreen() {
    state.currentScreen = 'progress';
    previewScreen.style.display = 'none';
    progressScreen.style.display = 'block';
    progressBar.style.width = '0%';
  }

  // Update progress (group-level)
  function updateProgress(current, total, message) {
    // Base progress: percentage of groups completed
    const basePercentage = Math.min((current / total) * 100, 100);
    progressBar.style.width = `${basePercentage}%`;
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
  
  // Update real-time progress during current merge
  function updateRealTimeProgress(currentGroupIndex, totalGroups, group, progressData) {
    if (!progressData) return;
    
    // Base progress: percentage of groups completed
    const baseProgress = currentGroupIndex / totalGroups;
    
    // Current merge progress: percentage within current group (if we have percent)
    let mergeProgress = 0;
    if (progressData.percent !== null && progressData.percent !== undefined) {
      mergeProgress = progressData.percent / 100;
    }
    
    // Combined progress
    const totalProgress = (baseProgress + (mergeProgress / totalGroups)) * 100;
    progressBar.style.width = `${Math.min(totalProgress, 100)}%`;
    
    // Update progress text with real-time info
    let progressMessage = `Merging Session ${group.sessionId}...`;
    if (progressData.timeStr) {
      progressMessage = `Merging Session ${group.sessionId} (${progressData.timeStr}`;
      if (progressData.totalDuration > 0) {
        const totalHours = Math.floor(progressData.totalDuration / 3600);
        const totalMinutes = Math.floor((progressData.totalDuration % 3600) / 60);
        const totalSeconds = Math.floor(progressData.totalDuration % 60);
        let totalTimeStr;
        if (totalHours > 0) {
          totalTimeStr = `${totalHours}:${totalMinutes.toString().padStart(2, '0')}:${totalSeconds.toString().padStart(2, '0')}`;
        } else {
          totalTimeStr = `${totalMinutes}:${totalSeconds.toString().padStart(2, '0')}`;
        }
        progressMessage += ` / ${totalTimeStr}`;
        
        if (progressData.percent !== null) {
          progressMessage += ` - ${Math.round(progressData.percent)}%`;
        }
        
        if (progressData.etaStr) {
          progressMessage += ` - ETA: ${progressData.etaStr}`;
        }
      }
      progressMessage += ')';
    }
    progressText.textContent = progressMessage;
  }

  const MIN_DURATION_FOR_SPLIT_SECONDS = 40 * 60; // 40 minutes

  // Show merge results
  async function showMergeResults(results, outputDir) {
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
    
    // Fetch duration for each successful result (to decide whether to show Split button)
    const durationsByIndex = new Map();
    const durationPromises = results.map((result, index) => {
      if (!result.success) {
        return Promise.resolve(null);
      }
      return window.electronAPI
        .getVideoDuration(result.outputPath)
        .then((dur) => ({ index, duration: dur }))
        .catch(() => ({ index, duration: null }));
    });
    const settledDurations = await Promise.allSettled(durationPromises);
    for (const settled of settledDurations) {
      if (settled.status === 'fulfilled' && settled.value !== null && settled.value.duration !== null) {
        const { index, duration } = settled.value;
        durationsByIndex.set(index, duration);
      }
    }
    
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
    
    // Add successful results with split and trim buttons (split only if video is at least 40 minutes)
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.success) {
        const filename = getFileName(result.outputPath);
        const durationSeconds = durationsByIndex.get(i) ?? 0;
        const showSplitBtn = durationSeconds >= MIN_DURATION_FOR_SPLIT_SECONDS;
        resultsHtml += `
          <div class="result-item success">
            <span class="result-icon">✓</span>
            <span class="result-name">${escapeHtml(filename)}</span>
            <button class="btn-trim-video" data-index="${i}" data-video-path="${escapeAttr(result.outputPath)}" data-video-name="${escapeAttr(filename)}">
              ✂️ Trim
            </button>
            ${showSplitBtn ? `<button class="btn-split-video" data-index="${i}" data-video-path="${escapeAttr(result.outputPath)}" data-video-name="${escapeAttr(filename)}">✂️ Split</button>` : ''}
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
      btn.addEventListener('click', async (e) => {
        const videoPath = e.target.getAttribute('data-video-path');
        const videoName = e.target.getAttribute('data-video-name');
        // Lazy load split video module when user clicks split button
        const splitVideo = await loadSplitVideoModule();
        splitVideo.showSplitVideoModal(videoPath, videoName, outputDir);
      });
    });

    // Add event listeners for trim video buttons
    document.querySelectorAll('.btn-trim-video').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const videoPath = e.target.getAttribute('data-video-path');
        const videoName = e.target.getAttribute('data-video-name');
        trimVideo.showTrimVideoModal(videoPath, videoName, outputDir);
      });
    });
  }

  // Quality selector change handler
  const qualitySelect = document.getElementById('qualitySelect');
  if (qualitySelect) {
    qualitySelect.addEventListener('change', async (e) => {
      selectedQuality = e.target.value;
      // Save preference
      try {
        await window.electronAPI.setPreferredQuality(selectedQuality);
      } catch (error) {
        console.error('Error saving quality preference:', error);
      }
    });
  }
  
  // Attach event listeners
  prepareMergeBtn.addEventListener('click', handlePrepareMerge);
  backBtn.addEventListener('click', handleBack);
    mergeBtn.addEventListener('click', handleMerge);
    
    // Batch merge button
    const mergeSelectedBtn = document.getElementById('mergeSelectedBtn');
    if (mergeSelectedBtn) {
      mergeSelectedBtn.addEventListener('click', () => handleBatchMerge());
    }
    
    // Stop on error checkbox
    const stopOnErrorCheckbox = document.getElementById('stopOnErrorCheckbox');
    if (stopOnErrorCheckbox) {
      stopOnErrorCheckbox.addEventListener('change', (e) => {
        state.stopOnError = e.target.checked;
      });
    }
  selectOutputDestinationBtn.addEventListener('click', handleSelectOutputDestination);
  useDefaultDestinationBtn.addEventListener('click', handleUseDefaultDestination);

  return { updateOutputDestinationDisplay };
}

