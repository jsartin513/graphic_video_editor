// Prerequisites modal functionality

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
    // Update status icons
    ffmpegStatus.textContent = status.ffmpegFound ? '✓' : '❌';
    ffmpegStatus.className = 'status-icon ' + (status.ffmpegFound ? 'success' : 'error');
    
    ffprobeStatus.textContent = status.ffprobeFound ? '✓' : '❌';
    ffprobeStatus.className = 'status-icon ' + (status.ffprobeFound ? 'success' : 'error');
    
    brewStatus.textContent = status.brewFound ? '✓' : '❌';
    brewStatus.className = 'status-icon ' + (status.brewFound ? 'success' : 'error');
    
    // Show/hide install button based on Homebrew availability
    if (!status.brewFound) {
      installBtn.style.display = 'none';
      installBtn.parentElement.querySelector('p').textContent = 'Homebrew is required to install ffmpeg. Please install Homebrew first from https://brew.sh';
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
      
      const result = await window.electronAPI.installPrerequisites();
      
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
      installResult.innerHTML = `<div class="result-item error">✗ Error: ${error.message}</div>`;
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

