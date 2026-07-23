/**
 * Utility for handling ESC/POS commands and Web Bluetooth printer connection.
 *
 * Supports two families of cheap BLE thermal printers:
 *  1. "ESC/POS" printers (generic serial/UART BLE bridges) — these understand
 *     standard ESC/POS text & raster commands directly.
 *  2. "Cat printers" (GB01/GB02/GT01/PD01/MX-series and rebrands like the
 *     "Sachii Mini Bluetooth Thermal Printer") — these only understand a
 *     proprietary binary image protocol, not ESC/POS. See catPrinterProtocol.ts.
 *
 * print() always accepts the same ESC/POS byte stream the app already builds
 * (via getCommands()/textToUint8() for text receipts, or canvasToEscPos() for
 * rasterized ones) and transparently re-encodes it for cat printers when needed.
 */

import {
  CAT_PRINTER_SERVICE_UUIDS,
  CAT_PRINTER_TX_CHARACTERISTIC_UUID,
  CAT_PRINTER_WIDTH,
  buildCatPrinterImageCommands,
  canvasToCatPrinterRows,
} from './catPrinterProtocol';
import { Capacitor } from '@capacitor/core';
import { BleClient, numbersToDataView } from '@capacitor-community/bluetooth-le';

type PrinterType = 'escpos' | 'catprinter';

export class ThermalPrinter {
  // Web Bluetooth (browser) state
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  // Native BLE (installed Android/iOS app) state — the WebView an installed
  // Capacitor app runs in does not support the Web Bluetooth API at all, so
  // a separate native plugin path is required for the app to actually be
  // able to print once installed (this worked in the browser already; this
  // is what makes it also work in the installed app).
  private nativeDeviceId: string | null = null;
  private nativeServiceUuid: string | null = null;
  private nativeCharUuid: string | null = null;
  private nativeWriteWithoutResponse = false;

  private printerType: PrinterType = 'escpos';

  // Common Thermal Printer Service UUIDs used by various brands (including HM-10, CC2541, ISSC, Avery, etc.)
  private static KNOWN_SERVICES = [
    '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer Service
    '0000ffe0-0000-1000-8000-00805f9b34fb', // Common BLE Serial (CC2541/HM-10 used in cheap thermal printers)
    '0000ffe1-0000-1000-8000-00805f9b34fb', // Alternate BLE Serial Service
    '0000ff00-0000-1000-8000-00805f9b34fb', // Chinese generic ESC/POS printers
    '0000ff01-0000-1000-8000-00805f9b34fb', // Some thermal printers
    '0000fee7-0000-1000-8000-00805f9b34fb', // Tencent/WeChat IoT
    '00004953-5343-fe7d-4158-706b65746368', // Microchip ISSC SPP
    '49535343-fe7d-4158-706b-657463684953', // Microchip ISSC SPP alternate
    'e7e1a000-a0f2-11e1-b201-0002767a551b', // Avery Dennison
    '00001101-0000-1000-8000-00805f9b34fb', // Classic SPP BLE bridge
    '0000180a-0000-1000-8000-00805f9b34fb', // Device Info Service
  ];

  async connect() {
    if (Capacitor.isNativePlatform()) {
      return this.connectNative();
    }
    return this.connectWeb();
  }

