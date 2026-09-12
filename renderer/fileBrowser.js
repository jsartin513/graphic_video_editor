import { escapeHtml, escapeAttr, getFileName } from './utils.js';

let activeBrowser = null;
let ignoreEscapeUntil = 0;

function $(id) {
  return document.getElementById(id);
}

function requiredEl(id) {
  const el = $(id);
  if (!el) {
    throw new Error(`Missing page element: ${id}`);
  }
  return el;
}

/**
 * In-app directory browser shown inline on the main screen.
 * Does not use macOS NSOpenPanel or a full-screen overlay.
 * @param {{ mode: 'files'|'folder'|'single-file', title?: string, startPath?: string }} options
 * @returns {Promise<{ canceled: boolean, files?: string[], folderPath?: string|null }>}
 */
export function openFileBrowser(options = {}) {
  const mode = options.mode || 'files';
  const title = options.title || (mode === 'folder' ? 'Select Folder' : 'Select Videos');

  if (activeBrowser) {
    activeBrowser.cancel();
  }

  return new Promise((resolve) => {
    const panel = requiredEl('fileBrowserPanel');
    const titleEl = requiredEl('fileBrowserTitle');
    const pathInput = requiredEl('fileBrowserPath');
    const listEl = requiredEl('fileBrowserList');
    const statusEl = requiredEl('fileBrowserStatus');
    const confirmBtn = requiredEl('fileBrowserConfirmBtn');
    const upBtn = requiredEl('fileBrowserUpBtn');
    const shortcutsEl = requiredEl('fileBrowserShortcuts');
    const goBtn = $('fileBrowserGoBtn');

    let currentPath = '';
    let currentParent = null;
    let selectedFiles = new Set();
    let selectedFolder = null;
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      activeBrowser = null;
      document.removeEventListener('keydown', onKeyDown, true);
      resolve(result);
      if (typeof window.mountHomeFileBrowser === 'function') {
        window.mountHomeFileBrowser('files');
      } else {
        panel.hidden = false;
      }
    };

    const cancel = () => finish({ canceled: true, files: [], folderPath: null });

    activeBrowser = { cancel };

    function updateConfirmButton() {
      if (mode === 'folder') {
        confirmBtn.disabled = !currentPath;
        confirmBtn.innerHTML = '<span class="btn-icon" aria-hidden="true">📂</span> Use This Folder';
        return;
      }
      if (mode === 'single-file') {
        confirmBtn.disabled = selectedFiles.size !== 1;
        confirmBtn.innerHTML = '<span class="btn-icon" aria-hidden="true">📁</span> Use This Video';
        return;
      }
      confirmBtn.disabled = selectedFiles.size === 0;
      const n = selectedFiles.size;
      confirmBtn.innerHTML = `<span class="btn-icon" aria-hidden="true">📁</span> Add ${n} Video${n === 1 ? '' : 's'}`;
    }

    function renderEntries(listing) {
      listEl.innerHTML = '';
      if (!listing.entries.length) {
        listEl.innerHTML = '<div class="file-browser-empty">No folders or video files in this directory. Paste a path above or use Home / Desktop / Movies.</div>';
        return;
      }

      for (const entry of listing.entries) {
        const row = document.createElement('div');
        const selected = entry.isDirectory
          ? selectedFolder === entry.path
          : selectedFiles.has(entry.path);
        row.className = `file-browser-row${selected ? ' selected' : ''}`;
        row.setAttribute('role', 'option');
        row.dataset.path = entry.path;

        const icon = entry.isDirectory ? '📁' : '🎬';
        const checkbox = (!entry.isDirectory && mode !== 'folder')
          ? `<input type="checkbox" class="file-browser-check" ${selectedFiles.has(entry.path) ? 'checked' : ''} aria-label="Select ${escapeAttr(entry.name)}">`
          : '';

        row.innerHTML = `
          ${checkbox}
          <span class="file-browser-icon" aria-hidden="true">${icon}</span>
          <span class="file-browser-name">${escapeHtml(entry.name)}</span>
        `;

        row.addEventListener('click', () => {
          if (entry.isDirectory) {
            navigate(entry.path);
            return;
          }
          if (mode === 'folder') return;
          if (mode === 'single-file') {
            selectedFiles = new Set([entry.path]);
          } else {
            toggleFile(entry);
          }
          renderEntries(listing);
          updateConfirmButton();
        });

        listEl.appendChild(row);
      }
    }

    function toggleFile(entry) {
      if (entry.isDirectory) return;
      if (mode === 'single-file') {
        selectedFiles = new Set([entry.path]);
        return;
      }
      if (selectedFiles.has(entry.path)) selectedFiles.delete(entry.path);
      else selectedFiles.add(entry.path);
    }

    async function navigate(dirPath) {
      if (!dirPath) return;
      statusEl.textContent = 'Loading…';
      try {
        const listing = await window.electronAPI.listDirectory(dirPath);
        currentPath = listing.path;
        currentParent = listing.parent;
        pathInput.value = listing.path;
        selectedFolder = listing.path;
        selectedFiles = new Set([...selectedFiles].filter((p) => listing.entries.some((e) => e.path === p)));
        upBtn.disabled = !currentParent;
        renderEntries(listing);
        const videos = listing.entries.filter((e) => e.isVideo).length;
        const folders = listing.entries.filter((e) => e.isDirectory).length;
        statusEl.textContent = `${folders} folder${folders === 1 ? '' : 's'}, ${videos} video${videos === 1 ? '' : 's'} — click a folder to open it, or click videos then Add.`;
        updateConfirmButton();
      } catch (error) {
        statusEl.textContent = error.message || 'Could not open that folder';
        listEl.innerHTML = `<div class="file-browser-empty">${escapeHtml(error.message || 'Could not open that folder')}</div>`;
      }
    }

    async function loadShortcuts() {
      shortcutsEl.innerHTML = '';
      try {
        const { roots, recents, volumes } = await window.electronAPI.getFileBrowserRoots();
        const groups = [
          { items: roots.map((r) => ({ label: r.label, path: r.path })) },
          { items: (recents || []).slice(0, 6).map((p) => ({ label: getFileName(p) || p, path: p })) },
          { items: (volumes || []).map((v) => ({ label: v.name, path: v.path })) }
        ];
        for (const group of groups) {
          if (!group.items.length) continue;
          for (const item of group.items) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-secondary btn-small file-browser-shortcut';
            btn.title = item.path;
            btn.textContent = item.label;
            btn.addEventListener('click', () => navigate(item.path));
            shortcutsEl.appendChild(btn);
          }
        }
      } catch (error) {
        statusEl.textContent = `Could not load folders: ${error.message || error}`;
      }
    }

    function confirm() {
      if (mode === 'folder') {
        if (!currentPath) return;
        finish({ canceled: false, files: [], folderPath: currentPath });
        return;
      }
      const files = [...selectedFiles];
      if (!files.length) return;
      finish({ canceled: false, files, folderPath: currentPath });
    }

    function onKeyDown(event) {
      if (event.key !== 'Escape') return;
      if (Date.now() < ignoreEscapeUntil) return;
      event.preventDefault();
      panel.hidden = true;
      cancel();
    }

    titleEl.textContent = title;
    selectedFiles = new Set();
    selectedFolder = null;
    panel.hidden = false;
    ignoreEscapeUntil = Date.now() + 600;
    document.addEventListener('keydown', onKeyDown, true);
    updateConfirmButton();
    panel.scrollIntoView({ block: 'nearest' });

    requiredEl('fileBrowserCloseBtn').onclick = () => {
      panel.hidden = true;
      cancel();
    };
    requiredEl('fileBrowserCancelBtn').onclick = () => {
      panel.hidden = true;
      cancel();
    };
    confirmBtn.onclick = confirm;
    upBtn.onclick = () => {
      if (currentParent) navigate(currentParent);
    };
    const goToTypedPath = () => navigate(pathInput.value.trim());
    pathInput.onkeydown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        goToTypedPath();
      }
    };
    if (goBtn) goBtn.onclick = goToTypedPath;

    loadShortcuts().then(async () => {
      let start = options.startPath;
      if (!start) {
        try {
          const { roots, recents } = await window.electronAPI.getFileBrowserRoots();
          start = recents?.[0] || roots?.find((r) => r.id === 'movies')?.path || roots?.[0]?.path;
        } catch (error) {
          start = '';
        }
      }
      if (start) await navigate(start);
      else {
        listEl.innerHTML = '<div class="file-browser-empty">Paste a folder path above and click Go, or use Home / Desktop / Movies.</div>';
        statusEl.textContent = 'Choose a folder to browse.';
      }
    });
  });
}
