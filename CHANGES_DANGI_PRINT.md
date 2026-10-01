# Dangi Print – update notes

## Included fixes

1. **Petrol bill format**
   - Increased petrol receipt typography and boldness.
   - Added fixed label/value columns so values have more separation and align to the right.
   - Increased spacing between petrol receipt sections while keeping the existing receipt structure.
   - Applied the larger/bolder treatment to ESC/POS petrol printing as well as the live preview/PDF path.

2. **Restaurant PDF logo consistency**
   - Current-bill PDF export now clones the exact live receipt DOM instead of rebuilding a second logo layout. This keeps the restaurant logo dimensions/aspect ratio consistent between Preview and PDF.
   - Image loading now waits for both load and decode before html2canvas capture.
   - History/custom export keeps fixed logo dimensions.

3. **Cat mini-printer Bluetooth**
   - CatPrinter/iPrint protocol is auto-detected from the connected AE30/AF30 service.
   - AE01 is preferred as the transmit characteristic when present.
   - Switching services now updates the detected printer protocol.
   - Native Android BLE MTU is detected and the write chunk size is clamped to the usable MTU payload, preventing oversized writes on low-MTU printers.
   - The app automatically switches its UI printer mode to CatPrinter after a CatPrinter service is detected.
   - Existing 0x5178 proprietary CatPrinter image protocol, Floyd–Steinberg dithering, minimal dilation, 384-dot width and high-but-not-maximum energy settings are preserved.
   - Default BLE tuning is 128-byte configured chunks / 20 ms delay; native MTU limits are respected automatically.

4. **Restaurant vs Super Mart**
   - Restaurant receipts now have a dining/order-receipt header, boxed bill information and boxed order-details section.
   - Super Mart keeps the simpler retail receipt presentation.
   - The same distinction is reflected in history/PDF HTML exports.

## Validation

- `App.tsx`, `src/lib/printer.ts`, and `src/lib/catPrinterProtocol.ts` were syntax/transpile checked with TypeScript 5.8.3.
- A full dependency install/build was not run in this environment because the project dependencies could not be downloaded before the execution timeout. The source ZIP is ready for the normal GitHub Actions / npm build workflow.

## Petrol bill format switch
- Added a Petrol Bill Format switch with **Old Format** and **New HP Format**.
- Old Format remains the existing receipt layout.
- New HP Format follows the uploaded Sompura/HP service-station sample with B1TT No, Trns. ID, Atnd. ID, Vehi. No, Date, Time, FP. ID, Nozl. No, Fuel, Density, Preset, Rate, Sale and Volume.
- Added editable Transaction ID, Density and Preset fields for the new format.
- The selected petrol format is retained in receipt history and is used for PDF export and ESC/POS printing. CatPrinter printing uses the live preview, so the selected format is also rendered there.

## Latest fixes — PDF, Cat Printer, Petrol NEW format
- PDF export now uses a dependency-free inline receipt renderer instead of cloning the Tailwind preview DOM. This avoids Android WebView/html2canvas CSS parsing failures and uses a native cache file + Share flow on Android.
- CatPrinter output now uses the documented 0xA2 uncompressed 384-dot bitmap row protocol (LSB-first) instead of the less-compatible 0xBF RLE row path.
- CatPrinter discovery now recognizes AE30/AE3A/AF30 services and AE01/AE03 TX characteristics, and Android reconnects through a stale-GATT disconnect first.
- CatPrinter printing and quick reprint now capture the same inline renderer used by PDF export.
- NEW_HP petrol format now has an editable Dealer Name field and an uploaded logo can override the selected company logo. The station/company name remains editable as before.
- Fixed a duplicate Preset input in the NEW_HP petrol editor.

## Latest fixes (Dangi Print)
- Petrol New Format labels now use a colon on every description and a compact 42/58 description/value alignment.
- New Format keeps the receipt as one continuous section without an internal horizontal divider.
- Android Cat Printer selection no longer filters the BLE picker by advertised service UUID; many small Cat printers do not advertise their service UUID, so the user can select the printer and the app inspects its GATT services afterward.
- Petrol format label changed from "New HP Format" to "New Format".
- App branding is Dangi Print, including the HTML title.
- Removed the visible `admin / admin` default-credentials text and removed hard-coded fallback credentials. If no credentials exist, the app starts unlocked so credentials can be created from Security settings.

## Latest printer + petrol layout fix (2026-10-01)
- NEW petrol format label/value columns tightened from 42/58 to 28/72 so values start much closer to their descriptions, matching the compact station-receipt layout.
- NEW petrol PDF/export rows use the same tighter 28/72 column layout and reduced vertical spacing.
- NEW petrol ESC/POS text output now uses a compact fixed 9-character description column so printed values align consistently.
- Identified the user's printer as the SC03H family from the Bluetooth name `SC03h-842D`. SC03H is a known cat-printer BLE family; Dangi Print now performs a BLE scan first and automatically selects an SC03H device before falling back to the normal device picker.
- Native Android BLE connection now explicitly requests GATT service discovery after connecting, improving service detection on Android versions where `getServices()` can otherwise return an empty list.

## Printer connection fix (2026-10-01, v6)
- Connection failures were silent: `connect()` swallowed every error and returned `false`, and the UI ignored a `false` result. The real reason (Location off, permission denied, timeout, no service) is now stored in `printer.lastError` and shown in the Bluetooth error box.
- MTU bug: the BLE plugin reports MTU `-1` when MTU negotiation fails, and the old code then fell back to 128-byte writes on a 23-byte-MTU link (20 usable bytes), so printers dropped or truncated data. Unknown/failed MTU is now treated as 23 and chunks are capped to MTU-3.
- Default write chunk lowered 128 -> 64 bytes (matches the settings that worked in earlier testing). Saved custom values are kept.
- Scan is stopped (awaited) before connecting; scan timeout 12s -> 8s and the timer is cleared once a printer is found.
- A half-open GATT link is disconnected if service/characteristic setup fails, so the next attempt starts clean.
- Each BLE write retries once using the other write type; a mid-print disconnect now gives a clear error.
- UI now flips back to "disconnected" when the printer drops the link.

## Print quality fix (2026-10-01, v7)
- Printed receipts were faint/speckled. Cause: the receipt was captured at 576px, downscaled to 384 dots, then Floyd-Steinberg dithered, so grey text became sparse dots.
- Receipt is now captured at exactly 384/288 scale (no resampling) for CatPrinter prints.
- All text/borders are forced to pure black for printing.
- Dithering + dilation replaced by a plain threshold (185) so text is solid and crisp.