  private async connectNative(): Promise<boolean> {
    try {
      await BleClient.initialize();

      const allServices = [...CAT_PRINTER_SERVICE_UUIDS, ...ThermalPrinter.KNOWN_SERVICES];

      // `services: []` (no required filter) plus `optionalServices` mirrors
      // the browser's acceptAllDevices behavior — shows every nearby BLE
      // device, not just ones already known to advertise these UUIDs.
      const device = await BleClient.requestDevice({
        services: [],
        optionalServices: allServices,
      });

      await BleClient.connect(device.deviceId, () => {
        this.nativeDeviceId = null;
        this.nativeServiceUuid = null;
        this.nativeCharUuid = null;
      });

      const services = await BleClient.getServices(device.deviceId);

      this.printerType = 'escpos';
      let matchedService: (typeof services)[number] | undefined;

      for (const uuid of CAT_PRINTER_SERVICE_UUIDS) {
        matchedService = services.find(s => s.uuid.toLowerCase() === uuid.toLowerCase());
        if (matchedService) {
          this.printerType = 'catprinter';
          console.log(`Detected cat-printer style device on service: ${uuid}`);
          break;
        }
      }

      if (!matchedService) {
        for (const uuid of ThermalPrinter.KNOWN_SERVICES) {
          matchedService = services.find(s => s.uuid.toLowerCase() === uuid.toLowerCase());
          if (matchedService) {
            console.log(`Successfully connected to printer service: ${uuid}`);
            break;
          }
        }
      }

      if (!matchedService && services.length > 0) {
        matchedService = services[0];
      }

      if (!matchedService) {
        throw new Error('No matching print services found on this device. Make sure the printer is turned on.');
      }

      let characteristic;
      if (this.printerType === 'catprinter') {
        characteristic =
          matchedService.characteristics.find(c => c.uuid.toLowerCase() === CAT_PRINTER_TX_CHARACTERISTIC_UUID.toLowerCase()) ||
          matchedService.characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);
      } else {
        characteristic = matchedService.characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);
      }

      if (!characteristic) throw new Error('No writable characteristic found for printing');

      this.nativeDeviceId = device.deviceId;
      this.nativeServiceUuid = matchedService.uuid;
      this.nativeCharUuid = characteristic.uuid;
      // Prefer fast, unacknowledged writes when available — matches the
      // browser path (Web Bluetooth's writeValueWithoutResponse), which
      // already prints correctly. Waiting for an acknowledgment on every
      // packet slows the data stream enough for the thermal print head to
      // cool between chunks, which produces a uniformly faded print rather
      // than fixing anything.
      this.nativeWriteWithoutResponse = !!characteristic.properties.writeWithoutResponse;

