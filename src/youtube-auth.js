/**
 * YouTube OAuth 2.0 (PKCE + loopback) and Data API helpers.
 */

const crypto = require('crypto');
const http = require('http');
const { shell } = require('electron');
const { logger } = require('./logger');
const {
  getOAuthClient,
  setOAuthClient,
  setRefreshToken,
  getRefreshToken,
  clearRefreshToken,
  clearAllSecrets
} = require('./youtube-secrets');

const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_BASE = 'https://www.googleapis.com/youtube/v3';

const OAUTH_TIMEOUT_MS = 5 * 60 * 1000;

let cachedAccessToken = null;
let accessTokenExpiresAt = 0;

function base64UrlEncode(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generatePkcePair() {
  const verifier = base64UrlEncode(crypto.randomBytes(32));
  const challenge = base64UrlEncode(crypto.createHash('sha256').update(verifier).digest());
  return { codeVerifier: verifier, codeChallenge: challenge };
}

function parseOAuthClientJson(json) {
  let data = json;
  if (typeof json === 'string') {
    data = JSON.parse(json);
  }
  const block = data.installed || data.web;
  if (!block?.client_id || !block?.client_secret) {
    throw new Error('OAuth JSON must be a Desktop (installed) client with client_id and client_secret');
  }
  return {
    clientId: block.client_id,
    clientSecret: block.client_secret
  };
}

async function importOAuthClient(json) {
  const { clientId, clientSecret } = parseOAuthClientJson(json);
  await setOAuthClient(clientId, clientSecret);
  await clearRefreshToken();
  cachedAccessToken = null;
  accessTokenExpiresAt = 0;
  return { success: true, clientId };
}

async function exchangeCodeForTokens(clientId, clientSecret, code, redirectUri, codeVerifier) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = payload.error_description || payload.error || res.statusText;
    throw new Error(`Token exchange failed: ${msg}`);
  }
  if (!payload.refresh_token) {
    throw new Error(
      'Google did not return a refresh token. Disconnect any prior access in your Google Account, then connect again.'
    );
  }
  return payload;
}

async function refreshAccessToken(clientId, clientSecret, refreshToken) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = payload.error_description || payload.error || res.statusText;
    throw new Error(`Token refresh failed: ${msg}`);
  }
  if (!payload.access_token) {
    throw new Error('Token refresh did not return an access token');
  }
  return payload;
}

async function getValidAccessToken() {
  const client = await getOAuthClient();
  const refreshToken = await getRefreshToken();
  if (!client || !refreshToken) {
    throw new Error('YouTube is not connected');
  }
  const now = Date.now();
  if (cachedAccessToken && accessTokenExpiresAt > now + 60_000) {
    return cachedAccessToken;
  }
  const tokens = await refreshAccessToken(client.clientId, client.clientSecret, refreshToken);
  cachedAccessToken = tokens.access_token;
  const expiresIn = Number(tokens.expires_in) || 3600;
  accessTokenExpiresAt = now + expiresIn * 1000;
  if (tokens.refresh_token) {
    await setRefreshToken(tokens.refresh_token);
  }
  return cachedAccessToken;
}

function invalidateAccessTokenCache() {
  cachedAccessToken = null;
  accessTokenExpiresAt = 0;
}

