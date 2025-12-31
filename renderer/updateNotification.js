// Update notification handling

let updateInfo = null;

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
    // Don't show error to user unless they manually checked for updates
  });

  window.electronAPI.onUpdateDownloadProgress((progress) => {
    console.log(`Download progress: ${progress.percent}%`);
    updateDownloadProgress(progress);
  });

  window.electronAPI.onUpdateDownloaded((info) => {
    console.log('Update downloaded, ready to install');
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
  notification.innerHTML = `
    <div class="update-notification-content">
      <div class="update-notification-header">
        <span class="update-icon">🎉</span>
        <h3>Update Available</h3>
      </div>
      <p class="update-message">Version ${info.version} is now available. You're currently using version ${info.currentVersion || '1.0.0'}.</p>
      <div class="update-actions">
        <button id="downloadUpdateBtn" class="btn btn-primary btn-small">
          <span class="btn-icon">⬇</span>
          Download Update
        </button>
        <button id="dismissUpdateBtn" class="btn btn-text btn-small">
          Remind Me Later
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);

  // Add event listeners
  document.getElementById('downloadUpdateBtn').addEventListener('click', async () => {
    await downloadUpdate();
  });

  document.getElementById('dismissUpdateBtn').addEventListener('click', () => {
    dismissUpdateNotification();
  });

  // Auto-show the notification
  setTimeout(() => {
    notification.classList.add('show');
  }, 100);
}

// Download update
async function downloadUpdate() {
  const notification = document.getElementById('updateNotification');
  if (!notification) return;

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
    await window.electronAPI.downloadUpdate();
  } catch (error) {
    console.error('Failed to download update:', error);
    showUpdateError('Failed to download update. Please try again later.');
  }
}

// Update download progress
function updateDownloadProgress(progress) {
  const progressBar = document.getElementById('updateProgressBar');
  const progressText = document.getElementById('updateProgressText');
  
  if (progressBar && progressText) {
    const percent = Math.round(progress.percent);
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${percent}% (${formatBytes(progress.transferred)} / ${formatBytes(progress.total)})`;
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
  const notification = document.getElementById('updateNotification');
  if (!notification) return;

  // Create the HTML structure safely
  const content = notification.querySelector('.update-notification-content');
  content.innerHTML = '';
  
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
  closeBtn.id = 'closeErrorBtn';
  closeBtn.className = 'btn btn-secondary btn-small';
  closeBtn.textContent = 'Close';
  actions.appendChild(closeBtn);
  
  content.appendChild(header);
  content.appendChild(messageP);
  content.appendChild(actions);

  document.getElementById('closeErrorBtn').addEventListener('click', () => {
    dismissUpdateNotification();
  });
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

// Format bytes to human-readable format
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Manual check for updates (can be triggered by user)
export async function checkForUpdates() {
  try {
    const result = await window.electronAPI.checkForUpdates();
    if (result && !result.available) {
      // Show a brief message that app is up to date
      showUpToDateMessage();
    }
  } catch (error) {
    console.error('Failed to check for updates:', error);
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
