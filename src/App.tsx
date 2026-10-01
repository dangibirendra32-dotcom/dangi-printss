/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Printer, 
  Smartphone, 
  Store, 
  Utensils, 
  Fuel, 
  Plus, 
  Trash2, 
  QrCode, 
  Camera, 
  Settings,
  Download,
  Bluetooth,
  ChevronRight,
  Info,
  Upload,
  Scissors,
  Sliders,
  ChevronLeft,
  Sparkles,
  CheckCircle,
  RefreshCw,
  Eye,
  FileText,
  Coffee,
  Pizza,
  Flame,
  Wine,
  Lock,
  Unlock,
  User,
  Shield,
  LogOut,
  Key,
  EyeOff,
  History,
  Calendar,
  Edit,
  Copy,
  IndianRupee,
  Clock,
  FileDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import html2canvas from 'html2canvas';

// Waits for every <img> inside a container to finish loading (or fail) before
// resolving. html2canvas captures whatever is currently painted — if a
// custom-uploaded logo's <img> hasn't finished loading yet, it captures as
// blank/missing instead of waiting for it.
const waitForImagesToLoad = (container: HTMLElement): Promise<void> => {
  const images = Array.from(container.querySelectorAll('img'));
  if (images.length === 0) return Promise.resolve();
  return Promise.all(images.map(async img => {
    if (!img.complete) {
      await new Promise<void>(resolve => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      });
    }
    try { if (typeof img.decode === 'function') await img.decode(); } catch { /* WebView fallback */ }
  })).then(() => undefined);
};
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

import { BillType, ReceiptData, ReceiptItem, PetrolCompany, HistoryItem } from './types';
import { ThermalPrinter } from './lib/printer';
import { PETROL_LOGOS, COMMON_ADDRESSES } from './constants';

const INITIAL_ITEMS: ReceiptItem[] = [
  { id: '1', name: 'Sample Item 1', quantity: 1, rate: 100, total: 100 }
];

