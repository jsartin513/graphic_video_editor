// File selection and handling functionality

import { getFileName, escapeHtml, escapeAttr, formatDate, formatDuration, formatBitrate, formatResolution, formatFrameRate, getDirectoryPath } from './utils.js';

// State will be managed in the main renderer.js
export function initializeFileHandling(state, domElements, trimVideo = null, undoRedo = null) {
  const {
    selectFilesBtn,
    selectFolderBtn,
    dropZone,
    fileList,
    fileCount,
    prepareMergeBtn,
    compareVideosBtn,
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
    const duplicates = [];
    const added = [];
    const fileNameMap = new Map(); // filename -> full path
    
    // Build map of existing filenames
    for (const existingFile of state.selectedFiles) {
      const fileName = getFileName(existingFile);
      if (!fileNameMap.has(fileName)) {
        fileNameMap.set(fileName, []);
      }
      fileNameMap.get(fileName).push(existingFile);
    }
    
    // Check for duplicates and add new files
    for (const file of newFiles) {
      // Skip if exact path already exists
      if (state.selectedFiles.includes(file)) {
        continue;
      }
      
      const fileName = getFileName(file);
      const existingPaths = fileNameMap.get(fileName) || [];
      
      if (existingPaths.length > 0) {
        // Duplicate filename detected
        duplicates.push({
          newFile: file,
          fileName: fileName,
          existingFiles: existingPaths
        });
      } else {
        // No duplicate, add file
        state.selectedFiles.push(file);
        if (!fileNameMap.has(fileName)) {
          fileNameMap.set(fileName, []);
        }
        fileNameMap.get(fileName).push(file);
        added.push(file);
      }
    }
    
    // Show error if duplicates found
    if (duplicates.length > 0) {
      const duplicateNames = duplicates.map(d => d.fileName).join(', ');
      const message = duplicates.length === 1
        ? `File "${duplicateNames}" is already in the list. Each file must have a unique name.`
        : `Files with duplicate names detected: ${duplicateNames}. Each file must have a unique name.`;
      
      alert(message);
      
      // Optionally still add files with a suffix to make them unique
      // For now, we'll just show the error and not add duplicates
    }
    
    // Save state for undo/redo if files were added
    if (undoRedo && added.length > 0) {
      undoRedo.saveState(`Added ${added.length} file${added.length > 1 ? 's' : ''}`);
    }
    
    // Update UI only if files were added
    if (added.length > 0 || duplicates.length === 0) {
      updateFileList();
    }
  }

  function removeFile(filePath) {
    const fileName = getFileName(filePath);
    state.selectedFiles = state.selectedFiles.filter(f => f !== filePath);
    
    // Save state for undo/redo
    if (undoRedo) {
      undoRedo.saveState(`Removed ${fileName}`);
    }
    
    updateFileList();
  }

  async function updateFileList() {
    fileList.innerHTML = '';
    
    if (state.selectedFiles.length === 0) {
      fileListContainer.style.display = 'none';
      prepareMergeBtn.style.display = 'none';
      if (compareVideosBtn) {
        compareVideosBtn.style.display = 'none';
      }
      return;
    }
    
    fileListContainer.style.display = 'block';
    prepareMergeBtn.style.display = 'inline-flex';
    
    // Show compare button only when exactly 2 files are selected
    if (compareVideosBtn) {
      if (state.selectedFiles.length === 2) {
        compareVideosBtn.style.display = 'inline-flex';
      } else {
        compareVideosBtn.style.display = 'none';
      }
    }
    
    fileCount.textContent = `${state.selectedFiles.length} file${state.selectedFiles.length !== 1 ? 's' : ''}`;
    
    // Create all file items in parallel
    const items = await Promise.all(
      state.selectedFiles.map(filePath => createFileItem(filePath))
    );
    // Performance optimization: Use DocumentFragment for batch DOM updates
    const fragment = document.createDocumentFragment();
    for (const item of items) {
      fragment.appendChild(item);
    }
    fileList.appendChild(fragment);

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
        if (!metadata) return;
        const mismatches = [];
        
        warnings.forEach(warning => {
          // Find the most common value using a Map to preserve original types
          const allValues = metadataList.map(m => m[warning.property]);
          const valueCounts = new Map();
          allValues.forEach(v => {
            valueCounts.set(v, (valueCounts.get(v) || 0) + 1);
          });
          
          if (valueCounts.size === 0) return;
          
          let mostCommon = null;
          let maxCount = 0;
          for (const [v, count] of valueCounts) {
            if (count > maxCount) {
              maxCount = count;
              mostCommon = v;
            }
          }
          
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
              return `<li><strong>${escapeHtml(propName)}:</strong> ${w.values.map(v => escapeHtml(String(v))).join(', ')}</li>`;
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
    const fileName = getFileName(filePath);

    try {
      const basicMetadata = await window.electronAPI.getFileMetadata(filePath);
      let videoMetadata = null;
      let flatMetadata = null; // For compatibility checking: { width, height, fps, videoCodec }

      try {
        videoMetadata = await window.electronAPI.getVideoMetadata(filePath);
        if (videoMetadata && videoMetadata.video) {
          const v = videoMetadata.video;
          flatMetadata = {
            width: v.width || null,
            height: v.height || null,
            fps: v.fps || null,
            videoCodec: v.codec || null
          };
        }
      } catch (error) {
        console.error(`Error getting video metadata for ${filePath}:`, error);
      }

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
        });

      const v = videoMetadata?.video;
      const duration = videoMetadata?.duration ?? null;
      const bitrate = videoMetadata?.bitrate ?? (v?.bitrate ?? null);

      let html = `
        <div class="file-thumbnail-container">
          <img class="file-thumbnail" src="" alt="Video thumbnail" style="display: none;">
          ${thumbnailHtml}
        </div>
        <div class="file-info">
          <div class="file-name">${escapeHtml(fileName)}</div>
          <div class="file-meta">
            <span>Size: ${basicMetadata?.sizeFormatted ?? 'Unknown'}</span>
            <span>Modified: ${basicMetadata ? formatDate(basicMetadata.modified) : ''}</span>
            ${flatMetadata ? `
            <span>Duration: ${formatDuration(duration)}</span>
            <span>Resolution: ${formatResolution(v?.width, v?.height)}</span>
            ` : ''}
          </div>
      `;

      if (flatMetadata) {
        html += `
          <button class="metadata-toggle" aria-expanded="false">
            <span class="toggle-icon">▶</span> Show Details
          </button>
          <div class="metadata-details" style="display: none;">
            <div class="metadata-grid">
              <div class="metadata-item">
                <span class="metadata-label">Resolution:</span>
                <span class="metadata-value">${formatResolution(v?.width, v?.height)}</span>
              </div>
              <div class="metadata-item">
                <span class="metadata-label">Frame Rate:</span>
                <span class="metadata-value">${formatFrameRate(v?.fps)}</span>
              </div>
              <div class="metadata-item">
                <span class="metadata-label">Video Codec:</span>
                <span class="metadata-value">${v?.codec ? escapeHtml(v.codec) : 'Unknown'}</span>
              </div>
              <div class="metadata-item">
                <span class="metadata-label">Bitrate:</span>
                <span class="metadata-value">${formatBitrate(bitrate)}</span>
              </div>
              <div class="metadata-item">
                <span class="metadata-label">Duration:</span>
                <span class="metadata-value">${formatDuration(duration)}</span>
              </div>
              <div class="metadata-item">
                <span class="metadata-label">File Size:</span>
                <span class="metadata-value">${basicMetadata?.sizeFormatted ?? 'Unknown'}</span>
              </div>
            </div>
          </div>
        `;
      }

      html += `
        </div>
        <div class="file-actions">
          ${trimVideo ? `<button class="btn-trim" data-file="${escapeAttr(filePath)}" data-name="${escapeAttr(fileName)}">✂️ Trim</button>` : ''}
          <button class="btn-remove" data-file="${escapeAttr(filePath)}" aria-label="Remove ${escapeHtml(fileName)}">Remove</button>
        </div>
      `;

      item.innerHTML = html;

      if (flatMetadata) {
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

      item.dataset.videoMetadata = JSON.stringify(flatMetadata);
      
    } catch (error) {
      const fileName = getFileName(filePath);
      
      item.innerHTML = `
        <div class="file-thumbnail-container">
          <div class="file-thumbnail-placeholder">🎬</div>
        </div>
        <div class="file-info">
          <div class="file-name">${escapeHtml(fileName)}</div>
        </div>
        <div class="file-actions">
          ${trimVideo ? `<button class="btn-trim" data-file="${escapeAttr(filePath)}" data-name="${escapeAttr(fileName)}">✂️ Trim</button>` : ''}
          <button class="btn-remove" data-file="${escapeAttr(filePath)}" aria-label="Remove ${escapeHtml(fileName)}">Remove</button>
        </div>
      `;
    }

    // Add trim button handler if trimVideo module is available
    if (trimVideo) {
      const trimBtn = item.querySelector('.btn-trim');
      if (trimBtn) {
        trimBtn.addEventListener('click', () => {
          const file = trimBtn.getAttribute('data-file');
          const name = trimBtn.getAttribute('data-name');
          const directory = getDirectoryPath(filePath);
          trimVideo.showTrimVideoModal(file, name, directory);
        });
      }
    }

    // Add remove button handler
    const removeBtn = item.querySelector('.btn-remove');
    removeBtn.addEventListener('click', () => removeFile(filePath));

    // Make item draggable for reordering
    item.draggable = true;
    item.setAttribute('data-file-index', state.selectedFiles.indexOf(filePath));
    item.classList.add('draggable-item');
    
    // Drag event handlers
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', filePath);
      item.classList.add('dragging');
      
      // Store the dragged item reference
      state.draggedItem = item;
      state.draggedIndex = state.selectedFiles.indexOf(filePath);
    });
    
    item.addEventListener('dragend', (e) => {
      item.classList.remove('dragging');
      
      // Clear drop indicators
      document.querySelectorAll('.drag-over-item').forEach(el => {
        el.classList.remove('drag-over-item');
      });
      
      delete state.draggedItem;
      delete state.draggedIndex;
    });
    
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      // Only show drop indicator if dragging over a different item
      if (state.draggedItem && item !== state.draggedItem) {
        item.classList.add('drag-over-item');
      }
    });
    
    item.addEventListener('dragleave', (e) => {
      // Only remove indicator if not dragging over a child element
      if (!item.contains(e.relatedTarget)) {
        item.classList.remove('drag-over-item');
      }
    });
    
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      item.classList.remove('drag-over-item');
      
      if (state.draggedItem && state.draggedIndex !== undefined) {
        const draggedFilePath = state.selectedFiles[state.draggedIndex];
        const dropIndex = state.selectedFiles.indexOf(filePath);
        
        if (draggedFilePath && dropIndex !== -1 && state.draggedIndex !== dropIndex) {
          // Reorder files in state
          const originalIndex = state.draggedIndex;
          state.selectedFiles.splice(originalIndex, 1);
          const targetIndex = originalIndex < dropIndex ? dropIndex - 1 : dropIndex;
          state.selectedFiles.splice(targetIndex, 0, draggedFilePath);
          
          // Save state for undo/redo if available (will be integrated when undo/redo feature is merged)
          if (typeof undoRedo !== 'undefined' && undoRedo) {
            undoRedo.saveState(`Reordered files`);
          }
          
          // Update UI
          updateFileList();
        }
      }
    });

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
  return { updateFileList, addFiles, removeFile, updateFileCount };
}
