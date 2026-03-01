// File selection and handling functionality

import { getFileName, escapeHtml, formatDate } from './utils.js';

// Thumbnail cache and queue management
const thumbnailCache = new Map();
const thumbnailQueue = [];
let activeThumbnailRequests = 0;
const MAX_CONCURRENT_THUMBNAILS = 4;

// State will be managed in the main renderer.js
export function initializeFileHandling(state, domElements) {
  const {
    selectFilesBtn,
    selectFolderBtn,
    dropZone,
    fileList,
    fileCount,
    prepareMergeBtn,
    fileListContainer
  } = domElements;

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
    dropZone.classList.add('drag-over');
  }

  function handleDragLeave(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
  }

  async function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    
    const paths = Array.from(e.dataTransfer.files).map(f => f.path);
    if (paths.length > 0) {
      const result = await window.electronAPI.processDroppedPaths(paths);
      if (result.files.length > 0) {
        addFiles(result.files);
      }
    }
  }

  function addFiles(newFiles) {
    for (const file of newFiles) {
      if (!state.selectedFiles.includes(file)) {
        state.selectedFiles.push(file);
      }
    }
    updateFileList();
  }

  function removeFile(filePath) {
    state.selectedFiles = state.selectedFiles.filter(f => f !== filePath);
    updateFileList();
  }

  async function updateFileList() {
    fileList.innerHTML = '';
    
    if (state.selectedFiles.length === 0) {
      fileListContainer.style.display = 'none';
      prepareMergeBtn.style.display = 'none';
      return;
    }
    
    fileListContainer.style.display = 'block';
    prepareMergeBtn.style.display = 'inline-flex';
    fileCount.textContent = `${state.selectedFiles.length} file${state.selectedFiles.length !== 1 ? 's' : ''}`;
    
    for (const filePath of state.selectedFiles) {
      const item = await createFileItem(filePath);
      fileList.appendChild(item);
    }
    
    // Start loading thumbnails after items are added to DOM
    loadThumbnailsForVisibleItems();
  }

  async function createFileItem(filePath) {
    const item = document.createElement('div');
    item.className = 'file-item';
    
    try {
      const metadata = await window.electronAPI.getFileMetadata(filePath);
      item.innerHTML = `
        <div class="file-thumbnail-container">
          <div class="file-thumbnail loading" data-filepath="${escapeHtml(filePath)}">
            <div class="thumbnail-spinner"></div>
          </div>
        </div>
        <div class="file-info">
          <div class="file-name">${escapeHtml(getFileName(filePath))}</div>
          <div class="file-meta">
            <span>Size: ${metadata.sizeFormatted}</span>
            <span>Modified: ${formatDate(metadata.modified)}</span>
          </div>
        </div>
        <div class="file-actions">
          <button class="btn-remove" data-file="${escapeHtml(filePath)}">Remove</button>
        </div>
      `;
    } catch (error) {
      item.innerHTML = `
        <div class="file-thumbnail-container">
          <div class="file-thumbnail loading" data-filepath="${escapeHtml(filePath)}">
            <div class="thumbnail-spinner"></div>
          </div>
        </div>
        <div class="file-info">
          <div class="file-name">${escapeHtml(getFileName(filePath))}</div>
        </div>
        <div class="file-actions">
          <button class="btn-remove" data-file="${escapeHtml(filePath)}">Remove</button>
        </div>
      `;
    }

    // Add remove button handler
    const removeBtn = item.querySelector('.btn-remove');
    removeBtn.addEventListener('click', () => removeFile(filePath));

    return item;
  }

  // Load thumbnails for visible items with concurrent request limiting
  async function loadThumbnailsForVisibleItems() {
    const thumbnailElements = fileList.querySelectorAll('.file-thumbnail.loading');
    
    for (const thumbnailEl of thumbnailElements) {
      const filePath = thumbnailEl.getAttribute('data-filepath');
      if (filePath) {
        queueThumbnailLoad(filePath, thumbnailEl);
      }
    }
  }

  // Queue thumbnail load with concurrent request limiting
  function queueThumbnailLoad(filePath, thumbnailEl) {
    thumbnailQueue.push({ filePath, thumbnailEl });
    processThumbnailQueue();
  }

  // Process thumbnail queue with concurrent request limiting
  async function processThumbnailQueue() {
    while (thumbnailQueue.length > 0 && activeThumbnailRequests < MAX_CONCURRENT_THUMBNAILS) {
      const item = thumbnailQueue.shift();
      if (item) {
        loadThumbnail(item.filePath, item.thumbnailEl);
      }
    }
  }

  // Load thumbnail for a specific file
  async function loadThumbnail(filePath, thumbnailEl) {
    // Check cache first before incrementing counter
    if (thumbnailCache.has(filePath)) {
      const cachedDataUrl = thumbnailCache.get(filePath);
      updateThumbnailElement(thumbnailEl, cachedDataUrl);
      // Process next item in queue since we didn't actually start a request
      processThumbnailQueue();
      return;
    }
    
    activeThumbnailRequests++;
    
    try {
      // Generate thumbnail
      const dataUrl = await window.electronAPI.generateThumbnail(filePath, 1);
      
      // Cache the result
      thumbnailCache.set(filePath, dataUrl);
      
      // Update UI
      updateThumbnailElement(thumbnailEl, dataUrl);
    } catch (error) {
      console.error(`Failed to generate thumbnail for ${filePath}:`, error);
      // Show error state
      thumbnailEl.classList.remove('loading');
      thumbnailEl.classList.add('error');
      thumbnailEl.innerHTML = '<div class="thumbnail-error">📹</div>';
    } finally {
      activeThumbnailRequests--;
      // Process next item in queue
      processThumbnailQueue();
    }
  }

  // Update thumbnail element with image data
  function updateThumbnailElement(thumbnailEl, dataUrl) {
    thumbnailEl.classList.remove('loading');
    thumbnailEl.innerHTML = `<img src="${dataUrl}" alt="Video thumbnail" />`;
  }

  // Attach event listeners
  selectFilesBtn.addEventListener('click', handleSelectFiles);
  selectFolderBtn.addEventListener('click', handleSelectFolder);
  dropZone.addEventListener('dragover', handleDragOver);
  dropZone.addEventListener('dragleave', handleDragLeave);
  dropZone.addEventListener('drop', handleDrop);
  dropZone.addEventListener('click', () => selectFilesBtn.click());

  // Export updateFileList so it can be called from other modules
  return { updateFileList, addFiles, removeFile };
}
