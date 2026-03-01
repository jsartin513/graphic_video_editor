// Video comparison functionality

import { getFileName, escapeHtml, formatDuration } from './utils.js';

export function initializeVideoComparison(state, domElements) {
  const {
    compareVideosBtn
  } = domElements;

  // Modal elements
  const comparisonModal = document.getElementById('comparisonModal');
  const closeComparisonModalBtn = document.getElementById('closeComparisonModalBtn');
  const closeComparisonBtn = document.getElementById('closeComparisonBtn');
  const comparisonContainer = document.getElementById('comparisonContainer');
  
  // Video elements
  const videoA = document.getElementById('videoA');
  const videoB = document.getElementById('videoB');
  const videoAName = document.getElementById('videoAName');
  const videoBName = document.getElementById('videoBName');
  
  // Control elements
  const playPauseBtn = document.getElementById('playPauseBtn');
  const playPauseText = document.getElementById('playPauseText');
  const timelineSlider = document.getElementById('timelineSlider');
  const currentTimeDisplay = document.getElementById('currentTime');
  const totalDurationDisplay = document.getElementById('totalDuration');
  const playbackSpeedSelect = document.getElementById('playbackSpeed');
  const layoutSideBySideBtn = document.getElementById('layoutSideBySide');
  const layoutOverUnderBtn = document.getElementById('layoutOverUnder');
  
  // State
  let isPlaying = false;
  let isSeeking = false;
  let videoPaths = [];

  // Initialize event listeners
  function initializeEventListeners() {
    // Close modal handlers
    closeComparisonModalBtn.addEventListener('click', closeModal);
    closeComparisonBtn.addEventListener('click', closeModal);
    
    // Playback controls
    playPauseBtn.addEventListener('click', togglePlayPause);
    timelineSlider.addEventListener('input', handleTimelineSeek);
    timelineSlider.addEventListener('mousedown', () => { isSeeking = true; });
    timelineSlider.addEventListener('mouseup', () => { isSeeking = false; });
    playbackSpeedSelect.addEventListener('change', handleSpeedChange);
    
    // Layout toggle
    layoutSideBySideBtn.addEventListener('click', () => setLayout('side-by-side'));
    layoutOverUnderBtn.addEventListener('click', () => setLayout('over-under'));
    
    // Video synchronization - update timeline as videos play
    videoA.addEventListener('timeupdate', handleVideoATimeUpdate);
    videoB.addEventListener('timeupdate', handleVideoBTimeUpdate);
    
    // Handle video events
    videoA.addEventListener('loadedmetadata', handleVideoLoaded);
    videoB.addEventListener('loadedmetadata', handleVideoLoaded);
    videoA.addEventListener('ended', handleVideoEnded);
    videoB.addEventListener('ended', handleVideoEnded);
    
    // Compare button in file list
    if (compareVideosBtn) {
      compareVideosBtn.addEventListener('click', openComparisonFromFileList);
    }
  }

  // Open comparison modal from file list
  function openComparisonFromFileList() {
    if (state.selectedFiles.length === 2) {
      openComparison(state.selectedFiles[0], state.selectedFiles[1]);
    }
  }

  // Open comparison modal with two video files
  async function openComparison(pathA, pathB) {
    // Validate paths
    if (!pathA || !pathB || typeof pathA !== 'string' || typeof pathB !== 'string') {
      console.error('Invalid video paths provided to comparison modal');
      return;
    }
    
    videoPaths = [pathA, pathB];
    
    // Set video names (getFileName already sanitizes output)
    videoAName.textContent = getFileName(pathA);
    videoBName.textContent = getFileName(pathB);
    
    // Load videos - paths come from trusted electron file picker
    // and are validated by the main process
    videoA.src = `file://${pathA}`;
    videoB.src = `file://${pathB}`;
    
    // Reset playback state
    isPlaying = false;
    playPauseText.textContent = 'Play';
    playPauseBtn.querySelector('.btn-icon').textContent = '▶';
    timelineSlider.value = 0;
    currentTimeDisplay.textContent = '0:00';
    totalDurationDisplay.textContent = '0:00';
    playbackSpeedSelect.value = '1';
    
    // Show modal
    comparisonModal.style.display = 'flex';
  }

  // Close comparison modal
  function closeModal() {
    // Pause videos
    videoA.pause();
    videoB.pause();
    
    // Clear sources
    videoA.src = '';
    videoB.src = '';
    
    // Reset state
    isPlaying = false;
    videoPaths = [];
    
    // Hide modal
    comparisonModal.style.display = 'none';
  }

  // Toggle play/pause
  function togglePlayPause() {
    if (isPlaying) {
      videoA.pause();
      videoB.pause();
      isPlaying = false;
      playPauseText.textContent = 'Play';
      playPauseBtn.querySelector('.btn-icon').textContent = '▶';
    } else {
      // Sync time before playing
      syncVideos();
      videoA.play();
      videoB.play();
      isPlaying = true;
      playPauseText.textContent = 'Pause';
      playPauseBtn.querySelector('.btn-icon').textContent = '⏸';
    }
  }

  // Handle timeline seek
  function handleTimelineSeek(e) {
    const percent = parseFloat(e.target.value);
    const maxDuration = Math.max(videoA.duration || 0, videoB.duration || 0);
    const newTime = (percent / 100) * maxDuration;
    
    videoA.currentTime = Math.min(newTime, videoA.duration || 0);
    videoB.currentTime = Math.min(newTime, videoB.duration || 0);
    
    updateTimeDisplay(newTime);
  }

  // Handle playback speed change
  function handleSpeedChange(e) {
    const speed = parseFloat(e.target.value);
    videoA.playbackRate = speed;
    videoB.playbackRate = speed;
  }

  // Sync videos to the same time position
  function syncVideos() {
    const targetTime = videoA.currentTime;
    videoB.currentTime = targetTime;
  }

  // Handle video A time update
  function handleVideoATimeUpdate() {
    if (!isSeeking && isPlaying) {
      // Keep videos synchronized during playback
      const timeDiff = Math.abs(videoA.currentTime - videoB.currentTime);
      if (timeDiff > 0.3) { // If drift exceeds 300ms, resync
        videoB.currentTime = videoA.currentTime;
      }
      
      // Update timeline
      const maxDuration = Math.max(videoA.duration || 0, videoB.duration || 0);
      if (maxDuration > 0) {
        const percent = (videoA.currentTime / maxDuration) * 100;
        timelineSlider.value = percent;
        updateTimeDisplay(videoA.currentTime);
      }
    }
  }

  // Handle video B time update
  function handleVideoBTimeUpdate() {
    // Video B follows video A, so we don't need to update timeline here
    // This prevents race conditions
  }

  // Handle video loaded
  function handleVideoLoaded() {
    // Update duration display when both videos are loaded
    if (videoA.duration && videoB.duration) {
      const maxDuration = Math.max(videoA.duration, videoB.duration);
      totalDurationDisplay.textContent = formatDuration(maxDuration);
    }
  }

  // Handle video ended
  function handleVideoEnded() {
    // Check if both videos have ended
    if (videoA.ended && videoB.ended) {
      isPlaying = false;
      playPauseText.textContent = 'Play';
      playPauseBtn.querySelector('.btn-icon').textContent = '▶';
    }
  }

  // Update time display
  function updateTimeDisplay(currentTime) {
    currentTimeDisplay.textContent = formatDuration(currentTime);
  }

  // Set layout mode
  function setLayout(layout) {
    if (layout === 'side-by-side') {
      comparisonContainer.classList.remove('over-under');
      comparisonContainer.classList.add('side-by-side');
      layoutSideBySideBtn.classList.add('active');
      layoutOverUnderBtn.classList.remove('active');
    } else if (layout === 'over-under') {
      comparisonContainer.classList.remove('side-by-side');
      comparisonContainer.classList.add('over-under');
      layoutSideBySideBtn.classList.remove('active');
      layoutOverUnderBtn.classList.add('active');
    }
  }

  // Initialize
  initializeEventListeners();

  // Public API
  return {
    openComparison,
    closeModal
  };
}
