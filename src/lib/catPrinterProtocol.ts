/**
 * Protocol implementation for "cat printer" style mini thermal printers
 * (sold under many names: GB01, GB02, GB03, GT01, YT01, MX-series, PD01,
 * and rebrands like "Sachii Mini Bluetooth Thermal Printer").
 *
 * Unlike standard POS receipt printers, these do NOT understand ESC/POS
 * commands. They speak a small proprietary binary protocol over BLE where
 * every packet looks like:
 *
 *   [0x51, 0x78, CMD, 0x00, LEN_LO, LEN_HI, ...payload, CHECKSUM, 0xFF]
 *
 * This is a well-documented, openly reverse-engineered protocol (see
 * rbaron/catprinter and related community projects). Printing works by
 * rasterizing content to a 1-bit-per-pixel image and sending it row by row.
 */

export const CAT_PRINTER_WIDTH = 384; // dots per line (standard for 58mm/2" cat printers)

// BLE identifiers used by this family of printers.
export const CAT_PRINTER_SERVICE_UUIDS = [
  '0000ae30-0000-1000-8000-00805f9b34fb',
  '0000af30-0000-1000-8000-00805f9b34fb',
];
export const CAT_PRINTER_TX_CHARACTERISTIC_UUID = '0000ae01-0000-1000-8000-00805f9b34fb';
export const CAT_PRINTER_RX_CHARACTERISTIC_UUID = '0000ae02-0000-1000-8000-00805f9b34fb';

// Signed-byte command IDs converted to their unsigned (0-255) form.
const CMD = {
  GET_DEV_STATE: 0xa3,
  SET_QUALITY: 0xa4,
  GET_DEV_INFO: 0xa8,
  LATTICE: 0xa6,
  SET_PAPER: 0xa1,
  PRINT_IMG_OR_TEXT: 0xbe,
  FEED_PAPER: 0xbd,
  SET_ENERGY: 0xaf,
  PRINT_ROW_UNCOMPRESSED: 0xa2,
  PRINT_ROW_RLE: 0xbf,
};

// CRC-8 lookup table used by the printer's checksum
const CHECKSUM_TABLE: number[] = [
  0, 7, 14, 9, 28, 27, 18, 21, 56, 63, 54, 49, 36, 35, 42, 45,
  112, 119, 126, 121, 108, 107, 98, 101, 72, 79, 70, 65, 84, 83, 90, 93,
  224, 231, 238, 233, 252, 251, 242, 245, 216, 223, 214, 209, 196, 195, 202, 205,
  144, 151, 158, 153, 140, 139, 130, 133, 168, 175, 166, 161, 180, 179, 186, 189,
  199, 192, 201, 206, 219, 220, 213, 210, 255, 248, 241, 246, 227, 228, 237, 234,
  183, 176, 185, 190, 171, 172, 165, 162, 143, 136, 129, 134, 147, 148, 157, 154,
  39, 32, 41, 46, 59, 60, 53, 50, 31, 24, 17, 22, 3, 4, 13, 10,
  87, 80, 89, 94, 75, 76, 69, 66, 111, 104, 97, 102, 115, 116, 125, 122,
  137, 142, 135, 128, 149, 146, 155, 156, 177, 182, 191, 184, 173, 170, 163, 164,
  249, 254, 247, 240, 229, 226, 235, 236, 193, 198, 207, 200, 221, 218, 211, 212,
  105, 110, 103, 96, 117, 114, 123, 124, 81, 86, 95, 88, 77, 74, 67, 68,
  25, 30, 23, 16, 5, 2, 11, 12, 33, 38, 47, 40, 61, 58, 51, 52,
  78, 73, 64, 71, 82, 85, 92, 91, 118, 113, 120, 127, 106, 109, 100, 99,
  62, 57, 48, 55, 34, 37, 44, 43, 6, 1, 8, 15, 26, 29, 20, 19,
  174, 169, 160, 167, 178, 181, 188, 187, 150, 145, 152, 159, 138, 141, 132, 131,
  222, 217, 208, 215, 194, 197, 204, 203, 230, 225, 232, 239, 250, 253, 244, 243,
];

function checksum(bytes: number[]): number {
  let c = 0;
  for (const b of bytes) {
    c = CHECKSUM_TABLE[(c ^ b) & 0xff];
  }
  return c;
}

function packet(cmd: number, payload: number[]): number[] {
  const lenLo = payload.length & 0xff;
  const lenHi = (payload.length >> 8) & 0xff;
  const body = [0x51, 0x78, cmd, 0x00, lenLo, lenHi, ...payload];
  const crc = checksum(payload);
  return [...body, crc, 0xff];
}

function cmdSetEnergy(val: number): number[] {
  return packet(CMD.SET_ENERGY, [(val >> 8) & 0xff, val & 0xff]);
}

function cmdApplyEnergyOrPrintText(): number[] {
  return packet(CMD.PRINT_IMG_OR_TEXT, [1]);
}

function cmdFeedPaper(lines: number): number[] {
  return packet(CMD.FEED_PAPER, [lines & 0xff]);
}

const CMD_GET_DEV_STATE = packet(CMD.GET_DEV_STATE, [0]);
const CMD_SET_QUALITY_200_DPI = packet(CMD.SET_QUALITY, [50]);
const CMD_SET_PAPER = packet(CMD.SET_PAPER, [48, 0]);
const CMD_LATTICE_START = packet(CMD.LATTICE, [0xaa, 0x55, 0x17, 0x38, 0x44, 0x5f, 0x5f, 0x5f, 0x44, 0x38, 0x2c]);
const CMD_LATTICE_END = packet(CMD.LATTICE, [0xaa, 0x55, 0x17, 0, 0, 0, 0, 0, 0, 0, 0x17]);

