# Installation Troubleshooting

## "App is Damaged" or "Can't be Opened" Error

If you see an error message saying the app is "damaged" or macOS tells you to move it to the trash, this is **not actually a problem with the app**. It's macOS Gatekeeper blocking unsigned applications.

### Quick Fix (Recommended)

1. **Right-click** (or Control-click) on "Video Merger.app" in your Applications folder
2. Select **"Open"** from the context menu
3. Click **"Open"** in the security warning dialog
4. The app will now launch and be trusted for future use

### Alternative: Remove Quarantine Attribute

If right-click doesn't work, open Terminal and run:

```bash
xattr -cr /Applications/Video\ Merger.app
```

Then try opening the app normally.

### Why This Happens

- The app is not code-signed with an Apple Developer certificate
- This is normal for apps distributed outside the Mac App Store
- macOS Gatekeeper blocks unsigned apps by default for security
- The app is safe - you just need to give explicit permission the first time

### Permanent Solution (For Developers)

To avoid this issue for users, you would need to:
1. Get an Apple Developer account ($99/year)
2. Code-sign the app with a Developer ID certificate
3. Notarize the app with Apple

For now, the right-click method works perfectly and only needs to be done once per user.


