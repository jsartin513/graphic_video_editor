// Keyboard shortcuts module
// Handles global keyboard shortcuts for the application

/**
 * Detect platform for displaying correct modifier key symbols
 */
function getPlatform() {
  const userAgent = navigator.userAgent.toLowerCase();
  const isMac = userAgent.indexOf('mac') !== -1;
  return {
    isMac,
    modifierKey: isMac ? 'Meta' : 'Control',
    modifierSymbol: isMac ? '⌘' : 'Ctrl',
    optionSymbol: isMac ? '⌥' : 'Alt'
  };
}

/**
 * Initialize keyboard shortcuts
 * @param {Object} domElements - DOM element references
 * @param {Object} handlers - Event handlers for each shortcut action
 */
export function initializeKeyboardShortcuts(domElements, handlers) {
  const platform = getPlatform();
  
  // Update button labels with keyboard shortcuts
  updateButtonLabels(domElements, platform);
  
  // Set up global keyboard event listener
  document.addEventListener('keydown', (event) => {
    handleKeyboardEvent(event, domElements, handlers, platform);
  });
  
  return {
    platform,
    getShortcutHint: (key) => getShortcutHint(key, platform)
  };
}

/**
 * Update button labels to include keyboard shortcut hints
 */
function updateButtonLabels(domElements, platform) {
  const shortcuts = [
    { element: domElements.selectFilesBtn, hint: `${platform.modifierSymbol}+O` },
    { element: domElements.selectFolderBtn, hint: `${platform.modifierSymbol}+D` },
    { element: domElements.prepareMergeBtn, hint: `${platform.modifierSymbol}+M`, secondaryHint: 'Enter' },
    { element: domElements.mergeBtn, hint: 'Enter' },
    { element: domElements.backBtn, hint: 'Esc' }
  ];
  
  shortcuts.forEach(({ element, hint, secondaryHint }) => {
    if (element) {
      // Create shortcut hint text
      const hintText = secondaryHint ? `${hint} or ${secondaryHint}` : hint;
      
      // Get the icon element if it exists
      const icon = element.querySelector('.btn-icon');
      
      // Extract current text content (excluding icon)
      let currentText = '';
      element.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          currentText += node.textContent;
        }
      });
      
      // Remove any existing shortcut hints
      const cleanText = currentText.trim().replace(/\s*\([^)]+\)\s*$/, '').trim();
      
      // Update button content
      if (icon) {
        // Keep the icon element and update text content
        element.childNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            node.textContent = ` ${cleanText} (${hintText})`;
          }
        });
      } else {
        element.textContent = `${cleanText} (${hintText})`;
      }
      
      // Update aria-label to include shortcut
      const ariaLabel = element.getAttribute('aria-label');
      if (ariaLabel && !ariaLabel.includes('keyboard shortcut')) {
        element.setAttribute('aria-label', `${ariaLabel}. Keyboard shortcut: ${hintText}`);
      }
    }
  });
}
    }
  });
}

/**
 * Get shortcut hint for a specific action
 */
function getShortcutHint(key, platform) {
  const hints = {
    'selectFiles': `${platform.modifierSymbol}+O`,
    'selectFolder': `${platform.modifierSymbol}+D`,
    'prepareMerge': `${platform.modifierSymbol}+M or Enter`,
    'merge': 'Enter',
    'back': 'Esc',
    'save': `${platform.modifierSymbol}+S`
  };
  
  return hints[key] || '';
}

/**
 * Handle keyboard events and trigger appropriate actions
 */
