╔═══════════════════════════════════════════════════════════════╗
║           VIDEO MERGER - INSTALLATION INSTRUCTIONS            ║
╚═══════════════════════════════════════════════════════════════╝

⚠️  IMPORTANT: Run the fix script BEFORE opening the app!

This app is not signed with an Apple Developer certificate, so 
macOS will show an "App is Damaged" error. This is normal and 
expected - the app is safe, just unsigned.


INSTALLATION STEPS:
═══════════════════

1. FIRST - Run the fix script:
   • Double-click "fix_damaged_app.sh"
   • If it doesn't run, open Terminal and drag the script onto it
   • Or run: bash fix_damaged_app.sh

2. THEN - Move the app:
   • Drag "Video Merger.app" to your Applications folder

3. DONE - Open and enjoy!
   • Launch Video Merger from Applications


ALTERNATIVE METHOD (if the script doesn't work):
═══════════════════════════════════════════════

Open Terminal and run this command:

    xattr -cr "Video Merger.app"

Then drag the app to Applications.


STILL HAVING ISSUES?
═══════════════════════════════════════════════

Try right-clicking the app → "Open" → Click "Open" in the dialog.
This tells macOS you trust the app.

For more help, see: INSTALLATION_TROUBLESHOOTING.md

