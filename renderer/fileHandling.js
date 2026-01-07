// File selection and handling functionality

import { getFileName, escapeHtml, formatDate, formatDuration, formatBitrate, formatResolution, formatFrameRate } from './utils.js';

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
      const basicMetadata = await window.electronAPI.getFileMetadata(filePath);
      const videoMetadata = await window.electronAPI.getVideoMetadataDetailed(filePath);
      
      // Build the basic file info
      let html = `
        <div class="file-info">
          <div class="file-name">${escapeHtml(getFileName(filePath))}</div>
          <div class="file-meta">
            <span>Size: ${basicMetadata.sizeFormatted}</span>
            <span>Modified: ${formatDate(basicMetadata.modified)}</span>
      `;
      
      // Add video metadata if available
      if (videoMetadata) {
        html += `
            <span>Duration: ${formatDuration(videoMetadata.duration)}</span>
            <span>Resolution: ${formatResolution(videoMetadata.width, videoMetadata.height)}</span>
        `;
      }
      
      html += `
          </div>
      `;
      
      // Add expandable detailed metadata section if video metadata is available
      if (videoMetadata) {
        html += `
          <button class="metadata-toggle" aria-expanded="false" aria-label="Show detailed metadata">
            <span class="toggle-icon">▶</span> Show Details
          </button>
          <div class="metadata-details" style="display: none;">
            <div class="metadata-grid">
              <div class="metadata-item">
                <span class="metadata-label">Resolution:</span>
                <span class="metadata-value">${formatResolution(videoMetadata.width, videoMetadata.height)}</span>
              </div>
              <div class="metadata-item">
                <span class="metadata-label">Frame Rate:</span>
                <span class="metadata-value">${formatFrameRate(videoMetadata.fps)}</span>
              </div>
              <div class="metadata-item">
                <span class="metadata-label">Video Codec:</span>
                <span class="metadata-value">${videoMetadata.videoCodec || 'Unknown'}</span>
              </div>
              <div class="metadata-item">
                <span class="metadata-label">Bitrate:</span>
                <span class="metadata-value">${formatBitrate(videoMetadata.formatBitrate || videoMetadata.videoBitrate)}</span>
              </div>
              <div class="metadata-item">
                <span class="metadata-label">Duration:</span>
                <span class="metadata-value">${formatDuration(videoMetadata.duration)}</span>
              </div>
              <div class="metadata-item">
                <span class="metadata-label">File Size:</span>
                <span class="metadata-value">${basicMetadata.sizeFormatted}</span>
              </div>
            </div>
          </div>
        `;
      }
      
      html += `
        </div>
        <div class="file-actions">
          <button class="btn-remove" data-file="${escapeHtml(filePath)}" aria-label="Remove ${escapeHtml(getFileName(filePath))}">Remove</button>
        </div>
      `;
      
      item.innerHTML = html;
      
      // Add toggle handler for metadata details if available
      if (videoMetadata) {
        const toggleBtn = item.querySelector('.metadata-toggle');
        const detailsSection = item.querySelector('.metadata-details');
        const toggleIcon = item.querySelector('.toggle-icon');
        
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
          
          if (isExpanded) {
            detailsSection.style.display = 'none';
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleIcon.textContent = '▶';
            toggleBtn.innerHTML = `<span class="toggle-icon">▶</span> Show Details`;
          } else {
            detailsSection.style.display = 'block';
            toggleBtn.setAttribute('aria-expanded', 'true');
            toggleIcon.textContent = '▼';
            toggleBtn.innerHTML = `<span class="toggle-icon">▼</span> Hide Details`;
          }
        });
      }
      
      // Store metadata for compatibility checking
      item.dataset.videoMetadata = JSON.stringify(videoMetadata);
      
    } catch (error) {
      item.innerHTML = `
        <div class="file-info">
          <div class="file-name">${escapeHtml(getFileName(filePath))}</div>
        </div>
        <div class="file-actions">
          <button class="btn-remove" data-file="${escapeHtml(filePath)}" aria-label="Remove ${escapeHtml(getFileName(filePath))}">Remove</button>
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