function handleKeyboardEvent(event, domElements, handlers, platform) {
  const { key, code } = event;
  const isModifier = event.getModifierState(platform.modifierKey);
  const isShift = event.shiftKey;
  const isAlt = event.altKey;
  
  // Check if we're in an input field (don't trigger shortcuts)
  const activeElement = document.activeElement;
  const isInInput = activeElement && (
    activeElement.tagName === 'INPUT' ||
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.contentEditable === 'true'
  );
  
  // Determine current screen/modal state
  const currentState = determineCurrentState(domElements);
  
  // Handle shortcuts based on current state
  let handled = false;
  
  // Cmd/Ctrl+O - Select Files
  if (isModifier && (key === 'o' || key === 'O') && !isShift && !isAlt) {
    if (currentState.canSelectFiles && handlers.selectFiles) {
      event.preventDefault();
      handlers.selectFiles();
      handled = true;
    }
  }
  
  // Cmd/Ctrl+D - Select Folder
  else if (isModifier && (key === 'd' || key === 'D') && !isShift && !isAlt) {
    if (currentState.canSelectFolder && handlers.selectFolder) {
      event.preventDefault();
      handlers.selectFolder();
      handled = true;
    }
  }
  
  // Cmd/Ctrl+M - Prepare Merge
  else if (isModifier && (key === 'm' || key === 'M') && !isShift && !isAlt) {
    if (currentState.canPrepareMerge && handlers.prepareMerge) {
      event.preventDefault();
      handlers.prepareMerge();
      handled = true;
    }
  }
  
  // Cmd/Ctrl+S - Save Preferences
  else if (isModifier && (key === 's' || key === 'S') && !isShift && !isAlt) {
    if (currentState.canSavePreferences && handlers.savePreferences) {
      event.preventDefault();
      handlers.savePreferences();
      handled = true;
    }
  }
  
  // Enter - Context-dependent action (Prepare Merge or Merge)
  else if ((key === 'Enter' || code === 'Enter') && !isModifier && !isShift && !isAlt && !isInInput) {
    if (currentState.canMerge && handlers.merge) {
      event.preventDefault();
      handlers.merge();
      handled = true;
    } else if (currentState.canPrepareMerge && handlers.prepareMerge) {
      event.preventDefault();
      handlers.prepareMerge();
      handled = true;
    }
  }
  
  // Escape - Cancel/Go Back
  else if ((key === 'Escape' || code === 'Escape') && !isModifier && !isShift && !isAlt) {
    if (currentState.canGoBack && handlers.goBack) {
      event.preventDefault();
      handlers.goBack();
      handled = true;
    } else if (currentState.hasOpenModal && handlers.closeModal) {
      event.preventDefault();
      handlers.closeModal();
      handled = true;
    }
  }
  
  if (handled) {
    // Provide feedback that shortcut was triggered (for debugging)
    console.log(`Keyboard shortcut triggered: ${key}`);
  }
}

/**
 * Determine the current state of the application to know which shortcuts are available
 */
function determineCurrentState(domElements) {
  const state = {
    canSelectFiles: false,
    canSelectFolder: false,
    canPrepareMerge: false,
    canMerge: false,
    canGoBack: false,
    canSavePreferences: false,
    hasOpenModal: false
  };
  
  // Check if modals are open
  const prerequisitesModal = domElements.prerequisitesModal;
  const splitVideoModal = domElements.splitVideoModal;
  
  if (prerequisitesModal && prerequisitesModal.style.display !== 'none') {
    state.hasOpenModal = true;
    return state;
  }
  
  if (splitVideoModal && splitVideoModal.style.display !== 'none') {
    state.hasOpenModal = true;
    return state;
  }
  
  // Check current screen
  const previewScreen = domElements.previewScreen;
  const progressScreen = domElements.progressScreen;
  const fileListContainer = domElements.fileListContainer;
  
  const isPreviewVisible = previewScreen && previewScreen.style.display !== 'none';
  const isProgressVisible = progressScreen && progressScreen.style.display !== 'none';
  const isFileListVisible = fileListContainer && fileListContainer.style.display !== 'none';
  
  // File selection screen
  if (!isPreviewVisible && !isProgressVisible) {
    state.canSelectFiles = true;
    state.canSelectFolder = true;
    
    // Check if prepare merge button is visible and enabled
    const prepareMergeBtn = domElements.prepareMergeBtn;
    if (prepareMergeBtn && prepareMergeBtn.style.display !== 'none' && !prepareMergeBtn.disabled) {
      state.canPrepareMerge = true;
    }
  }
  
  // Preview screen
  if (isPreviewVisible && !isProgressVisible) {
    state.canGoBack = true;
    
    // Check if merge button is visible and enabled
    const mergeBtn = domElements.mergeBtn;
    if (mergeBtn && !mergeBtn.disabled) {
      state.canMerge = true;
    }
  }
  
  // Progress screen - no shortcuts available during merge
  if (isProgressVisible) {
    // No shortcuts during progress
  }
  
  return state;
}

/**
 * Get keyboard shortcut help text for display
 */
export function getKeyboardShortcutsHelp() {
  const platform = getPlatform();
  
  return {
    title: 'Keyboard Shortcuts',
    shortcuts: [
      { keys: `${platform.modifierSymbol}+O`, description: 'Open files dialog' },
      { keys: `${platform.modifierSymbol}+D`, description: 'Open folder dialog' },
      { keys: `${platform.modifierSymbol}+M`, description: 'Prepare merge' },
      { keys: 'Enter', description: 'Start merge / Prepare merge' },
      { keys: 'Esc', description: 'Cancel / Go back' },
      { keys: `${platform.modifierSymbol}+S`, description: 'Save preferences' }
    ]
  };
}
