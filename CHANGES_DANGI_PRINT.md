# Dangi Print – update notes

## 1. New petrol bill format ("Station Slip") — current format kept
- Petrol tab now has **Bill Format: Classic Slip / Station Slip**. Classic is unchanged in layout and stays the default.
- Station Slip follows the dispenser-slip sample: logo, station name / dealer line / address, then
  `Bill No, Trns.ID, Atnd.ID, Vehi.No, Date, Time, FP. ID, Nozl No, Fuel, Density, Preset, Rate, Sale, Volume`.
- Wide, fixed label column (92px) + colon + value, so items and values are clearly separated.
- Extra inputs (shown only for Station Slip): Dealer Line, Trns.ID, FP ID, Density, Preset.
- Works in live preview, mobile preview, PDF / history export, Bluetooth (ESC/POS text) and cat-printer image print.
- New helper file: `src/lib/petrolStation.ts`.

## 2. Restaurant logo: preview vs export
- The logo ring is now a fixed 52x52 box in preview AND export (no padding-based sizing).
- History/custom PDF export now uses the same icons as the preview (previously it drew text badges such as "UTENSILS").
- Custom logos are re-fitted ("contain") onto an exact canvas before capture, because html2canvas does not reliably
  honour `object-fit`. This is what made logos change proportions after export. Same fix applies to cat-printer prints.

## 3. Cat mini printer connection
- Connection failures were silent (`connect()` returned false and the app showed nothing). The real reason is now
  shown in Bluetooth Settings (permission denied, Bluetooth off, no service found, etc.).
- Android: short settle delay + up to 3 service-discovery retries after connecting (empty service list was a common failure).
- Kept from earlier update: CatPrinter (AE30/AF30) auto-detect, AE01 preferred, MTU-aware chunk size.
- Tips if it still fails: printer on and close, not connected to another phone/app, Bluetooth AND Location ON,
  allow "Nearby devices" permission for the app.

## 4. Super Mart vs Restaurant
- Restaurant: "DINING • ORDER RECEIPT" header, boxed bill info, boxed "ORDER DETAILS", "★ Thank you for dining ★" footer.
- Super Mart: plain layout, "RETAIL • TAX INVOICE" header, "Goods once sold will not be taken back" footer.
- Same distinction in history/PDF export.

## 5. Petrol bill: bigger, denser, bolder (Classic and Station)
- Font sizes +1px, pure black text, and a light horizontal text-shadow so glyphs print thicker
  (the Courier font has no weight above 700, so this is what makes it look denser). Also more spacing between rows.

## Housekeeping
- Removed the two duplicate 3.7 MB `app-debug.apk` files (`public/` and `APK_DOWNLOAD/`); GitHub Actions builds a fresh APK.

## Validation
- Sources syntax/type-checked with TypeScript (no syntax errors; remaining messages are only from dependencies
  that are not installed in this sandbox). A full `npm install && npm run build` was not run here (no network),
  so the first GitHub Actions run is the real build test.