export default function App() {
  const [activeTab, handleTabChangeInternal] = useState<BillType>('MART');
  const [data, setData] = useState<ReceiptData>({
    type: 'MART',
    companyName: 'EXPRESS MART',
    address: COMMON_ADDRESSES.MART,
    phone: '9876543210',
    gstNumber: '29AAAAA0000A1Z5',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    billNumber: 'BILL-' + Math.floor(1000 + Math.random() * 9000),
    items: INITIAL_ITEMS,
    subtotal: 100,
    taxLabel: 'GST',
    taxRate: 0,
    taxAmount: 0,
    total: 100,
    paymentMode: 'CASH',
    fontSize: 'medium',
    fontStyle: 'normal',
    showGst: true,
    petrolDetails: {
      company: 'JIO_BP',
      format: 'OLD',
      transactionId: '',
      dealerName: 'HPCL',
      density: 835.7,
      preset: 'NON PRESET',
      telNo: '7633481',
      receiptNo: '6563',
      fccId: '',
      fipNo: '',
      nozzleNo: '',
      product: 'Petrol',
      ratePerLtr: 93.85,
      volumeLtr: 6.18,
      amount: 580,
      vehType: 'Petrol',
      vehicleNumber: '',
      customerName: '',
      lstNo: '',
      vatNo: '',
      attendantId: 'not available'
    }
  });

  const [printer, setPrinter] = useState<ThermalPrinter | null>(null);
  const [isPrinterConnected, setIsPrinterConnected] = useState(false);
  
  // --- Bluetooth Configuration State ---
  const [customServiceUuid, setCustomServiceUuid] = useState<string>(() => {
    return localStorage.getItem('dangi_custom_service_uuid') || '';
  });
  const [customCharacteristicUuid, setCustomCharacteristicUuid] = useState<string>(() => {
    return localStorage.getItem('dangi_custom_characteristic_uuid') || '';
  });
  const [showBluetoothSettingsModal, setShowBluetoothSettingsModal] = useState(false);
  const [showMobilePreviewModal, setShowMobilePreviewModal] = useState(false);
  const [bluetoothConnectionError, setBluetoothConnectionError] = useState<string>('');

  const [bleChunkSize, setBleChunkSize] = useState<number>(() => {
    return Number(localStorage.getItem('dangi_ble_chunk_size')) || 128;
  });
  const [bleDelayMs, setBleDelayMs] = useState<number>(() => {
    const saved = localStorage.getItem('dangi_ble_delay_ms');
    return saved !== null ? Number(saved) : 20;
  });
  const [bleForceWriteWithResponse, setBleForceWriteWithResponse] = useState<boolean>(() => {
    return localStorage.getItem('dangi_ble_force_write') === 'true';
  });
  const [bleUseCrLf, setBleUseCrLf] = useState<boolean>(() => {
    return localStorage.getItem('dangi_ble_use_crlf') !== 'false';
  });
  const [bleSendCutCommand, setBleSendCutCommand] = useState<boolean>(() => {
    return localStorage.getItem('dangi_ble_send_cut') === 'true'; // Default false for safe printer compatibility
  });

  const [printerProtocol, setPrinterProtocol] = useState<'esc-pos' | 'cat-printer'>(() => {
    return (localStorage.getItem('dangi_printer_protocol') as 'esc-pos' | 'cat-printer') || 'esc-pos';
  });

  // Keep printer instance properties in sync with user settings
  useEffect(() => {
    if (printer) {
      printer.chunkSize = bleChunkSize;
      printer.delayMs = bleDelayMs;
      printer.forceWriteWithResponse = bleForceWriteWithResponse;
      printer.useCrLf = bleUseCrLf;
      printer.sendCutCommand = bleSendCutCommand;
    }
  }, [printer, bleChunkSize, bleDelayMs, bleForceWriteWithResponse, bleUseCrLf, bleSendCutCommand]);

  // Active GATT Discovery and Live-Override States
  const [activeServiceUuid, setActiveServiceUuid] = useState<string>('');
  const [activeCharacteristicUuid, setActiveCharacteristicUuid] = useState<string>('');
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [availableCharacteristics, setAvailableCharacteristics] = useState<any[]>([]);

  const handleSwitchService = async (serviceUuid: string) => {
    if (!printer) return;
    try {
      await printer.setServiceByUuid(serviceUuid);
      setActiveServiceUuid(printer.connectedServiceUuid);
      setActiveCharacteristicUuid(printer.connectedCharacteristicUuid);
      setAvailableCharacteristics(printer.availableCharacteristics);
    } catch (err: any) {
      alert("Failed to switch service: " + err.message);
    }
  };

  const handleSwitchCharacteristic = async (charUuid: string) => {
    if (!printer) return;
    try {
      await printer.setCharacteristicByUuid(charUuid);
      setActiveCharacteristicUuid(printer.connectedCharacteristicUuid);
    } catch (err: any) {
      alert("Failed to switch characteristic: " + err.message);
    }
  };

  // --- Secure Authentication State ---
  const [isSecurityEnabled, setIsSecurityEnabled] = useState<boolean>(() => {
    const hasCredentials = !!localStorage.getItem('tinyprint_username') && !!localStorage.getItem('tinyprint_password');
    return hasCredentials && localStorage.getItem('tinyprint_security_enabled') !== 'false';
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const sessionAuth = sessionStorage.getItem('tinyprint_authenticated') === 'true';
    const hasCredentials = !!localStorage.getItem('tinyprint_username') && !!localStorage.getItem('tinyprint_password');
    const isSecEnabled = hasCredentials && localStorage.getItem('tinyprint_security_enabled') !== 'false';
    return !isSecEnabled || sessionAuth;
  });
  const [loginIdInput, setLoginIdInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [showChangeCredentialsModal, setShowChangeCredentialsModal] = useState<boolean>(false);
  const [newLoginId, setNewLoginId] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState<string>('');
  const [credentialsChangeSuccess, setCredentialsChangeSuccess] = useState<string>('');
  const [credentialsChangeError, setCredentialsChangeError] = useState<string>('');

  // --- Secure Authentication Actions ---
  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const correctUser = localStorage.getItem('tinyprint_username');
    const correctPass = localStorage.getItem('tinyprint_password');

    if (!correctUser || !correctPass) {
      setLoginError('No login credentials are configured. Open Security settings to create them.');
      return;
    }

    if (loginIdInput.trim() === correctUser && passwordInput === correctPass) {
      setIsAuthenticated(true);
      sessionStorage.setItem('tinyprint_authenticated', 'true');
      setLoginIdInput('');
      setPasswordInput('');
      setLoginError('');
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 }
      });
    } else {
      setLoginError('Invalid Login ID or Password.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('tinyprint_authenticated');
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setCredentialsChangeError('');
    setCredentialsChangeSuccess('');

    if (!newLoginId.trim()) {
      setCredentialsChangeError('Login ID cannot be empty');
      return;
    }
    if (!newPassword) {
      setCredentialsChangeError('Password cannot be empty');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setCredentialsChangeError('Passwords do not match');
      return;
    }

    localStorage.setItem('tinyprint_username', newLoginId.trim());
    localStorage.setItem('tinyprint_password', newPassword);
    setCredentialsChangeSuccess('Credentials updated successfully!');
    
    setNewLoginId('');
    setNewPassword('');
    setNewPasswordConfirm('');

    setTimeout(() => {
      setShowChangeCredentialsModal(false);
      setCredentialsChangeSuccess('');
    }, 1500);
  };

  const handleToggleSecurity = (enabled: boolean) => {
    localStorage.setItem('tinyprint_security_enabled', String(enabled));
    setIsSecurityEnabled(enabled);
    if (!enabled) {
      setIsAuthenticated(true);
    } else {
      const sessionAuth = sessionStorage.getItem('tinyprint_authenticated') === 'true';
      setIsAuthenticated(sessionAuth);
    }
  };

  // --- Print & Receipt History States & Handlers ---
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem('tinyprint_history');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null);
  const [showQuickReprintModal, setShowQuickReprintModal] = useState<boolean>(false);
  const [quickDate, setQuickDate] = useState<string>('');
  const [quickTime, setQuickTime] = useState<string>('');
  const [quickAmount, setQuickAmount] = useState<string>('');
  const [quickCustomerName, setQuickCustomerName] = useState<string>('');

  const saveToHistory = (customData?: ReceiptData) => {
    const dataToSave = customData || data;
    const newItem: HistoryItem = {
      id: 'HIST-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      savedAt: new Date().toISOString(),
      receiptData: JSON.parse(JSON.stringify(dataToSave))
    };
    setHistory(prev => {
      const updated = [newItem, ...prev];
      localStorage.setItem('tinyprint_history', JSON.stringify(updated));
      return updated;
    });
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem('tinyprint_history', JSON.stringify(updated));
      return updated;
    });
  };

  const loadHistoryItemToEditor = (item: HistoryItem) => {
    setData(JSON.parse(JSON.stringify(item.receiptData)));
    handleTabChange(item.receiptData.type);
    confetti({
      particleCount: 30,
      spread: 50,
      origin: { y: 0.8 }
    });
  };

  const openQuickReprint = (item: HistoryItem) => {
    setSelectedHistoryItem(item);
    setQuickDate(item.receiptData.date);
    setQuickTime(item.receiptData.time);
    
    // Determine initial amount
    let initialAmt = '0';
    if (item.receiptData.type === 'PETROL') {
      initialAmt = String(item.receiptData.petrolDetails?.amount || 0);
    } else {
      initialAmt = String(item.receiptData.total || 0);
    }
    setQuickAmount(initialAmt);
    setQuickCustomerName(item.receiptData.petrolDetails?.customerName || '');
    setShowQuickReprintModal(true);
  };

  // --- PDF Bill Export States & Handlers ---
  const [pdfExportFormat, setPdfExportFormat] = useState<'58MM' | '80MM' | 'A4'>('58MM');
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const getPetrolLogoHtmlForPdf = (p?: ReceiptData['petrolDetails']): string => {
    const company = p?.company || 'JIO_BP';
    // An uploaded logo always wins. This keeps the NEW_HP format editable just
    // like the old format instead of locking it to the selected company logo.
    if (p?.customLogoUrl) {
      return `<div style="display:flex;justify-content:center;align-items:center;width:100%;height:120px;margin:4px 0 8px 0;overflow:hidden;">
        <img src="${p.customLogoUrl}" style="display:block;max-width:150px;max-height:110px;width:auto;height:auto;object-fit:contain;" />
      </div>`;
    }
    if (company === 'CUSTOM') return '';

    const logoSrcByCompany: Record<Exclude<PetrolCompany, 'CUSTOM'>, string> = {
      JIO_BP: '/logos/jio-bp.svg',
      HP: '/logos/hp.svg',
      BHARAT_PETROLEUM: '/logos/bharat-petroleum.png',
      INDIAN_OIL: '/logos/indian-oil.png',
      NAYARA: '/logos/nayara.png',
      ESSAR: '/logos/essar.png',
    };
    const src = logoSrcByCompany[company as Exclude<PetrolCompany, 'CUSTOM'>] || logoSrcByCompany.JIO_BP;

    return `<div style="display: flex; justify-content: center; align-items: center; width: 100%; margin: 4px 0 8px 0;">
      <img src="${src}" style="max-width: 150px; max-height: 110px; object-fit: contain;" />
    </div>`;
  };

  const getRestaurantLogoHtmlForPdf = (rData: ReceiptData): string => {
    if (rData.type !== 'RESTAURANT' || rData.restaurantLogo === 'NONE') return '';

    const badge = (innerHtml: string) => `
      <div style="display:flex; justify-content:center; align-items:center; width:100%; height:48px; margin-bottom:10px;">
        <div style="width:44px; height:44px; min-width:44px; min-height:44px; box-sizing:border-box; border:2px solid #0f172a; border-radius:9999px; display:flex; align-items:center; justify-content:center; overflow:hidden; line-height:0;">
          ${innerHtml}
        </div>
      </div>
    `;

    if (rData.restaurantLogo === 'CUSTOM') {
      if (rData.restaurantCustomLogoUrl) {
        return badge(`<img src="${rData.restaurantCustomLogoUrl}" width="28" height="28" style="display:block; width:28px; height:28px; max-width:28px; max-height:28px; object-fit:contain; flex:0 0 28px;" />`);
      }
      return badge('<span style="display:flex; align-items:center; justify-content:center; width:28px; height:28px; font-family:Arial,sans-serif; font-size:8px; font-weight:900; letter-spacing:.4px;">UTENSILS</span>');
    }

    const symbolByLogo: Record<Exclude<NonNullable<ReceiptData['restaurantLogo']>, 'NONE' | 'CUSTOM'>, string> = {
      UTENSILS: 'UTENSILS', COFFEE: 'CAFE', PIZZA: 'PIZZA', FLAME: 'GRILL', BAR: 'BAR',
    };
    const symbol = symbolByLogo[(rData.restaurantLogo || 'UTENSILS') as keyof typeof symbolByLogo] || 'UTENSILS';
    return badge(`<span style="display:flex; align-items:center; justify-content:center; width:28px; height:28px; font-family:Arial,sans-serif; font-size:8px; font-weight:900; letter-spacing:.4px; text-align:center;">${symbol}</span>`);
  };

  const renderReceiptHtmlForExport = (rData: ReceiptData): string => {
    if (rData.type === 'PETROL') {
      const p = rData.petrolDetails;
      if (p?.format === 'NEW_HP') {
        const row = (label: string, value: string, bold = false) => `<div style="display:grid;grid-template-columns:28% 72%;column-gap:0;align-items:baseline;margin:0 0 2px 0;line-height:1.12;${bold ? 'font-weight:900;' : ''}"><span style="white-space:nowrap;">${label}</span><span style="text-align:left;overflow-wrap:anywhere;word-break:break-word;">${value}</span></div>`;
        return `
          <div style="width:100%;color:#111827;font-family:monospace;font-size:12px;font-weight:800;box-sizing:border-box;background:#fff;">
            ${getPetrolLogoHtmlForPdf(p)}
            <div style="text-align:center;font-size:13px;font-weight:900;text-transform:uppercase;line-height:1.1;">${(rData.companyName || '').toUpperCase()}</div>
            <div style="text-align:center;font-size:10px;font-weight:900;margin-top:3px;">DEALERS:- ${p?.dealerName || 'HPCL'}</div>
            <div style="text-align:center;font-size:10px;font-weight:900;margin-top:3px;line-height:1.2;">${rData.address || ''}</div>
            <div style="margin:9px 0 8px;padding:0;">
              ${row('BILL NO:', rData.billNumber || p.receiptNo || '')}
              ${row('Trns. ID:', p.transactionId || '')}
              ${row('Atnd. ID:', p.attendantId || '')}
              ${row('Vehi. No:', p.vehicleNumber || '')}
              ${row('Date:', rData.date || '')}
              ${row('Time:', rData.time || '')}
              ${row('FP. ID:', p.fipNo || '')}
              ${row('Nozl. No:', p.nozzleNo || '')}
            </div>
            <div style="font-size:12px;">
              ${row('Fuel:', p.product || 'Petrol')}
              ${row('Density:', `${(p.density ?? 835.7).toFixed(1)} kg/m3`)}
              ${row('Preset:', p.preset || 'NON PRESET')}
              ${row('Rate:', `Rs.${(p.ratePerLtr || 0).toFixed(2)}`, true)}
              ${row('Sale:', `Rs.${(p.amount || 0).toFixed(2)}`, true)}
              ${row('Volume:', `${(p.volumeLtr || 0).toFixed(2)} Lts.`, true)}
            </div>
            <div style="text-align:center;margin-top:10px;padding-top:0;">
              <div style="font-size:10px;font-weight:900;text-transform:uppercase;">Thank You! Visit Again</div>
              <div style="font-size:8px;margin-top:4px;font-weight:700;">SAVE FUEL, SAVE MONEY, SAVE THE PLANET.</div>
            </div>
          </div>`;
      }
      const petrolRow = (label: string, value: string) => `
        <div style="display:grid; grid-template-columns:48% 52%; column-gap:6px; align-items:baseline; margin:0 0 7px 0; line-height:1.25; font-weight:900;">
          <span style="white-space:nowrap;">${label}</span><span style="text-align:right; overflow-wrap:anywhere; word-break:break-word;">${value}</span>
        </div>`;
      return `
        <div style="width:100%; color:#111827; font-family:monospace; font-size:12px; font-weight:900; box-sizing:border-box; background-color:#ffffff;">
          ${getPetrolLogoHtmlForPdf(p)}
          <div style="text-align: center; font-weight: 900; font-size: 12px; margin-bottom: 8px; margin-top: 4px;">WELCOME!!!</div>
          <div style="text-align: center; font-size: 11px; margin-bottom: 8px; line-height: 1.2; font-weight: 900; text-transform: uppercase;">${(rData.companyName || '').toUpperCase()}</div>
          <div style="text-align: center; font-size: 10px; margin-bottom: 16px; line-height: 1.2;">${rData.address || ''}</div>
          
          <div style="font-size:11px; margin:0 0 14px 0; border-top:1px dashed #9ca3af; border-bottom:1px dashed #9ca3af; padding:10px 0 7px 0;">
            ${petrolRow('TEL NO:', p?.telNo || '')}
            ${petrolRow('RECEIPT NO:', p?.receiptNo || '')}
            ${petrolRow('FCC ID:', p?.fccId || 'N/A')}
            ${petrolRow('FIP NO:', p?.fipNo || 'N/A')}
            ${petrolRow('NOZZLE NO:', p?.nozzleNo || 'N/A')}
          </div>
          <div style="font-size:12px; margin:0 0 14px 0; padding:10px 0 6px 0; border-bottom:1px dashed #9ca3af; font-weight:900;">
            ${petrolRow('PRODUCT:', p?.product || '')}
            ${petrolRow('RATE/LTR:', (p?.ratePerLtr || 0).toFixed(2))}
            ${petrolRow('AMOUNT:', `₹${(p?.amount || 0).toFixed(2)}`)}
            ${petrolRow('VOLUME(LTR):', `${(p?.volumeLtr || 0).toFixed(2)} lt`)}
          </div>
          <div style="font-size:11px; margin-bottom:14px;">
            ${petrolRow('VEH TYPE:', p?.vehType || '')}
            ${petrolRow('VEH NO:', p?.vehicleNumber || '')}
            ${petrolRow('CUSTOMER:', p?.customerName || '')}
          </div>
          <div style="font-size:11px; padding-top:10px; border-top:1px dashed #9ca3af;">
            ${petrolRow('DATE:', `${rData.date || ''} ${rData.time || ''}`)}
            ${petrolRow('MODE:', rData.paymentMode || '')}
            ${petrolRow('VAT NO:', p?.vatNo || 'N/A')}
            ${petrolRow('ATTENDANT:', p?.attendantId || '')}
          </div>

          <div style="text-align: center; margin-top: 24px; margin-bottom: 8px;">
            <div style="font-weight: 900; font-size: 12px; text-transform: uppercase;">Thank You! Visit Again</div>
            <div style="font-size: 8px; margin-top: 4px; font-weight: 700;">SAVE FUEL, SAVE MONEY, SAVE THE PLANET.</div>
          </div>
        </div>
      `;
    }

    const itemsHtml = (rData.items || []).map((item, index) => `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin: 4px 0; font-size: 10px;">
        <span style="width: 8%;">${index + 1}</span>
        <span style="width: 32%; word-break: break-word; line-height: 1.1;">${item.name || 'Unnamed Item'}</span>
        <span style="width: 15%; text-align: right;">${item.quantity}</span>
        <span style="width: 20%; text-align: right;">₹${(item.rate || 0).toFixed(2)}</span>
        <span style="width: 25%; text-align: right;">₹${(item.total || 0).toFixed(2)}</span>
      </div>
    `).join('');

    return `
      <div style="width: 100%; color: #1e293b; font-family: monospace; font-size: 11px; box-sizing: border-box; background-color: #ffffff;">
        ${getRestaurantLogoHtmlForPdf(rData)}
        <h1 style="font-size:${rData.type === 'RESTAURANT' ? '15px' : '14px'}; font-weight:900; text-align:center; margin-bottom:4px; line-height:1; text-transform:uppercase; color:#0f172a;">${rData.companyName || 'STORE'}</h1>
        <p style="text-align:center; font-size:10px; margin-bottom:6px; white-space:normal;">${rData.address || ''}</p>
        ${rData.type === 'RESTAURANT' ? `<div style="text-align:center; font-size:8px; font-weight:900; letter-spacing:2px; margin-bottom:8px;">DINING • ORDER RECEIPT</div>` : ''}
        <div style="width:100%; height:1px; border-bottom:1px dashed #cbd5e1; margin:8px 0;"></div>

        <div style="width:100%; font-size:10px; padding:${rData.type === 'RESTAURANT' ? '7px 5px' : '0 4px'}; margin-bottom:6px; box-sizing:border-box; ${rData.type === 'RESTAURANT' ? 'background:#f8fafc; border:1px solid #cbd5e1; border-radius:5px;' : ''}">
          <div style="display:flex; justify-content:space-between;"><span>DATE: ${rData.date || ''}</span><span>TIME: ${rData.time || ''}</span></div>
          <div>BILL NO: ${rData.billNumber || ''}</div>
          ${rData.showGst !== false ? `<div>GSTIN: ${rData.gstNumber || 'N/A'}</div>` : ''}
          <div>MODE: ${rData.paymentMode || ''}</div>
        </div>

        <div style="width:100%; height:1px; border-bottom:1px dashed #cbd5e1; margin:8px 0;"></div>

        <div style="width:100%; padding:${rData.type === 'RESTAURANT' ? '7px 6px' : '0 4px'}; box-sizing:border-box; ${rData.type === 'RESTAURANT' ? 'border:1px solid #cbd5e1; border-radius:5px;' : ''}">
          ${rData.type === 'RESTAURANT' ? `<div style="font-size:8px; font-weight:900; letter-spacing:1.5px; color:#64748b; margin-bottom:6px;">ORDER DETAILS</div>` : ''}
          <div style="display:flex; justify-content:space-between; font-weight:900; font-size:10px; margin-bottom:4px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
            <span style="width:8%;">#</span>
            <span style="width:32%;">ITEM</span>
            <span style="width:15%; text-align:right;">QTY</span>
            <span style="width:20%; text-align:right;">RATE</span>
            <span style="width:25%; text-align:right;">TOTAL</span>
          </div>
          <div style="margin-bottom:8px;">${itemsHtml}</div>
        </div>

        <div style="width: 100%; height: 1px; border-bottom: 1px dashed #cbd5e1; margin: 8px 0;"></div>

        <div style="width: 100%; padding: 0 4px; text-align: right; font-size: 10px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;"><span>SUBTOTAL</span><span>₹${(rData.subtotal || 0).toFixed(2)}</span></div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 900; margin-top: 6px;">
            <span style="text-transform: uppercase;">Grand Total</span>
            <span>₹${(rData.total || 0).toFixed(2)}</span>
          </div>
        </div>

        <div style="width: 100%; height: 1px; border-bottom: 1px dashed #cbd5e1; margin: 16px 0 12px 0;"></div>
        <p style="text-align: center; font-weight: 700; margin-top: 12px; text-transform: uppercase; font-size: 11px;">Thank You! Visit Again</p>
      </div>
    `;
  };

  const captureReceiptCanvas = async (rData: ReceiptData, scale = 2): Promise<HTMLCanvasElement> => {
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'fixed';
    tempDiv.style.top = '-10000px';
    tempDiv.style.left = '-10000px';
    tempDiv.style.width = '288px';
    tempDiv.style.padding = '24px 16px';
    tempDiv.style.backgroundColor = '#ffffff';
    tempDiv.style.color = '#111827';
    tempDiv.style.boxSizing = 'border-box';
    tempDiv.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    tempDiv.innerHTML = renderReceiptHtmlForExport(rData);
    document.body.appendChild(tempDiv);
    try {
      await new Promise(resolve => setTimeout(resolve, 60));
      await waitForImagesToLoad(tempDiv);
      return await html2canvas(tempDiv, {
        scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
    } finally {
      if (document.body.contains(tempDiv)) document.body.removeChild(tempDiv);
    }
  };

  const handleExportPdf = async (customData?: ReceiptData) => {
    const targetData = customData || data;
    setIsExportingPdf(true);

    try {
      const canvas = await captureReceiptCanvas(targetData, 3);
      const imgData = canvas.toDataURL('image/png');
      const sanitizedCompName = (targetData.companyName || 'Bill').replace(/[^a-zA-Z0-9]/g, '_');
      const sanitizedBillNo = (targetData.billNumber || targetData.petrolDetails?.receiptNo || 'Receipt').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${sanitizedCompName}_${sanitizedBillNo}_${targetData.date || 'Export'}.pdf`;

      let pdf: jsPDF;
      if (pdfExportFormat === 'A4') {
        pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const targetWidth = 110;
        const targetHeight = (canvas.height * targetWidth) / canvas.width;
        const xPos = (210 - targetWidth) / 2;
        const yPos = 20;
        pdf.setDrawColor(220, 225, 230);
        pdf.setFillColor(250, 252, 255);
        pdf.roundedRect(xPos - 5, yPos - 5, targetWidth + 10, targetHeight + 10, 3, 3, 'FD');
        pdf.addImage(imgData, 'PNG', xPos, yPos, targetWidth, targetHeight);
      } else {
        const pdfWidth = pdfExportFormat === '58MM' ? 58 : 80;
        const minHeight = pdfExportFormat === '58MM' ? 30 : 40;
        const pdfHeight = Math.max((canvas.height * pdfWidth) / canvas.width, minHeight);
        pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pdfWidth, pdfHeight] });
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }

      if (Capacitor.isNativePlatform()) {
        const dataUri = pdf.output('datauristring');
        const base64Index = dataUri.indexOf('base64,');
        const base64Data = base64Index >= 0 ? dataUri.substring(base64Index + 7) : '';
        if (!base64Data) throw new Error('PDF data was empty.');
        const safeFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
        const writeResult = await Filesystem.writeFile({ path: safeFileName, data: base64Data, directory: Directory.Cache });
        const canShare = await Share.canShare();
        if (canShare.value) {
          await Share.share({ title: safeFileName, text: 'Bill PDF', url: writeResult.uri, dialogTitle: 'Save or share PDF' });
        } else {
          alert(`PDF created successfully. Saved as ${safeFileName} in app cache.`);
        }
      } else {
        pdf.save(fileName);
      }

      try {
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
      } catch { /* ignore */ }
    } catch (err: any) {
      console.error('PDF Export Error:', err);
      alert('Failed to export PDF: ' + (err?.message || String(err)));
    } finally {
      setIsExportingPdf(false);
    }
  };

  const getQuickReprintAdjustedData = (): ReceiptData | null => {
    if (!selectedHistoryItem) return null;
    const adjusted = JSON.parse(JSON.stringify(selectedHistoryItem.receiptData)) as ReceiptData;
    adjusted.date = quickDate;
    adjusted.time = quickTime;

    const targetTotal = parseFloat(quickAmount) || 0;
    if (adjusted.type === 'PETROL') {
      if (adjusted.petrolDetails) {
        adjusted.petrolDetails.amount = targetTotal;
        adjusted.petrolDetails.customerName = quickCustomerName;
        const rate = adjusted.petrolDetails.ratePerLtr || 1;
        adjusted.petrolDetails.volumeLtr = parseFloat((targetTotal / rate).toFixed(3));
      }
    } else {
      const oldTotal = adjusted.total || 1;
      const factor = oldTotal > 0 ? targetTotal / oldTotal : 1;
      
      let subtotalAcc = 0;
      adjusted.items = adjusted.items.map(item => {
        const rate = item.rate * factor;
        const total = item.quantity * rate;
        subtotalAcc += total;
        return {
          ...item,
          rate: parseFloat(rate.toFixed(2)),
          total: parseFloat(total.toFixed(2))
        };
      });
      
      adjusted.subtotal = parseFloat(subtotalAcc.toFixed(2));
      adjusted.taxAmount = 0;
      adjusted.total = adjusted.subtotal;
    }
    return adjusted;
  };

  const handleQuickReprintExportPdf = async () => {
    const adjustedData = getQuickReprintAdjustedData();
    if (!adjustedData) return;
    await handleExportPdf(adjustedData);
    setShowQuickReprintModal(false);
  };

  const handleQuickPrint = async () => {
    if (!selectedHistoryItem) return;
    if (!isPrinterConnected || !printer) {
      alert("Please connect to a Bluetooth printer first.");
      return;
    }

    try {
      // Create a modified copy of the receiptData
      const adjusted = JSON.parse(JSON.stringify(selectedHistoryItem.receiptData)) as ReceiptData;
      adjusted.date = quickDate;
      adjusted.time = quickTime;

      const targetTotal = parseFloat(quickAmount) || 0;
      if (adjusted.type === 'PETROL') {
        if (adjusted.petrolDetails) {
          adjusted.petrolDetails.amount = targetTotal;
          adjusted.petrolDetails.customerName = quickCustomerName;
          const rate = adjusted.petrolDetails.ratePerLtr || 1;
          adjusted.petrolDetails.volumeLtr = parseFloat((targetTotal / rate).toFixed(3));
        }
      } else {
        // Mart / Restaurant proportional scaling
        const oldTotal = adjusted.total || 1;
        const factor = oldTotal > 0 ? targetTotal / oldTotal : 1;
        
        let subtotalAcc = 0;
        adjusted.items = adjusted.items.map(item => {
          const rate = item.rate * factor;
          const total = item.quantity * rate;
          subtotalAcc += total;
          return {
            ...item,
            rate: parseFloat(rate.toFixed(2)),
            total: parseFloat(total.toFixed(2))
          };
        });
        
        adjusted.subtotal = parseFloat(subtotalAcc.toFixed(2));
        adjusted.taxAmount = 0;
        adjusted.total = adjusted.subtotal;
      }

      if (printer.getPrinterType() === 'catprinter') {
        // Capture the same dependency-free inline receipt renderer used by PDF
        // export. This avoids Android WebView/Tailwind CSS rendering issues.
        const canvas = await captureReceiptCanvas(adjusted, 2);
        const bytes = ThermalPrinter.canvasToCatPrinter(canvas, printer.getCatPrinterEnergy());
        await printer.print(bytes);
        setShowQuickReprintModal(false);
        saveToHistory(adjusted);
        return;
      }

      // Send to print!
      const cmds = ThermalPrinter.getCommands();
      const chunks: Uint8Array[] = [];

      chunks.push(cmds.INIT);
      chunks.push(cmds.ALIGN_CENTER);
      chunks.push(cmds.BOLD_ON);

      if (adjusted.type === 'PETROL') {
        const p = adjusted.petrolDetails;
        chunks.push(cmds.BOLD_ON);
        if (p?.format === 'NEW_HP') {
          chunks.push(cmds.ALIGN_CENTER);
          chunks.push(cmds.TEXT_SIZE_NORMAL);
          chunks.push(ThermalPrinter.textToUint8(adjusted.companyName.toUpperCase()));
          chunks.push(ThermalPrinter.textToUint8(`DEALERS:- ${p?.dealerName || 'HPCL'}`));
          chunks.push(ThermalPrinter.textToUint8(adjusted.address));
          chunks.push(cmds.ALIGN_LEFT);
          const newPetrolRow = (label: string, value: string) => ThermalPrinter.textToUint8(`${label.padEnd(9, ' ')}${value}`);
          chunks.push(newPetrolRow('BILL NO:', adjusted.billNumber || p.receiptNo || ''));
          chunks.push(newPetrolRow('Trns. ID:', p.transactionId || ''));
          chunks.push(newPetrolRow('Atnd. ID:', p.attendantId || ''));
          chunks.push(newPetrolRow('Vehi. No:', p.vehicleNumber || ''));
          chunks.push(newPetrolRow('Date:', adjusted.date));
          chunks.push(newPetrolRow('Time:', adjusted.time));
          chunks.push(newPetrolRow('FP. ID:', p.fipNo || ''));
          chunks.push(newPetrolRow('Nozl. No:', p.nozzleNo || ''));
          chunks.push(newPetrolRow('Fuel:', p.product || 'Petrol'));
          chunks.push(newPetrolRow('Density:', `${(p.density ?? 835.7).toFixed(1)} kg/m3`));
          chunks.push(newPetrolRow('Preset:', p.preset || 'NON PRESET'));
          chunks.push(newPetrolRow('Rate:', `Rs.${(p.ratePerLtr || 0).toFixed(2)}`));
          chunks.push(newPetrolRow('Sale:', `Rs.${(p.amount || 0).toFixed(2)}`));
          chunks.push(newPetrolRow('Volume:', `${(p.volumeLtr || 0).toFixed(2)} Lts.`));
        } else {
          chunks.push(cmds.ALIGN_CENTER);
          chunks.push(cmds.TEXT_SIZE_LARGE);
          chunks.push(ThermalPrinter.textToUint8("WELCOME!!!"));
          chunks.push(ThermalPrinter.textToUint8(`${adjusted.companyName.toUpperCase()}`));
          chunks.push(cmds.TEXT_SIZE_NORMAL);
          chunks.push(ThermalPrinter.textToUint8(adjusted.address));
          chunks.push(ThermalPrinter.textToUint8(`TEL NO: ${p?.telNo}`));
          chunks.push(ThermalPrinter.textToUint8(`RECEIPT NO: ${p?.receiptNo}`));
          chunks.push(ThermalPrinter.textToUint8(`FCC ID: ${p?.fccId}`));
          chunks.push(ThermalPrinter.textToUint8(`FIP NO: ${p?.fipNo}`));
          chunks.push(ThermalPrinter.textToUint8(`NOZZLE NO: ${p?.nozzleNo}`));
          chunks.push(cmds.ALIGN_LEFT);
          chunks.push(cmds.BOLD_ON);
          chunks.push(cmds.TEXT_SIZE_LARGE);
          chunks.push(ThermalPrinter.textToUint8(`PRODUCT: ${p?.product}`));
          chunks.push(ThermalPrinter.textToUint8(`RATE/LTR: ${p?.ratePerLtr.toFixed(2)}`));
          chunks.push(ThermalPrinter.textToUint8(`AMOUNT: ${p?.amount.toFixed(2)}`));
          chunks.push(ThermalPrinter.textToUint8(`VOLUME(LTR): ${p?.volumeLtr.toFixed(2)} lt`));
          chunks.push(cmds.TEXT_SIZE_NORMAL);
          chunks.push(ThermalPrinter.textToUint8(` `));
          chunks.push(ThermalPrinter.textToUint8(`VEH TYPE: ${p?.vehType}`));
          chunks.push(ThermalPrinter.textToUint8(`VEH NO: ${p?.vehicleNumber}`));
          chunks.push(ThermalPrinter.textToUint8(`CUSTOMER: ${p?.customerName || ''}`));
          chunks.push(ThermalPrinter.textToUint8(` `));
          chunks.push(ThermalPrinter.textToUint8(`DATE: ${adjusted.date} ${adjusted.time}`));
          chunks.push(ThermalPrinter.textToUint8(`MODE: ${adjusted.paymentMode}`));
          chunks.push(ThermalPrinter.textToUint8(`LST NO: ${p?.lstNo}`));
          chunks.push(ThermalPrinter.textToUint8(`VAT NO: ${p?.vatNo}`));
          chunks.push(ThermalPrinter.textToUint8(`ATTENDANT: ${p?.attendantId}`));
        }
        chunks.push(cmds.BOLD_OFF);
      } else {
        chunks.push(ThermalPrinter.textToUint8(adjusted.companyName.toUpperCase()));
        chunks.push(cmds.BOLD_OFF);
        chunks.push(ThermalPrinter.textToUint8(adjusted.address));
        chunks.push(ThermalPrinter.textToUint8(`Phone: ${adjusted.phone}`));
        if (adjusted.showGst !== false && adjusted.gstNumber) chunks.push(ThermalPrinter.textToUint8(`GST: ${adjusted.gstNumber}`));
        
        chunks.push(cmds.ALIGN_LEFT);
        chunks.push(ThermalPrinter.textToUint8(`--------------------------------`));
        chunks.push(ThermalPrinter.textToUint8(`Date: ${adjusted.date}   Time: ${adjusted.time}`));
        chunks.push(ThermalPrinter.textToUint8(`Bill No: ${adjusted.billNumber}`));
        chunks.push(ThermalPrinter.textToUint8(`--------------------------------`));
        
        chunks.push(ThermalPrinter.textToUint8(`#  ITEM       QTY  RATE TOTAL`));
        chunks.push(ThermalPrinter.textToUint8(`--------------------------------`));
        
        adjusted.items.forEach((item, index) => {
          const noPart = (index + 1).toString().padStart(2);
          const namePart = item.name.substring(0, 10).padEnd(10);
          const qtyPart = item.quantity.toString().padStart(3);
          const ratePart = item.rate.toString().padStart(5);
          const totalPart = item.total.toString().padStart(6);
          chunks.push(ThermalPrinter.textToUint8(`${noPart} ${namePart} ${qtyPart} ${ratePart} ${totalPart}`));
        });
        
        chunks.push(ThermalPrinter.textToUint8(`--------------------------------`));
        chunks.push(cmds.ALIGN_RIGHT);
        chunks.push(ThermalPrinter.textToUint8(`Subtotal: ${adjusted.subtotal.toFixed(2)}`));
        chunks.push(cmds.BOLD_ON);
        chunks.push(ThermalPrinter.textToUint8(`TOTAL: ${adjusted.total.toFixed(2)}`));
        chunks.push(cmds.BOLD_OFF);
      }
      
      chunks.push(cmds.ALIGN_CENTER);
      chunks.push(cmds.FEED_PAPER);
      
      if (adjusted.type === 'PETROL') {
        chunks.push(ThermalPrinter.textToUint8(`***************`));
        chunks.push(ThermalPrinter.textToUint8(`Thank You! Visit Again`));
        chunks.push(ThermalPrinter.textToUint8(`Save Fuel, Save Money.`));
      } else {
        chunks.push(ThermalPrinter.textToUint8(`Thank You! Visit Again`));
      }
      
      chunks.push(cmds.FEED_PAPER);
      if (bleSendCutCommand) {
        chunks.push(cmds.CUT);
      }

      let totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      let combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      await printer.print(combined);
      setShowQuickReprintModal(false);

      // Save this newly modified receipt to history as well
      saveToHistory(adjusted);
    } catch (e) {
      alert("Printing failed: " + e);
    }
  };

  // Handle Tab Change
  const handleTabChange = (type: BillType) => {
    handleTabChangeInternal(type);
    setData(prev => ({
      ...prev,
      type,
      companyName: type === 'MART' ? 'EXPRESS MART' : type === 'RESTAURANT' ? 'DINE DELIGHT' : 'Jio-bp',
      address: COMMON_ADDRESSES[type]
    }));
  };

  // Recalculates subtotal/taxAmount/total from the current items list and
  // tax rate. Must be called any time items are added, edited, or removed —
  // otherwise the displayed Grand Total silently goes stale.
  const recalcTotals = (items: ReceiptItem[], taxRate: number) => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
    };
  };

  const addItem = () => {
    const newItem: ReceiptItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      quantity: 1,
      rate: 0,
      total: 0
    };
    setData(prev => {
      const items = [...prev.items, newItem];
      return { ...prev, items, ...recalcTotals(items, prev.taxRate) };
    });
  };

  const updateItem = (id: string, field: keyof ReceiptItem, value: any) => {
    setData(prev => {
      const items = prev.items.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity' || field === 'rate') {
            updatedItem.total = updatedItem.quantity * updatedItem.rate;
          }
          return updatedItem;
        }
        return item;
      });
      return { ...prev, items, ...recalcTotals(items, prev.taxRate) };
    });
  };

  const removeItem = (id: string) => {
    setData(prev => {
      const items = prev.items.filter(item => item.id !== id);
      return { ...prev, items, ...recalcTotals(items, prev.taxRate) };
    });
  };

  const connectPrinter = async () => {
    setBluetoothConnectionError('');
    try {
      const newPrinter = new ThermalPrinter();
      newPrinter.chunkSize = bleChunkSize;
      newPrinter.delayMs = bleDelayMs;
      newPrinter.forceWriteWithResponse = bleForceWriteWithResponse;
      newPrinter.useCrLf = bleUseCrLf;
      newPrinter.sendCutCommand = bleSendCutCommand;

      const success = await newPrinter.connect(
        customServiceUuid ? customServiceUuid.trim() : undefined,
        customCharacteristicUuid ? customCharacteristicUuid.trim() : undefined
      );
      if (success) {
        setPrinter(newPrinter);
        setIsPrinterConnected(true);
        setBluetoothConnectionError('');
        const detectedProtocol = newPrinter.getPrinterType() === 'catprinter' ? 'cat-printer' : 'esc-pos';
        setPrinterProtocol(detectedProtocol);
        localStorage.setItem('dangi_printer_protocol', detectedProtocol);
        
        setActiveServiceUuid(newPrinter.connectedServiceUuid);
        setActiveCharacteristicUuid(newPrinter.connectedCharacteristicUuid);
        setAvailableServices(newPrinter.availableServices);
        setAvailableCharacteristics(newPrinter.availableCharacteristics);

        localStorage.setItem('dangi_custom_service_uuid', customServiceUuid);
        localStorage.setItem('dangi_custom_characteristic_uuid', customCharacteristicUuid);
        localStorage.setItem('dangi_ble_chunk_size', String(bleChunkSize));
        localStorage.setItem('dangi_ble_delay_ms', String(bleDelayMs));
        localStorage.setItem('dangi_ble_force_write', String(bleForceWriteWithResponse));
        localStorage.setItem('dangi_ble_use_crlf', String(bleUseCrLf));
        localStorage.setItem('dangi_ble_send_cut', String(bleSendCutCommand));

        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    } catch (err: any) {
      console.error(err);
      const message = err?.message || String(err);
      setBluetoothConnectionError(
        message || 'Printer not found. Turn on SC03h-842D, keep it disconnected from other phones, enable Bluetooth and Location Services, then search again.'
      );
      setIsPrinterConnected(false);
      setPrinter(null);
    }
  };

  const sendTestPrint = async () => {
    if (!printer) {
      alert("Printer is not connected. Please connect first.");
      return;
    }
    try {
      if (printer.getPrinterType() === 'catprinter') {
        const canvas = document.createElement('canvas');
        canvas.width = 384;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, 384, 240);
          
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 22px Courier New, monospace';
          ctx.fillText("--- TEST PRINT ---", 70, 45);
          
          ctx.font = '14px Courier New, monospace';
          ctx.fillText(`Status: Connected (iPrint)`, 20, 90);
          ctx.fillText(`Chunk Size: ${bleChunkSize} bytes`, 20, 120);
          ctx.fillText(`Delay: ${bleDelayMs} ms`, 20, 150);
          ctx.fillText(`Time: ${new Date().toLocaleTimeString()}`, 20, 180);
          
          ctx.font = 'bold 26px Courier New, monospace';
          ctx.fillText("SUCCESS!", 130, 225);
        }
        const bytes = ThermalPrinter.canvasToCatPrinter(canvas);
        await printer.print(bytes);
        return;
      }

      const cmds = ThermalPrinter.getCommands();
      const chunks: Uint8Array[] = [];
      chunks.push(cmds.INIT);
      chunks.push(cmds.ALIGN_CENTER);
      chunks.push(cmds.BOLD_ON);
      chunks.push(ThermalPrinter.textToUint8("--- TEST PRINT ---", bleUseCrLf));
      chunks.push(cmds.BOLD_OFF);
      chunks.push(cmds.ALIGN_LEFT);
      chunks.push(ThermalPrinter.textToUint8(`Status: Connected`, bleUseCrLf));
      chunks.push(ThermalPrinter.textToUint8(`Chunk Size: ${bleChunkSize} bytes`, bleUseCrLf));
      chunks.push(ThermalPrinter.textToUint8(`Delay: ${bleDelayMs} ms`, bleUseCrLf));
      chunks.push(ThermalPrinter.textToUint8(`Mode: ${bleForceWriteWithResponse ? 'With Response' : 'Without Response'}`, bleUseCrLf));
      chunks.push(ThermalPrinter.textToUint8(`Ending: ${bleUseCrLf ? 'CRLF (\\r\\n)' : 'LF (\\n)'}`, bleUseCrLf));
      chunks.push(ThermalPrinter.textToUint8(`Time: ${new Date().toLocaleTimeString()}`, bleUseCrLf));
      chunks.push(cmds.ALIGN_CENTER);
      chunks.push(ThermalPrinter.textToUint8("SUCCESS!", bleUseCrLf));
      chunks.push(cmds.FEED_PAPER);
      if (bleSendCutCommand) {
        chunks.push(cmds.CUT);
      }
      
      let totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      let combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      
      await printer.print(combined);
    } catch (err: any) {
      alert("Test print failed: " + err.message);
    }
  };

  const handlePrint = async () => {
    if (!isPrinterConnected || !printer) {
      alert("Please connect to a Bluetooth printer first.");
      return;
    }

    try {
      if (printer.getPrinterType() === 'catprinter') {
        const canvas = await captureReceiptCanvas(data, 2);
        const bytes = ThermalPrinter.canvasToCatPrinter(canvas, printer.getCatPrinterEnergy());
        await printer.print(bytes);
        saveToHistory();
        
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.7 }
        });
        return;
      }

      const cmds = ThermalPrinter.getCommands();
      const chunks: Uint8Array[] = [];

      chunks.push(cmds.INIT);
      chunks.push(cmds.ALIGN_CENTER);
      chunks.push(cmds.BOLD_ON);

      if (data.type === 'PETROL') {
        const p = data.petrolDetails;
        chunks.push(cmds.BOLD_ON);
        if (p?.format === 'NEW_HP') {
          chunks.push(cmds.ALIGN_CENTER);
          chunks.push(cmds.TEXT_SIZE_NORMAL);
          chunks.push(ThermalPrinter.textToUint8(data.companyName.toUpperCase()));
          chunks.push(ThermalPrinter.textToUint8(`DEALERS:- ${p?.dealerName || 'HPCL'}`));
          chunks.push(ThermalPrinter.textToUint8(data.address));
          chunks.push(cmds.ALIGN_LEFT);
          const newPetrolRow = (label: string, value: string) => ThermalPrinter.textToUint8(`${label.padEnd(9, ' ')}${value}`);
          chunks.push(newPetrolRow('BILL NO:', data.billNumber || p.receiptNo || ''));
          chunks.push(newPetrolRow('Trns. ID:', p.transactionId || ''));
          chunks.push(newPetrolRow('Atnd. ID:', p.attendantId || ''));
          chunks.push(newPetrolRow('Vehi. No:', p.vehicleNumber || ''));
          chunks.push(newPetrolRow('Date:', data.date));
          chunks.push(newPetrolRow('Time:', data.time));
          chunks.push(newPetrolRow('FP. ID:', p.fipNo || ''));
          chunks.push(newPetrolRow('Nozl. No:', p.nozzleNo || ''));
          chunks.push(newPetrolRow('Fuel:', p.product || 'Petrol'));
          chunks.push(newPetrolRow('Density:', `${(p.density ?? 835.7).toFixed(1)} kg/m3`));
          chunks.push(newPetrolRow('Preset:', p.preset || 'NON PRESET'));
          chunks.push(newPetrolRow('Rate:', `Rs.${(p.ratePerLtr || 0).toFixed(2)}`));
          chunks.push(newPetrolRow('Sale:', `Rs.${(p.amount || 0).toFixed(2)}`));
          chunks.push(newPetrolRow('Volume:', `${(p.volumeLtr || 0).toFixed(2)} Lts.`));
        } else {
          chunks.push(cmds.ALIGN_CENTER);
          chunks.push(cmds.TEXT_SIZE_LARGE);
          chunks.push(ThermalPrinter.textToUint8("WELCOME!!!"));
          chunks.push(ThermalPrinter.textToUint8(`${data.companyName.toUpperCase()}`));
          chunks.push(cmds.TEXT_SIZE_NORMAL);
          chunks.push(ThermalPrinter.textToUint8(data.address));
          chunks.push(ThermalPrinter.textToUint8(`TEL NO: ${p?.telNo}`));
          chunks.push(ThermalPrinter.textToUint8(`RECEIPT NO: ${p?.receiptNo}`));
          chunks.push(ThermalPrinter.textToUint8(`FCC ID: ${p?.fccId}`));
          chunks.push(ThermalPrinter.textToUint8(`FIP NO: ${p?.fipNo}`));
          chunks.push(ThermalPrinter.textToUint8(`NOZZLE NO: ${p?.nozzleNo}`));
          chunks.push(cmds.ALIGN_LEFT);
          chunks.push(cmds.BOLD_ON);
          chunks.push(cmds.TEXT_SIZE_LARGE);
          chunks.push(ThermalPrinter.textToUint8(`PRODUCT: ${p?.product}`));
          chunks.push(ThermalPrinter.textToUint8(`RATE/LTR: ${p?.ratePerLtr.toFixed(2)}`));
          chunks.push(ThermalPrinter.textToUint8(`AMOUNT: ${p?.amount.toFixed(2)}`));
          chunks.push(ThermalPrinter.textToUint8(`VOLUME(LTR): ${p?.volumeLtr.toFixed(2)} lt`));
          chunks.push(cmds.TEXT_SIZE_NORMAL);
          chunks.push(ThermalPrinter.textToUint8(` `));
          chunks.push(ThermalPrinter.textToUint8(`VEH TYPE: ${p?.vehType}`));
          chunks.push(ThermalPrinter.textToUint8(`VEH NO: ${p?.vehicleNumber}`));
          chunks.push(ThermalPrinter.textToUint8(`CUSTOMER: ${p?.customerName || ''}`));
          chunks.push(ThermalPrinter.textToUint8(` `));
          chunks.push(ThermalPrinter.textToUint8(`DATE: ${data.date} ${data.time}`));
          chunks.push(ThermalPrinter.textToUint8(`MODE: ${data.paymentMode}`));
          chunks.push(ThermalPrinter.textToUint8(`LST NO: ${p?.lstNo}`));
          chunks.push(ThermalPrinter.textToUint8(`VAT NO: ${p?.vatNo}`));
          chunks.push(ThermalPrinter.textToUint8(`ATTENDANT: ${p?.attendantId}`));
        }
        chunks.push(cmds.BOLD_OFF);
      } else {
        chunks.push(ThermalPrinter.textToUint8(data.companyName.toUpperCase()));
        chunks.push(cmds.BOLD_OFF);
        chunks.push(ThermalPrinter.textToUint8(data.address));
        chunks.push(ThermalPrinter.textToUint8(`Phone: ${data.phone}`));
        if (data.showGst !== false && data.gstNumber) chunks.push(ThermalPrinter.textToUint8(`GST: ${data.gstNumber}`));
        
        chunks.push(cmds.ALIGN_LEFT);
        chunks.push(ThermalPrinter.textToUint8(`--------------------------------`));
        chunks.push(ThermalPrinter.textToUint8(`Date: ${data.date}   Time: ${data.time}`));
        chunks.push(ThermalPrinter.textToUint8(`Bill No: ${data.billNumber}`));
        chunks.push(ThermalPrinter.textToUint8(`--------------------------------`));
        
        // Header for items
        chunks.push(ThermalPrinter.textToUint8(`#  ITEM       QTY  RATE TOTAL`));
        chunks.push(ThermalPrinter.textToUint8(`--------------------------------`));
        
        data.items.forEach((item, index) => {
          const noPart = (index + 1).toString().padStart(2);
          const namePart = item.name.substring(0, 10).padEnd(10);
          const qtyPart = item.quantity.toString().padStart(3);
          const ratePart = item.rate.toString().padStart(5);
          const totalPart = item.total.toString().padStart(6);
          chunks.push(ThermalPrinter.textToUint8(`${noPart} ${namePart} ${qtyPart} ${ratePart} ${totalPart}`));
        });
        
        chunks.push(ThermalPrinter.textToUint8(`--------------------------------`));
        chunks.push(cmds.ALIGN_RIGHT);
        chunks.push(ThermalPrinter.textToUint8(`Subtotal: ${data.subtotal.toFixed(2)}`));
        chunks.push(cmds.BOLD_ON);
        chunks.push(ThermalPrinter.textToUint8(`TOTAL: ${data.total.toFixed(2)}`));
        chunks.push(cmds.BOLD_OFF);
      }
      
      chunks.push(cmds.ALIGN_CENTER);
      chunks.push(cmds.FEED_PAPER);
      
      if (data.type === 'PETROL') {
        chunks.push(ThermalPrinter.textToUint8(`***************`));
        chunks.push(ThermalPrinter.textToUint8(`Thank You! Visit Again`));
        chunks.push(ThermalPrinter.textToUint8(`Save Fuel, Save Money.`));
      } else {
        chunks.push(ThermalPrinter.textToUint8(`Thank You! Visit Again`));
      }
      
      chunks.push(cmds.FEED_PAPER);
      if (bleSendCutCommand) {
        chunks.push(cmds.CUT);
      }

      // Flatten chunks
      let totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      let combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      await printer.print(combined);
      saveToHistory();
    } catch (error) {
      console.error("Printing failed", error);
      alert("Printing failed. See console for details.");
    }
  };

  if (isSecurityEnabled && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-900 selection:bg-emerald-100">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white p-8 rounded-[32px] shadow-2xl shadow-slate-200/80 border border-slate-100"
        >
          {/* Lock Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mb-4 shadow-sm shadow-emerald-100">
              <Lock className="w-8 h-8 text-emerald-500 animate-pulse" />
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Dangi Print</h1>
            <p className="text-[10px] font-semibold text-slate-400 mt-1 uppercase tracking-widest">Secured Thermal Engine</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Login ID</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input 
                  type="text"
                  required
                  value={loginIdInput}
                  onChange={(e) => setLoginIdInput(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-medium placeholder:text-slate-300 text-sm focus:outline-none"
                  placeholder="Enter Login ID"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Key className="w-4 h-4" />
                </span>
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-medium placeholder:text-slate-300 text-sm focus:outline-none"
                  placeholder="Enter Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-600 font-bold text-center"
              >
                {loginError}
              </motion.div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98] flex items-center justify-center gap-2 mt-2 cursor-pointer border-none"
            >
              <Unlock className="w-4 h-4" />
              Unlock System
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Authorized Personnel Only</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-28 lg:pb-0 overflow-x-hidden">
      {/* Header */}
      <header className="bg-slate-900/95 backdrop-blur-xl text-white px-3 sm:px-6 py-3.5 shadow-xl sticky top-0 z-40 border-b border-slate-800/80">
        <div className="container mx-auto flex justify-between items-center gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-2xl border border-emerald-500/30 shrink-0">
              <Printer className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white truncate">
                Dangi Print
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isSecurityEnabled && (
              <button 
                onClick={handleLogout}
                className="flex items-center justify-center gap-1.5 bg-slate-800/80 hover:bg-slate-700 px-3 py-2 rounded-2xl text-xs font-bold transition-all text-slate-300 hover:text-white border border-slate-700/60 cursor-pointer active:scale-95"
                title="Log Out / Lock App"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline text-[11px]">Lock</span>
              </button>
            )}
            <button 
              onClick={() => {
                setNewLoginId(localStorage.getItem('tinyprint_username') || '');
                setCredentialsChangeError('');
                setCredentialsChangeSuccess('');
                setShowChangeCredentialsModal(true);
              }}
              className="flex items-center justify-center gap-1.5 bg-slate-800/80 hover:bg-slate-700 px-3 py-2 rounded-2xl text-xs font-bold transition-all text-slate-300 hover:text-white border border-slate-700/60 cursor-pointer active:scale-95"
              title="Security Configuration"
            >
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline text-[11px]">Security</span>
            </button>

            <button 
              onClick={connectPrinter}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-2xl text-xs font-black transition-all border cursor-pointer active:scale-95 shadow-sm ${
                isPrinterConnected 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30' 
                  : 'bg-emerald-600 text-white hover:bg-emerald-500 border-emerald-500'
              }`}
            >
              <Bluetooth className={`w-3.5 h-3.5 ${isPrinterConnected ? 'text-emerald-400' : 'text-white animate-pulse'}`} />
              <span className="hidden sm:inline text-[11px] uppercase tracking-wider">{isPrinterConnected ? 'Connected' : 'Connect'}</span>
            </button>

            <button
              onClick={() => setShowBluetoothSettingsModal(true)}
              className="p-2 bg-slate-800/80 hover:bg-slate-700 rounded-2xl text-slate-300 hover:text-white transition-all border border-slate-700/60 cursor-pointer flex items-center justify-center shadow-sm active:scale-95"
              title="Bluetooth Printer Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-3 sm:p-6 lg:p-8 grid lg:grid-cols-12 gap-6 lg:gap-8 min-w-0">
        {/* Left Side: Controls & Editor */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-5 sm:gap-6 min-w-0">
          
          {/* Bill Type Selector */}
          <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200/80 grid grid-cols-3 gap-1.5">
            {[
              { id: 'MART', icon: Store, label: 'Super Mart' },
              { id: 'RESTAURANT', icon: Utensils, label: 'Restaurant' },
              { id: 'PETROL', icon: Fuel, label: 'Petrol Bill' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as BillType)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl transition-all cursor-pointer select-none active:scale-95 ${
                  activeTab === tab.id 
                    ? 'bg-emerald-600 text-white font-black shadow-md shadow-emerald-600/20' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-bold'
                }`}
              >
                <tab.icon className="w-4 h-4 shrink-0" />
                <span className="text-[10px] sm:text-xs uppercase tracking-wider text-center">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* We migrated the PDF cropper to the Direct PDF tab */}

          {/* Form Editor */}
          <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-500" />
              Receipt Details
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Company Name</label>
                  <input 
                    type="text" 
                    value={data.companyName}
                    onChange={(e) => setData({...data, companyName: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                    placeholder="Enter Business Name"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Address</label>
                  <textarea 
                    rows={2}
                    value={data.address}
                    onChange={(e) => setData({...data, address: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all font-medium resize-none"
                    placeholder="Physical Address"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Phone</label>
                    <input 
                      type="text" 
                      value={data.phone}
                      onChange={(e) => setData({...data, phone: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">GSTIN</label>
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={data.showGst !== false}
                          onChange={(e) => setData({...data, showGst: e.target.checked})}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4.5 bg-slate-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-emerald-500/20 peer-checked:bg-emerald-600 relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:after:translate-x-3.5"></div>
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          {data.showGst !== false ? 'Show' : 'Hide'}
                        </span>
                      </label>
                    </div>
                    <input 
                      type="text" 
                      value={data.gstNumber}
                      onChange={(e) => setData({...data, gstNumber: e.target.value})}
                      disabled={data.showGst === false}
                      className={`w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all font-medium ${
                        data.showGst === false ? 'opacity-50 cursor-not-allowed bg-slate-100/50' : ''
                      }`}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Date</label>
                    <input 
                      type="date"
                      value={data.date}
                      onChange={(e) => setData({...data, date: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Time</label>
                    <input 
                      type="text"
                      value={data.time}
                      onChange={(e) => setData({...data, time: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                      placeholder="e.g. 14:35"
                    />
                  </div>
                </div>

                {activeTab === 'RESTAURANT' && (
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Restaurant Logo Option</label>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                      {[
                        { id: 'UTENSILS', icon: Utensils, label: 'Classic' },
                        { id: 'COFFEE', icon: Coffee, label: 'Cafe' },
                        { id: 'PIZZA', icon: Pizza, label: 'Pizza' },
                        { id: 'FLAME', icon: Flame, label: 'Grill' },
                        { id: 'BAR', icon: Wine, label: 'Bar' },
                        { id: 'CUSTOM', icon: Camera, label: 'Custom' },
                        { id: 'NONE', icon: Scissors, label: 'None' },
                      ].map((logoOpt) => {
                        const isSelected = data.restaurantLogo === logoOpt.id || 
                          (!data.restaurantLogo && logoOpt.id === 'UTENSILS');
                        return (
                          <button
                            key={logoOpt.id}
                            type="button"
                            onClick={() => setData({
                              ...data,
                              restaurantLogo: logoOpt.id as any
                            })}
                            className={`p-2 border-2 rounded-xl flex flex-col items-center justify-center transition-all ${
                              isSelected 
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-600 shadow-sm font-bold' 
                                : 'border-slate-100 hover:border-slate-200 bg-white text-slate-500'
                            }`}
                          >
                            <div className="w-8 h-8 flex items-center justify-center">
                              {logoOpt.id === 'CUSTOM' && data.restaurantCustomLogoUrl ? (
                                <img src={data.restaurantCustomLogoUrl} alt="Custom Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                              ) : logoOpt.id === 'NONE' ? (
                                <span className="text-[10px] uppercase font-black tracking-tighter text-slate-400">Empty</span>
                              ) : (
                                <logoOpt.icon className="w-5 h-5" />
                              )}
                            </div>
                            <span className="text-[9px] font-bold mt-1 tracking-tight truncate w-full text-center">
                              {logoOpt.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {data.restaurantLogo === 'CUSTOM' && (
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-dashed border-slate-200 mt-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Upload Custom Restaurant Logo / Icon</label>
                        <div className="flex items-center gap-3">
                          <input 
                            type="file" 
                            id="custom-restaurant-logo-file"
                            accept=".svg,image/svg+xml,image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const result = event.target?.result as string;
                                  setData(prev => ({
                                    ...prev,
                                    restaurantCustomLogoUrl: result
                                  }));
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          <label 
                            htmlFor="custom-restaurant-logo-file"
                            className="px-3.5 py-1.5 bg-white border border-slate-200 text-xs text-emerald-600 font-bold rounded-xl cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                          >
                            Choose Logo
                          </label>
                          <div className="text-[10px] text-slate-400 flex-1 truncate">
                            {data.restaurantCustomLogoUrl ? "Logo successfully dynamic-linked!" : "Supports SVG, PNG, JPG files"}
                          </div>
                          {data.restaurantCustomLogoUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setData(prev => ({
                                  ...prev,
                                  restaurantCustomLogoUrl: undefined
                                }));
                              }}
                              className="text-[10px] text-red-500 hover:underline font-bold"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                 {activeTab === 'PETROL' && (
                  <div className="space-y-4">
                    <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div>
                          <label className="text-xs font-black text-slate-700 uppercase tracking-widest block">Petrol Bill Format</label>
                          <p className="text-[10px] text-slate-500 mt-0.5">Choose the old receipt or the new service-station receipt.</p>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-white px-2 py-1 rounded-lg border border-emerald-100">{data.petrolDetails?.format === 'NEW_HP' ? 'NEW' : 'OLD'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 p-1 bg-white rounded-xl border border-emerald-100">
                        <button type="button" onClick={() => setData(prev => ({ ...prev, petrolDetails: { ...prev.petrolDetails!, format: 'OLD' } }))} className={`py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${data.petrolDetails?.format !== 'NEW_HP' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Old Format</button>
                        <button type="button" onClick={() => setData(prev => ({ ...prev, petrolDetails: { ...prev.petrolDetails!, format: 'NEW_HP' } }))} className={`py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${data.petrolDetails?.format === 'NEW_HP' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>New Format</button>
                      </div>
                    </div>

                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Petrol Company</label>
                    <div className="grid grid-cols-4 gap-2">
                      {(['JIO_BP', 'HP', 'BHARAT_PETROLEUM', 'INDIAN_OIL', 'NAYARA', 'ESSAR', 'CUSTOM'] as PetrolCompany[]).map(co => {
                        const companyDisplayName: Record<PetrolCompany, string> = {
                          JIO_BP: 'Jio-bp',
                          HP: 'HP',
                          BHARAT_PETROLEUM: 'Bharat Petroleum',
                          INDIAN_OIL: 'Indian Oil',
                          NAYARA: 'Nayara Energy',
                          ESSAR: 'Essar',
                          CUSTOM: 'My Petrol',
                        };
                        const companyShortLabel: Record<PetrolCompany, string> = {
                          JIO_BP: 'Jio-bp',
                          HP: 'HP',
                          BHARAT_PETROLEUM: 'BP',
                          INDIAN_OIL: 'IOC',
                          NAYARA: 'Nayara',
                          ESSAR: 'Essar',
                          CUSTOM: 'Custom',
                        };
                        const knownDisplayNames = Object.values(companyDisplayName);
                        return (
                        <button
                          key={co}
                          type="button"
                          onClick={() => setData({
                            ...data, 
                            companyName: co === 'CUSTOM' ? (knownDisplayNames.includes(data.companyName) ? 'My Petrol' : data.companyName) : companyDisplayName[co],
                            petrolDetails: { ...data.petrolDetails!, company: co }
                          })}
                          className={`p-2 border-2 rounded-xl flex flex-col items-center justify-center transition-all ${
                            data.petrolDetails?.company === co 
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-600 shadow-sm' 
                              : 'border-slate-100 hover:border-slate-200 bg-white'
                          }`}
                        >
                          <div className="w-12 h-12 p-1 flex items-center justify-center overflow-hidden">
                            {co === 'CUSTOM' ? (
                              data.petrolDetails?.customLogoUrl ? (
                                <img src={data.petrolDetails.customLogoUrl} alt="Custom Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-400">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )
                            ) : (
                              PETROL_LOGOS[co]
                            )}
                          </div>
                          <span className="text-[9px] font-bold mt-1 tracking-tight truncate w-full text-center">
                            {companyShortLabel[co]}
                          </span>
                        </button>
                        );
                      })}
                    </div>

                    {data.petrolDetails?.format === 'NEW_HP' && (
                      <div className="space-y-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">New Format Fields</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Transaction ID</label>
                            <input type="text" value={data.petrolDetails?.transactionId || ''} onChange={(e) => setData(prev => ({ ...prev, petrolDetails: { ...prev.petrolDetails!, transactionId: e.target.value } }))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs" placeholder="TRNS. ID" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Dealer Name</label>
                            <input type="text" value={data.petrolDetails?.dealerName || ''} onChange={(e) => setData(prev => ({ ...prev, petrolDetails: { ...prev.petrolDetails!, dealerName: e.target.value } }))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs" placeholder="HPCL" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Density</label>
                            <input type="number" step="0.1" value={data.petrolDetails?.density ?? 835.7} onChange={(e) => setData(prev => ({ ...prev, petrolDetails: { ...prev.petrolDetails!, density: parseFloat(e.target.value) || 0 } }))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Preset</label>
                            <input type="text" value={data.petrolDetails?.preset || 'NON PRESET'} onChange={(e) => setData(prev => ({ ...prev, petrolDetails: { ...prev.petrolDetails!, preset: e.target.value } }))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs" />
                          </div>
                        </div>
                      </div>
                    )}

                    {(data.petrolDetails?.company === 'CUSTOM' || data.petrolDetails?.format === 'NEW_HP') && (
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-dashed border-slate-200 mt-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Upload Custom SVG / Logo Image</label>
                        <div className="flex items-center gap-3">
                          <input 
                            type="file" 
                            id="custom-logo-file"
                            accept=".svg,image/svg+xml,image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const result = event.target?.result as string;
                                  setData(prev => ({
                                    ...prev,
                                    petrolDetails: {
                                      ...prev.petrolDetails!,
                                      customLogoUrl: result
                                    }
                                  }));
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          <label 
                            htmlFor="custom-logo-file"
                            className="px-3.5 py-1.5 bg-white border border-slate-200 text-xs text-emerald-600 font-bold rounded-xl cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                          >
                            Choose SVG/Logo
                          </label>
                          <div className="text-[10px] text-slate-400 flex-1 truncate">
                            {data.petrolDetails?.customLogoUrl ? "Logo successfully dynamic-linked!" : "Supports SVG, PNG, JPG files"}
                          </div>
                          {data.petrolDetails?.customLogoUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setData(prev => ({
                                  ...prev,
                                  petrolDetails: {
                                    ...prev.petrolDetails!,
                                    customLogoUrl: undefined
                                  }
                                }));
                              }}
                              className="text-[10px] text-red-500 hover:underline font-bold"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                       <div>
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">TEL NO</label>
                         <input type="text" value={data.petrolDetails?.telNo} onChange={(e) => setData({...data, petrolDetails: {...data.petrolDetails!, telNo: e.target.value}})} className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs" />
                       </div>
                       <div>
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">RECEIPT NO</label>
                         <input type="text" value={data.petrolDetails?.receiptNo} onChange={(e) => setData({...data, petrolDetails: {...data.petrolDetails!, receiptNo: e.target.value}})} className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs" />
                       </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                       <div className="col-span-2">
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Product</label>
                         <input type="text" value={data.petrolDetails?.product} onChange={(e) => setData({...data, petrolDetails: {...data.petrolDetails!, product: e.target.value}})} className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs" />
                       </div>
                       <div>
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Rate/Ltr</label>
                         <input 
                           type="number" 
                           step="0.01"
                           value={data.petrolDetails?.ratePerLtr} 
                           onChange={(e) => {
                             const rate = parseFloat(e.target.value) || 0;
                             const amt = data.petrolDetails?.amount || 0;
                             const vol = rate > 0 ? amt / rate : 0;
                             setData({
                               ...data, 
                               petrolDetails: {
                                 ...data.petrolDetails!, 
                                 ratePerLtr: rate,
                                 volumeLtr: parseFloat(vol.toFixed(3))
                               }
                             });
                           }} 
                           className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs" 
                         />
                       </div>
                       <div>
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Amount</label>
                         <input type="number" value={data.petrolDetails?.amount} 
                           onChange={(e) => {
                             const amt = parseFloat(e.target.value) || 0;
                             const rate = data.petrolDetails?.ratePerLtr || 0;
                             const vol = rate > 0 ? amt / rate : 0;
                             setData({
                               ...data, 
                               petrolDetails: {
                                 ...data.petrolDetails!, 
                                 amount: amt,
                                 volumeLtr: parseFloat(vol.toFixed(3))
                               }
                             });
                           }} 
                           className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs text-emerald-900 font-bold" />
                       </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                       <div>
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Veh No</label>
                         <input type="text" value={data.petrolDetails?.vehicleNumber} onChange={(e) => setData({...data, petrolDetails: {...data.petrolDetails!, vehicleNumber: e.target.value}})} className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs" />
                       </div>
                       <div>
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Veh Type</label>
                         <input type="text" value={data.petrolDetails?.vehType} onChange={(e) => setData({...data, petrolDetails: {...data.petrolDetails!, vehType: e.target.value}})} className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs" />
                       </div>
                       <div>
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Volume(Ltr)</label>
                         <input type="number" value={data.petrolDetails?.volumeLtr !== undefined ? parseFloat((data.petrolDetails.volumeLtr).toFixed(3)) : 0} 
                           readOnly 
                           disabled 
                           className="w-full px-4 py-2 bg-slate-100 text-slate-500 border-none rounded-xl focus:outline-none cursor-not-allowed font-semibold text-xs shadow-inner" />
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div>
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Customer Name</label>
                         <input 
                           type="text" 
                           placeholder="Blank or enter name"
                           value={data.petrolDetails?.customerName || ''} 
                           onChange={(e) => setData({...data, petrolDetails: {...data.petrolDetails!, customerName: e.target.value}})} 
                           className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs font-medium" 
                         />
                       </div>
                       <div>
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Attendant ID</label>
                         <input 
                           type="text" 
                           value={data.petrolDetails?.attendantId || ''} 
                           onChange={(e) => setData({...data, petrolDetails: {...data.petrolDetails!, attendantId: e.target.value}})} 
                           className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs font-medium" 
                         />
                       </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                       <div>
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">FCC ID</label>
                         <input type="text" value={data.petrolDetails?.fccId || ''} onChange={(e) => setData({...data, petrolDetails: {...data.petrolDetails!, fccId: e.target.value}})} className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-[10px]" />
                       </div>
                       <div>
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">FIP NO</label>
                         <input type="text" value={data.petrolDetails?.fipNo || ''} onChange={(e) => setData({...data, petrolDetails: {...data.petrolDetails!, fipNo: e.target.value}})} className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-[10px]" />
                       </div>
                       <div>
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">NOZZLE NO</label>
                         <input type="text" value={data.petrolDetails?.nozzleNo || ''} onChange={(e) => setData({...data, petrolDetails: {...data.petrolDetails!, nozzleNo: e.target.value}})} className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-[10px]" />
                       </div>
                       <div>
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">VAT NO</label>
                         <input type="text" value={data.petrolDetails?.vatNo || ''} onChange={(e) => setData({...data, petrolDetails: {...data.petrolDetails!, vatNo: e.target.value}})} className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-[10px]" />
                       </div>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Payment Mode</label>
                    <div className="flex p-0.5 bg-slate-50 border border-slate-100 rounded-xl gap-1 h-9">
                      {['CASH', 'ONLINE'].map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setData({ ...data, paymentMode: mode })}
                          className={`flex-1 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                            data.paymentMode === mode
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-700 bg-transparent'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Font Size</label>
                    <select 
                      value={data.fontSize}
                      onChange={(e) => setData({...data, fontSize: e.target.value as any})}
                      className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-xs"
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Font Style</label>
                    <select 
                      value={data.fontStyle}
                      onChange={(e) => setData({...data, fontStyle: e.target.value as any})}
                      className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-xs"
                    >
                      <option value="normal">Normal</option>
                      <option value="condensed">Condensed</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Items Table Editor */}
            {activeTab !== 'PETROL' && (
              <div className="mt-10">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Bill Items</h3>
                  <button 
                    onClick={addItem}
                    className="flex items-center gap-1 text-xs font-bold text-white bg-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Item
                  </button>
                </div>
                
                {/* Mobile: card-based item list — avoids the horizontal scroll a wide
                    table would need on narrow phones, and keeps the delete button
                    always immediately visible instead of requiring a scroll to reach it. */}
                <div className="sm:hidden space-y-3">
                  <AnimatePresence mode="popLayout">
                    {data.items.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-slate-50/50 rounded-2xl p-3"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-slate-400 w-5 text-center shrink-0">{index + 1}</span>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                            className="flex-1 min-w-0 bg-white rounded-xl px-3 py-2 border-none focus:outline-none font-bold text-slate-700 placeholder:text-slate-300"
                            placeholder="e.g. Bread"
                          />
                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-2 bg-red-50 text-red-500 active:bg-red-100 rounded-xl active:scale-95 shrink-0"
                            title="Remove Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pl-7">
                          <div>
                            <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Qty</label>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full bg-white rounded-xl px-2 py-1.5 border-none focus:outline-none font-bold text-slate-700"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Rate</label>
                            <input
                              type="number"
                              value={item.rate}
                              onChange={(e) => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                              className="w-full bg-white rounded-xl px-2 py-1.5 border-none focus:outline-none font-bold text-slate-700"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Total</label>
                            <div className="px-2 py-1.5 font-black text-slate-900">₹{item.total.toFixed(2)}</div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Desktop/tablet: compact table layout */}
                <div className="hidden sm:block overflow-x-auto w-full min-w-0">
                  <table className="w-full min-w-[480px] text-left text-sm border-separate border-spacing-y-2">
                    <thead>
                      <tr className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                        <th className="pb-2 w-8">#</th>
                        <th className="pb-2">Description</th>
                        <th className="pb-2">Qty</th>
                        <th className="pb-2">Rate</th>
                        <th className="pb-2 text-right">Total</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence mode="popLayout">
                        {data.items.map((item, index) => (
                          <motion.tr 
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-slate-50/50 rounded-2xl group"
                          >
                            <td className="p-2 first:rounded-l-2xl text-center text-xs font-bold text-slate-400">
                              {index + 1}
                            </td>
                            <td className="p-2">
                              <input 
                                type="text" 
                                value={item.name}
                                onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                                className="w-full bg-transparent border-none focus:outline-none font-bold text-slate-700 placeholder:text-slate-300"
                                placeholder="e.g. Bread"
                              />
                            </td>
                            <td className="p-2">
                              <input 
                                type="number" 
                                value={item.quantity}
                                onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                className="w-16 bg-transparent border-none focus:outline-none font-bold text-slate-700"
                              />
                            </td>
                            <td className="p-2">
                              <input 
                                type="number" 
                                value={item.rate}
                                onChange={(e) => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                                className="w-20 bg-transparent border-none focus:outline-none font-bold text-slate-700 hover:text-emerald-600 transition-colors"
                              />
                            </td>
                            <td className="p-2 text-right font-black text-slate-900">
                              {item.total.toFixed(2)}
                            </td>
                            <td className="p-2 last:rounded-r-2xl pr-3 text-right">
                              <button 
                                onClick={() => removeItem(item.id)}
                                className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all p-2 bg-red-50 sm:bg-transparent text-red-500 hover:text-red-700 hover:bg-red-100 rounded-xl cursor-pointer active:scale-95"
                                title="Remove Item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Total Section */}
            {activeTab !== 'PETROL' && (
              <div className="mt-6 flex flex-col items-end gap-3 pt-6 border-t border-slate-100">
                <div className="flex items-center gap-8 text-sm text-slate-500 font-bold">
                  <span>Subtotal</span>
                  <span className="w-24 text-right">₹{data.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-8 text-xl font-black text-emerald-600 bg-emerald-50 px-6 py-3 rounded-2xl">
                  <span>GRAND TOTAL</span>
                  <span className="w-32 text-right font-mono">₹{data.total.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="mb-12">
            {/* Quick Actions */}
            <div className="bg-[#121212] p-6 rounded-3xl shadow-2xl flex flex-col items-center text-center text-white max-w-xl mx-auto">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-4">
                <Download className="w-6 h-6" />
              </div>
              <h3 className="font-bold">Generate & Print</h3>
              <p className="text-xs text-white/50 mt-1 mb-4">Print Thermal Receipt or Export PDF</p>
              <div className="flex flex-col gap-3 w-full">
                <button 
                  onClick={handlePrint}
                  className="w-full py-3 bg-emerald-500 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  <Printer className="w-5 h-5" /> PRINT RECEIPT
                </button>

                {/* PDF Export Section */}
                <div className="bg-white/5 p-3 rounded-2xl border border-white/10 text-left">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider flex items-center gap-1">
                      <FileDown className="w-3.5 h-3.5 text-blue-400" /> Export Bill PDF
                    </span>
                    <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/10">
                      <button
                        type="button"
                        onClick={() => setPdfExportFormat('58MM')}
                        className={`px-2 py-0.5 text-[9px] font-black rounded-md transition-all cursor-pointer ${
                          pdfExportFormat === '58MM' ? 'bg-blue-600 text-white' : 'text-white/50 hover:text-white'
                        }`}
                      >
                        58mm
                      </button>
                      <button
                        type="button"
                        onClick={() => setPdfExportFormat('80MM')}
                        className={`px-2 py-0.5 text-[9px] font-black rounded-md transition-all cursor-pointer ${
                          pdfExportFormat === '80MM' ? 'bg-blue-600 text-white' : 'text-white/50 hover:text-white'
                        }`}
                      >
                        80mm
                      </button>
                      <button
                        type="button"
                        onClick={() => setPdfExportFormat('A4')}
                        className={`px-2 py-0.5 text-[9px] font-black rounded-md transition-all cursor-pointer ${
                          pdfExportFormat === 'A4' ? 'bg-blue-600 text-white' : 'text-white/50 hover:text-white'
                        }`}
                      >
                        A4
                      </button>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleExportPdf()}
                    disabled={isExportingPdf}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20 active:scale-95 disabled:opacity-50 cursor-pointer border-none"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>{isExportingPdf ? 'GENERATING PDF...' : 'DOWNLOAD BILL PDF'}</span>
                  </button>
                </div>
                
              </div>
            </div>
          </div>

          {/* Print & Receipt History Card */}
          <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 mt-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Printed Receipts History</h2>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Adjust and Reprint Instantly</p>
                </div>
              </div>
              {history.length > 0 && (
                <button 
                  onClick={() => {
                    if(confirm("Are you sure you want to clear all history?")) {
                      setHistory([]);
                      localStorage.removeItem('tinyprint_history');
                    }
                  }}
                  className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase tracking-wider hover:underline bg-transparent border-none cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center">
                <Clock className="w-10 h-10 text-slate-300 mb-2 animate-pulse" />
                <p className="text-xs font-black text-slate-600 uppercase tracking-widest">No print history yet</p>
                <p className="text-[10px] text-slate-400 font-semibold max-w-sm mt-1 leading-relaxed">
                  Printed receipts from the template generator automatically save here. You'll be able to reprint them with modified dates or amounts in one click!
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                {history.map((item) => {
                  const rData = item.receiptData;
                  const dateObj = new Date(item.savedAt);
                  const formattedSavedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + dateObj.toLocaleDateString();
                  
                  return (
                    <div 
                      key={item.id} 
                      className="p-3.5 bg-slate-50 hover:bg-slate-100/75 rounded-2xl border border-slate-150 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        {/* Bill Type Badge */}
                        <div className={`px-2.5 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider text-center flex flex-col justify-center min-w-[75px] shrink-0 ${
                          rData.type === 'PETROL' 
                            ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                            : rData.type === 'RESTAURANT' 
                              ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                              : 'bg-green-100 text-green-700 border border-green-200'
                        }`}>
                          <span>{rData.type === 'PETROL' ? 'Petrol' : rData.type === 'RESTAURANT' ? 'Restaurant' : 'Super Mart'}</span>
                        </div>
                        
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-slate-800 uppercase truncate leading-tight tracking-tight">
                            {rData.companyName}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-emerald-400" />
                            <span>Bill Date: {rData.date} {rData.time}</span>
                          </p>
                          <p className="text-[9px] text-slate-400 font-medium mt-0.5 uppercase">
                            Saved: {formattedSavedTime}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-200/60 shrink-0">
                        <div className="text-right sm:mr-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block leading-none">Total Amount</span>
                          <span className="text-xs font-black text-emerald-600 font-mono">
                            ₹{(rData.type === 'PETROL' ? (rData.petrolDetails?.amount || 0) : rData.total).toFixed(2)}
                          </span>
                        </div>

                        <div className="flex gap-1.5">
                          {/* Export PDF Button */}
                          <button
                            onClick={() => handleExportPdf(item.receiptData)}
                            className="px-2.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 hover:border-blue-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                            title="Export History Bill as PDF"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>

                          {/* Quick Reprint Button */}
                          <button
                            onClick={() => openQuickReprint(item)}
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer border-none shadow-sm shadow-emerald-600/10 active:scale-95"
                            title="Reprint with a new Date or Amount"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Reprint</span>
                          </button>
                          
                          {/* Load to Editor */}
                          <button
                            onClick={() => loadHistoryItemToEditor(item)}
                            className="p-2 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-xl transition-all cursor-pointer"
                            title="Load into Main Builder"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => deleteHistoryItem(item.id)}
                            className="p-2 bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-xl transition-all cursor-pointer"
                            title="Delete History Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Virtual Preview */}
        <div className="lg:col-span-5 xl:col-span-4 sticky top-24 self-start min-w-0">
          <div className="relative group">
            {/* Paper Texture Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-900/5 to-slate-900/10 pointer-events-none rounded-[40px] z-10 opacity-50"></div>
            
            <div className="bg-white p-4 pt-12 pb-24 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] rounded-t-[40px] rounded-b-[40px] w-full max-w-[320px] mx-auto overflow-hidden relative border-t-[10px] border-emerald-100">
               
              {/* Receipt Content -> Strictly 2 inches width emulation */}
              <div id="receipt-paper-container" className="receipt-paper font-mono text-[11px] leading-tight text-slate-800 antialiased mx-auto flex flex-col items-center bg-white px-4 py-6 w-[288px]">
                {activeTab === 'PETROL' ? (
                  <div className="w-full font-black text-[12px] leading-tight">
                    {data.petrolDetails?.format === 'NEW_HP' ? (
                      <div className="w-full font-black text-[11px] leading-tight text-slate-900">
                        <div className="flex flex-col items-center mb-3 mt-1 w-full">
                          <div className="w-28 h-28 flex items-center justify-center">
                            {data.petrolDetails?.customLogoUrl ? (
                              <img src={data.petrolDetails.customLogoUrl} alt="Station Logo" className="max-w-[112px] max-h-[112px] object-contain" referrerPolicy="no-referrer" />
                            ) : (
                              PETROL_LOGOS[data.petrolDetails?.company || 'HP']
                            )}
                          </div>
                        </div>
                        <div className="text-center font-black text-[13px] uppercase leading-tight">{data.companyName}</div>
                        <div className="text-center font-black text-[10px] uppercase mt-1">DEALERS:- {data.petrolDetails?.dealerName || 'HPCL'}</div>
                        <div className="text-center font-black text-[10px] mt-1 leading-tight">{data.address}</div>
                        <div className="mt-2 mb-2 space-y-0">
                          {[
                            ['BILL NO:', data.billNumber || data.petrolDetails?.receiptNo || ''],
                            ['Trns. ID:', data.petrolDetails?.transactionId || ''],
                            ['Atnd. ID:', data.petrolDetails?.attendantId || ''],
                            ['Vehi. No:', data.petrolDetails?.vehicleNumber || ''],
                            ['Date:', data.date || ''],
                            ['Time:', data.time || ''],
                            ['FP. ID:', data.petrolDetails?.fipNo || ''],
                            ['Nozl. No:', data.petrolDetails?.nozzleNo || ''],
                          ].map(([label, value]) => (
                            <div key={label} className="grid grid-cols-[28%_72%] items-baseline">
                              <span className="whitespace-nowrap">{label}</span><span className="break-words text-left">{value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-0 text-[12px]">
                          <div className="grid grid-cols-[28%_72%]"><span>Fuel:</span><span className="text-left">{data.petrolDetails?.product || 'Petrol'}</span></div>
                          <div className="grid grid-cols-[28%_72%]"><span>Density:</span><span className="text-left">{(data.petrolDetails?.density ?? 835.7).toFixed(1)} kg/m3</span></div>
                          <div className="grid grid-cols-[28%_72%]"><span>Preset:</span><span className="text-left">{data.petrolDetails?.preset || 'NON PRESET'}</span></div>
                          <div className="grid grid-cols-[28%_72%] font-black"><span>Rate:</span><span className="text-left">Rs.{data.petrolDetails?.ratePerLtr.toFixed(2)}</span></div>
                          <div className="grid grid-cols-[28%_72%] font-black"><span>Sale:</span><span className="text-left">Rs.{data.petrolDetails?.amount.toFixed(2)}</span></div>
                          <div className="grid grid-cols-[28%_72%] font-black"><span>Volume:</span><span className="text-left">{data.petrolDetails?.volumeLtr.toFixed(2)} Lts.</span></div>
                        </div>
                        <div className="mt-3 pt-0 text-center">
                          <div className="font-black text-[10px] uppercase">Thank You! Visit Again</div>
                          <div className="text-[8px] mt-1 font-bold">SAVE FUEL, SAVE MONEY, SAVE THE PLANET.</div>
                        </div>
                      </div>
                    ) : (
                    <>
                    <div className="flex flex-col items-center mb-5 mt-3 min-h-[145px] justify-center w-full">
                      <div className="w-44 h-44 flex items-center justify-center">
                        {data.petrolDetails?.company === 'CUSTOM' ? (
                          data.petrolDetails?.customLogoUrl ? (
                            <img 
                              src={data.petrolDetails.customLogoUrl} 
                              alt="Custom Station Logo" 
                              className="max-w-[176px] max-h-[176px] object-contain transition-all select-none" 
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="border-4 border-dashed border-slate-200 rounded-2xl w-32 h-32 flex flex-col items-center justify-center text-slate-300 text-[10px] p-2 text-center leading-normal">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mb-1.5 text-slate-400">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Upload Custom SVG Logo
                            </div>
                          )
                        ) : (
                          PETROL_LOGOS[data.petrolDetails?.company || 'JIO_BP']
                        )}
                      </div>
                    </div>
                    
                    <div className="text-center font-black text-[14px] mb-2">WELCOME!!!</div>
                    
                    <div className="text-center text-[13px] mb-4 leading-tight font-black">{data.companyName.toUpperCase()}</div>
                    <div className="text-center text-[11px] mb-4 leading-tight font-bold">{data.address}</div>
                    
                    <div className="text-[11px] space-y-2 mb-5 font-black">
                      <div className="grid grid-cols-[48%_52%] gap-x-1 items-baseline"><span>TEL NO:</span> <span className="text-right break-words">{data.petrolDetails?.telNo}</span></div>
                      <div className="grid grid-cols-[48%_52%] gap-x-1 items-baseline"><span>RECEIPT NO:</span> <span className="text-right break-words">{data.petrolDetails?.receiptNo}</span></div>
                      <div className="grid grid-cols-[48%_52%] gap-x-1 items-baseline"><span>FCC ID:</span> <span className="text-right break-words">{data.petrolDetails?.fccId || 'N/A'}</span></div>
                      <div className="grid grid-cols-[48%_52%] gap-x-1 items-baseline"><span>FIP NO:</span> <span className="text-right break-words">{data.petrolDetails?.fipNo || 'N/A'}</span></div>
                      <div className="grid grid-cols-[48%_52%] gap-x-1 items-baseline"><span>NOZZLE NO:</span> <span className="text-right break-words">{data.petrolDetails?.nozzleNo || 'N/A'}</span></div>
                    </div>

                    <div className="text-[12px] space-y-2.5 mt-3 mb-5 py-4 border-y border-dashed border-slate-300 font-black">
                      <div className="grid grid-cols-[48%_52%] gap-x-1 items-baseline uppercase"><span>PRODUCT:</span> <span className="text-right break-words">{data.petrolDetails?.product}</span></div>
                      <div className="grid grid-cols-[48%_52%] gap-x-1 items-baseline uppercase"><span>RATE/LTR:</span> <span className="text-right break-words">{data.petrolDetails?.ratePerLtr.toFixed(2)}</span></div>
                      <div className="grid grid-cols-[48%_52%] gap-x-1 items-baseline uppercase"><span>AMOUNT:</span> <span className="text-right break-words">₹{data.petrolDetails?.amount.toFixed(2)}</span></div>
                      <div className="grid grid-cols-[48%_52%] gap-x-1 items-baseline uppercase"><span>VOLUME(LTR):</span> <span className="text-right break-words">{data.petrolDetails?.volumeLtr.toFixed(2)} lt</span></div>
                    </div>

                    <div className="text-[11px] space-y-2 mb-5 font-black">
                      <div className="grid grid-cols-[48%_52%] gap-x-1 items-baseline uppercase"><span>VEH TYPE:</span> <span className="text-right break-words">{data.petrolDetails?.vehType}</span></div>
                      <div className="grid grid-cols-[48%_52%] gap-x-1 items-baseline uppercase"><span>VEH NO:</span> <span className="text-right break-words">{data.petrolDetails?.vehicleNumber}</span></div>
                      <div className="grid grid-cols-[48%_52%] gap-x-1 items-baseline uppercase"><span>CUSTOMER:</span> <span className="max-w-[120px] text-right">{data.petrolDetails?.customerName || ''}</span></div>
                    </div>

                    <div className="text-[11px] space-y-2 pt-2 font-black">
                      <div className="grid grid-cols-[48%_52%] gap-x-1 items-baseline uppercase"><span>DATE:</span> <span className="text-right break-words">{data.date} {data.time}</span></div>
                      <div className="grid grid-cols-[48%_52%] gap-x-1 items-baseline uppercase"><span>MODE:</span> <span className="text-right break-words">{data.paymentMode}</span></div>
                      <div className="grid grid-cols-[48%_52%] gap-x-1 items-baseline uppercase"><span>VAT NO:</span> <span className="text-right break-words">{data.petrolDetails?.vatNo || 'N/A'}</span></div>
                      <div className="grid grid-cols-[48%_52%] gap-x-1 items-baseline uppercase"><span>ATTENDANT:</span> <span className="text-right break-words">{data.petrolDetails?.attendantId}</span></div>
                    </div>

                    <div className="flex flex-col items-center mt-12 mb-4">
                      <div className="mb-2 tracking-widest text-slate-300">******************</div>
                      <div className="font-black text-[13px] uppercase">Thank You! Visit Again</div>
                      <div className="text-[9px] mt-1 font-bold">SAVE FUEL, SAVE MONEY, SAVE THE PLANET.</div>
                    </div>
                    </>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Logo Area */}
                    {data.type === 'RESTAURANT' && data.restaurantLogo !== 'NONE' && (
                      <div className="mb-4 border-2 border-slate-900 rounded-full p-2 flex items-center justify-center">
                        {(!data.restaurantLogo || data.restaurantLogo === 'UTENSILS') && <Utensils className="w-6 h-6 text-slate-900" />}
                        {data.restaurantLogo === 'COFFEE' && <Coffee className="w-6 h-6 text-slate-900" />}
                        {data.restaurantLogo === 'PIZZA' && <Pizza className="w-6 h-6 text-slate-900" />}
                        {data.restaurantLogo === 'FLAME' && <Flame className="w-6 h-6 text-slate-900" />}
                        {data.restaurantLogo === 'BAR' && <Wine className="w-6 h-6 text-slate-900" />}
                        {data.restaurantLogo === 'CUSTOM' && (
                          data.restaurantCustomLogoUrl ? (
                            <img src={data.restaurantCustomLogoUrl} className="w-8 h-8 object-contain" referrerPolicy="no-referrer" alt="Custom Logo" />
                          ) : (
                            <Utensils className="w-6 h-6 text-slate-900" />
                          )
                        )}
                      </div>
                    )}

                    <h1 className={`text-center font-black mb-1 leading-none uppercase ${data.type === 'RESTAURANT' ? 'text-[15px] tracking-tight' : 'text-base'}`}>{data.companyName}</h1>
                    <p className="text-center text-[10px] whitespace-normal mb-2 max-w-[210px]">{data.address}</p>
                    {data.type === 'RESTAURANT' && (
                      <div className="text-center text-[8px] font-black tracking-[0.22em] uppercase mb-2">DINING • ORDER RECEIPT</div>
                    )}
                    <div className="w-full h-[1px] border-b border-dashed border-slate-300 my-2"></div>
                    
                    {/* Header Info */}
                    <div className={`w-full px-1 ${data.type === 'RESTAURANT' ? 'bg-slate-50 border border-slate-200 rounded-md py-1.5 mb-2' : 'mb-1'}`}>
                      <div className="flex justify-between">
                        <span>DATE: {data.date}</span>
                        <span>TIME: {data.time}</span>
                      </div>
                      <div>BILL NO: {data.billNumber}</div>
                      {data.showGst !== false && <div>GSTIN: {data.gstNumber || 'N/A'}</div>}
                      <div>MODE: {data.paymentMode}</div>
                    </div>

                    <div className="w-full h-[1px] border-b border-dashed border-slate-300 my-2"></div>
                    
                    {/* Items Table */}
                    <div className={`w-full px-1 ${data.type === 'RESTAURANT' ? 'border border-slate-300 rounded-md p-1.5' : ''}`}>
                      {data.type === 'RESTAURANT' && (
                        <div className="text-[8px] font-black uppercase tracking-widest mb-1.5 text-slate-500">ORDER DETAILS</div>
                      )}
                      <div className="flex justify-between font-black text-[10px] mb-1 border-b border-slate-200 pb-1">
                        <span className="w-[8%]">#</span>
                        <span className="w-[32%]">ITEM</span>
                        <span className="w-[15%] text-right">QTY</span>
                        <span className="w-[20%] text-right">RATE</span>
                        <span className="w-[25%] text-right">TOTAL</span>
                      </div>
                      <div className="space-y-1.5 mb-2">
                        {data.items.map((item, index) => (
                          <div key={item.id} className="flex justify-between items-start">
                            <span className="w-[8%]">{index + 1}</span>
                            <span className="w-[32%] break-words leading-[1]">{item.name || 'Unnamed Item'}</span>
                            <span className="w-[15%] text-right">{item.quantity}</span>
                            <span className="w-[20%] text-right">₹{item.rate.toFixed(2)}</span>
                            <span className="w-[25%] text-right">₹{item.total.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="w-full h-[1px] border-b border-dashed border-slate-300 my-2"></div>
                    
                    {/* Summary */}
                    <div className="w-full px-1 text-right space-y-1">
                      <div className="flex justify-between">
                        <span>SUBTOTAL</span>
                        <span>₹{data.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-black mt-1">
                        <span className="uppercase">Grand Total</span>
                        <span>₹{data.total.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="w-full h-[1px] border-b border-dashed border-slate-300 my-4"></div>

                    {/* QR Code */}
                    {data.qrValue && (
                      <div className="flex flex-col items-center mb-10 mt-2">
                        <div className="bg-white p-2 border border-slate-200">
                          <QRCodeSVG value={data.qrValue} size={100} />
                        </div>
                        <p className="text-[9px] mt-2 font-black text-slate-400">SCAN TO PAY</p>
                      </div>
                    )}

                    <p className="text-center font-bold mt-4 uppercase">Thank You! Visit Again</p>
                  </>
                )}
                <div className="mt-8 opacity-20 transform scale-y-50">----------------------------</div>
              </div>
              
              {/* Serrated Edge Bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-4 bg-[radial-gradient(circle_at_2px_0,transparent_1.5px,white_2px)] bg-[length:4px_4px]"></div>
            </div>

            {/* Preview Decoration & Action */}
            <div className="flex flex-col items-center gap-3 mt-6">
              <div className="flex items-center justify-center gap-2 text-slate-400">
                <Info className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Live Paper Preview (58mm)</span>
              </div>

              <button
                type="button"
                onClick={() => handleExportPdf()}
                disabled={isExportingPdf}
                className="w-[288px] py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 active:scale-95 border-none"
              >
                <FileDown className="w-4 h-4 text-blue-400" />
                <span>{isExportingPdf ? 'Exporting PDF...' : 'Download PDF Receipt'}</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Mobile Sticky Action Bar (For instant Print, Preview, PDF on Mobile) */}
      <div className="lg:hidden fixed bottom-3 left-3 right-3 z-40 bg-slate-900/95 backdrop-blur-xl border border-slate-800/80 p-2.5 rounded-2xl shadow-2xl flex items-center justify-between gap-2 text-white">
        <button
          type="button"
          onClick={() => setShowMobilePreviewModal(true)}
          className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 border border-slate-700/60 shadow-sm cursor-pointer"
        >
          <Eye className="w-4 h-4 text-emerald-400" />
          <span>Preview</span>
        </button>

        <button
          type="button"
          onClick={handlePrint}
          className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-emerald-500/20 cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Print</span>
        </button>

        <button
          type="button"
          onClick={() => handleExportPdf()}
          disabled={isExportingPdf}
          className="py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          title="Export PDF"
        >
          <FileDown className="w-4 h-4" />
          <span className="hidden sm:inline">PDF</span>
        </button>
      </div>

      {/* Mobile Receipt Live Preview Bottom Sheet Modal */}
      <AnimatePresence>
        {showMobilePreviewModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-slate-900 text-white rounded-t-[32px] sm:rounded-[32px] w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 shadow-2xl relative border-t sm:border border-slate-800/80 flex flex-col items-center"
            >
              {/* Top Grab Handle */}
              <div className="w-12 h-1.5 bg-slate-700 rounded-full mb-4 sm:hidden cursor-pointer" onClick={() => setShowMobilePreviewModal(false)} />

              <div className="flex justify-between items-center w-full mb-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Eye className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-black tracking-tight text-white">Live Thermal Receipt Preview</h3>
                </div>
                <button 
                  onClick={() => setShowMobilePreviewModal(false)}
                  className="bg-slate-800 p-2 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white border-none cursor-pointer flex items-center justify-center transition-all"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>

              {/* Mobile Thermal Paper View Wrapper */}
              <div className="bg-slate-950 p-4 rounded-2xl w-full flex justify-center mb-6 overflow-x-auto border border-slate-800/80 shadow-inner">
                {/* Emulated 2-inch Thermal Receipt */}
                <div className="bg-white text-slate-900 p-4 rounded-xl shadow-2xl scale-[0.92] sm:scale-100 origin-top">
                  <div className="receipt-paper font-mono text-[11px] leading-tight text-slate-800 antialiased mx-auto flex flex-col items-center bg-white px-3 py-4 w-[288px]">
                    {activeTab === 'PETROL' ? (
                      <div className="w-full font-black text-center text-xs">
                        <p className="font-bold text-sm mb-1">{data.companyName || 'PETROL PUMP'}</p>
                        <p className="text-[10px] text-slate-600 mb-3">{data.address}</p>
                        <div className="border-y border-dashed border-slate-400 py-2 my-2 text-left space-y-1 text-[10px]">
                          <div className="flex justify-between"><span>PRODUCT:</span> <span>{data.petrolDetails?.product}</span></div>
                          <div className="flex justify-between"><span>AMOUNT:</span> <span>₹{data.petrolDetails?.amount.toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>VOL (LTR):</span> <span>{data.petrolDetails?.volumeLtr.toFixed(2)}</span></div>
                        </div>
                        <p className="text-[10px] mt-2">DATE: {data.date} {data.time}</p>
                      </div>
                    ) : (
                      <div className="w-full text-center text-xs">
                        <p className="font-bold text-sm mb-1">{data.companyName || 'BUSINESS NAME'}</p>
                        <p className="text-[10px] text-slate-600 mb-3">{data.address}</p>
                        <div className="border-y border-dashed border-slate-400 py-2 my-2 text-left space-y-1 text-[10px]">
                          {data.items.map((item, index) => (
                            <div key={item.id} className="flex justify-between">
                              <span className="truncate max-w-[140px]">{index + 1}. {item.name}</span>
                              <span>{item.quantity} x ₹{item.rate} = ₹{item.total.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between font-black text-xs my-2">
                          <span>TOTAL:</span>
                          <span>₹{data.total.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-4">**** THANK YOU ****</p>
                  </div>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="flex items-center gap-3 w-full">
                <button
                  type="button"
                  onClick={() => {
                    setShowMobilePreviewModal(false);
                    handlePrint();
                  }}
                  className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Receipt Now</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleExportPdf();
                  }}
                  disabled={isExportingPdf}
                  className="py-3.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 border border-slate-700 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <FileDown className="w-4 h-4 text-blue-400" />
                  <span>PDF</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bluetooth Configuration Modal */}
      <AnimatePresence>
        {showBluetoothSettingsModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 font-sans text-slate-900 selection:bg-emerald-100"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white p-6 rounded-[32px] w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2 text-emerald-600">
                  <Bluetooth className="w-5 h-5 text-emerald-500 animate-pulse" />
                  <h3 className="text-lg font-black tracking-tight">Bluetooth Printer Settings</h3>
                </div>
                <button 
                  onClick={() => setShowBluetoothSettingsModal(false)}
                  className="bg-slate-50 p-2 rounded-full hover:bg-slate-100 text-slate-600 border-none cursor-pointer flex items-center justify-center"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>

              <div className="space-y-5 text-sm">
                <p className="text-slate-500 text-xs font-semibold leading-relaxed">
                  Low-cost mini thermal printers (like those from Flipkart or Amazon) use varying Bluetooth Low Energy (BLE) chips. Configure custom UUIDs below if the automatic discovery fails.
                </p>

                {/* Status Indicator */}
                <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
                  isPrinterConnected 
                    ? 'bg-green-50 border-green-200 text-green-800' 
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${isPrinterConnected ? 'bg-green-500 animate-ping' : 'bg-amber-500'}`} />
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider">Status: </span>
                    <span className="text-xs font-bold">{isPrinterConnected ? 'Connected & Ready' : 'Not Connected'}</span>
                  </div>
                </div>

                {/* Programmatic Iframe Security Warning */}
                {window.self !== window.top && (
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-800 space-y-1.5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" /> Web Bluetooth Sandbox Notice
                    </p>
                    <p className="text-[11px] font-semibold leading-relaxed text-amber-700">
                      For security, modern browsers block BLE device discovery when running inside nested iframes (such as the AI Studio live preview panel).
                    </p>
                    <p className="text-[11px] font-bold leading-relaxed text-amber-900">
                      Please click the <strong className="font-extrabold text-amber-950 underline text-amber-950">"Open in new tab"</strong> button in the top-right corner of the preview to run the app directly, connect your printer, and print!
                    </p>
                  </div>
                )}

                {bluetoothConnectionError && (
                  <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-2xl">
                    <p className="text-[10px] font-black uppercase tracking-wider text-red-500 mb-1 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" /> Connection Error
                    </p>
                    <p className="text-xs font-semibold break-words leading-relaxed">{bluetoothConnectionError}</p>
                  </div>
                )}

                {/* Common Presets */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Common Quick Presets</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomServiceUuid('0000ffe0-0000-1000-8000-00805f9b34fb');
                        setCustomCharacteristicUuid('0000ffe1-0000-1000-8000-00805f9b34fb');
                      }}
                      className="text-left p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl text-xs font-bold transition-all text-slate-700 cursor-pointer"
                    >
                      <div className="font-extrabold text-[10px] text-emerald-600 uppercase mb-0.5">Preset 1: HM-10 (Most Common)</div>
                      <div className="text-[10px] text-slate-400 font-mono">Service: ffe0 | Char: ffe1</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomServiceUuid('0000fff0-0000-1000-8000-00805f9b34fb');
                        setCustomCharacteristicUuid('0000fff1-0000-1000-8000-00805f9b34fb');
                      }}
                      className="text-left p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl text-xs font-bold transition-all text-slate-700 cursor-pointer"
                    >
                      <div className="font-extrabold text-[10px] text-emerald-600 uppercase mb-0.5">Preset 2: JDY-10 / MPT-II</div>
                      <div className="text-[10px] text-slate-400 font-mono">Service: fff0 | Char: fff1</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomServiceUuid('000018f0-0000-1000-8000-00805f9b34fb');
                        setCustomCharacteristicUuid('00002af1-0000-1000-8000-00805f9b34fb');
                      }}
                      className="text-left p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl text-xs font-bold transition-all text-slate-700 cursor-pointer"
                    >
                      <div className="font-extrabold text-[10px] text-emerald-600 uppercase mb-0.5">Preset 3: Standard Printer</div>
                      <div className="text-[10px] text-slate-400 font-mono">Service: 18f0 | Char: 2af1</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomServiceUuid('49535343-fe7d-4158-706b-657463684953');
                        setCustomCharacteristicUuid('49535343-114d-416d-8e05-667463684953');
                      }}
                      className="text-left p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl text-xs font-bold transition-all text-slate-700 cursor-pointer"
                    >
                      <div className="font-extrabold text-[10px] text-emerald-600 uppercase mb-0.5">Preset 4: Microchip ISSC</div>
                      <div className="text-[10px] text-slate-400 font-mono">Service: ISSC | Char: ISSC</div>
                    </button>
                  </div>
                </div>

                {/* Custom Inputs */}
                <div className="space-y-3.5">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Custom Service UUID (Optional)</label>
                    <input 
                      type="text" 
                      value={customServiceUuid}
                      onChange={(e) => setCustomServiceUuid(e.target.value)}
                      placeholder="e.g. 0000ffe0-0000-1000-8000-00805f9b34fb"
                      className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-xs font-mono transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Custom Characteristic UUID (Optional)</label>
                    <input 
                      type="text" 
                      value={customCharacteristicUuid}
                      onChange={(e) => setCustomCharacteristicUuid(e.target.value)}
                      placeholder="e.g. 0000ffe1-0000-1000-8000-00805f9b34fb"
                      className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-xs font-mono transition-all"
                    />
                  </div>
                </div>

                {/* Printer Type / Protocol Selection */}
                <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100 space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700 flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5 text-emerald-600" /> Printer Protocol / Mode
                  </div>
                  <div>
                    <select
                      value={printerProtocol}
                      onChange={(e) => {
                        const val = e.target.value as 'esc-pos' | 'cat-printer';
                        setPrinterProtocol(val);
                        localStorage.setItem('dangi_printer_protocol', val);
                      }}
                      className="w-full bg-white text-slate-800 px-3 py-2.5 rounded-xl border border-slate-200 outline-none text-xs font-bold cursor-pointer transition-all focus:border-emerald-500"
                    >
                      <option value="esc-pos">Standard ESC/POS (Normal Text Printers)</option>
                      <option value="cat-printer">CatPrinter / iPrint (pocket graphics-only printers)</option>
                    </select>
                    <p className="text-[9px] text-slate-400 mt-1.5 font-semibold leading-normal">
                      Select <strong>Standard ESC/POS</strong> for general text printers (e.g., MPT-II, JDY-10). Select <strong>CatPrinter / iPrint</strong> for cat-themed and pocket graphics printers (uses 0x51 0x78 packets).
                    </p>
                  </div>
                </div>

                {/* Advanced BLE Connection Tuning */}
                <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100 space-y-3.5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700 flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5" /> BLE Hardware Tuning
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">BLE Chunk Size</label>
                      <select
                        value={bleChunkSize}
                        onChange={(e) => {
                          const size = Number(e.target.value);
                          setBleChunkSize(size);
                          localStorage.setItem('dangi_ble_chunk_size', String(size));
                        }}
                        className="w-full bg-white text-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200 outline-none text-xs font-semibold cursor-pointer"
                      >
                        <option value={20}>20 bytes (Legacy/Safest)</option>
                        <option value={32}>32 bytes</option>
                        <option value={64}>64 bytes</option>
                        <option value={128}>128 bytes (Recommended)</option>
                        <option value={256}>256 bytes (Fastest)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Inter-Chunk Delay</label>
                      <select
                        value={bleDelayMs}
                        onChange={(e) => {
                          const delay = Number(e.target.value);
                          setBleDelayMs(delay);
                          localStorage.setItem('dangi_ble_delay_ms', String(delay));
                        }}
                        className="w-full bg-white text-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200 outline-none text-xs font-semibold cursor-pointer"
                      >
                        <option value={0}>0 ms (No Delay)</option>
                        <option value={5}>5 ms</option>
                        <option value={15}>15 ms (Default)</option>
                        <option value={30}>30 ms (Highly Compatible)</option>
                        <option value={50}>50 ms (Slow Buffer)</option>
                        <option value={100}>100 ms (Super Slow)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={bleForceWriteWithResponse}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setBleForceWriteWithResponse(val);
                          localStorage.setItem('dangi_ble_force_write', String(val));
                        }}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-600">Force Write with Response (Slower/Secure)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={bleUseCrLf}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setBleUseCrLf(val);
                          localStorage.setItem('dangi_ble_use_crlf', String(val));
                        }}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-600">Use Carriage Return (\r\n) line-feeds (Recommended)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={bleSendCutCommand}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setBleSendCutCommand(val);
                          localStorage.setItem('dangi_ble_send_cut', String(val));
                        }}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-600">Send Auto Paper-Cut Command (GS V 0)</span>
                    </label>
                  </div>
                </div>

                {/* GATT Hardware Inspector */}
                {isPrinterConnected && (
                  <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100 space-y-3.5">
                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-emerald-600 animate-pulse" /> Active GATT Inspector & Live Override
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Active GATT Service</label>
                        <select
                          value={activeServiceUuid}
                          onChange={(e) => handleSwitchService(e.target.value)}
                          className="w-full bg-white text-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200 outline-none text-xs font-mono font-semibold cursor-pointer"
                        >
                          {availableServices.length > 0 ? (
                            availableServices.map((uuid) => (
                              <option key={uuid} value={uuid}>
                                {uuid === '000018f0-0000-1000-8000-00805f9b34fb' ? 'Standard Printer (18f0)' :
                                 uuid === '0000ffe0-0000-1000-8000-00805f9b34fb' ? 'HM-10 Serial (ffe0)' :
                                 uuid === '0000fff0-0000-1000-8000-00805f9b34fb' ? 'JDY-10 Serial (fff0)' :
                                 uuid.slice(4, 8) === '1800' ? 'GAP / Generic Access (1800)' :
                                 uuid.slice(4, 8) === '1801' ? 'GATT Service (1801)' :
                                 uuid.slice(4, 8) === '180a' ? 'Device Info (180a - WRONG SERVICE!)' :
                                 uuid}
                              </option>
                            ))
                          ) : (
                            <option value={activeServiceUuid}>{activeServiceUuid}</option>
                          )}
                        </select>
                        <p className="text-[9px] text-slate-400 mt-1 font-semibold">
                          Switch services if the printer is connected but silent. Standard printers use ffe0, fff0, or 18f0. Avoid 180a/1800.
                        </p>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Available Characteristics (Click to switch active transmit channel)</label>
                        <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                          {availableCharacteristics.length > 0 ? (
                            availableCharacteristics.map((char: any) => {
                              const charUuid = typeof char === 'string' ? char : (char?.uuid || '');
                              const charProps = (typeof char === 'object' && char?.properties) ? char.properties : undefined;
                              const isWritable = charProps ? !!(charProps.write || charProps.writeWithoutResponse) : true;
                              const isSelected = charUuid === activeCharacteristicUuid;
                              return (
                                <button
                                  key={charUuid || Math.random().toString()}
                                  type="button"
                                  onClick={() => isWritable && handleSwitchCharacteristic(charUuid)}
                                  className={`w-full text-left p-2 rounded-xl text-xs font-mono border transition-all flex items-center justify-between ${
                                    isSelected
                                      ? "bg-emerald-50/80 border-emerald-300 text-emerald-800 shadow-sm"
                                      : isWritable
                                      ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 cursor-pointer"
                                      : "bg-slate-100/50 border-slate-100 text-slate-400 cursor-not-allowed"
                                  }`}
                                >
                                  <div className="truncate pr-1.5 font-bold">
                                    {charUuid.length >= 12 ? `${charUuid.slice(4, 8).toUpperCase()}... ${charUuid.slice(-12)}` : charUuid}
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    {charProps?.write && (
                                      <span className="bg-blue-50 text-blue-700 px-1 py-0.5 rounded text-[8px] font-black tracking-widest border border-blue-100 uppercase">Write</span>
                                    )}
                                    {charProps?.writeWithoutResponse && (
                                      <span className="bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded text-[8px] font-black tracking-widest border border-emerald-100 uppercase">No-Resp</span>
                                    )}
                                    {isSelected && (
                                      <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest border border-amber-200 uppercase">Active</span>
                                    )}
                                  </div>
                                </button>
                              );
                            })
                          ) : (
                            <div className="text-xs text-slate-400 font-mono italic p-2 bg-white rounded-xl border border-slate-200">
                              {activeCharacteristicUuid || "None discovered"}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Live Diagnostic Testing */}
                {isPrinterConnected && (
                  <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100/60 flex items-center justify-between">
                    <div className="mr-2 text-left">
                      <h4 className="text-xs font-extrabold text-emerald-800">Connection is Active!</h4>
                      <p className="text-[10px] text-emerald-600 font-semibold leading-normal">Send a custom diagnostic text to test actual printing live.</p>
                    </div>
                    <button
                      type="button"
                      onClick={sendTestPrint}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all border-none cursor-pointer flex items-center gap-1.5 shadow-sm shrink-0"
                    >
                      <Printer className="w-3.5 h-3.5" /> Send Test Line
                    </button>
                  </div>
                )}

                {/* Help Box */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-500 font-semibold space-y-2 leading-relaxed">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-emerald-500" /> Troubleshooting Guide
                  </div>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Make sure your printer is turned on and Bluetooth is active on your device.</li>
                    <li>If it fails, download a free BLE scanner app (like <strong>nRF Connect</strong> or <strong>LightBlue</strong>) on your smartphone.</li>
                    <li>Scan for your printer, connect to it in the app, and locate the <strong>Write / Writable</strong> service and characteristic UUIDs.</li>
                    <li>Copy and paste those exact UUIDs into the fields above, then click <strong>Apply & Connect</strong>!</li>
                  </ul>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomServiceUuid('');
                      setCustomCharacteristicUuid('');
                      setBluetoothConnectionError('');
                    }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border-none cursor-pointer"
                  >
                    Clear Custom
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await connectPrinter();
                    }}
                    className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-100 border-none cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Bluetooth className="w-4 h-4" />
                    Apply & Connect
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Change Credentials / Security Configuration Modal */}
      <AnimatePresence>
        {showChangeCredentialsModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 font-sans text-slate-900 selection:bg-emerald-100"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white p-6 rounded-[32px] w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2 text-emerald-600">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-lg font-black tracking-tight">Security Configuration</h3>
                </div>
                <button 
                  onClick={() => setShowChangeCredentialsModal(false)}
                  className="bg-slate-50 p-2 rounded-full hover:bg-slate-100 text-slate-600 border-none cursor-pointer flex items-center justify-center"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>

              {/* Toggle Protection */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6 flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Enable Password Protection</h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Require Login ID and password to access generator</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleSecurity(!isSecurityEnabled)}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 border-none cursor-pointer flex items-center ${
                    isSecurityEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`bg-white w-5 h-5 rounded-full shadow transition-transform ${
                      isSecurityEnabled ? 'transform translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              {isSecurityEnabled && (
                <form onSubmit={handleSaveCredentials} className="space-y-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-slate-100 pb-1">Change Authentication Credentials</span>
                  
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">New Login ID</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <User className="w-3.5 h-3.5" />
                      </span>
                      <input 
                        type="text"
                        required
                        value={newLoginId}
                        onChange={(e) => setNewLoginId(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-xs focus:outline-none"
                        placeholder="Enter New Login ID"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">New Password</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                          <Key className="w-3.5 h-3.5" />
                        </span>
                        <input 
                          type="password"
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-xs focus:outline-none"
                          placeholder="Password"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Confirm Password</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                          <Key className="w-3.5 h-3.5" />
                        </span>
                        <input 
                          type="password"
                          required
                          value={newPasswordConfirm}
                          onChange={(e) => setNewPasswordConfirm(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-xs focus:outline-none"
                          placeholder="Confirm"
                        />
                      </div>
                    </div>
                  </div>

                  {credentialsChangeError && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-bold text-center">
                      {credentialsChangeError}
                    </div>
                  )}

                  {credentialsChangeSuccess && (
                    <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-xs text-green-600 font-bold text-center flex items-center justify-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      {credentialsChangeSuccess}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md active:scale-95 cursor-pointer border-none"
                  >
                    Save Security Settings
                  </button>
                </form>
              )}

              <div className="text-[9px] text-slate-400 font-semibold leading-relaxed mt-4 pt-4 border-t border-slate-100 text-center uppercase tracking-wider">
                Active Username: <strong className="text-slate-600 font-bold">{localStorage.getItem('tinyprint_username') || 'Not configured'}</strong>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Reprint Modal */}
      <AnimatePresence>
        {showQuickReprintModal && selectedHistoryItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 font-sans text-slate-900 selection:bg-emerald-100"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white p-6 sm:p-7 rounded-[32px] w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-5">
                <div className="flex items-center gap-2 text-emerald-600">
                  <Printer className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <h3 className="text-base font-black tracking-tight uppercase">Quick Reprint Customizer</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Change Date or Amount & Print</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowQuickReprintModal(false)}
                  className="bg-slate-50 p-2 rounded-full hover:bg-slate-100 text-slate-600 border-none cursor-pointer flex items-center justify-center"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 mb-5 text-[11px] leading-tight text-slate-500 font-semibold uppercase flex items-center justify-between">
                <span>Template: <strong className="text-slate-800 font-black truncate max-w-[180px] block">{selectedHistoryItem.receiptData.companyName}</strong></span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-lg text-[9px] font-black shrink-0">{selectedHistoryItem.receiptData.type}</span>
              </div>

              <div className="space-y-4">
                {/* Date Input */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">New Bill Date</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                    </span>
                    <input 
                      type="date"
                      required
                      value={quickDate}
                      onChange={(e) => setQuickDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all font-semibold text-xs focus:outline-none"
                    />
                  </div>
                </div>

                {/* Time Input */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">New Bill Time</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                    </span>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. 14:32"
                      value={quickTime}
                      onChange={(e) => setQuickTime(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all font-semibold text-xs focus:outline-none"
                    />
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">New Grand Total (₹)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                    </span>
                    <input 
                      type="number"
                      step="0.01"
                      required
                      value={quickAmount}
                      onChange={(e) => setQuickAmount(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-emerald-50 text-emerald-900 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all font-black text-xs focus:outline-none"
                      placeholder="Enter Target Amount"
                    />
                  </div>
                  <p className="text-[9px] text-slate-400 font-medium mt-1 leading-normal uppercase">
                    {selectedHistoryItem.receiptData.type === 'PETROL' 
                      ? 'Re-calculates volume (liters) using station rate per liter.' 
                      : 'Proportionally scales rates of all items to perfectly match total.'}
                  </p>
                </div>

                {/* Customer Name Input (Only Petrol) */}
                {selectedHistoryItem.receiptData.type === 'PETROL' && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Customer Name</label>
                    <input 
                      type="text"
                      value={quickCustomerName}
                      onChange={(e) => setQuickCustomerName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all font-semibold text-xs focus:outline-none"
                      placeholder="Leave empty for blank"
                    />
                  </div>
                )}
              </div>

              {/* Instant Before/After Comparison Preview Card */}
              <div className="mt-5 p-3.5 bg-slate-50 border border-slate-150 rounded-2xl grid grid-cols-2 gap-4">
                <div className="border-r border-slate-200 pr-2">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Original Receipt</span>
                  <div className="text-[10px] font-black text-slate-700 truncate uppercase">
                    Date: {selectedHistoryItem.receiptData.date}
                  </div>
                  <div className="text-xs font-black text-slate-500 mt-1 font-mono">
                    ₹{(selectedHistoryItem.receiptData.type === 'PETROL' 
                      ? (selectedHistoryItem.receiptData.petrolDetails?.amount || 0) 
                      : selectedHistoryItem.receiptData.total).toFixed(2)}
                  </div>
                </div>

                <div className="pl-2">
                  <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest block mb-1">Custom Print Preview</span>
                  <div className="text-[10px] font-black text-emerald-700 truncate uppercase">
                    Date: {quickDate || '...'}
                  </div>
                  <div className="text-xs font-black text-emerald-600 mt-1 font-mono">
                    ₹{(parseFloat(quickAmount) || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowQuickReprintModal(false)}
                  className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer border-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleQuickReprintExportPdf}
                  disabled={isExportingPdf}
                  className="py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer border-none flex items-center justify-center gap-1 shadow-md shadow-blue-600/10 disabled:opacity-50"
                  title="Export this customized bill directly as PDF"
                >
                  <FileDown className="w-4 h-4 shrink-0" />
                  <span>PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleQuickPrint}
                  className={`py-3 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer border-none flex items-center justify-center gap-1 shadow-lg ${
                    isPrinterConnected 
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10' 
                      : 'bg-emerald-400 cursor-not-allowed opacity-75'
                  }`}
                  disabled={!isPrinterConnected}
                  title={!isPrinterConnected ? "Connect printer to print" : "Send to printer"}
                >
                  <Printer className="w-4 h-4 shrink-0" />
                  <span>Print</span>
                </button>
              </div>

              {!isPrinterConnected && (
                <div className="text-center text-[9px] text-amber-600 font-bold uppercase mt-3 leading-normal">
                  ⚠️ Connect to a Bluetooth printer first to send receipts!
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Custom Font Logic for virtual paper */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
        .receipt-paper {
          font-family: 'Courier Prime', monospace;
          background: white;
          filter: contrast(1.1) brightness(1.02);
          width: 250px;
          font-size: ${data.fontSize === 'small' ? '9px' : data.fontSize === 'medium' ? '11px' : '13px'};
          font-weight: ${activeTab === 'PETROL' || data.fontStyle === 'bold' ? '700' : '400'};
          letter-spacing: ${data.fontStyle === 'condensed' ? '-0.5px' : 'normal'};
        }
        .cursor-edit {
          border-bottom: 1px dashed transparent;
        }
        .cursor-edit:hover {
          border-bottom-color: currentColor;
          background: rgba(0,0,0,0.05);
        }
      `}</style>
      
      {/* Elegantly Crafted Footer */}
      <footer className="w-full bg-white border-t border-slate-200/60 py-6 mt-12 text-center select-none font-sans">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none">
            &copy; 2026 Dangi Print. All Rights Reserved.
          </p>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest leading-none flex items-center justify-center gap-1.5">
            Created by <span className="text-emerald-600 border-b-2 border-emerald-300 font-black">Birendra Dangi</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
