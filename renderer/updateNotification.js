// Update notification handling
import { formatBytes } from './utils.js';

let updateInfo = null;
let userInitiatedCheck = false;
let isDownloading = false;

// Initialize update listeners
export function initUpdateNotifications() {
  // Listen for update events
  window.electronAPI.onUpdateChecking(() => {
    console.log('Checking for updates...');
  });

  window.electronAPI.onUpdateAvailable((info) => {
    console.log('Update available:', info);
    updateInfo = info;
    showUpdateNotification(info);
  });

  window.electronAPI.onUpdateNotAvailable((info) => {
    console.log('No updates available');
    updateInfo = null;
  });
  
  window.electronAPI.onUpdateError((error) => {
    console.error('Update error:', error);
    // Only show errors if user manually checked for updates
    if (userInitiatedCheck) {
      showUpdateError(error);
    }
  });

  window.electronAPI.onUpdateDownloadProgress((progress) => {
    console.log(`Download progress: ${progress.percent}%`);
    updateDownloadProgress(progress);
  });

  window.electronAPI.onUpdateDownloaded((info) => {
    console.log('Update downloaded, ready to install');
    isDownloading = false; // Reset download state
    showUpdateReadyNotification(info);
  });
}

// Show update available notification
function showUpdateNotification(info) {
  // Remove any existing notification first
  const existingNotification = document.getElementById('updateNotification');
  if (existingNotification) {
    existingNotification.remove();
  }

  const notification = document.createElement('div');
  notification.id = 'updateNotification';
  notification.className = 'update-notification';
  
  const content = document.createElement('div');
  content.className = 'update-notification-content';
  
  // Header
  const header = document.createElement('div');
  header.className = 'update-notification-header';
  header.innerHTML = `
    <span class="update-icon">🎉</span>
    <h3>Update Available</h3>
  `;
  
  // Message with safe version text (defensive check for missing version info)
  const message = document.createElement('p');
  message.className = 'update-message';
  const newVersion = info?.version || 'a new version';
  const currentVersion = info?.currentVersion || '1.0.0';
  message.textContent = `Version ${newVersion} is now available. You're currently using version ${currentVersion}.`;
  
  // Actions
  const actions = document.createElement('div');
  actions.className = 'update-actions';
  
  const downloadBtn = document.createElement('button');
  downloadBtn.id = 'downloadUpdateBtn';
  downloadBtn.className = 'btn btn-primary btn-small';
  downloadBtn.innerHTML = `
    <span class="btn-icon">⬇</span>
    Download Update
  `;
  
  const dismissBtn = document.createElement('button');
  dismissBtn.id = 'dismissUpdateBtn';
  dismissBtn.className = 'btn btn-text btn-small';
  dismissBtn.textContent = 'Remind Me Later';
  
  actions.appendChild(downloadBtn);
  actions.appendChild(dismissBtn);
  
  content.appendChild(header);
  content.appendChild(message);
  content.appendChild(actions);
  notification.appendChild(content);
  
  document.body.appendChild(notification);

  // Add event listeners
  downloadBtn.addEventListener('click', async () => {
    await downloadUpdate();
  });

  dismissBtn.addEventListener('click', () => {
    dismissUpdateNotification();
  });

  // Auto-show the notification
  setTimeout(() => {
    notification.classList.add('show');
  }, 100);
}

// Download update
async function downloadUpdate() {
  // Prevent multiple simultaneous downloads
  if (isDownloading) {
    console.log('Download already in progress');
    return;
  }

  const notification = document.getElementById('updateNotification');
  if (!notification) return;

  isDownloading = true;

  // Update UI to show downloading state
  notification.querySelector('.update-notification-content').innerHTML = `
    <div class="update-notification-header">
      <span class="update-icon">⬇</span>
      <h3>Downloading Update</h3>
    </div>
    <p class="update-message">Please wait while we download the update...</p>
    <div class="update-progress">
      <div class="progress-bar-container">
        <div id="updateProgressBar" class="progress-bar" style="width: 0%"></div>
      </div>
      <p id="updateProgressText" class="progress-text">0%</p>
    </div>
  `;

  try {
    const result = await window.electronAPI.downloadUpdate();
    if (result && result.error) {
      showUpdateError(result.error);
      isDownloading = false;
    }
    // Note: isDownloading will be reset when update-downloaded event fires
  } catch (error) {
    console.error('Failed to download update:', error);
    isDownloading = false;
    const errorMessage = error.message || String(error);
    if (errorMessage.includes('network') || errorMessage.includes('ENOTFOUND')) {
      showUpdateError('Download failed. Please check your internet connection and try again.');
    } else {
      showUpdateError('Failed to download update. Please try again later.');
    }
  }
}

