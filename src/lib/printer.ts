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
  ENERGY_LEVELS,
  DEFAULT_ENERGY,
} from './catPrinterProtocol';
import { Capacitor } from '@capacitor/core';
import { BleClient, numbersToDataView } from '@capacitor-community/bluetooth-le';

type PrinterType = 'escpos' | 'catprinter';

export class ThermalPrinter {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  private nativeDeviceId: string | null = null;
  private nativeServiceUuid: string | null = null;
  private nativeCharUuid: string | null = null;
  private nativeWriteWithoutResponse = false;

  private printerType: PrinterType = 'escpos';

  // Energy level for cat printers - adjustable
  private catPrinterEnergy: number = DEFAULT_ENERGY;

  private static KNOWN_SERVICES = [
    '000018f0-0000-1000-8000-00805f9b34fb',
    '0000ffe0-0000-1000-8000-00805f9b34fb',
    '0000ffe1-0000-1000-8000-00805f9b34fb',
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '0000ff01-0000-1000-8000-00805f9b34fb',
    '0000fee7-0000-1000-8000-00805f9b34fb',
    '00004953-5343-fe7d-4158-706b65746368',
    '49535343-fe7d-4158-706b-657463684953',
    'e7e1a000-a0f2-11e1-b201-0002767a551b',
    '00001101-0000-1000-8000-00805f9b34fb',
    '0000180a-0000-1000-8000-00805f9b34fb',
  ];

  // Method to set energy level for cat printers
  setCatPrinterEnergy(energy: number) {
    // Validate energy level
    const validEnergies = Object.values(ENERGY_LEVELS);
    if (!validEnergies.includes(energy)) {
      throw new Error(`Invalid energy level: ${energy}. Valid values: ${validEnergies.map(e => e.toString(16)).join(', ')}`);
    }
    this.catPrinterEnergy = energy;
    console.log(`Cat printer energy set to: ${energy.toString(16)}`);
  }

  // Get current energy level
  getCatPrinterEnergy(): number {
    return this.catPrinterEnergy;
  }

  // OPTIMIZATION 10: Add disconnect method
  async disconnect() {
    if (Capacitor.isNativePlatform()) {
      if (this.nativeDeviceId) {
        try {
          await BleClient.disconnect(this.nativeDeviceId);
        } catch (error) {
          console.error('Disconnect error:', error);
        }
        this.nativeDeviceId = null;
        this.nativeServiceUuid = null;
        this.nativeCharUuid = null;
      }
    } else {
      if (this.device) {
        try {
          this.device.gatt?.disconnect();
        } catch (error) {
          console.error('Disconnect error:', error);
        }
        this.device = null;
        this.characteristic = null;
      }
    }
    this.printerType = 'escpos';
  }

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
      this.nativeWriteWithoutResponse = !!characteristic.properties.writeWithoutResponse;

