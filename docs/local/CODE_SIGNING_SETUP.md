# Code Signing Setup Guide

This guide walks you through signing your Electron app with an Apple Developer ID certificate, which allows users to install and run your app without Gatekeeper warnings.

## Prerequisites

- ✅ Apple Developer account ($99/year)
- ✅ macOS machine for signing
- ✅ Xcode installed (for certificate management)

## Step 1: Generate Your Developer ID Certificate

### Option A: Using Xcode (Recommended)

1. **Open Xcode**
2. Go to **Xcode → Settings → Accounts** (or **Preferences → Accounts** on older Xcode)
3. Click the **+** button and sign in with your Apple Developer account
4. Select your team and click **Manage Certificates...**
5. Click the **+** button at the bottom left
6. Select **Developer ID Application** (not "Mac Development" or "App Store")
7. Click **Done**

The certificate will be automatically added to your keychain.

### Option B: Using Apple Developer Portal

1. Go to [developer.apple.com/account](https://developer.apple.com/account)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **+** to create a new certificate
4. Select **Developer ID Application** under **Software**
5. Follow the instructions to:
   - Create a Certificate Signing Request (CSR) using Keychain Access
   - Upload the CSR
   - Download the certificate
6. Double-click the downloaded certificate to install it in your keychain

## Step 2: Verify Certificate Installation

Run this command to list your Developer ID certificates:

```bash
security find-identity -v -p codesigning | grep "Developer ID Application"
```

You should see output like:
```
1) ABC123DEF456 "Developer ID Application: Your Name (TEAM_ID)"
```

**Important**: Copy the **TEAM_ID** (the alphanumeric code in parentheses) - you'll need it!

## Step 3: Configure electron-builder

The `electron-builder.config.js` file has been updated to support code signing. You have two options:

### Option A: Use Environment Variables (Recommended for CI/CD)

Set these environment variables before building:

```bash
export APPLE_ID="your-email@example.com"
export APPLE_TEAM_ID="TEAM_ID"  # From Step 2
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # Only for notarization
```

**Note**: App-specific password is only needed if you want to notarize your app. You can create one at [appleid.apple.com](https://appleid.apple.com).

### Option B: Use Keychain (Recommended for Local Builds)

If your certificate is in your keychain, electron-builder will automatically find it. Just ensure:

1. Your certificate is named exactly: `Developer ID Application: Your Name (TEAM_ID)`
2. The certificate is in your **login** keychain (not System)
3. Your keychain is unlocked when building

## Step 4: Build and Sign

Now build your app as usual. electron-builder will automatically sign it:

```bash
npm run build:fat
```

The signed app will be in the `dist/` directory.

### Verify Signing

Check that your app is signed:

```bash
codesign -dv --verbose=4 "dist/mac/Video Merger.app"
```

You should see output like:
```
Authority=Developer ID Application: Your Name (TEAM_ID)
```

## Step 5: Notarize Your App (Optional but Recommended)

Notarization gives users even more confidence - they won't see any security warnings at all.

### Create App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in with your Apple ID (the one associated with your Developer account)
3. Go to **Sign-In and Security → App-Specific Passwords**
4. Click **Generate an app-specific password**
5. Label it (e.g., "Notarization for Video Merger")
6. Copy the password (format: `xxxx-xxxx-xxxx-xxxx`)

### Configure Notarization

Set environment variables:

```bash
export APPLE_ID="your-email@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAM_ID"
```

Then build:

```bash
npm run build:fat
```

electron-builder will:
1. Sign the app
2. Create a DMG
3. Sign the DMG
4. Submit to Apple for notarization
5. Staple the notarization ticket to the DMG

**Note**: Notarization takes 5-10 minutes. The build will wait for it to complete.

### Check Notarization Status

```bash
xcrun stapler validate "dist/Video Merger-1.0.0.dmg"
```

## GitHub Actions Setup (Optional)

To sign builds in GitHub Actions, you need to:

1. **Export your certificate and key**:
   ```bash
   # Export certificate and private key from keychain
   security create-keychain -p "" build.keychain
   security default-keychain -s build.keychain
   security unlock-keychain -p "" build.keychain
   security set-keychain-settings -t 3600 -u build.keychain
   
   # Export certificate (replace with your certificate name)
   security find-identity -v -p codesigning
   # Find your certificate, then export:
   security import certificate.p12 -k build.keychain -P "" -T /usr/bin/codesign
   ```

2. **Add GitHub Secrets**:
   - `APPLE_CERTIFICATE`: Base64-encoded certificate (.p12 file)
   - `APPLE_CERTIFICATE_PASSWORD`: Password for the certificate
   - `APPLE_TEAM_ID`: Your team ID
   - `APPLE_ID`: Your Apple ID email
   - `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password (for notarization)

3. **Update `.github/workflows/build.yml`** to import the certificate before building.

**Warning**: Storing certificates in GitHub Secrets requires careful security practices. Consider if you really need automated signing or if manual signing is sufficient.

## Troubleshooting

### "No valid signing identities found"

**Problem**: electron-builder can't find your certificate.

**Solutions**:
- Verify certificate is installed: `security find-identity -v -p codesigning`
- Ensure certificate is in your **login** keychain
- Unlock your keychain: `security unlock-keychain ~/Library/Keychains/login.keychain-db`
- Specify certificate name explicitly in `electron-builder.config.js`

### "Resource fork, Finder information, or similar detritus not allowed"

**Problem**: DMG contains macOS metadata files that can't be signed.

**Solution**: electron-builder should handle this automatically. If not, ensure you're using the latest version.

### Notarization Fails

**Problem**: Apple rejects your notarization submission.

**Common causes**:
- Missing or invalid entitlements
- Hardened runtime not enabled
- Unsigned helper tools
- Invalid code signature

**Solution**: Check the notarization log:
```bash
xcrun notarytool log <submission-id> --apple-id <your-email> --password <app-password> --team-id <team-id>
```

### "The operation couldn't be completed. (OSStatus error -67062)"

**Problem**: Invalid certificate or keychain issue.

**Solution**:
- Ensure your Developer ID certificate hasn't expired
- Re-download the certificate from Apple Developer portal if needed
- Verify keychain is unlocked

## Security Best Practices

1. **Never commit certificates or keys** to git
2. **Use environment variables** or GitHub Secrets for sensitive data
3. **Rotate app-specific passwords** periodically
4. **Use separate certificates** for development and production if possible
5. **Keep certificates secure** - treat them like passwords

## References

- [Apple Developer - Signing Your Apps for Gatekeeper](https://developer.apple.com/developer-id/)
- [electron-builder Code Signing Documentation](https://www.electron.build/code-signing)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)

