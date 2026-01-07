// File selection and handling functionality

import { getFileName, escapeHtml, formatDate } from './utils.js';

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
  }

  async function createFileItem(filePath) {
    const item = document.createElement('div');
    item.className = 'file-item';
    
    try {
      const metadata = await window.electronAPI.getFileMetadata(filePath);
      
      // Get video metadata (lazy load - don't await)
      let videoMetadataHtml = '';
      window.electronAPI.getVideoMetadata(filePath)
        .then(videoMetadata => {
          if (videoMetadata && videoMetadata.video) {
            const metadataDetails = item.querySelector('.video-metadata-details');
            if (metadataDetails) {
              const v = videoMetadata.video;
              const a = videoMetadata.audio;
              metadataDetails.innerHTML = `
                <div class="metadata-row">
                  <span class="metadata-label">Resolution:</span>
                  <span class="metadata-value">${v.width}×${v.height}</span>
                </div>
                <div class="metadata-row">
                  <span class="metadata-label">Codec:</span>
                  <span class="metadata-value">${v.codec.toUpperCase()}</span>
                </div>
                <div class="metadata-row">
                  <span class="metadata-label">FPS:</span>
                  <span class="metadata-value">${v.fps ? v.fps.toFixed(2) : 'N/A'}</span>
                </div>
                ${a ? `
                <div class="metadata-row">
                  <span class="metadata-label">Audio:</span>
                  <span class="metadata-value">${a.codec.toUpperCase()} ${a.channels}ch</span>
                </div>
                ` : ''}
              `;
              metadataDetails.style.display = 'block';
            }
          }
        })
        .catch(error => {
          console.error(`Error getting video metadata for ${filePath}:`, error);
        });
      
      // Generate thumbnail (lazy load - don't await)
      let thumbnailHtml = '<div class="file-thumbnail-placeholder">🎬</div>';
      window.electronAPI.generateThumbnail(filePath, 1)
        .then(thumbnailDataUrl => {
          const thumbnailImg = item.querySelector('.file-thumbnail');
          if (thumbnailImg) {
            thumbnailImg.src = thumbnailDataUrl;
            thumbnailImg.style.display = 'block';
            const placeholder = item.querySelector('.file-thumbnail-placeholder');
            if (placeholder) {
              placeholder.style.display = 'none';
            }
          }
        })
        .catch(error => {
          console.error(`Error generating thumbnail for ${filePath}:`, error);
          // Keep placeholder if thumbnail generation fails
        });
      
      item.innerHTML = `
        <div class="file-thumbnail-container">
          <img class="file-thumbnail" src="" alt="Video thumbnail" style="display: none;">
          ${thumbnailHtml}
        </div>
        <div class="file-info">
          <div class="file-name">${escapeHtml(getFileName(filePath))}</div>
          <div class="file-meta">
            <span>Size: ${metadata.sizeFormatted}</span>
            <span>Modified: ${formatDate(metadata.modified)}</span>
          </div>
          <div class="video-metadata-details" style="display: none; margin-top: 8px; font-size: 11px; color: var(--text-secondary);"></div>
        </div>
        <div class="file-actions">
          <button class="btn-remove" data-file="${escapeHtml(filePath)}">Remove</button>
        </div>
      `;
    } catch (error) {
      item.innerHTML = `
        <div class="file-thumbnail-container">
          <div class="file-thumbnail-placeholder">🎬</div>
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
