// File selection and handling functionality

import { getFileName, formatDate } from './utils.js';

// Metadata cache to avoid redundant IPC calls
const metadataCache = new Map();

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
    // Clear cache entry for removed file
    metadataCache.delete(filePath);
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
    
    // Performance optimization: Fetch all metadata in parallel
    const metadataPromises = state.selectedFiles.map(filePath => 
      getOrFetchMetadata(filePath)
    );
    const metadataResults = await Promise.all(metadataPromises);
    
    // Performance optimization: Use DocumentFragment for batch DOM updates
    const fragment = document.createDocumentFragment();
    state.selectedFiles.forEach((filePath, index) => {
      const item = createFileItem(filePath, metadataResults[index]);
      fragment.appendChild(item);
    });
    
    fileList.appendChild(fragment);
  }
  
  // Get metadata from cache or fetch from main process
  async function getOrFetchMetadata(filePath) {
    if (metadataCache.has(filePath)) {
      return metadataCache.get(filePath);
    }
    
    try {
      const metadata = await window.electronAPI.getFileMetadata(filePath);
      metadataCache.set(filePath, metadata);
      return metadata;
    } catch (error) {
      console.error(`Error fetching metadata for ${filePath}:`, error);
      return null;
    }
  }

  // Performance optimization: Create DOM elements directly instead of using innerHTML
  function createFileItem(filePath, metadata) {
    const item = document.createElement('div');
    item.className = 'file-item';
    
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    
    const fileName = document.createElement('div');
    fileName.className = 'file-name';
    fileName.textContent = getFileName(filePath);
    fileInfo.appendChild(fileName);
    
    if (metadata) {
      const fileMeta = document.createElement('div');
      fileMeta.className = 'file-meta';
      
      const sizeSpan = document.createElement('span');
      sizeSpan.textContent = `Size: ${metadata.sizeFormatted}`;
      fileMeta.appendChild(sizeSpan);
      
      const modifiedSpan = document.createElement('span');
      modifiedSpan.textContent = `Modified: ${formatDate(metadata.modified)}`;
      fileMeta.appendChild(modifiedSpan);
      
      fileInfo.appendChild(fileMeta);
    }
    
    const fileActions = document.createElement('div');
    fileActions.className = 'file-actions';
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => removeFile(filePath));
    fileActions.appendChild(removeBtn);
    
    item.appendChild(fileInfo);
    item.appendChild(fileActions);

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