async function youtubeApiGet(path, accessToken, params = {}) {
  const url = new URL(`${API_BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = payload.error?.message || res.statusText;
    throw new Error(msg || `YouTube API error (${res.status})`);
  }
  return payload;
}

async function getMyChannel() {
  const accessToken = await getValidAccessToken();
  const data = await youtubeApiGet('channels', accessToken, {
    part: 'snippet',
    mine: 'true'
  });
  const channel = data.items?.[0];
  if (!channel) {
    throw new Error('No YouTube channel found for this account');
  }
  return {
    channelId: channel.id,
    channelTitle: channel.snippet?.title || 'YouTube channel'
  };
}

async function listMyPlaylists(maxResults = 50) {
  const accessToken = await getValidAccessToken();
  const data = await youtubeApiGet('playlists', accessToken, {
    part: 'snippet',
    mine: 'true',
    maxResults: String(Math.min(maxResults, 50))
  });
  const items = Array.isArray(data.items) ? data.items : [];
  return items.map((item) => ({
    id: item.id,
    title: item.snippet?.title || item.id
  }));
}

function startLoopbackOAuthServer({ clientId, codeChallenge, state }) {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      server.close();
      reject(new Error('YouTube sign-in timed out. Try again.'));
    }, OAUTH_TIMEOUT_MS);

    server.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(err);
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : null;
      if (!port) {
        settled = true;
        clearTimeout(timeout);
        server.close();
        reject(new Error('Could not start local server for YouTube sign-in'));
        return;
      }

      const redirectUri = `http://127.0.0.1:${port}/callback`;
      const authParams = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: YOUTUBE_SCOPE,
        access_type: 'offline',
        prompt: 'consent',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      });
      const authUrl = `${AUTH_URL}?${authParams.toString()}`;

      shell.openExternal(authUrl).catch((err) => {
        logger.warn('Failed to open browser for YouTube OAuth', { error: err.message });
      });

      const finish = (handler) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        server.close();
        handler();
      };

      server.on('request', (req, res) => {
        try {
          const reqUrl = new URL(req.url || '/', `http://127.0.0.1:${port}`);
          if (reqUrl.pathname !== '/callback') {
            res.writeHead(404);
            res.end('Not found');
            return;
          }
          const error = reqUrl.searchParams.get('error');
          if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<html><body><p>Sign-in failed. You can close this tab and return to Video Merger.</p></body></html>');
            finish(() => reject(new Error(error)));
            return;
          }
          const code = reqUrl.searchParams.get('code');
          const returnedState = reqUrl.searchParams.get('state');
          if (!code || returnedState !== state) {
            res.writeHead(400);
            res.end('Invalid OAuth response');
            finish(() => reject(new Error('Invalid OAuth response')));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<html><body><p>Connected. You can close this tab and return to Video Merger.</p></body></html>');
          finish(() => resolve({ code, redirectUri }));
        } catch (err) {
          res.writeHead(500);
          res.end('Error');
          finish(() => reject(err));
        }
      });
    });
  });
}

async function connectYouTube() {
  const client = await getOAuthClient();
  if (!client) {
    throw new Error('Import your Google OAuth Desktop client JSON in Settings first');
  }
  const { codeVerifier, codeChallenge } = generatePkcePair();
  const state = base64UrlEncode(crypto.randomBytes(16));
  const { code, redirectUri } = await startLoopbackOAuthServer({
    clientId: client.clientId,
    codeChallenge,
    state
  });
  const tokens = await exchangeCodeForTokens(
    client.clientId,
    client.clientSecret,
    code,
    redirectUri,
    codeVerifier
  );
  await setRefreshToken(tokens.refresh_token);
  cachedAccessToken = tokens.access_token;
  const expiresIn = Number(tokens.expires_in) || 3600;
  accessTokenExpiresAt = Date.now() + expiresIn * 1000;
  const channel = await getMyChannel();
  return {
    connected: true,
    channelTitle: channel.channelTitle,
    channelId: channel.channelId
  };
}

async function disconnectYouTube() {
  await clearRefreshToken();
  invalidateAccessTokenCache();
  return { connected: false };
}

async function clearYouTubeCredentials() {
  await clearAllSecrets();
  invalidateAccessTokenCache();
  return { success: true };
}

async function getConnectionStatus() {
  const client = await getOAuthClient();
  const hasClient = Boolean(client?.clientId);
  const hasToken = Boolean(await getRefreshToken());
  if (!hasClient || !hasToken) {
    return {
      connected: false,
      clientConfigured: hasClient,
      clientId: client?.clientId || null
    };
  }
  try {
    const channel = await getMyChannel();
    return {
      connected: true,
      clientConfigured: true,
      clientId: client.clientId,
      channelTitle: channel.channelTitle,
      channelId: channel.channelId
    };
  } catch (error) {
    logger.warn('YouTube status check failed', { error: error.message });
    return {
      connected: false,
      clientConfigured: true,
      clientId: client.clientId,
      error: error.message
    };
  }
}

module.exports = {
  YOUTUBE_SCOPE,
  parseOAuthClientJson,
  importOAuthClient,
  connectYouTube,
  disconnectYouTube,
  clearYouTubeCredentials,
  getConnectionStatus,
  getValidAccessToken,
  getMyChannel,
  listMyPlaylists,
  invalidateAccessTokenCache,
  refreshAccessToken,
  exchangeCodeForTokens
};
