# Step-by-Step: Get Your Developer ID Certificate

Follow these steps to get your Developer ID certificate without needing Xcode.

## Step 1: Create a Certificate Signing Request (CSR)

1. **Open Keychain Access** on your Mac
   - Press `Cmd + Space` and type "Keychain Access"
   - Or find it in Applications → Utilities → Keychain Access

2. **Create the CSR**:
   - Go to **Keychain Access** menu → **Certificate Assistant** → **Request a Certificate From a Certificate Authority**
   - Enter your email address (the one associated with your Apple Developer account)
   - Enter your name (common name)
   - Select **"Saved to disk"**
   - Click **Continue**
   - Choose a location to save (e.g., Desktop)
   - Click **Save**

You should now have a `.certSigningRequest` file on your Desktop (or wherever you saved it).

## Step 2: Download Your Certificate from Apple Developer Portal

1. **Go to the Apple Developer Portal**:
   - Visit: https://developer.apple.com/account/resources/certificates/list
   - Sign in with your Apple Developer account

2. **Create a new certificate**:
   - Click the **+** button (blue plus icon in the top right)
   - Under **Software**, select **Developer ID Application**
   - Click **Continue**

3. **Upload your CSR**:
   - Click **Choose File**
   - Select the `.certSigningRequest` file you created in Step 1
   - Click **Continue**

4. **Download your certificate**:
   - Apple will generate your certificate
   - Click **Download** to save the certificate file (`.cer` file)

## Step 3: Install the Certificate

1. **Double-click the downloaded `.cer` file**
   - It should automatically open in Keychain Access
   - The certificate will be installed in your **login** keychain

2. **Verify it's installed**:
   - In Keychain Access, make sure **login** keychain is selected (left sidebar)
   - Click on **My Certificates** (bottom of categories list)
   - You should see: **Developer ID Application: Your Name (TEAM_ID)**

## Step 4: Verify Installation

Run this command in Terminal:

```bash
npm run check-signing
```

Or manually check:

```bash
security find-identity -v -p codesigning | grep "Developer ID Application"
```

You should see output like:
```
1) ABC123DEF456 "Developer ID Application: Your Name (TEAM_ID)"
```

**Important**: Note your **TEAM_ID** (the 10-character code in parentheses) - you'll need it for notarization!

## Troubleshooting

### Can't find the certificate after installing

- Make sure you're looking in the **login** keychain (not System)
- Make sure you're viewing **My Certificates** category
- Try searching for "Developer ID" in Keychain Access

### Certificate appears but is "Untrusted"

- Right-click the certificate in Keychain Access
- Select **Get Info**
- Expand **Trust** section
- Set **When using this certificate** to **Always Trust**
- Close the window

### Still having issues?

- Make sure you're logged into the Apple Developer Portal with the correct account
- Verify your Apple Developer account is active and paid
- Try creating a new CSR and downloading the certificate again

## Next Steps

Once your certificate is installed:

1. ✅ Verify: `npm run check-signing`
2. 🔨 Build: `npm run build:fat`
3. ✅ Check signing: `codesign -dv --verbose=4 "dist/Video Merger.app"`

For notarization (optional), you'll also need:
- Your Team ID (from the certificate)
- An app-specific password (create at appleid.apple.com)

