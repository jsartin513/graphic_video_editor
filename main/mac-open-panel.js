const { execFile } = require('child_process');

function escapeAppleScriptString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function runOsascript(script) {
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/osascript', ['-e', script], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      if (error) {
        const detail = `${error.stderr || ''} ${error.message || ''}`;
        if (error.code === 1 && /-128|User canceled/i.test(detail)) {
          resolve(null);
          return;
        }
        reject(error);
        return;
      }
      resolve((stdout || '').trim());
    });
  });
}

/**
 * Native macOS open-file panel via AppleScript. Avoids Electron's broken/hidden
 * NSOpenPanel on recent macOS versions.
 */
async function chooseFiles(prompt = 'Select Video Files') {
  const safePrompt = escapeAppleScriptString(prompt);
  const script = `
set out to ""
repeat with f in (choose file with prompt "${safePrompt}" with multiple selections allowed)
  set out to out & (POSIX path of f) & linefeed
end repeat
return out
`;
  const stdout = await runOsascript(script);
  if (stdout === null) {
    return { canceled: true, filePaths: [] };
  }
  const filePaths = stdout.split(/\n/).map((line) => line.trim()).filter(Boolean);
  if (!filePaths.length) {
    return { canceled: true, filePaths: [] };
  }
  return { canceled: false, filePaths };
}

/**
 * Native macOS choose-folder panel via AppleScript.
 */
async function chooseFolder(prompt = 'Select Folder with Video Files') {
  const safePrompt = escapeAppleScriptString(prompt);
  const script = `POSIX path of (choose folder with prompt "${safePrompt}")`;
  const stdout = await runOsascript(script);
  if (stdout === null) {
    return { canceled: true, filePaths: [] };
  }
  return { canceled: false, filePaths: [stdout] };
}

module.exports = {
  chooseFiles,
  chooseFolder,
  escapeAppleScriptString,
  runOsascript
};
