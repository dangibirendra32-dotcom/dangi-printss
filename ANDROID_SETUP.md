# Building "Dangi Print" as an Android app via GitHub

This project is now wrapped with **Capacitor** so it can run as a native Android
app, and a **GitHub Actions** workflow (`.github/workflows/build-android.yml`)
has been added that builds the APK for you automatically — you don't need
Android Studio or a local Android SDK.

## 1. Push this project to GitHub

```bash
cd dangi-print          # the extracted folder
git init
git add .
git commit -m "Add Capacitor + Android build workflow"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

(Create the empty repo on github.com first if you haven't already.)

## 2. Let GitHub build the APK

As soon as you push to `main`, the **Build Android APK** workflow runs
automatically. You can also trigger it manually:

- Go to your repo → **Actions** tab → **Build Android APK** → **Run workflow**.

When it finishes (a few minutes), open the workflow run → scroll to
**Artifacts** → download **dangi-print-debug-apk**. That zip contains
`app-debug.apk` — copy it to your phone (or scan a QR code link to it) and
install it (enable "install unknown apps" for your file manager/browser).

## 3. Bluetooth printing: now supports both printer families

The app detects what kind of printer you connect to and speaks its language
automatically:

- **Standard ESC/POS receipt printers** (generic serial/UART BLE bridges) —
  works as before.
- **"Cat printer" style mini printers** (GB01/GB02/GT01/PD01/MX-series and
  rebrands like the **Sachii Mini Bluetooth Thermal Printer**) — these don't
  understand ESC/POS at all; they use a different proprietary protocol. Support
  for this has been added in `src/lib/catPrinterProtocol.ts`, and `printer.ts`
  now auto-detects which type you paired and re-encodes the receipt as an
  image for cat printers automatically.

This still uses the Web Bluetooth API under the hood, so the WebView caveat
from the section above still applies — Bluetooth printing works in desktop/
Android Chrome, but **not yet in the wrapped Android APK's WebView**. Native
BLE (via `@capacitor-community/bluetooth-le`) is the next step to make it work
inside the installed app — say the word if you want that wired up too.

## 4. Customizing the app icon/name later

Once `android/` exists (after the first CI run, or if you run
`npx cap add android` yourself with Node/npm installed locally), you can:
- Change the app name/id in `capacitor.config.ts`
- Replace icons in `android/app/src/main/res/mipmap-*`
- Use `npx @capacitor/assets generate` with a source icon to regenerate all
  densities automatically.

## Notes
- The workflow builds a **debug** APK (unsigned, fine for testing/sideloading).
  For a Play Store release you'd need a signed **release** build — I can add
  that step (keystore via GitHub Secrets) whenever you're ready to publish.
- The old `app-debug.apk` files under `public/` and `APK_DOWNLOAD/` are leftover
  from a previous export and aren't used by the app or this workflow — safe to
  delete, or just ignore them.
