// Video splitting functionality

import { getFileName, escapeHtml, formatDuration } from './utils.js';

export function initializeSplitVideo(domElements) {
  let closeSplitModalBtn = null;
  let cancelSplitBtn = null;
  let executeSplitBtn = null;

  // Initialize split video modal elements and event listeners
  closeSplitModalBtn = document.getElementById('closeSplitModalBtn');
  cancelSplitBtn = document.getElementById('cancelSplitBtn');
  executeSplitBtn = document.getElementById('executeSplitBtn');

  function closeSplitVideoModal() {
    document.getElementById('splitVideoModal').style.display = 'none';
    document.getElementById('splitProgress').style.display = 'none';
    document.getElementById('splitResult').style.display = 'none';
  }

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
    cancelBtn.disabled = false; // Enable cancel button during operation
    cancelBtn.textContent = 'Cancel';
    progressDiv.style.display = 'block';
    resultDiv.style.display = 'none';
    progressBar.style.width = '0%';
    progressText.textContent = `Splitting into ${splits.length} segments...`;
    
    // Set up cancel handler
    let isCancelling = false;
    const handleCancel = async () => {
      if (isCancelling) return;
      
      const confirmed = confirm('Are you sure you want to cancel the split operation?\n\nAny progress will be lost.');
      if (!confirmed) return;
      
      isCancelling = true;
      cancelBtn.disabled = true;
      cancelBtn.textContent = 'Cancelling...';
      
      try {
        await window.electronAPI.cancelSplit();
        progressText.textContent = 'Split cancelled by user';
      } catch (error) {
        console.error('Error cancelling split:', error);
      }
    };
    
    // Temporarily replace the cancel button handler
    const oldOnClick = cancelBtn.onclick;
    cancelBtn.onclick = handleCancel;
    
    // Create split output directory (use path separator for cross-platform)
    const pathParts = outputDir.split(/[\/\\]/);
    pathParts.push('split_videos');
    const splitOutputDir = pathParts.join('/');
    
    try {
      const result = await window.electronAPI.splitVideo(videoPath, splits, splitOutputDir);
      
      if (result.cancelled) {
        // Operation was cancelled
        progressBar.style.width = '100%';
        progressText.textContent = 'Split cancelled';
        resultDiv.className = 'split-result error';
        resultDiv.innerHTML = `<p>⚠ Operation cancelled by user</p>`;
        resultDiv.style.display = 'block';
        
        // Update buttons
        executeBtn.disabled = false;
        cancelBtn.textContent = 'Close';
        cancelBtn.disabled = false;
        cancelBtn.onclick = closeSplitVideoModal;
      } else if (result.success) {
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
          window.electronAPI.openFolder(splitOutputDir).catch(err => {
            console.error('Error opening folder:', err);
          });
        };
      } else {
        throw new Error('Split failed');
      }
    } catch (error) {
      progressBar.style.width = '100%';
      
      // Check if error is due to cancellation
      if (error.message && error.message.includes('cancelled')) {
        progressText.textContent = 'Split cancelled';
        resultDiv.className = 'split-result error';
        resultDiv.innerHTML = `<p>⚠ Operation cancelled by user</p>`;
      } else {
        progressText.textContent = 'Split failed!';
        resultDiv.className = 'split-result error';
        resultDiv.innerHTML = `<p>✗ Error: ${escapeHtml(error.message)}</p>`;
      }
      
      resultDiv.style.display = 'block';
      executeBtn.disabled = false;
      cancelBtn.textContent = 'Close';
      cancelBtn.disabled = false;
      cancelBtn.onclick = closeSplitVideoModal;
    }
  }

  // Attach event listeners
  if (closeSplitModalBtn) {
    closeSplitModalBtn.addEventListener('click', closeSplitVideoModal);
  }
  if (cancelSplitBtn) {
    cancelSplitBtn.addEventListener('click', closeSplitVideoModal);
  }
  if (executeSplitBtn) {
    executeSplitBtn.addEventListener('click', executeVideoSplit);
  }

  return { showSplitVideoModal };
}

