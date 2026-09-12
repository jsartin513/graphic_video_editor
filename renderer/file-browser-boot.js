/**
 * In-app folder browser that does not depend on ES modules.
 * macOS NSOpenPanel is not used. Listing is fs.readdir via IPC.
 */
(function bootFileBrowser() {
  function $(id) {
    return document.getElementById(id);
  }

  function showBanner(message, isError) {
    var el = $('filePickStatus');
    if (!el) return;
    el.hidden = false;
    el.textContent = message || '';
    if (isError) el.classList.add('error');
    else el.classList.remove('error');
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.addEventListener('error', function (event) {
    showBanner('UI error: ' + (event.message || event.error || 'unknown'), true);
  });
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    var message = reason && reason.message ? reason.message : String(reason || 'unknown');
    showBanner('UI error: ' + message, true);
  });

  var currentPath = '';
  var currentParent = null;
  var selectedFiles = {};
  var mode = 'files';
  var listingCache = { entries: [] };

  function alreadyInMergeList(filePath) {
    return window.appState && Array.isArray(window.appState.selectedFiles)
      && window.appState.selectedFiles.indexOf(filePath) !== -1;
  }

  function selectedCount() {
    return Object.keys(selectedFiles).length;
  }

  function selectedPaths() {
    return Object.keys(selectedFiles);
  }

  function updateConfirmButton() {
    var confirmBtn = $('fileBrowserConfirmBtn');
    if (!confirmBtn) return;
    if (mode === 'folder') {
      confirmBtn.disabled = !currentPath;
      confirmBtn.innerHTML = '<span class="btn-icon" aria-hidden="true">📂</span> Use This Folder';
      return;
    }
    var n = selectedCount();
    confirmBtn.disabled = n === 0;
    confirmBtn.innerHTML = '<span class="btn-icon" aria-hidden="true">📁</span> Add ' + n + ' Video' + (n === 1 ? '' : 's');
  }

  function renderEntries(listing) {
    var listEl = $('fileBrowserList');
    if (!listEl) return;
    listingCache = listing;
    listEl.innerHTML = '';
    if (!listing.entries.length) {
      listEl.innerHTML = '<div class="file-browser-empty">No folders or video files here. Click Home / Desktop / Movies, or paste a path and press Go.</div>';
      return;
    }
    listing.entries.forEach(function (entry) {
      var row = document.createElement('div');
      var inMergeList = !entry.isDirectory && alreadyInMergeList(entry.path);
      var selected = !entry.isDirectory && (
        Object.prototype.hasOwnProperty.call(selectedFiles, entry.path) || inMergeList
      );
      row.className = 'file-browser-row' + (selected ? ' selected' : '') + (inMergeList ? ' added' : '');
      row.setAttribute('role', 'option');
      var checkbox = (!entry.isDirectory && mode !== 'folder')
        ? '<input type="checkbox" class="file-browser-check"' + (selected ? ' checked' : '') + ' aria-label="Select ' + escapeHtml(entry.name) + '">'
        : '';
      row.innerHTML = checkbox
        + '<span class="file-browser-icon" aria-hidden="true">' + (entry.isDirectory ? '📁' : '🎬') + '</span>'
        + '<span class="file-browser-name">' + escapeHtml(entry.name) + '</span>'
        + (inMergeList ? '<span class="file-browser-added">Added</span>' : '');
      row.addEventListener('click', function () {
        if (entry.isDirectory) {
          navigate(entry.path);
          return;
        }
        if (mode === 'folder') return;
        if (inMergeList) return;
        if (Object.prototype.hasOwnProperty.call(selectedFiles, entry.path)) {
          delete selectedFiles[entry.path];
        } else {
          selectedFiles[entry.path] = true;
        }
        renderEntries(listing);
        updateConfirmButton();
      });
      listEl.appendChild(row);
    });
  }

  async function navigate(dirPath) {
    var statusEl = $('fileBrowserStatus');
    var listEl = $('fileBrowserList');
    var pathInput = $('fileBrowserPath');
    var upBtn = $('fileBrowserUpBtn');
    if (!dirPath) return;
    if (statusEl) statusEl.textContent = 'Loading…';
    try {
      var listing = await window.electronAPI.listDirectory(dirPath);
      currentPath = listing.path;
      currentParent = listing.parent;
      if (pathInput) pathInput.value = listing.path;
      if (upBtn) upBtn.disabled = !currentParent;
      var keep = {};
      (listing.entries || []).forEach(function (entry) {
        if (Object.prototype.hasOwnProperty.call(selectedFiles, entry.path)) {
          keep[entry.path] = true;
        }
      });
      selectedFiles = keep;
      renderEntries(listing);
      var videos = listing.entries.filter(function (e) { return e.isVideo; }).length;
      var folders = listing.entries.filter(function (e) { return e.isDirectory; }).length;
      if (statusEl) {
        statusEl.textContent = folders + ' folder' + (folders === 1 ? '' : 's') + ', '
          + videos + ' video' + (videos === 1 ? '' : 's')
          + ' — click a folder to open it, or click videos then Add.';
      }
      updateConfirmButton();
    } catch (error) {
      var message = (error && error.message) ? error.message : String(error);
      if (statusEl) statusEl.textContent = message;
      if (listEl) {
        listEl.innerHTML = '<div class="file-browser-empty">' + escapeHtml(message) + '</div>';
      }
      showBanner('Could not open folder: ' + message, true);
    }
  }

  async function loadShortcuts() {
    var shortcutsEl = $('fileBrowserShortcuts');
    if (!shortcutsEl) return null;
    shortcutsEl.innerHTML = '';
    var data = await window.electronAPI.getFileBrowserRoots();
    var items = []
      .concat((data.roots || []).map(function (r) { return { label: r.label, path: r.path }; }))
      .concat((data.recents || []).slice(0, 6).map(function (p) {
        var name = String(p).split('/').filter(Boolean).pop() || p;
        return { label: name, path: p };
      }))
      .concat((data.volumes || []).map(function (v) { return { label: v.name, path: v.path }; }));
    items.forEach(function (item) {
      if (!item.path) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary btn-small file-browser-shortcut';
      btn.title = item.path;
      btn.textContent = item.label;
      btn.addEventListener('click', function () { navigate(item.path); });
      shortcutsEl.appendChild(btn);
    });
    return data;
  }

  function waitForVideoMergerAddFiles(maxMs) {
    return new Promise(function (resolve) {
      var deadline = Date.now() + (maxMs || 3000);
      function check() {
        if (typeof window.videoMergerAddFiles === 'function') {
          resolve(window.videoMergerAddFiles);
          return;
        }
        if (Date.now() >= deadline) {
          resolve(null);
          return;
        }
        setTimeout(check, 50);
      }
      check();
    });
  }

  function countAddedFromResult(result) {
    if (!result || !Array.isArray(result.added)) {
      return 0;
    }
    return result.added.length;
  }

  async function addSelected() {
    var paths = mode === 'folder' ? (currentPath ? [currentPath] : []) : selectedPaths();
    if (!paths.length) return;
    try {
      var addFn = await waitForVideoMergerAddFiles(3000);
      if (!addFn) {
        showBanner('Video list is still loading. Wait a moment and try Add again.', true);
        return;
      }
      var result = await addFn(paths);
      var addedCount = countAddedFromResult(result);
      if (!addedCount) return;
      selectedFiles = {};
      renderEntries(listingCache);
      updateConfirmButton();
      var list = $('fileListContainer');
      if (list) list.scrollIntoView({ block: 'nearest' });
    } catch (error) {
      showBanner('Could not add videos: ' + ((error && error.message) || error), true);
    }
  }

  var didLoadListing = false;

  async function mountHomeFileBrowser(nextMode) {
    mode = nextMode || 'files';
    var panel = $('fileBrowserPanel');
    var titleEl = $('fileBrowserTitle');
    var listEl = $('fileBrowserList');
    var statusEl = $('fileBrowserStatus');
    if (panel) {
      panel.hidden = false;
      panel.removeAttribute('hidden');
      panel.style.display = 'block';
    }
    if (titleEl) {
      titleEl.textContent = mode === 'folder'
        ? 'Choose a folder of videos'
        : 'Browse videos on this Mac';
    }
    if (!window.electronAPI || typeof window.electronAPI.listDirectory !== 'function') {
      showBanner('Folder APIs are not available. Quit Video Merger and reopen it.', true);
      if (listEl) listEl.innerHTML = '<div class="file-browser-empty">Folder APIs missing.</div>';
      return;
    }

    $('fileBrowserCloseBtn') && ($('fileBrowserCloseBtn').onclick = function () {
      showBanner('Folder list is still available — click Select Files to bring it back.');
      if (panel) panel.hidden = true;
    });
    $('fileBrowserCancelBtn') && ($('fileBrowserCancelBtn').onclick = function () {
      selectedFiles = {};
      mode = 'files';
      if (titleEl) titleEl.textContent = 'Browse videos on this Mac';
      renderEntries(listingCache);
      updateConfirmButton();
    });
    $('fileBrowserConfirmBtn') && ($('fileBrowserConfirmBtn').onclick = addSelected);
    $('fileBrowserUpBtn') && ($('fileBrowserUpBtn').onclick = function () {
      if (currentParent) navigate(currentParent);
    });
    var pathInput = $('fileBrowserPath');
    var goToTypedPath = function () {
      if (pathInput) navigate(pathInput.value.trim());
    };
    if (pathInput) {
      pathInput.onkeydown = function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          goToTypedPath();
        }
      };
    }
    $('fileBrowserGoBtn') && ($('fileBrowserGoBtn').onclick = goToTypedPath);

    updateConfirmButton();
    if (didLoadListing && currentPath) {
      renderEntries(listingCache);
      return;
    }

    if (statusEl) statusEl.textContent = 'Loading folders…';
    try {
      var data = await loadShortcuts();
      var start = (data && data.recents && data.recents[0])
        || ((data.roots || []).find(function (r) { return r.id === 'movies'; }) || {}).path
        || ((data.roots || [])[0] || {}).path;
      if (start) await navigate(start);
      else if (listEl) {
        listEl.innerHTML = '<div class="file-browser-empty">Paste a folder path above and click Go, or use Home / Desktop / Movies.</div>';
      }
      didLoadListing = true;
    } catch (error) {
      var message = (error && error.message) ? error.message : String(error);
      showBanner('Could not load folders: ' + message, true);
      if (listEl) listEl.innerHTML = '<div class="file-browser-empty">' + escapeHtml(message) + '</div>';
    }
  }

  window.mountHomeFileBrowser = mountHomeFileBrowser;

  function start() {
    if (!window.electronAPI) {
      showBanner('Waiting for app APIs…');
      setTimeout(start, 50);
      return;
    }
    showBanner('Folder list is below. Click Home / Desktop / Movies, then click videos and Add. Finder dialogs are not used.');
    mountHomeFileBrowser('files');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
