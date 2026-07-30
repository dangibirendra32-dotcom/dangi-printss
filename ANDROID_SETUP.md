# Dangi Print — Android setup

This app already includes everything from our earlier printer work — the
cat-printer protocol (Floyd-Steinberg dithering, adjustable energy levels),
native Bluetooth support for the installed app, and a **Bluetooth Settings**
panel for manually overriding the service/characteristic UUID, chunk size,
and write delay if a specific printer needs different tuning. None of that
needed to be re-added; it was already there.

What was actually missing — and has now been added — is the Android/Capacitor
wrapper itself:

- `capacitor.config.ts`
- `.github/workflows/build-android.yml` (builds the APK automatically via
  GitHub Actions)
- `@capacitor/android` and `@capacitor/cli` in `package.json`, plus
  `cap:sync` / `cap:open` / `cap:copy` scripts

## 1. Push this project to GitHub

Same process as before:
1. Create a new empty repo on github.com (no README).
2. On the repo page, click **uploading an existing file**.
3. Extract this zip on your computer, select everything **inside** the
   extracted folder (not the folder itself), and drag it into the upload box.
4. Make sure `.github/workflows/build-android.yml` shows up in the file list
   before committing — dotfiles/folders are hidden by default in some file
   explorers, so double check it's there. If it's missing, add it directly on
   GitHub afterwards: **Add file → Create new file**, name it exactly
   `.github/workflows/build-android.yml`, and paste in the workflow content.
5. Commit.

## 2. Let GitHub build the APK

Go to the **Actions** tab — "Build Android APK" should run automatically.
Wait for the green checkmark, open the run, and download the
**dangi-print-debug-apk** artifact.

## 3. Test in a browser first

Before installing the APK, deploy the site (e.g. via Netlify connected to
this GitHub repo) and test printing in Chrome on your phone first — this
confirms the print pipeline itself is working before adding the native app
layer on top.

## 4. Bluetooth Settings panel

If auto-detection doesn't pick the right service/characteristic for your
printer, use the in-app **Bluetooth Settings** to manually specify one, or
adjust chunk size / write delay if printing seems unreliable. Defaults
(64 bytes, ~15ms) matched what worked in earlier testing — change these only
if you're troubleshooting a specific printer.

## Notes

- The workflow builds a **debug** APK (unsigned, fine for testing/sideloading).
  For a Play Store release, a signed release build would be needed instead.
- Leftover `app-debug.apk` files under `public/` and `APK_DOWNLOAD/` are not
  used by the app or this workflow — safe to ignore or delete.
