// Recent Directories UI module
// Manages display and interaction with recent and pinned directories

export function initializeRecentDirectories(state, domElements, fileHandling) {
  const recentDirectoriesSection = document.getElementById('recentDirectoriesSection');
  const recentDirectoriesList = document.getElementById('recentDirectoriesList');
  const clearRecentBtn = document.getElementById('clearRecentBtn');

  // Load and display recent directories on startup
  async function loadRecentDirectories() {
    try {
      const prefs = await window.electronAPI.loadPreferences();
      displayRecentDirectories(prefs);
    } catch (error) {
      console.error('Error loading recent directories:', error);
    }
  }

  // Display recent directories
  function displayRecentDirectories(preferences) {
    const pinnedDirs = preferences.pinnedDirectories || [];
    const recentDirs = preferences.recentDirectories || [];

    // Clear current list
    recentDirectoriesList.innerHTML = '';

    // Show section only if there are directories to display
    const hasDirectories = pinnedDirs.length > 0 || recentDirs.length > 0;
    recentDirectoriesSection.style.display = hasDirectories ? 'block' : 'none';

    if (!hasDirectories) {
      return;
    }

    // Display pinned directories first
    pinnedDirs.forEach(item => {
      const dirItem = createDirectoryItem(item.path, true);
      recentDirectoriesList.appendChild(dirItem);
    });

    // Display recent directories
    recentDirs.forEach(item => {
      const dirItem = createDirectoryItem(item.path, false);
      recentDirectoriesList.appendChild(dirItem);
    });
  }

  // Create a directory item element
  function createDirectoryItem(dirPath, isPinned) {
    const item = document.createElement('div');
    item.className = `recent-directory-item ${isPinned ? 'pinned' : ''}`;
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');

    // Get directory name for display (handle both / and \ separators)
    const pathSeparator = dirPath.includes('\\') ? '\\' : '/';
    const parts = dirPath.split(pathSeparator).filter(p => p);
    const dirName = parts[parts.length - 1] || dirPath;
    
    item.innerHTML = `
      <div class="recent-directory-info">
        <span class="recent-directory-icon" aria-hidden="true">${isPinned ? '📌' : '📂'}</span>
        <span class="recent-directory-path" title="${escapeHtml(dirPath)}">${escapeHtml(dirName)}</span>
        <span class="recent-directory-meta">${escapeHtml(getParentPath(dirPath))}</span>
      </div>
      <div class="recent-directory-actions">
        <button class="btn-${isPinned ? 'unpin' : 'pin'}" 
                aria-label="${isPinned ? 'Unpin' : 'Pin'} folder"
                title="${isPinned ? 'Unpin' : 'Pin'} this folder">
          ${isPinned ? '📍' : '📌'}
        </button>
      </div>
    `;

    // Handle clicking the directory item
    const infoSection = item.querySelector('.recent-directory-info');
    infoSection.addEventListener('click', () => handleDirectoryClick(dirPath));
    
    // Handle keyboard navigation
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleDirectoryClick(dirPath);
      }
    });

    // Handle pin/unpin button
    const pinBtn = item.querySelector(`.btn-${isPinned ? 'unpin' : 'pin'}`);
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handlePinToggle(dirPath, isPinned);
    });

    return item;
  }

  // Handle clicking on a directory
  async function handleDirectoryClick(dirPath) {
    try {
      const result = await window.electronAPI.openRecentDirectory(dirPath);
      if (result.success && result.files.length > 0) {
        fileHandling.addFiles(result.files);
        // Refresh the recent directories list
        await loadRecentDirectories();
      } else if (result.success && result.files.length === 0) {
        showNotification('No video files found in this directory.');
      }
    } catch (error) {
      console.error('Error opening recent directory:', error);
      showNotification('Failed to open directory. It may have been moved or deleted.');
      // Cleanup invalid directories
      await window.electronAPI.cleanupDirectories();
      await loadRecentDirectories();
    }
  }

  // Show notification message
  function showNotification(message) {
    // For now, use alert as a simple solution
    // TODO: Replace with a proper toast notification system in future
    alert(message);
  }

  // Handle pin/unpin toggle
  async function handlePinToggle(dirPath, isPinned) {
    try {
      if (isPinned) {
        await window.electronAPI.unpinDirectory(dirPath);
      } else {
        await window.electronAPI.pinDirectory(dirPath);
      }
      // Refresh the list
      await loadRecentDirectories();
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  }

  // Handle clear recent button
  clearRecentBtn.addEventListener('click', async () => {
    if (confirm('Clear all recent folders? (Pinned folders will be kept)')) {
      try {
        await window.electronAPI.clearRecentDirectories();
        await loadRecentDirectories();
      } catch (error) {
        console.error('Error clearing recent directories:', error);
      }
    }
  });

  // Helper function to escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Helper function to get parent path for display
  function getParentPath(dirPath) {
    // Handle both / and \ separators
    const pathSeparator = dirPath.includes('\\') ? '\\' : '/';
    const parts = dirPath.split(pathSeparator).filter(p => p);
    if (parts.length <= 1) return '';
    parts.pop(); // Remove last part (directory name)
    const parent = parts.slice(-2).join(pathSeparator); // Show last 2 parts of parent path
    return parent ? `...${pathSeparator}${parent}` : '';
  }

  // Load recent directories on init
  loadRecentDirectories();

  // Cleanup invalid directories on init
  window.electronAPI.cleanupDirectories().catch(err => {
    console.error('Error during initial cleanup:', err);
  });

  return {
    refresh: loadRecentDirectories
  };
}
