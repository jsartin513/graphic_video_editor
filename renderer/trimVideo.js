// Video trimming functionality

import { formatDuration, escapeHtml } from './utils.js';

export function initializeTrimVideo(domElements, state) {
  // Create and inject the trim modal HTML
  createTrimModal();
  
  const trimVideoModal = document.getElementById('trimVideoModal');
  const closeTrimModalBtn = document.getElementById('closeTrimModalBtn');
  const trimVideoName = document.getElementById('trimVideoName');
  const trimVideoDuration = document.getElementById('trimVideoDuration');
  const trimStartTime = document.getElementById('trimStartTime');
  const trimEndTime = document.getElementById('trimEndTime');
  const trimPreview = document.getElementById('trimPreview');
  const cancelTrimBtn = document.getElementById('cancelTrimBtn');
  const executeTrimBtn = document.getElementById('executeTrimBtn');
  const trimProgress = document.getElementById('trimProgress');
  const trimProgressBar = document.getElementById('trimProgressBar');
  const trimProgressText = document.getElementById('trimProgressText');
  const trimResult = document.getElementById('trimResult');
  const timelineSlider = document.getElementById('timelineSlider');
  const timelinePreview = document.getElementById('timelinePreview');
  
  let currentVideoPath = null;
  let currentVideoName = null;
  let currentVideoDuration = 0;
  let currentOutputDir = null;
  
  // Format time in seconds to HH:MM:SS
  function formatTimeInput(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  
  // Parse time input HH:MM:SS to seconds
  function parseTimeInput(timeStr) {
    const parts = timeStr.split(':');
    if (parts.length !== 3) return 0;
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    const s = parseInt(parts[2]) || 0;
    return h * 3600 + m * 60 + s;
  }
  
  // Update preview text based on trim times
  function updateTrimPreview() {
    const startSeconds = parseTimeInput(trimStartTime.value);
    const endSeconds = parseTimeInput(trimEndTime.value);
    
    if (endSeconds <= startSeconds) {
      trimPreview.textContent = 'End time must be after start time';
      trimPreview.style.color = 'var(--accent-danger)';
      executeTrimBtn.disabled = true;
      return;
    }
    
    if (endSeconds > currentVideoDuration) {
      trimPreview.textContent = 'End time exceeds video duration';
      trimPreview.style.color = 'var(--accent-danger)';
      executeTrimBtn.disabled = true;
      return;
    }
    
    const duration = endSeconds - startSeconds;
    trimPreview.textContent = `Trimmed video will be ${formatDuration(duration)} (from ${trimStartTime.value} to ${trimEndTime.value})`;
    trimPreview.style.color = '';
    executeTrimBtn.disabled = false;
  }
  
  // Update timeline preview
  function updateTimelinePreview() {
    const startSeconds = parseTimeInput(trimStartTime.value);
    const endSeconds = parseTimeInput(trimEndTime.value);
    
    if (currentVideoDuration > 0) {
      const startPercent = (startSeconds / currentVideoDuration) * 100;
      const endPercent = (endSeconds / currentVideoDuration) * 100;
      
      timelinePreview.style.left = `${startPercent}%`;
      timelinePreview.style.right = `${100 - endPercent}%`;
    }
  }
  
  // Show trim video modal
  async function showTrimVideoModal(videoPath, videoName, outputDir) {
    currentVideoPath = videoPath;
    currentVideoName = videoName;
    currentOutputDir = outputDir;
    
    trimVideoName.textContent = videoName;
    
    // Get video duration
    try {
      const duration = await window.electronAPI.getVideoDuration(videoPath);
      currentVideoDuration = duration;
      trimVideoDuration.textContent = formatDuration(duration);
      
      // Set default trim times (full video)
      trimStartTime.value = formatTimeInput(0);
      trimEndTime.value = formatTimeInput(duration);
      
      updateTrimPreview();
      updateTimelinePreview();
    } catch (error) {
      console.error('Error getting video duration:', error);
      trimVideoDuration.textContent = 'Unknown';
    }
    
    // Reset UI state
    trimProgress.style.display = 'none';
    trimResult.style.display = 'none';
    trimResult.innerHTML = '';
    executeTrimBtn.disabled = false;
    cancelTrimBtn.disabled = false;
    
    // Show modal
    trimVideoModal.style.display = 'flex';
  }
  
  // Close trim modal
  function closeTrimModal() {
    trimVideoModal.style.display = 'none';
    currentVideoPath = null;
    currentVideoName = null;
    currentVideoDuration = 0;
    currentOutputDir = null;
  }
  
  // Handle trim execution
  async function executeTrim() {
    const startSeconds = parseTimeInput(trimStartTime.value);
    const endSeconds = parseTimeInput(trimEndTime.value);
    
    if (endSeconds <= startSeconds) {
      alert('End time must be after start time');
      return;
    }
    
    if (endSeconds > currentVideoDuration) {
      alert('End time exceeds video duration');
      return;
    }
    
    // Disable buttons during trim
    executeTrimBtn.disabled = true;
    cancelTrimBtn.disabled = true;
    
    // Show progress
    trimProgress.style.display = 'block';
    trimProgressBar.style.width = '0%';
    trimProgressText.textContent = 'Trimming video...';
    
    try {
      // Generate output filename - preserve case from input
      const extension = currentVideoName.match(/\.[^.]+$/)?.[0] || '.MP4';
      const baseName = currentVideoName.replace(/\.[^.]+$/, '');
      const outputFilename = `${baseName}_trimmed${extension}`;
      const outputPath = currentOutputDir ? `${currentOutputDir}/${outputFilename}` : null;
      
      // Call trim handler
      const result = await window.electronAPI.trimVideo({
        inputPath: currentVideoPath,
        outputPath: outputPath,
        startTime: startSeconds,
        endTime: endSeconds
      });
      
      // Update progress
      trimProgressBar.style.width = '100%';
      trimProgressText.textContent = 'Trim complete!';
      
      // Show result
      trimResult.style.display = 'block';
      trimResult.innerHTML = `
        <div class="trim-success">
          <span class="result-icon">✓</span>
          <div>
            <p><strong>Video trimmed successfully!</strong></p>
            <p class="trim-result-path">${escapeHtml(result.outputPath)}</p>
          </div>
        </div>
        <button id="openTrimmedFolderBtn" class="btn btn-secondary btn-small">
          <span class="btn-icon">📂</span>
          View in Finder
        </button>
        <button id="closeTrimResultBtn" class="btn btn-primary btn-small">
          Done
        </button>
      `;
      
      // Add event listeners for result buttons
      document.getElementById('openTrimmedFolderBtn')?.addEventListener('click', async () => {
        try {
          await window.electronAPI.openFolder(currentOutputDir || result.outputPath.split('/').slice(0, -1).join('/'));
        } catch (error) {
          console.error('Error opening folder:', error);
        }
      });
      
      document.getElementById('closeTrimResultBtn')?.addEventListener('click', closeTrimModal);
      
    } catch (error) {
      console.error('Error trimming video:', error);
      trimProgressText.textContent = 'Trim failed';
      trimResult.style.display = 'block';
      trimResult.innerHTML = `
        <div class="trim-error">
          <span class="result-icon">✗</span>
          <p>${escapeHtml(error.message)}</p>
        </div>
      `;
      executeTrimBtn.disabled = false;
      cancelTrimBtn.disabled = false;
    }
  }
  
  // Handle timeline slider interaction
  function handleTimelineClick(e) {
    const rect = timelineSlider.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = clickX / rect.width;
    const clickedTime = percent * currentVideoDuration;
    
    // If shift key is held, set end time, otherwise set start time
    if (e.shiftKey) {
      trimEndTime.value = formatTimeInput(clickedTime);
    } else {
      trimStartTime.value = formatTimeInput(clickedTime);
    }
    
    updateTrimPreview();
    updateTimelinePreview();
  }
  
  // Attach event listeners
  closeTrimModalBtn.addEventListener('click', closeTrimModal);
  cancelTrimBtn.addEventListener('click', closeTrimModal);
  executeTrimBtn.addEventListener('click', executeTrim);
  trimStartTime.addEventListener('input', () => {
    updateTrimPreview();
    updateTimelinePreview();
  });
  trimEndTime.addEventListener('input', () => {
    updateTrimPreview();
    updateTimelinePreview();
  });
  timelineSlider.addEventListener('click', handleTimelineClick);
  
  // Close modal on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && trimVideoModal.style.display === 'flex') {
      closeTrimModal();
    }
  });
  
  return {
    showTrimVideoModal
  };
}

