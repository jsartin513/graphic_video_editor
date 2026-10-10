// Prerequisites modal functionality

import { showErrorDialog } from './errorDialog.js';

export function initializePrerequisites(domElements) {
  const {
    prerequisitesModal,
    installBtn,
    checkAgainBtn,
    closeModalBtn,
    installProgress,
    installProgressBar,
    installProgressText,
    installResult,
    ffmpegStatus,
    ffprobeStatus,
    brewStatus
  } = domElements;

  function showPrerequisitesModal(status) {
    const installInstructions = document.getElementById('installInstructions');
    const modalIntro = prerequisitesModal.querySelector('.modal-body > p');

    // Update status icons
    ffmpegStatus.textContent = status.ffmpegFound ? '✓' : '❌';
    ffmpegStatus.className = 'status-icon ' + (status.ffmpegFound ? 'success' : 'error');
    
    ffprobeStatus.textContent = status.ffprobeFound ? '✓' : '❌';
    ffprobeStatus.className = 'status-icon ' + (status.ffprobeFound ? 'success' : 'error');
    
    brewStatus.textContent = status.brewFound ? '✓' : '❌';
    brewStatus.className = 'status-icon ' + (status.brewFound ? 'success' : 'error');

    const bundledInApp = Boolean(status.bundledInApp);
    if (modalIntro) {
      modalIntro.innerHTML = bundledInApp
        ? 'This build includes bundled <strong>ffmpeg</strong>, but it could not be used. Try reinstalling the latest <strong>fat</strong> build from GitHub Releases, or contact support with app logs.'
        : 'Video Merger requires <strong>ffmpeg</strong> to merge videos, but it is not available on your system.';
    }

    if (installInstructions) {
      installInstructions.style.display = bundledInApp ? 'none' : 'block';
    }
    if (bundledInApp) {
      installBtn.style.display = 'none';
    } else if (!status.brewFound) {
      installBtn.style.display = 'none';
      const hint = installBtn.parentElement.querySelector('p');
      if (hint) {
        hint.textContent =
          'Homebrew is required to install ffmpeg. Install Homebrew from https://brew.sh, then use the button below.';
      }
    } else {
      installBtn.style.display = 'inline-flex';
    }
    
    // Reset UI state
    installProgress.style.display = 'none';
    installResult.style.display = 'none';
    checkAgainBtn.style.display = 'none';
    installBtn.disabled = false;
    
    prerequisitesModal.style.display = 'flex';
  }

  async function handleCheckPrerequisites() {
    try {
      const status = await window.electronAPI.checkFFmpeg();
      if (status.installed) {
        installResult.innerHTML = '<div class="result-item success">✓ All prerequisites are installed!</div>';
        installResult.style.display = 'block';
        setTimeout(() => {
          prerequisitesModal.style.display = 'none';
        }, 2000);
      } else {
        showPrerequisitesModal(status);
      }
    } catch (error) {
      console.error('Error checking prerequisites:', error);
    }
  }

  async function handleInstallPrerequisites() {
    const confirmed = window.confirm(
      'Install ffmpeg with Homebrew?\n\n' +
        'This runs "brew install ffmpeg" on your Mac. It may take several minutes and requires an internet connection.\n\n' +
        'Only continue if you are using a lite build without bundled ffmpeg.'
    );
    if (!confirmed) {
      return;
    }

    installBtn.disabled = true;
    installProgress.style.display = 'block';
    installProgressBar.style.width = '0%';
    installProgressText.textContent = 'Starting installation...';
    installResult.style.display = 'none';
    
    try {
      // Simulate progress (since we can't easily track brew install progress)
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 2;
        if (progress < 90) {
          installProgressBar.style.width = `${progress}%`;
          installProgressText.textContent = 'Installing ffmpeg... This may take a few minutes.';
        }
      }, 500);
      
      const result = await window.electronAPI.installPrerequisites({ confirmed: true });
      
      clearInterval(progressInterval);
      installProgressBar.style.width = '100%';
      
      if (result.success) {
        installProgressText.textContent = 'Installation complete!';
        installResult.innerHTML = `
          <div class="result-item success">
            ✓ ${result.message}
            ${result.version ? `<br>Installed version: ${result.version}` : ''}
          </div>
        `;
        installResult.style.display = 'block';
        checkAgainBtn.style.display = 'inline-flex';
        
        // Auto-close after 3 seconds
        setTimeout(() => {
          handleCheckPrerequisites();
        }, 3000);
      } else {
        installProgressText.textContent = 'Installation failed';
        installResult.innerHTML = `
          <div class="result-item error">
            ✗ ${result.message}
            ${result.needsHomebrew ? '<br><br>Please install Homebrew first from <a href="https://brew.sh" target="_blank">brew.sh</a>' : ''}
          </div>
        `;
        installResult.style.display = 'block';
        installBtn.disabled = false;
        checkAgainBtn.style.display = 'inline-flex';
      }
    } catch (error) {
      clearInterval(progressInterval);
      installProgressText.textContent = 'Installation error';
      
      // Map error and show user-friendly dialog
      const mappedError = await window.electronAPI.mapError(error.message || String(error));
      showErrorDialog(mappedError);
      
      installResult.innerHTML = `<div class="result-item error">✗ Error: ${mappedError.userMessage}</div>`;
      installResult.style.display = 'block';
      installBtn.disabled = false;
    }
  }

  // Attach event listeners
  installBtn.addEventListener('click', handleInstallPrerequisites);
  checkAgainBtn.addEventListener('click', handleCheckPrerequisites);
  closeModalBtn.addEventListener('click', () => {
    prerequisitesModal.style.display = 'none';
  });

  // Note: The prerequisites-missing event listener is now in renderer.js
  // to support lazy loading of this module

  return { showPrerequisitesModal };
}