      return true;
    } catch (error) {
      console.error('Native Bluetooth connection failed:', error);
      return false;
    }
  }

  private async connectWeb(): Promise<boolean> {
    try {
      const allServices = [...CAT_PRINTER_SERVICE_UUIDS, ...ThermalPrinter.KNOWN_SERVICES];

      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: allServices,
      });

      const server = await this.device.gatt?.connect();
      if (!server) throw new Error('Could not connect to GATT Server');

      let service: BluetoothRemoteGATTService | null = null;
      this.printerType = 'escpos';

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
        this.characteristic =
          characteristics?.find(c => c.uuid.toLowerCase() === CAT_PRINTER_TX_CHARACTERISTIC_UUID.toLowerCase()) ||
          characteristics?.find(c => c.properties.write || c.properties.writeWithoutResponse) ||
          null;
      } else {
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
      const canvas = ThermalPrinter.escPosBytesToCanvas(data);
      const rows = canvasToCatPrinterRows(canvas);
      // Use the configured energy level
      outgoing = buildCatPrinterImageCommands(rows, this.catPrinterEnergy);
      console.log(`Printing with energy: ${this.catPrinterEnergy.toString(16)}`);
    }

    // OPTIMIZATION 4: Safer chunk size for BLE compatibility
    const chunkSize = 128; // Changed from 180 for better compatibility
    // OPTIMIZATION 5: Moderate delay for reliable printing
    const interChunkDelayMs = 20; // Changed from 10ms for reliability

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

      // Moderate delay for reliable printing
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
      TEXT_SIZE_LARGE: new Uint8Array([0x1d, 0x21, 0x11]),
      FEED_PAPER: new Uint8Array([0x1b, 0x64, 0x03]),
      CUT: new Uint8Array([0x1d, 0x56, 0x00]),
    };
  }

  static textToUint8(text: string) {
    const encoder = new TextEncoder();
    return encoder.encode(text + '\n');
  }

  static canvasToEscPos(canvas: HTMLCanvasElement): Uint8Array {
    const ctx = canvas.getContext('2d');
    if (!ctx) return new Uint8Array();

    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const widthBytes = Math.ceil(w / 8);

    const header = new Uint8Array([
      0x1b, 0x40,
      0x1b, 0x61, 0x00,
      0x1b, 0x33, 0x18,
      0x1d, 0x76, 0x30, 0,
      widthBytes % 256, Math.floor(widthBytes / 256),
      h % 256, Math.floor(h / 256)
    ]);

    // Use Floyd-Steinberg dithering for ESC/POS too
    const grayscale: number[] = new Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      if (a > 60) {
        grayscale[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      } else {
        grayscale[i] = 255;
      }
    }

    // Apply Floyd-Steinberg dithering
    const dithered: boolean[] = new Array(w * h);
    const error = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        let value = grayscale[idx] + error[idx];
        const quantized = value < 128 ? 0 : 255;
        dithered[idx] = quantized === 0;
        const err = value - quantized;
        if (x + 1 < w) {
          error[idx + 1] += err * 7 / 16;
        }
        if (y + 1 < h) {
          const nextRow = (y + 1) * w;
          if (x > 0) {
            error[nextRow + x - 1] += err * 3 / 16;
          }
          error[nextRow + x] += err * 5 / 16;
          if (x + 1 < w) {
            error[nextRow + x + 1] += err * 1 / 16;
          }
        }
      }
    }

    // Minimal 1-pixel dilation
    const dilated: Uint8Array = new Uint8Array(w * h);
    for (let i = 0; i < dithered.length; i++) {
      dilated[i] = dithered[i] ? 1 : 0;
    }

    // Apply dilation
    const dilatedCopy = new Uint8Array(dilated);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!dilatedCopy[y * w + x]) continue;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
              dilated[ny * w + nx] = 1;
            }
          }
        }
      }
    }

    const body = new Uint8Array(widthBytes * h);
    let byteIdx = 0;

    for (let y = 0; y < h; y++) {
      for (let xb = 0; xb < widthBytes; xb++) {
        let byteVal = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = xb * 8 + bit;
          if (x < w && dilated[y * w + x]) {
            byteVal |= (1 << (7 - bit));
          }
        }
        body[byteIdx++] = byteVal;
      }
    }

    const footer = new Uint8Array([
      0x1b, 0x32,
      0x1b, 0x64, 0x03,
      0x1d, 0x56, 0x00
    ]);

    const finalCmd = new Uint8Array(header.length + body.length + footer.length);
    finalCmd.set(header, 0);
    finalCmd.set(body, header.length);
    finalCmd.set(footer, header.length + body.length);

    return finalCmd;
  }

  static escPosBytesToCanvas(data: Uint8Array): HTMLCanvasElement {
    // Check if this is already a raster payload
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

    // Parse text-mode ESC/POS stream
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

    // OPTIMIZATION 7: Improved font rendering with fallback
    const width = CAT_PRINTER_WIDTH;
    const normalFontSize = 24;
    const largeFontSize = 38;
    const normalLineHeight = 30;
    const largeLineHeight = 46;
    const feedLineHeight = 22;

    let totalHeight = 20;
    for (const op of state.ops) {
      totalHeight += op.kind === 'feed' ? feedLineHeight : op.large ? largeLineHeight : normalLineHeight;
    }
    totalHeight += 20;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.max(totalHeight, 40);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'top';
    ctx.imageSmoothingEnabled = false; // Sharper text

    let y = 20;
    for (const op of state.ops) {
      if (op.kind === 'feed') {
        y += feedLineHeight;
        continue;
      }
      const fontSize = op.large ? largeFontSize : normalFontSize;
      const lineHeight = op.large ? largeLineHeight : normalLineHeight;
      // OPTIMIZATION 12: Use sans-serif with bold/normal for better compatibility
      ctx.font = `${op.bold ? "bold" : "normal"} ${fontSize}px sans-serif`;
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