// Update download progress
function updateDownloadProgress(progress) {
  const progressBar = document.getElementById('updateProgressBar');
  const progressText = document.getElementById('updateProgressText');
  
  if (progressBar && progressText && progress) {
    // Defensive checks for progress object
    const percent = Math.round(progress.percent || 0);
    const transferred = progress.transferred || 0;
    const total = progress.total || 0;
    
    progressBar.style.width = `${percent}%`;
    if (total > 0) {
      progressText.textContent = `${percent}% (${formatBytes(transferred)} / ${formatBytes(total)})`;
    } else {
      progressText.textContent = `${percent}%`;
    }
  }
}

// Show update ready notification
function showUpdateReadyNotification(info) {
  const notification = document.getElementById('updateNotification');
  if (!notification) return;

  notification.querySelector('.update-notification-content').innerHTML = `
    <div class="update-notification-header">
      <span class="update-icon">✅</span>
      <h3>Update Ready</h3>
    </div>
    <p class="update-message">The update has been downloaded and is ready to install.</p>
    <div class="update-actions">
      <button id="installUpdateBtn" class="btn btn-primary btn-small">
        <span class="btn-icon">🔄</span>
        Restart & Install
      </button>
      <button id="installLaterBtn" class="btn btn-secondary btn-small">
        Install on Quit
      </button>
    </div>
  `;

  // Add event listeners
  document.getElementById('installUpdateBtn').addEventListener('click', () => {
    window.electronAPI.installUpdate();
  });

  document.getElementById('installLaterBtn').addEventListener('click', () => {
    dismissUpdateNotification();
  });
}

// Show update error
function showUpdateError(message) {
  // Remove any existing notification first
  const existingNotification = document.getElementById('updateNotification');
  if (existingNotification) {
    existingNotification.remove();
  }

  const notification = document.createElement('div');
  notification.id = 'updateNotification';
  notification.className = 'update-notification';
  
  const content = document.createElement('div');
  content.className = 'update-notification-content';
  
  const header = document.createElement('div');
  header.className = 'update-notification-header';
  header.innerHTML = `
    <span class="update-icon">⚠️</span>
    <h3>Update Error</h3>
  `;
  
  const messageP = document.createElement('p');
  messageP.className = 'update-message';
  messageP.textContent = message; // Use textContent to prevent XSS
  
  const actions = document.createElement('div');
  actions.className = 'update-actions';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-secondary btn-small';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => {
    dismissUpdateNotification();
  });
  actions.appendChild(closeBtn);
  
  content.appendChild(header);
  content.appendChild(messageP);
  content.appendChild(actions);
  
  notification.appendChild(content);
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('show');
  }, 100);
}

// Dismiss update notification
function dismissUpdateNotification() {
  const notification = document.getElementById('updateNotification');
  if (notification) {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }
}

// Manual check for updates (can be triggered by user)
let isCheckingForUpdates = false;

export async function checkForUpdates() {
  // Prevent multiple simultaneous checks
  if (isCheckingForUpdates) {
    console.log('Update check already in progress');
    return;
  }

  isCheckingForUpdates = true;
  userInitiatedCheck = true;
  
  try {
    const result = await window.electronAPI.checkForUpdates();
    if (result && result.error) {
      // Show error message
      showUpdateError(result.message || 'Failed to check for updates');
      return;
    }
    if (result && !result.available) {
      // Show a brief message that app is up to date
      showUpToDateMessage();
    }
  } catch (error) {
    console.error('Failed to check for updates:', error);
    showUpdateError('Failed to check for updates. Please try again later.');
  } finally {
    isCheckingForUpdates = false;
    // Reset after a delay so errors from background checks don't show
    setTimeout(() => {
      userInitiatedCheck = false;
    }, 5000);
  }
}

// Show "up to date" message
function showUpToDateMessage() {
  // Remove any existing notification first
  const existingNotification = document.getElementById('updateNotification');
  if (existingNotification) {
    existingNotification.remove();
  }

  const notification = document.createElement('div');
  notification.id = 'updateNotification';
  notification.className = 'update-notification';
  notification.innerHTML = `
    <div class="update-notification-content">
      <div class="update-notification-header">
        <span class="update-icon">✅</span>
        <h3>You're Up to Date</h3>
      </div>
      <p class="update-message">You're running the latest version of Video Merger.</p>
    </div>
  `;
  
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('show');
  }, 100);

  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    dismissUpdateNotification();
  }, 3000);
}