// Create trim modal HTML and inject into document
function createTrimModal() {
  const modalHTML = `
    <div id="trimVideoModal" class="modal-overlay" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="trimModalTitle">
      <div class="modal-content trim-modal-content">
        <div class="modal-header">
          <h2 id="trimModalTitle">Trim Video</h2>
          <button id="closeTrimModalBtn" class="modal-close-btn" aria-label="Close trim video dialog">×</button>
        </div>
        <div class="modal-body">
          <div class="trim-video-info">
            <p><strong>Video:</strong> <span id="trimVideoName"></span></p>
            <p><strong>Duration:</strong> <span id="trimVideoDuration"></span></p>
          </div>
          
          <div class="timeline-section">
            <label>Visual Timeline</label>
            <div id="timelineSlider" class="timeline-slider" role="slider" aria-label="Video timeline">
              <div class="timeline-track"></div>
              <div id="timelinePreview" class="timeline-preview"></div>
            </div>
            <p class="timeline-hint">Click to set start time • Shift+Click to set end time</p>
          </div>
          
          <div class="trim-settings">
            <div class="form-group">
              <label for="trimStartTime">Start Time (HH:MM:SS):</label>
              <input type="text" id="trimStartTime" class="time-input" placeholder="00:00:00" pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}" />
            </div>
            
            <div class="form-group">
              <label for="trimEndTime">End Time (HH:MM:SS):</label>
              <input type="text" id="trimEndTime" class="time-input" placeholder="00:00:00" pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}" />
            </div>
            
            <div class="trim-preview-section">
              <p><strong>Preview:</strong> <span id="trimPreview" aria-live="polite">Configure times above</span></p>
            </div>
          </div>

          <div id="trimProgress" class="trim-progress" style="display: none;" role="status" aria-live="polite">
            <div class="progress-bar-container">
              <div id="trimProgressBar" class="progress-bar"></div>
            </div>
            <p id="trimProgressText" class="progress-text">Trimming...</p>
          </div>

          <div id="trimResult" class="trim-result" style="display: none;" aria-live="polite"></div>
        </div>
        <div class="modal-footer">
          <button id="cancelTrimBtn" class="btn btn-secondary" aria-label="Cancel trim operation">Cancel</button>
          <button id="executeTrimBtn" class="btn btn-primary" aria-label="Execute video trim">
            <span class="btn-icon" aria-hidden="true">✂️</span>
            Trim Video
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Insert modal before closing body tag
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}
