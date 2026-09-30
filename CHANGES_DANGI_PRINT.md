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
