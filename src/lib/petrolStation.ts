import type { ReceiptData } from '../types';
import { ThermalPrinter } from './printer';

/**
 * "Station slip" petrol bill format (the label : value layout printed by
 * dispenser-side printers, e.g. Bill No / Trns.ID / Vehi.No / Density ...).
 *
 * The same row list feeds the live preview, the PDF/history HTML export and
 * the ESC/POS text printer so all three always agree.
 */

/** yyyy-mm-dd -> dd/mm/yyyy (leaves anything else untouched). */
export const formatStationDate = (date: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : date || '';
};

/** HH:MM -> HH:MM:SS (leaves anything else untouched). */
export const formatStationTime = (time: string): string => {
  return /^\d{1,2}:\d{2}$/.test(time || '') ? `${time}:00` : time || '';
};

export const getStationRows = (data: ReceiptData): Array<[string, string]> => {
  const p = data.petrolDetails;
  const rate = p?.ratePerLtr ?? 0;
  const amount = p?.amount ?? 0;
  const volume = p?.volumeLtr ?? 0;
  return [
    ['Bill No', p?.receiptNo || ''],
    ['Trns.ID', p?.transactionId || ''],
    ['Atnd.ID', p?.attendantId || ''],
    ['Vehi.No', p?.vehicleNumber || 'NotEntered'],
    ['Date', formatStationDate(data.date)],
    ['Time', formatStationTime(data.time)],
    ['FP. ID', p?.fpId || '1'],
    ['Nozl No', p?.nozzleNo || '1'],
    ['Fuel', p?.product || ''],
    ['Density', p?.density || ''],
    ['Preset', p?.preset || 'NON PRESET'],
    ['Rate', `Rs.${rate.toFixed(2)}`],
    ['Sale', `Rs.${amount.toFixed(2)}`],
    ['Volume', `${volume.toFixed(2)}Lts.`],
  ];
};

export const escapeHtml = (s: string): string =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** ESC/POS byte chunks for the station slip (header + rows, no footer). */
export const buildStationEscPos = (data: ReceiptData): Uint8Array[] => {
  const cmds = ThermalPrinter.getCommands();
  const p = data.petrolDetails;
  const chunks: Uint8Array[] = [];

  chunks.push(cmds.ALIGN_LEFT);
  chunks.push(cmds.BOLD_ON);
  chunks.push(ThermalPrinter.textToUint8((data.companyName || '').toUpperCase()));
  if (p?.dealerLine) chunks.push(ThermalPrinter.textToUint8(p.dealerLine.toUpperCase()));
  if (data.address) chunks.push(ThermalPrinter.textToUint8(data.address.toUpperCase()));
  chunks.push(ThermalPrinter.textToUint8(' '));
  // Double-height only (GS ! 0x01): keeps 32 columns so rows never wrap.
  chunks.push(new Uint8Array([0x1d, 0x21, 0x01]));
  getStationRows(data).forEach(([label, value]) => {
    chunks.push(ThermalPrinter.textToUint8(`${label.padEnd(8)}:${value}`));
  });
  chunks.push(cmds.TEXT_SIZE_NORMAL);
  chunks.push(cmds.BOLD_OFF);
  return chunks;
};
