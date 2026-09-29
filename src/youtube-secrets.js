/**
 * Encrypted storage for YouTube OAuth client secret and refresh token (userData).
 */

const { app, safeStorage } = require('electron');
const fs = require('fs').promises;
const path = require('path');

function getSecretsPath() {
  return path.join(app.getPath('userData'), 'youtube-secrets.json');
}

function encryptString(plain) {
  if (!plain) return null;
  const str = String(plain);
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(str).toString('base64');
  }
  return Buffer.from(str, 'utf8').toString('base64');
}

function decryptString(enc) {
  if (!enc) return null;
  const buf = Buffer.from(enc, 'base64');
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(buf);
  }
  return buf.toString('utf8');
}

async function loadSecretsFile() {
  try {
    const raw = await fs.readFile(getSecretsPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveSecretsFile(data) {
  await fs.mkdir(path.dirname(getSecretsPath()), { recursive: true });
  await fs.writeFile(getSecretsPath(), JSON.stringify(data, null, 2), 'utf8');
}

async function setOAuthClient(clientId, clientSecret) {
  const data = await loadSecretsFile();
  data.clientId = clientId;
  data.clientSecretEnc = encryptString(clientSecret);
  await saveSecretsFile(data);
}

async function getOAuthClient() {
  const data = await loadSecretsFile();
  if (!data.clientId || !data.clientSecretEnc) {
    return null;
  }
  return {
    clientId: data.clientId,
    clientSecret: decryptString(data.clientSecretEnc)
  };
}

async function setRefreshToken(refreshToken) {
  const data = await loadSecretsFile();
  data.refreshTokenEnc = encryptString(refreshToken);
  await saveSecretsFile(data);
}

async function getRefreshToken() {
  const data = await loadSecretsFile();
  if (!data.refreshTokenEnc) return null;
  return decryptString(data.refreshTokenEnc);
}

async function clearRefreshToken() {
  const data = await loadSecretsFile();
  delete data.refreshTokenEnc;
  await saveSecretsFile(data);
}

async function clearAllSecrets() {
  try {
    await fs.unlink(getSecretsPath());
  } catch {
    // ignore missing file
  }
}

async function hasOAuthClient() {
  const client = await getOAuthClient();
  return Boolean(client?.clientId && client?.clientSecret);
}

async function hasRefreshToken() {
  const token = await getRefreshToken();
  return Boolean(token);
}

module.exports = {
  setOAuthClient,
  getOAuthClient,
  setRefreshToken,
  getRefreshToken,
  clearRefreshToken,
  clearAllSecrets,
  hasOAuthClient,
  hasRefreshToken,
  encryptString,
  decryptString
};
