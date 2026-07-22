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

## 4. Print quality fixes (fade / missing logo / text layout)

If you tested printing and saw faded output, no logo, or text laid out
differently than the on-screen preview, that's now fixed:

- **Main "Print" button** now captures the actual on-screen receipt (logo
  included) as an image and prints that directly, instead of rebuilding the
  receipt from scratch as plain text. This is what was causing the logo to be
  missing and the layout to not match what's on screen.
- **Text still faded after the resolution fix, then the logo faded too**:
  this printer has two ways to send a row of dots — a compressed (RLE) format
  and a plain uncompressed one. Test prints showed the compressed format
  (used for the logo, since it's mostly solid blocks) came out dark and
  solid, while the plain uncompressed format (used as a fallback for
  busy/text rows) came out faint. Switching everything to the uncompressed
  format made even the logo faint too, confirming that format is the weak
  one for this printer. Fixed by always using the compressed (RLE) row
  format for every row, logo and text alike.

Note: the **Quick Reprint** feature (reprinting a past receipt with adjusted
amounts) still uses the older plain-text method, so it won't include the logo
yet — only the main Print button has been upgraded so far.

## 5. Bluetooth printing: works both in-browser and in the installed app

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

Bluetooth printing was initially only confirmed working in a phone/desktop
browser (Chrome), because the installed Android app's WebView doesn't support
the Web Bluetooth API at all. That's now fixed: `printer.ts` detects whether
it's running as an installed app or in a browser, and automatically uses a
native Bluetooth plugin (`@capacitor-community/bluetooth-le`) inside the
installed app, while still using the browser's own Bluetooth in Chrome. No
extra steps needed — just install the newly-built APK and use "Connect
Printer" from inside the app itself.

## 4. Customizing the app icon/name later

Once `android/` exists (after the first CI run, or if you run
`npx cap add android` yourself with Node/npm installed locally), you can:
- Change the app name/id in `capacitor.config.ts`
- Replace icons in `android/app/src/main/res/mipmap-*`
- Use `npx @capacitor/assets generate` with a source icon to regenerate all
  densities automatically.

## 6. Verified against the real protocol

I found and cross-checked the actual reverse-engineered protocol for this
printer family (these are commonly called "cat printers" / sold with an
"iPrint" style app). The command sequence, checksum method, and packet
format in `catPrinterProtocol.ts` match the documented reference exactly.

There's also a known, unresolved community issue with these printers: even a
byte-perfect reimplementation of the protocol tends to print lighter than the
official vendor app, and nobody has published why.

To get darker output **without** using more paper, the fix is now purely in
image processing: borderline gray pixels count as ink more readily, and thin
strokes get thickened using all 8 surrounding pixels (not just the 4
above/below/left/right) — this bolds up text and lines without changing the
receipt's length at all. (An earlier version of this fix tried doubling paper
length for extra darkness — that's been removed per your request to keep
paper usage the same.)

## Notes
- The workflow builds a **debug** APK (unsigned, fine for testing/sideloading).
  For a Play Store release you'd need a signed **release** build — I can add
  that step (keystore via GitHub Secrets) whenever you're ready to publish.
- The old `app-debug.apk` files under `public/` and `APK_DOWNLOAD/` are leftover
  from a previous export and aren't used by the app or this workflow — safe to
  delete, or just ignore them.
