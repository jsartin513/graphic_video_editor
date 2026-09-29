/**
 * YouTube section inside the Settings modal.
 */
export function initializeYouTubeSettings({ onPreferencesUpdated }) {
  const statusEl = document.getElementById('settingsYouTubeStatus');
  const clientHintEl = document.getElementById('settingsYouTubeClientHint');
  const connectedPanel = document.getElementById('settingsYouTubeConnectedPanel');
  const disconnectedPanel = document.getElementById('settingsYouTubeDisconnectedPanel');
  const importBtn = document.getElementById('settingsYouTubeImportBtn');
  const connectBtn = document.getElementById('settingsYouTubeConnectBtn');
  const disconnectBtn = document.getElementById('settingsYouTubeDisconnectBtn');
  const clearBtn = document.getElementById('settingsYouTubeClearBtn');
  const playlistSelect = document.getElementById('settingsYouTubePlaylistSelect');
  const privacySelect = document.getElementById('settingsYouTubePrivacySelect');
  const autoUploadCheckbox = document.getElementById('settingsYouTubeAutoUploadCheckbox');
  const descriptionInput = document.getElementById('settingsYouTubeDescriptionInput');
  const saveSettingsBtn = document.getElementById('settingsYouTubeSaveBtn');
  const setupGuideBtn = document.getElementById('settingsYouTubeSetupGuideBtn');

  let lastSettings = null;
  let playlistsLoaded = false;

  async function loadPlaylistsIfConnected(connected) {
    if (!playlistSelect || !connected) {
      playlistsLoaded = false;
      return;
    }
    playlistSelect.innerHTML = '<option value="">Don\'t add to a playlist</option>';
    try {
      const result = await window.electronAPI.youtubeListPlaylists();
      if (result?.success && Array.isArray(result.playlists)) {
        for (const pl of result.playlists) {
          const opt = document.createElement('option');
          opt.value = pl.id;
          opt.textContent = pl.title;
          playlistSelect.appendChild(opt);
        }
      }
      playlistsLoaded = true;
    } catch (error) {
      console.error('Failed to load YouTube playlists', error);
    }
  }

  function applySettingsToForm(settings) {
    lastSettings = settings || {};
    if (privacySelect) {
      privacySelect.value = lastSettings.privacyStatus || 'private';
    }
    if (autoUploadCheckbox) {
      autoUploadCheckbox.checked = Boolean(lastSettings.autoUpload);
    }
    if (descriptionInput) {
      descriptionInput.value = lastSettings.description || '';
    }
    if (playlistSelect && playlistsLoaded) {
      playlistSelect.value = lastSettings.playlistId || '';
    }
  }

  async function refreshYouTubeUi() {
    if (!window.electronAPI?.youtubeGetStatus) return;
    try {
      const result = await window.electronAPI.youtubeGetStatus();
      if (!result?.success) {
        if (statusEl) statusEl.textContent = result?.error || 'Could not load YouTube status.';
        return;
      }
      const { status, settings } = result;
      applySettingsToForm(settings);

      const connected = Boolean(status?.connected);
      if (connectedPanel) connectedPanel.hidden = !connected;
      if (disconnectedPanel) {
        disconnectedPanel.hidden = connected;
        if (!connected) {
          const hint = disconnectedPanel.querySelector('.form-hint');
          if (hint) {
            hint.textContent = status.clientConfigured
              ? 'Click Connect YouTube to sign in and configure playlist and privacy.'
              : 'Import your Desktop OAuth client, then connect to choose playlist and privacy options.';
          }
        }
      }

      if (statusEl) {
        statusEl.textContent = connected
          ? `Connected as ${status.channelTitle || 'YouTube channel'}`
          : status.clientConfigured
            ? 'OAuth client configured. Connect your YouTube account to upload.'
            : 'Not configured. Import your Google OAuth Desktop client JSON to get started.';
      }
      if (clientHintEl) {
        clientHintEl.textContent = status.clientId
          ? `Client ID: ${status.clientId}`
          : '';
      }
      if (connectBtn) connectBtn.disabled = !status.clientConfigured;
      await loadPlaylistsIfConnected(connected);
      applySettingsToForm(settings);
    } catch (error) {
      console.error('YouTube settings refresh failed', error);
      if (statusEl) statusEl.textContent = 'Could not load YouTube status.';
    }
  }

  async function saveYouTubeSettings() {
    const playlistId = playlistSelect?.value || null;
    const selectedOpt = playlistSelect?.selectedOptions?.[0];
    const playlistTitle =
      playlistId && selectedOpt ? selectedOpt.textContent.trim() : null;
    const payload = {
      autoUpload: Boolean(autoUploadCheckbox?.checked),
      privacyStatus: privacySelect?.value || 'private',
      playlistId: playlistId || null,
      playlistTitle,
      description: descriptionInput?.value || ''
    };
    try {
      const result = await window.electronAPI.youtubeSaveSettings(payload);
      if (result?.success === false) {
        alert(result.error || 'Could not save YouTube settings.');
        return;
      }
      if (result?.preferences && onPreferencesUpdated) {
        onPreferencesUpdated(result.preferences);
      }
      lastSettings = result?.preferences?.youtube || payload;
    } catch (error) {
      console.error('Save YouTube settings failed', error);
      alert('Could not save YouTube settings.');
    }
  }

  if (importBtn) {
    importBtn.addEventListener('click', async () => {
      try {
        const result = await window.electronAPI.youtubeImportOAuthClientFile();
        if (result?.canceled) return;
        if (result?.success === false) {
          alert(result.error || 'Import failed.');
          return;
        }
        await refreshYouTubeUi();
      } catch (error) {
        console.error('Import OAuth client failed', error);
        alert('Import failed.');
      }
    });
  }

  if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
      connectBtn.disabled = true;
      if (statusEl) statusEl.textContent = 'Opening browser for Google sign-in…';
      try {
        const result = await window.electronAPI.youtubeConnect();
        if (result?.success === false) {
          alert(result.error || 'Could not connect YouTube.');
        }
        await refreshYouTubeUi();
      } catch (error) {
        console.error('YouTube connect failed', error);
        alert('Could not connect YouTube.');
        await refreshYouTubeUi();
      } finally {
        connectBtn.disabled = false;
      }
    });
  }

  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', async () => {
      try {
        await window.electronAPI.youtubeDisconnect();
        await refreshYouTubeUi();
      } catch (error) {
        console.error('YouTube disconnect failed', error);
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (!confirm('Remove stored YouTube OAuth client and sign-in?')) return;
      try {
        await window.electronAPI.youtubeClearCredentials();
        await refreshYouTubeUi();
      } catch (error) {
        console.error('Clear YouTube credentials failed', error);
      }
    });
  }

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => saveYouTubeSettings());
  }

  if (setupGuideBtn) {
    setupGuideBtn.addEventListener('click', () => {
      window.electronAPI.openExternal(
        'https://github.com/jsartin513/graphic_video_editor/blob/main/USER_GUIDE.md#youtube-upload-after-merge'
      );
    });
  }

  return {
    refreshYouTubeUi
  };
}
