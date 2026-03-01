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
    
    // Create all file items
    const items = [];
    for (const filePath of state.selectedFiles) {
      const item = await createFileItem(filePath);
      items.push(item);
      fileList.appendChild(item);
    }
    
    // Perform compatibility check if we have multiple files
    if (state.selectedFiles.length > 1) {
      await checkCompatibility(items);
    }
  }
  
  async function checkCompatibility(items) {
    // Extract metadata from all items
    const metadataList = items.map(item => {
      const metadataStr = item.dataset.videoMetadata;
      return metadataStr ? JSON.parse(metadataStr) : null;
    }).filter(m => m !== null);
    
    if (metadataList.length < 2) return;
    
    // Find the most common values for each property
    const properties = ['width', 'height', 'fps', 'videoCodec'];
    const warnings = [];
    
    properties.forEach(prop => {
      const values = metadataList.map(m => m[prop]).filter(v => v !== null);
      const uniqueValues = [...new Set(values)];
      
      if (uniqueValues.length > 1) {
        // Multiple different values found
        warnings.push({
          property: prop,
          values: uniqueValues
        });
      }
    });
    
    // If there are warnings, highlight mismatched items
    if (warnings.length > 0) {
      items.forEach((item, index) => {
        const metadataStr = item.dataset.videoMetadata;
        if (!metadataStr) return;
        
        const metadata = JSON.parse(metadataStr);
        const mismatches = [];
        
        warnings.forEach(warning => {
          // Find the most common value
          const allValues = metadataList.map(m => m[warning.property]);
          const valueCounts = {};
          allValues.forEach(v => {
            valueCounts[v] = (valueCounts[v] || 0) + 1;
          });
          
          const keys = Object.keys(valueCounts);
          if (keys.length === 0) return;
          
          const mostCommon = keys.reduce((a, b) => 
            valueCounts[a] > valueCounts[b] ? a : b
          );
          
          // Check if this item's value differs from most common
          if (metadata[warning.property] !== mostCommon) {
            mismatches.push(warning.property);
          }
        });
        
        // Add warning indicator if there are mismatches
        if (mismatches.length > 0) {
          item.classList.add('metadata-mismatch');
          
          // Add warning message
          const warningDiv = document.createElement('div');
          warningDiv.className = 'compatibility-warning';
          warningDiv.innerHTML = `
            <span class="warning-icon" aria-hidden="true">⚠️</span>
            <span class="warning-text">
              This video has different ${mismatches.join(', ')} compared to other files.
              Merging may require re-encoding.
            </span>
          `;
          
          const fileInfo = item.querySelector('.file-info');
          fileInfo.insertBefore(warningDiv, fileInfo.querySelector('.metadata-toggle') || fileInfo.querySelector('.file-actions'));
        }
      });
      
      // Add a summary warning at the top of the file list
      const summaryWarning = document.createElement('div');
      summaryWarning.className = 'compatibility-summary';
      summaryWarning.innerHTML = `
        <span class="warning-icon" aria-hidden="true">⚠️</span>
        <div class="warning-content">
          <strong>Compatibility Warning:</strong>
          <p>The selected videos have different properties. This may affect merge quality:</p>
          <ul>
            ${warnings.map(w => {
              const propName = w.property === 'fps' ? 'frame rate' : 
                               w.property === 'videoCodec' ? 'video codec' :
                               w.property;
              return `<li><strong>${propName}:</strong> ${w.values.join(', ')}</li>`;
            }).join('')}
          </ul>
        </div>
      `;
      
      fileList.insertBefore(summaryWarning, fileList.firstChild);
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
                <span class="metadata-value">${formatBitrate(videoMetadata.bitrate)}</span>
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
        
        const TOGGLE_TEXT = {
          collapsed: { icon: '▶', text: 'Show Details' },
          expanded: { icon: '▼', text: 'Hide Details' }
        };
        
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
          
          if (isExpanded) {
            detailsSection.style.display = 'none';
            toggleBtn.setAttribute('aria-expanded', 'false');
            const { icon, text } = TOGGLE_TEXT.collapsed;
            toggleBtn.innerHTML = `<span class="toggle-icon">${icon}</span> ${text}`;
          } else {
            detailsSection.style.display = 'block';
            toggleBtn.setAttribute('aria-expanded', 'true');
            const { icon, text } = TOGGLE_TEXT.expanded;
            toggleBtn.innerHTML = `<span class="toggle-icon">${icon}</span> ${text}`;
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
