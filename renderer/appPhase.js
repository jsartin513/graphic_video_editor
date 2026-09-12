/** Central UI phase: pick → merge → progress (and selection-fallback after analysis errors). */

const PHASES = ['pick', 'merge', 'progress', 'selection-fallback'];

let currentPhase = 'pick';
let addingMore = false;

function getAppContainer() {
  return document.querySelector('.app-container');
}

export function getAppPhase() {
  return currentPhase;
}

export function isAddingMoreVideos() {
  return addingMore;
}

/**
 * @param {'pick'|'merge'|'progress'|'selection-fallback'} phase
 * @param {{ addingMore?: boolean }} [options]
 */
export function setAppPhase(phase, options = {}) {
  if (!PHASES.includes(phase)) return;
  currentPhase = phase;
  if (phase === 'pick') {
    addingMore = Boolean(options.addingMore);
  } else {
    addingMore = false;
  }

  const app = getAppContainer();
  if (!app) return;

  app.classList.remove('phase-pick', 'phase-merge', 'phase-progress', 'phase-selection-fallback');
  app.classList.add(`phase-${phase}`);
  if (addingMore) {
    app.classList.add('phase-adding-more');
  } else {
    app.classList.remove('phase-adding-more');
  }

  const hasFiles =
    window.appState &&
    Array.isArray(window.appState.selectedFiles) &&
    window.appState.selectedFiles.length > 0;
  app.classList.toggle('has-selected-files', hasFiles);

  const preview = document.getElementById('previewScreen');
  const progress = document.getElementById('progressScreen');
  if (preview) {
    preview.style.display = phase === 'merge' ? 'block' : 'none';
  }
  if (progress) {
    progress.style.display = phase === 'progress' ? 'block' : 'none';
  }

  const fileListContainer = document.getElementById('fileListContainer');
  if (fileListContainer) {
    const showList = phase === 'selection-fallback' && hasFiles;
    fileListContainer.hidden = !showList;
    fileListContainer.style.display = showList ? 'block' : 'none';
  }

  const addingMoreBar = document.getElementById('addingMoreBar');
  if (addingMoreBar) {
    const showBar = phase === 'pick' && addingMore;
    addingMoreBar.hidden = !showBar;
  }
}

export function resetToEmptyPick() {
  addingMore = false;
  setAppPhase('pick');
}