function runLengthEncodeRow(row: boolean[]): number[] {
  const out: number[] = [];
  let count = 0;
  let last = -1;
  const flush = (n: number, val: number) => {
    while (n > 0x7f) {
      out.push(0x7f | (val << 7));
      n -= 0x7f;
    }
    if (n > 0) out.push((val << 7) | n);
  };
  for (const px of row) {
    const val = px ? 1 : 0;
    if (val === last) {
      count++;
    } else {
      if (count > 0) flush(count, last);
      count = 1;
      last = val;
    }
  }
  if (count > 0) flush(count, last);
  return out;
}

function cmdPrintRow(row: boolean[]): number[] {
  return packet(CMD.PRINT_ROW_RLE, runLengthEncodeRow(row));
}

// ENERGY_LEVELS: Different energy settings for cat printers
// OPTIMIZATION 1: Reduced energy to prevent over-burning
export const ENERGY_LEVELS = {
  LOW: 0x8000,      // 50% - for very sensitive printers
  MEDIUM: 0xC000,   // 75% - for most printers
  HIGH: 0xD800,     // 84.4% - Recommended for most cat printers
  MAXIMUM: 0xFFFF,  // 100% - Maximum energy (may over-burn)
};

// Default energy level - CHANGED from MAXIMUM to HIGH for better results
export const DEFAULT_ENERGY = ENERGY_LEVELS.HIGH;

export function buildCatPrinterImageCommands(rows: boolean[][], energy: number = DEFAULT_ENERGY): Uint8Array {
  const packets: number[][] = [
    CMD_GET_DEV_STATE,
    CMD_SET_QUALITY_200_DPI,
    cmdSetEnergy(energy),
    cmdApplyEnergyOrPrintText(),
    CMD_LATTICE_START,
  ];
  for (const row of rows) {
    packets.push(cmdPrintRow(row));
  }
  packets.push(
    cmdFeedPaper(25),
    CMD_SET_PAPER,
    CMD_SET_PAPER,
    CMD_SET_PAPER,
    CMD_LATTICE_END,
    CMD_GET_DEV_STATE,
  );
  return new Uint8Array(packets.flat());
}

/**
 * Floyd-Steinberg dithering algorithm for better print quality
 * This distributes quantization errors to neighboring pixels,
 * creating much better looking output than simple thresholding.
 */
function floydSteinbergDither(grayscale: number[], width: number, height: number): boolean[] {
  const result: boolean[] = new Array(width * height);
  const error = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      // Get original pixel value + accumulated error
      let value = grayscale[idx] + error[idx];

      // Quantize to 0 or 255
      const quantized = value < 128 ? 0 : 255;
      result[idx] = quantized === 0;

      // Calculate quantization error
      const err = value - quantized;

      // Distribute error to neighboring pixels (Floyd-Steinberg)
      if (x + 1 < width) {
        error[idx + 1] += err * 7 / 16;
      }
      if (y + 1 < height) {
        const nextRow = (y + 1) * width;
        if (x > 0) {
          error[nextRow + x - 1] += err * 3 / 16;
        }
        error[nextRow + x] += err * 5 / 16;
        if (x + 1 < width) {
          error[nextRow + x + 1] += err * 1 / 16;
        }
      }
    }
  }

  return result;
}

export function canvasToCatPrinterRows(canvas: HTMLCanvasElement): boolean[][] {
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  let sourceCanvas = canvas;
  if (canvas.width !== CAT_PRINTER_WIDTH) {
    const scaled = document.createElement('canvas');
    scaled.width = CAT_PRINTER_WIDTH;
    scaled.height = Math.round((canvas.height * CAT_PRINTER_WIDTH) / canvas.width);
    const sctx = scaled.getContext('2d');
    if (sctx) {
      sctx.fillStyle = '#fff';
      sctx.fillRect(0, 0, scaled.width, scaled.height);
      sctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
      sourceCanvas = scaled;
    }
  }

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const sctx = sourceCanvas.getContext('2d')!;
  const imgData = sctx.getImageData(0, 0, w, h).data;

  // OPTIMIZATION 2: Use Floyd-Steinberg dithering instead of thresholding

  // First, convert to grayscale
  const grayscale: number[] = new Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const r = imgData[idx];
    const g = imgData[idx + 1];
    const b = imgData[idx + 2];
    const a = imgData[idx + 3];
    if (a > 60) {
      // Weighted grayscale conversion (better than simple average)
      grayscale[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    } else {
      grayscale[i] = 255; // Transparent -> white
    }
  }

  // Apply Floyd-Steinberg dithering
  const dithered = floydSteinbergDither(grayscale, w, h);

  // OPTIMIZATION 3: Minimal dilation (only 1 pass, not 3)
  const rows: boolean[][] = [];
  for (let y = 0; y < h; y++) {
    const row: boolean[] = new Array(w).fill(false);
    for (let x = 0; x < w; x++) {
      row[x] = dithered[y * w + x];
    }
    rows.push(row);
  }

  // Single small dilation pass (not 3 passes or 7x thickening)
  const dilated = rows.map(row => [...row]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!rows[y][x]) continue;
      // Only 1 pixel dilation in all 8 directions (not 3 pixels)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
            dilated[ny][nx] = true;
          }
        }
      }
    }
  }

  return dilated;
}