      return true;
    } catch (error) {
      console.error('Native Bluetooth connection failed:', error);
      return false;
    }
  }

  private async connectWeb(): Promise<boolean> {
    try {
      // Try cat-printer service UUIDs first (they're specific/unambiguous),
      // then fall back to the broader generic ESC/POS serial UUID list.
      const allServices = [...CAT_PRINTER_SERVICE_UUIDS, ...ThermalPrinter.KNOWN_SERVICES];

      // Allow searching for any bluetooth device and specify known print services as optional so we can access them
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: allServices,
      });

      const server = await this.device.gatt?.connect();
      if (!server) throw new Error('Could not connect to GATT Server');

      let service: BluetoothRemoteGATTService | null = null;
      this.printerType = 'escpos';

      // Try cat-printer services first
      for (const serviceUuid of CAT_PRINTER_SERVICE_UUIDS) {
        try {
          service = await server.getPrimaryService(serviceUuid);
          if (service) {
            this.printerType = 'catprinter';
            console.log(`Detected cat-printer style device on service: ${serviceUuid}`);
            break;
          }
        } catch (e) {
          // Continue searching
        }
      }

      // Then fall back to standard ESC/POS-style services
      if (!service) {
        for (const serviceUuid of ThermalPrinter.KNOWN_SERVICES) {
          try {
            service = await server.getPrimaryService(serviceUuid);
            if (service) {
              console.log(`Successfully connected to printer service: ${serviceUuid}`);
              break;
            }
          } catch (e) {
            // Continue searching
          }
        }
      }

      // Fallback: if we couldn't get a specific known service, try to get all services if permitted
      if (!service) {
        try {
          const services = await server.getPrimaryServices();
          if (services && services.length > 0) {
            service = services[0];
          }
        } catch (e) {
          throw new Error('No matching print services found on this device. Make sure the printer is turned on.');
        }
      }

      if (!service) throw new Error('No print service found');

      const characteristics = await service.getCharacteristics();

      if (this.printerType === 'catprinter') {
        // Prefer the known TX characteristic for cat printers, fall back to generic search.
        this.characteristic =
          characteristics?.find(c => c.uuid === CAT_PRINTER_TX_CHARACTERISTIC_UUID) ||
          characteristics?.find(c => c.properties.write || c.properties.writeWithoutResponse) ||
          null;
      } else {
        // Try to find a writable characteristic
        this.characteristic = characteristics?.find(c => c.properties.write || c.properties.writeWithoutResponse) || null;
      }

      if (!this.characteristic) throw new Error('No writable characteristic found for printing');

      return true;
    } catch (error) {
      console.error('Bluetooth connection failed:', error);
      return false;
    }
  }

  getPrinterType(): PrinterType {
    return this.printerType;
  }

  async print(data: Uint8Array) {
    const isNative = Capacitor.isNativePlatform();
    if (isNative && !this.nativeDeviceId) throw new Error('Printer not connected');
    if (!isNative && !this.characteristic) throw new Error('Printer not connected');

    let outgoing = data;

    if (this.printerType === 'catprinter') {
      // Cat printers don't understand ESC/POS at all — rasterize whatever
      // ESC/POS stream the app built (text receipt or already-a-raster PDF
      // crop) into a canvas, then re-encode it as cat-printer commands.
      const canvas = ThermalPrinter.escPosBytesToCanvas(data);
      // Use higher energy for better print quality on cat printers
      const rows = canvasToCatPrinterRows(canvas, true);
      // Use maximum energy (0xFFFF) for best results
      outgoing = buildCatPrinterImageCommands(rows, 0xffff);
    }

    // Most mini printers have extremely small BLE buffers (often 20 bytes up to 128 bytes).
    // Using 64-byte chunks with a 15ms sleep is the sweet spot for maximum
    // reliability across generic printers — this matches the browser path,
    // which already prints correctly, so the native path uses the same
    // pacing rather than slowing things down further.
    const chunkSize = 64;
    const interChunkDelayMs = 15;
    for (let i = 0; i < outgoing.length; i += chunkSize) {
      const chunk = outgoing.slice(i, i + chunkSize);

      if (isNative) {
        const dv = numbersToDataView(Array.from(chunk));
        if (this.nativeWriteWithoutResponse) {
          await BleClient.writeWithoutResponse(this.nativeDeviceId!, this.nativeServiceUuid!, this.nativeCharUuid!, dv);
        } else {
          await BleClient.write(this.nativeDeviceId!, this.nativeServiceUuid!, this.nativeCharUuid!, dv);
        }
      } else if (this.characteristic) {
        if (typeof this.characteristic.writeValueWithoutResponse === 'function' && this.characteristic.properties.writeWithoutResponse) {
          await this.characteristic.writeValueWithoutResponse(chunk);
        } else if (typeof this.characteristic.writeValueWithResponse === 'function') {
          await this.characteristic.writeValueWithResponse(chunk);
        } else {
          await this.characteristic.writeValue(chunk);
        }
      }

      // Micro-sleep to allow the printer's hardware buffer to process incoming bytes without dropping them
      await new Promise(resolve => setTimeout(resolve, interChunkDelayMs));
    }
  }

  static getCommands() {
    return {
      INIT: new Uint8Array([0x1b, 0x40]),
      ALIGN_LEFT: new Uint8Array([0x1b, 0x61, 0x00]),
      ALIGN_CENTER: new Uint8Array([0x1b, 0x61, 0x01]),
      ALIGN_RIGHT: new Uint8Array([0x1b, 0x61, 0x02]),
      BOLD_ON: new Uint8Array([0x1b, 0x45, 0x01]),
      BOLD_OFF: new Uint8Array([0x1b, 0x45, 0x00]),
      TEXT_SIZE_NORMAL: new Uint8Array([0x1d, 0x21, 0x00]),
      TEXT_SIZE_LARGE: new Uint8Array([0x1d, 0x21, 0x11]), // Double height & width
      FEED_PAPER: new Uint8Array([0x1b, 0x64, 0x03]), // Feed 3 lines
      CUT: new Uint8Array([0x1d, 0x56, 0x00]),
    };
  }

  // Convert string to Uint8Array (standard ASCII/CP850)
  static textToUint8(text: string) {
    const encoder = new TextEncoder();
    return encoder.encode(text + '\n');
  }

  /**
   * Converts a canvas into an ESC/POS raster graphic command (GS v 0).
   * Generates a precise binary monochrome bitmask where 1 is black and 0 is white.
   */
  static canvasToEscPos(canvas: HTMLCanvasElement): Uint8Array {
    const ctx = canvas.getContext('2d');
    if (!ctx) return new Uint8Array();

    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Calculate width in bytes (each byte holds 8 pixels horizontally)
    const widthBytes = Math.ceil(w / 8);

    // ESC/POS GS v 0 m xL xH yL yH d1...dk
    // Initialize standard printer setting, line spacing & alignment center/left
    const header = new Uint8Array([
      0x1b, 0x40,           // ESC @ (Initialize printer)
      0x1b, 0x61, 0x00,     // ESC a 0 (Align Left)
      0x1b, 0x33, 0x18,     // ESC 3 24 (Set line spacing to 24 dots)
      0x1d, 0x76, 0x30, 0,  // GS v 0 0 (Raster image normal mode)
      widthBytes % 256, Math.floor(widthBytes / 256), // xL, xH (horizontal bytes)
      h % 256, Math.floor(h / 256)                   // yL, yH (vertical dots)
    ]);

    // First pass: build a plain ink/no-ink map per pixel.
    // Slightly generous threshold (210, not 185/255) plus a 1px dilation pass
    // below — thermal print heads lose fine detail, so thin strokes and
    // borderline-gray pixels need extra help or the print comes out faded.
    const ink: Uint8Array = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        if (a > 60 && (r + g + b) / 3 < 210) {
          ink[y * w + x] = 1;
        }
      }
    }
    // Dilate by 1px so thin text/line strokes survive thermal printing.
    const dilated = new Uint8Array(ink);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!ink[y * w + x]) continue;
        if (x > 0) dilated[y * w + (x - 1)] = 1;
        if (x < w - 1) dilated[y * w + (x + 1)] = 1;
        if (y > 0) dilated[(y - 1) * w + x] = 1;
        if (y < h - 1) dilated[(y + 1) * w + x] = 1;
      }
    }

    // Build image pixel bitmask body
    const body = new Uint8Array(widthBytes * h);
    let byteIdx = 0;

    for (let y = 0; y < h; y++) {
      for (let xb = 0; xb < widthBytes; xb++) {
        let byteVal = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = xb * 8 + bit;
          if (x < w && dilated[y * w + x]) {
            byteVal |= (1 << (7 - bit)); // Set bit (high-bit on left, low-bit on right)
          }
        }
        body[byteIdx++] = byteVal;
      }
    }

    // Feed lines & cut paper command
    const footer = new Uint8Array([
      0x1b, 0x32,       // ESC 2 (Reset line spacing default)
      0x1b, 0x64, 0x03, // ESC d 3 (Feed 3 lines)
      0x1d, 0x56, 0x00  // GS V 0 (Cut paper)
    ]);

    // Concatenate all commands
    const finalCmd = new Uint8Array(header.length + body.length + footer.length);
    finalCmd.set(header, 0);
    finalCmd.set(body, header.length);
    finalCmd.set(footer, header.length + body.length);

    return finalCmd;
  }

  /**
   * Interprets an ESC/POS byte stream (as produced by getCommands()+textToUint8(),
   * or by canvasToEscPos()) and renders it onto an offscreen canvas, so it can be
   * re-encoded for printers (like cat printers) that only accept raster images.
   */
  static escPosBytesToCanvas(data: Uint8Array): HTMLCanvasElement {
    // Case 1: this is already a canvasToEscPos() raster payload — decode it
    // directly for a lossless roundtrip instead of re-parsing as text.
    if (
      data.length > 16 &&
      data[0] === 0x1b && data[1] === 0x40 &&
      data[2] === 0x1b && data[3] === 0x61 && data[4] === 0x00 &&
      data[5] === 0x1b && data[6] === 0x33 &&
      data[8] === 0x1d && data[9] === 0x76 && data[10] === 0x30
    ) {
      const widthBytes = data[12] + data[13] * 256;
      const height = data[14] + data[15] * 256;
      const width = widthBytes * 8;
      const bodyStart = 16;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      const imgData = ctx.createImageData(width, height);

      for (let y = 0; y < height; y++) {
        for (let xb = 0; xb < widthBytes; xb++) {
          const byteVal = data[bodyStart + y * widthBytes + xb] || 0;
          for (let bit = 0; bit < 8; bit++) {
            const x = xb * 8 + bit;
            if (x >= width) continue;
            const isInk = (byteVal & (1 << (7 - bit))) !== 0;
            const idx = (y * width + x) * 4;
            const shade = isInk ? 0 : 255;
            imgData.data[idx] = shade;
            imgData.data[idx + 1] = shade;
            imgData.data[idx + 2] = shade;
            imgData.data[idx + 3] = 255;
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
      return canvas;
    }

    // Case 2: a text-mode ESC/POS stream — parse the small set of commands
    // this app actually emits (INIT/ALIGN/BOLD/SIZE/FEED/CUT) plus the
    // newline-terminated text lines between them, then draw them.
    const cmds = ThermalPrinter.getCommands();
    const matchers: { bytes: Uint8Array; apply: (s: DrawState) => void }[] = [
      { bytes: cmds.INIT, apply: () => {} },
      { bytes: cmds.ALIGN_LEFT, apply: s => (s.align = 'left') },
      { bytes: cmds.ALIGN_CENTER, apply: s => (s.align = 'center') },
      { bytes: cmds.ALIGN_RIGHT, apply: s => (s.align = 'right') },
      { bytes: cmds.BOLD_ON, apply: s => (s.bold = true) },
      { bytes: cmds.BOLD_OFF, apply: s => (s.bold = false) },
      { bytes: cmds.TEXT_SIZE_LARGE, apply: s => (s.large = true) },
      { bytes: cmds.TEXT_SIZE_NORMAL, apply: s => (s.large = false) },
      { bytes: cmds.FEED_PAPER, apply: s => s.ops.push({ kind: 'feed' }) },
      { bytes: cmds.CUT, apply: () => {} },
    ];

    interface DrawState {
      align: 'left' | 'center' | 'right';
      bold: boolean;
      large: boolean;
      ops: Array<
        | { kind: 'text'; text: string; align: 'left' | 'center' | 'right'; bold: boolean; large: boolean }
        | { kind: 'feed' }
      >;
    }
    const state: DrawState = { align: 'left', bold: false, large: false, ops: [] };

    let i = 0;
    let textBuf: number[] = [];
    const flushText = () => {
      if (textBuf.length === 0) return;
      const text = new TextDecoder().decode(new Uint8Array(textBuf));
      textBuf = [];
      const lines = text.split('\n');
      // textToUint8() always appends a trailing \n, so split() leaves one
      // trailing empty string per line pushed — drop only that artifact.
      if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
      for (const line of lines) {
        state.ops.push({ kind: 'text', text: line, align: state.align, bold: state.bold, large: state.large });
      }
    };

    while (i < data.length) {
      let matched = false;
      if (data[i] === 0x1b || data[i] === 0x1d) {
        for (const m of matchers) {
          if (data.length - i >= m.bytes.length && m.bytes.every((b, j) => data[i + j] === b)) {
            flushText();
            m.apply(state);
            i += m.bytes.length;
            matched = true;
            break;
          }
        }
      }
      if (!matched) {
        textBuf.push(data[i]);
        i++;
      }
    }
    flushText();

    // Render the parsed operations onto a canvas.
    const width = CAT_PRINTER_WIDTH;
    const normalFontSize = 20;
    const largeFontSize = 34;
    const normalLineHeight = 26;
    const largeLineHeight = 42;
    const feedLineHeight = 18;

    // First pass: measure total height.
    let totalHeight = 20; // top padding
    for (const op of state.ops) {
      totalHeight += op.kind === 'feed' ? feedLineHeight : op.large ? largeLineHeight : normalLineHeight;
    }
    totalHeight += 20; // bottom padding

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.max(totalHeight, 40);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'top';

    let y = 20;
    for (const op of state.ops) {
      if (op.kind === 'feed') {
        y += feedLineHeight;
        continue;
      }
      const fontSize = op.large ? largeFontSize : normalFontSize;
      const lineHeight = op.large ? largeLineHeight : normalLineHeight;
      ctx.font = `${op.bold ? 'bold ' : ''}${fontSize}px "Courier New", monospace`;
      const textWidth = ctx.measureText(op.text).width;
      let x = 4;
      if (op.align === 'center') x = Math.max(4, (width - textWidth) / 2);
      else if (op.align === 'right') x = Math.max(4, width - textWidth - 4);
      ctx.fillText(op.text, x, y);
      y += lineHeight;
    }

    return canvas;
  }
}

