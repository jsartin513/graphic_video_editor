/**
 * Tests for src/youtube-auth.js (mocked fetch and secrets).
 */

jest.mock('../src/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }));

const mockSecrets = {
  getOAuthClient: jest.fn(),
  setOAuthClient: jest.fn(),
  setRefreshToken: jest.fn(),
  getRefreshToken: jest.fn(),
  clearRefreshToken: jest.fn(),
  clearAllSecrets: jest.fn()
};

jest.mock('../src/youtube-secrets', () => mockSecrets);

const { parseOAuthClientJson, refreshAccessToken, importOAuthClient } = require('../src/youtube-auth');

describe('youtube-auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe('parseOAuthClientJson', () => {
    it('parses installed desktop client JSON', () => {
      const json = {
        installed: {
          client_id: 'id.apps.googleusercontent.com',
          client_secret: 'secret'
        }
      };
      expect(parseOAuthClientJson(json)).toEqual({
        clientId: 'id.apps.googleusercontent.com',
        clientSecret: 'secret'
      });
    });

    it('throws when client fields are missing', () => {
      expect(() => parseOAuthClientJson({ installed: { client_id: 'x' } })).toThrow(/client_secret/);
    });
  });

  describe('refreshAccessToken', () => {
    it('returns access token on success', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'at-123', expires_in: 3600 })
      });
      const result = await refreshAccessToken('cid', 'csecret', 'refresh');
      expect(result.access_token).toBe('at-123');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('throws when refresh fails', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        statusText: 'Bad',
        json: async () => ({ error: 'invalid_grant' })
      });
      await expect(refreshAccessToken('cid', 'csecret', 'bad')).rejects.toThrow(/refresh failed/i);
    });
  });

  describe('importOAuthClient', () => {
    it('stores client and clears refresh token', async () => {
      mockSecrets.setOAuthClient.mockResolvedValue(undefined);
      mockSecrets.clearRefreshToken.mockResolvedValue(undefined);
      const result = await importOAuthClient({
        installed: { client_id: 'a', client_secret: 'b' }
      });
      expect(mockSecrets.setOAuthClient).toHaveBeenCalledWith('a', 'b');
      expect(mockSecrets.clearRefreshToken).toHaveBeenCalled();
      expect(result.clientId).toBe('a');
    });
  });
});
