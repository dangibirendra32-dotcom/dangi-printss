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
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import * as pdfjsLib from 'pdfjs-dist';
import html2canvas from 'html2canvas-pro';
// @ts-expect-error - Vite ?url imports are not natively typed in TypeScript config
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

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
    taxLabel: 'GST (18%)',
    taxRate: 18,
    taxAmount: 18,
    total: 118,
    paymentMode: 'CASH',
    fontSize: 'medium',
    fontStyle: 'normal',
    showGst: true,
    petrolDetails: {
      company: 'JIO_BP',
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

  const [isScanning, setIsScanning] = useState(false);
  const [printer, setPrinter] = useState<ThermalPrinter | null>(null);
  const [isPrinterConnected, setIsPrinterConnected] = useState(false);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [pdfCanvas, setPdfCanvas] = useState<HTMLCanvasElement | null>(null);
  const scannerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const receiptPaperRef = useRef<HTMLDivElement>(null);

  // --- Secure Authentication State ---
  const [isSecurityEnabled, setIsSecurityEnabled] = useState<boolean>(() => {
    return localStorage.getItem('tinyprint_security_enabled') !== 'false';
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const sessionAuth = sessionStorage.getItem('tinyprint_authenticated') === 'true';
    const isSecEnabled = localStorage.getItem('tinyprint_security_enabled') !== 'false';
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
    const correctUser = localStorage.getItem('tinyprint_username') || 'admin';
    const correctPass = localStorage.getItem('tinyprint_password') || 'admin';

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
      setLoginError('Invalid Login ID or Password. Default is admin / admin.');
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
        adjusted.taxAmount = parseFloat((subtotalAcc * (adjusted.taxRate / 100)).toFixed(2));
        adjusted.total = parseFloat((adjusted.subtotal + adjusted.taxAmount).toFixed(2));
      }

      // Send to print!
      const cmds = ThermalPrinter.getCommands();
      const chunks: Uint8Array[] = [];

      chunks.push(cmds.INIT);
      chunks.push(cmds.ALIGN_CENTER);
      chunks.push(cmds.BOLD_ON);

      if (adjusted.type === 'PETROL') {
        chunks.push(cmds.BOLD_ON);
        chunks.push(ThermalPrinter.textToUint8("WELCOME!!!"));
        chunks.push(ThermalPrinter.textToUint8(`${adjusted.companyName.toUpperCase()}`));
        chunks.push(ThermalPrinter.textToUint8(adjusted.address));
        chunks.push(ThermalPrinter.textToUint8(`TEL NO: ${adjusted.petrolDetails?.telNo}`));
        chunks.push(ThermalPrinter.textToUint8(`RECEIPT NO: ${adjusted.petrolDetails?.receiptNo}`));
        chunks.push(ThermalPrinter.textToUint8(`FCC ID: ${adjusted.petrolDetails?.fccId}`));
        chunks.push(ThermalPrinter.textToUint8(`FIP NO: ${adjusted.petrolDetails?.fipNo}`));
        chunks.push(ThermalPrinter.textToUint8(`NOZZLE NO: ${adjusted.petrolDetails?.nozzleNo}`));
        
        chunks.push(cmds.ALIGN_LEFT);
        chunks.push(ThermalPrinter.textToUint8(` `));
        chunks.push(ThermalPrinter.textToUint8(`PRODUCT: ${adjusted.petrolDetails?.product}`));
        chunks.push(ThermalPrinter.textToUint8(`RATE/LTR: ${adjusted.petrolDetails?.ratePerLtr.toFixed(2)}`));
        chunks.push(ThermalPrinter.textToUint8(`AMOUNT: ${adjusted.petrolDetails?.amount.toFixed(2)}`));
        chunks.push(ThermalPrinter.textToUint8(`VOLUME(LTR): ${adjusted.petrolDetails?.volumeLtr.toFixed(2)} lt`));
        chunks.push(ThermalPrinter.textToUint8(` `));
        chunks.push(ThermalPrinter.textToUint8(`VEH TYPE: ${adjusted.petrolDetails?.vehType}`));
        chunks.push(ThermalPrinter.textToUint8(`VEH NO: ${adjusted.petrolDetails?.vehicleNumber}`));
        chunks.push(ThermalPrinter.textToUint8(`CUSTOMER: ${adjusted.petrolDetails?.customerName || ''}`));
        chunks.push(ThermalPrinter.textToUint8(` `));
        chunks.push(ThermalPrinter.textToUint8(`DATE: ${adjusted.date} ${adjusted.time}`));
        chunks.push(ThermalPrinter.textToUint8(`MODE: ${adjusted.paymentMode}`));
        chunks.push(ThermalPrinter.textToUint8(`LST NO: ${adjusted.petrolDetails?.lstNo}`));
        chunks.push(ThermalPrinter.textToUint8(`VAT NO: ${adjusted.petrolDetails?.vatNo}`));
        chunks.push(ThermalPrinter.textToUint8(`ATTENDANT: ${adjusted.petrolDetails?.attendantId}`));
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
        
        chunks.push(ThermalPrinter.textToUint8(`ITEM            QTY    RATE   TOTAL`));
        chunks.push(ThermalPrinter.textToUint8(`--------------------------------`));
        
        adjusted.items.forEach(item => {
          const namePart = item.name.substring(0, 15).padEnd(15);
          const qtyPart = item.quantity.toString().padStart(3);
          const ratePart = item.rate.toString().padStart(6);
          const totalPart = item.total.toString().padStart(6);
          chunks.push(ThermalPrinter.textToUint8(`${namePart} ${qtyPart} ${ratePart} ${totalPart}`));
        });
        
        chunks.push(ThermalPrinter.textToUint8(`--------------------------------`));
        chunks.push(cmds.ALIGN_RIGHT);
        chunks.push(ThermalPrinter.textToUint8(`Subtotal: ${adjusted.subtotal.toFixed(2)}`));
        chunks.push(ThermalPrinter.textToUint8(`${adjusted.taxLabel}: ${adjusted.taxAmount.toFixed(2)}`));
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
      chunks.push(cmds.CUT);

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

  // --- PDF Auto-Crop & Resolution Optimizer State ---
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>('');
  const [pdfPageCount, setPdfPageCount] = useState<number>(0);
  const [pdfCurrentPage, setPdfCurrentPage] = useState<number>(1);
  const [pdfThreshold, setPdfThreshold] = useState<number>(242); // 0-255 brightness ink detector
  const [pdfPadding, setPdfPadding] = useState<number>(6); // padding in px (cropped margin cushion)
  const [pdfPrinterWidth, setPdfPrinterWidth] = useState<number>(384); // 384 (58mm) or 576 (80mm)
  const [originalPdfDims, setOriginalPdfDims] = useState({ w: 0, h: 0 });
  const [croppedPdfDims, setCroppedPdfDims] = useState({ w: 0, h: 0 });
  const [pdfCroppedCanvas, setPdfCroppedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [pdfCroppedUrl, setPdfCroppedUrl] = useState<string>('');
  const [showPdfPreviewTab, setShowPdfPreviewTab] = useState<boolean>(false);
  const [pdfDitherMock, setPdfDitherMock] = useState<boolean>(false); // Simulate dithering mode
  const [appMode, setAppMode] = useState<'TEMPLATE' | 'PDF'>('TEMPLATE');
  const [pdfOriginalUrl, setPdfOriginalUrl] = useState<string>('');
  const [pdfCropRect, setPdfCropRect] = useState({ left: 0, top: 0, width: 100, height: 100 });
  const [isDraggingPdf, setIsDraggingPdf] = useState(false);

  // New states for manual cropping and text boldness enhancement
  const [pdfCropMode, setPdfCropMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [manualCropLeft, setManualCropLeft] = useState<number>(5);
  const [manualCropTop, setManualCropTop] = useState<number>(5);
  const [manualCropRight, setManualCropRight] = useState<number>(95);
  const [manualCropBottom, setManualCropBottom] = useState<number>(95);
  const [pdfBoldness, setPdfBoldness] = useState<number>(1); // default to Light Bold (1 pt dilation) for pristine physical layout
  const [pdfProcessingError, setPdfProcessingError] = useState<string>('');

  // Unified PDF processing workflow
  const processPdfBuffer = async (
    buffer: ArrayBuffer,
    pageNumber: number,
    threshold: number,
    padding: number,
    printerWidth: number
  ) => {
    setIsProcessingPdf(true);
    setPdfProcessingError('');
    try {
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
      const totalPages = pdf.numPages;
      setPdfPageCount(totalPages);
      
      const pageNum = Math.min(Math.max(1, pageNumber), totalPages);
      setPdfCurrentPage(pageNum);

      const page = await pdf.getPage(pageNum);
      
      // Render at a solid 2.2 scale for crisp fonts without sacrificing CPU time
      const viewport = page.getViewport({ scale: 2.2 });
      const rawCanvas = document.createElement('canvas');
      rawCanvas.width = viewport.width;
      rawCanvas.height = viewport.height;
      
      const rawContext = rawCanvas.getContext('2d');
      if (!rawContext) throw new Error("Could not acquire 2D context");

      // Pre-fill solid white background to guarantee opaque paper rendering and eliminate alpha-transparency scaling blackouts
      rawContext.fillStyle = '#FFFFFF';
      rawContext.fillRect(0, 0, rawCanvas.width, rawCanvas.height);

      // Draw PDF page
      await page.render({ 
        canvasContext: rawContext, 
        viewport: viewport 
      } as any).promise;

      // Original base image details
      const w = rawCanvas.width;
      const h = rawCanvas.height;

      let minX = 0;
      let maxX = w;
      let minY = 0;
      let maxY = h;

      if (pdfCropMode === 'AUTO') {
        const imgData = rawContext.getImageData(0, 0, w, h);
        const pixels = imgData.data;

        // Use precise profile projection histograms to scan column and row ink densities
        const colInkCount = new Int32Array(w);
        const rowInkCount = new Int32Array(h);

        for (let y = 0; y < h; y++) {
          const rowOffset = y * w;
          for (let x = 0; x < w; x++) {
            const idx = (rowOffset + x) * 4;
            const a = pixels[idx + 3];

            if (a > 30) { // check alpha transparency
              const r = pixels[idx];
              const g = pixels[idx + 1];
              const b = pixels[idx + 2];

              // If average pixel color is darker than threshold, it is "ink"
              const isInk = (r < threshold || g < threshold || b < threshold);
              if (isInk) {
                colInkCount[x]++;
                rowInkCount[y]++;
              }
            }
          }
        }

        // Filter out individual random speckles (0.1% height/width scale noise barrier)
        const noiseThresholdX = Math.max(1, Math.round(h * 0.001));
        const noiseThresholdY = Math.max(1, Math.round(w * 0.001));

        let detectedMinX = 0;
        let detectedMaxX = w;
        let detectedMinY = 0;
        let detectedMaxY = h;

        let foundLeft = false;
        for (let x = 0; x < w; x++) {
          if (colInkCount[x] >= noiseThresholdX) {
            detectedMinX = x;
            foundLeft = true;
            break;
          }
        }

        let foundRight = false;
        for (let x = w - 1; x >= 0; x--) {
          if (colInkCount[x] >= noiseThresholdX) {
            detectedMaxX = x;
            foundRight = true;
            break;
          }
        }

        let foundTop = false;
        for (let y = 0; y < h; y++) {
          if (rowInkCount[y] >= noiseThresholdY) {
            detectedMinY = y;
            foundTop = true;
            break;
          }
        }

        let foundBottom = false;
        for (let y = h - 1; y >= 0; y--) {
          if (rowInkCount[y] >= noiseThresholdY) {
            detectedMaxY = y;
            foundBottom = true;
            break;
          }
        }

        // Safeguard if no ink was detected
        if (!foundLeft || !foundRight || !foundTop || !foundBottom || detectedMaxX <= detectedMinX || detectedMaxY <= detectedMinY) {
          minX = 0;
          maxX = w;
          minY = 0;
          maxY = h;
        } else {
          minX = detectedMinX;
          maxX = detectedMaxX;
          minY = detectedMinY;
          maxY = detectedMaxY;
        }

        // For Left/Right width sides, crop exactly 100% of the extra page space (strictly 0 border cushion)
        minX = Math.max(0, minX);
        maxX = Math.min(w, maxX);

        // For Top/Bottom height margins, apply the safety cushion padding to avoid character truncation
        const scalePaddingY = Math.round(padding * 2.2);
        minY = Math.max(0, minY - scalePaddingY);
        maxY = Math.min(h, maxY + scalePaddingY);
      } else {
        // Manual crop calculations directly from slider boundary percentages
        minX = Math.round((manualCropLeft / 100) * w);
        maxX = Math.round((manualCropRight / 100) * w);
        minY = Math.round((manualCropTop / 100) * h);
        maxY = Math.round((manualCropBottom / 100) * h);

        // Grid boundaries safety guards
        if (minX < 0) minX = 0;
        if (minY < 0) minY = 0;
        if (maxX <= minX) maxX = Math.min(w, minX + 10);
        if (maxY <= minY) maxY = Math.min(h, minY + 10);
      }

      const croppedW = maxX - minX;
      const croppedH = maxY - minY;

      // Extract bounding-box content
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = croppedW;
      croppedCanvas.height = croppedH;
      const croppedCtx = croppedCanvas.getContext('2d');
      if (!croppedCtx) throw new Error("Could not create cropped canvas context");
      
      croppedCtx.fillStyle = '#FFFFFF';
      croppedCtx.fillRect(0, 0, croppedW, croppedH);
      croppedCtx.drawImage(rawCanvas, minX, minY, croppedW, croppedH, 0, 0, croppedW, croppedH);

      // Downscale proportionally to perfect resolution matching target printer printable width
      const targetW = printerWidth;
      const targetH = Math.round((croppedH / croppedW) * targetW);

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = targetW;
      finalCanvas.height = targetH;
      const finalCtx = finalCanvas.getContext('2d');
      if (!finalCtx) throw new Error("Could not create final scaled canvas");

      finalCtx.fillStyle = '#FFFFFF';
      finalCtx.fillRect(0, 0, targetW, targetH);
      finalCtx.imageSmoothingEnabled = true;
      finalCtx.imageSmoothingQuality = 'high';
      finalCtx.drawImage(croppedCanvas, 0, 0, croppedW, croppedH, 0, 0, targetW, targetH);

      // --- TEXT CLARITY & BOLDING FILTER ---
      // Apply extreme binarization and morphological dilation to make fonts pristine, deep black, and thickened
      const fCtx = finalCanvas.getContext('2d');
      if (fCtx) {
        const fImgData = fCtx.getImageData(0, 0, targetW, targetH);
        const fPixels = fImgData.data;
        const totalPixels = fPixels.length;

        // 1. Convert to pure absolute high contrast (Binarize using threshold, blending alpha against white)
        const binarized = new Uint8ClampedArray(totalPixels);
        for (let i = 0; i < totalPixels; i += 4) {
          const a = fPixels[i + 3];
          const alphaFactor = a / 255;
          
          // Mathematically blend content color with standard white backing to bypass scaling pixel artifacts
          const r = Math.round(fPixels[i] * alphaFactor + 255 * (1 - alphaFactor));
          const g = Math.round(fPixels[i + 1] * alphaFactor + 255 * (1 - alphaFactor));
          const b = Math.round(fPixels[i + 2] * alphaFactor + 255 * (1 - alphaFactor));
          
          const brightness = (r + g + b) / 3;

          // Anything darker than threshold goes black, others go paper-white
          if (brightness < threshold) {
            binarized[i] = 0;
            binarized[i + 1] = 0;
            binarized[i + 2] = 0;
            binarized[i + 3] = 255;
          } else {
            binarized[i] = 255;
            binarized[i + 1] = 255;
            binarized[i + 2] = 255;
            binarized[i + 3] = 255;
          }
        }

        // 2. Boldness thickening via 2D morphological dilation
        if (pdfBoldness > 0) {
          const boldPixels = new Uint8ClampedArray(binarized);
          const rad = pdfBoldness; // 1, 2, or 3 pixel radius boundary growth

          for (let y = rad; y < targetH - rad; y++) {
            for (let x = rad; x < targetW - rad; x++) {
              const idx = (y * targetW + x) * 4;

              // If it feels white, query nearby neighborhood. If any black neighbor exists, widen the stroke!
              if (binarized[idx] === 255) {
                let hasBlackNeighbor = false;
                for (let dy = -rad; dy <= rad; dy++) {
                  for (let dx = -rad; dx <= rad; dx++) {
                    const neighborIdx = ((y + dy) * targetW + (x + dx)) * 4;
                    if (binarized[neighborIdx] === 0) {
                      hasBlackNeighbor = true;
                      break;
                    }
                  }
                  if (hasBlackNeighbor) break;
                }

                if (hasBlackNeighbor) {
                  boldPixels[idx] = 0;
                  boldPixels[idx + 1] = 0;
                  boldPixels[idx + 2] = 0;
                  boldPixels[idx + 3] = 255;
                }
              }
            }
          }

          fCtx.putImageData(new ImageData(boldPixels, targetW, targetH), 0, 0);
        } else {
          fCtx.putImageData(new ImageData(binarized, targetW, targetH), 0, 0);
        }
      }

      // Update dimensions state
      setOriginalPdfDims({ w: Math.round(w / 2.2), h: Math.round(h / 2.2) });
      setCroppedPdfDims({ w: Math.round(croppedW / 2.2), h: Math.round(croppedH / 2.2) });
      setPdfCroppedCanvas(finalCanvas);
      setPdfCanvas(finalCanvas);

      // Save original uncropped representation and relative bounding offsets
      const rawUrl = rawCanvas.toDataURL('image/png');
      setPdfOriginalUrl(rawUrl);
      setPdfCropRect({
        left: (minX / w) * 100,
        top: (minY / h) * 100,
        width: (croppedW / w) * 100,
        height: (croppedH / h) * 100
      });

      // Generate visual URL for virtual paper simulator
      const dataUrl = finalCanvas.toDataURL('image/png');
      setPdfCroppedUrl(dataUrl);

    } catch (error: any) {
      console.error("PDF Processing Error details:", error);
      setPdfProcessingError(error?.message || String(error) || "Failed to process PDF.");
    } finally {
      setIsProcessingPdf(false);
    }
  };

  // Re-process when sliders or settings update
  useEffect(() => {
    if (pdfBuffer) {
      processPdfBuffer(pdfBuffer, pdfCurrentPage, pdfThreshold, pdfPadding, pdfPrinterWidth);
    }
  }, [
    pdfCurrentPage,
    pdfThreshold,
    pdfPadding,
    pdfPrinterWidth,
    pdfCropMode,
    manualCropLeft,
    manualCropTop,
    manualCropRight,
    manualCropBottom,
    pdfBoldness
  ]);

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

  const processPdfFile = async (file: File) => {
    setPdfFileName(file.name);
    setIsProcessingPdf(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      setPdfBuffer(arrayBuffer);
      setPdfCurrentPage(1);

      // Initial run with standard values
      await processPdfBuffer(arrayBuffer, 1, pdfThreshold, pdfPadding, pdfPrinterWidth);
      
      // Auto-switch preview tab to PDF so they see processed result immediately
      setShowPdfPreviewTab(true);
      setAppMode('PDF');
      
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 }
      });
    } catch (error) {
      console.error("PDF Parsing Error:", error);
      alert("Failed to read PDF. Make sure it is not corrupted or password-protected.");
    } finally {
      setIsProcessingPdf(false);
    }
  };

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await processPdfFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingPdf(true);
  };

  const handleDragLeave = () => {
    setIsDraggingPdf(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingPdf(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        await processPdfFile(file);
      } else {
        alert("Please drop a valid PDF file.");
      }
    }
  };

  const handlePrintPdf = async () => {
    if (!pdfCroppedCanvas || !printer || !isPrinterConnected) {
      alert("Please connect your Bluetooth printer and upload a PDF first.");
      return;
    }
    
    setIsProcessingPdf(true);
    try {
      // Use real high-fidelity ESC/POS raster graphic assembler
      const rasterCmd = ThermalPrinter.canvasToEscPos(pdfCroppedCanvas);
      if (rasterCmd.length === 0) {
        throw new Error("Compiled raster output was empty.");
      }

      await printer.print(rasterCmd);
      
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch (error: any) {
      console.error("PDF Graphic print command failed:", error);
      alert("Print failed: " + error.message);
    } finally {
      setIsProcessingPdf(false);
    }
  };

  const addItem = () => {
    const newItem: ReceiptItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      quantity: 1,
      rate: 0,
      total: 0
    };
    setData(prev => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const updateItem = (id: string, field: keyof ReceiptItem, value: any) => {
    setData(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity' || field === 'rate') {
            updatedItem.total = updatedItem.quantity * updatedItem.rate;
          }
          return updatedItem;
        }
        return item;
      })
    }));
  };

  const removeItem = (id: string) => {
    setData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  const connectPrinter = async () => {
    const newPrinter = new ThermalPrinter();
    const success = await newPrinter.connect();
    if (success) {
      setPrinter(newPrinter);
      setIsPrinterConnected(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  };

  const startScanner = () => {
    setIsScanning(true);
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render((decodedText) => {
        setData(prev => ({ ...prev, qrValue: decodedText }));
        scanner.clear();
        setIsScanning(false);
      }, (error) => {
        // console.warn(error);
      });
      scannerRef.current = scanner;
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear();
    }
    setIsScanning(false);
  };

  const handlePrint = async () => {
    if (!isPrinterConnected || !printer) {
      alert("Please connect to a Bluetooth printer first.");
      return;
    }

    try {
      if (!receiptPaperRef.current) {
        throw new Error('Could not find the receipt preview to print.');
      }

      // Capture exactly what's shown on screen (logo included) instead of
      // rebuilding the receipt from scratch as plain text — this is what
      // keeps the printed layout matching the preview, and is what actually
      // lets the logo make it onto paper.
      //
      // Capture at a HIGHER resolution than the printer's final 384-dot
      // width, then downscale with smoothing afterwards. Rendering straight
      // at 384px makes small receipt text only a few pixels tall, so thin
      // strokes fall apart into faded fragments. Supersampling first lets
      // the browser anti-alias text properly, and the smoothed downscale
      // turns that into clean gray gradients that survive the black/white
      // threshold as solid, legible letters instead of broken dots.
      const printerWidth = 384;
      // Use even higher supersampling for better quality on mobile
      const superSampleFactor = 4; // Increased from 3
      const captureScale = (printerWidth * superSampleFactor) / receiptPaperRef.current.offsetWidth;
      const hiResCanvas = await html2canvas(receiptPaperRef.current, {
        backgroundColor: '#ffffff',
        scale: captureScale,
        useCORS: true,
        logging: false,
        // Add these options for better quality
        onclone: (clonedDoc) => {
          // Ensure the receipt is fully rendered
          const receipt = clonedDoc.querySelector('.receipt-paper');
          if (receipt) {
            (receipt as HTMLElement).style.transform = 'none';
          }
        }
      });

      const finalHeight = Math.round((hiResCanvas.height * printerWidth) / hiResCanvas.width);
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = printerWidth;
      finalCanvas.height = finalHeight;
      const finalCtx = finalCanvas.getContext('2d')!;
      finalCtx.imageSmoothingEnabled = true;
      finalCtx.imageSmoothingQuality = 'high';
      finalCtx.fillStyle = '#fff';
      finalCtx.fillRect(0, 0, printerWidth, finalHeight);
      finalCtx.drawImage(hiResCanvas, 0, 0, hiResCanvas.width, hiResCanvas.height, 0, 0, printerWidth, finalHeight);

      // Apply contrast enhancement for better print quality
      const imageData = finalCtx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
      const pixels = imageData.data;
      for (let i = 0; i < pixels.length; i += 4) {
        // Increase contrast
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const avg = (r + g + b) / 3;
        const newVal = avg < 128 ? 0 : 255;
        pixels[i] = newVal;
        pixels[i + 1] = newVal;
        pixels[i + 2] = newVal;
      }
      finalCtx.putImageData(imageData, 0, 0);

      const combined = ThermalPrinter.canvasToEscPos(finalCanvas);

      await printer.print(combined);
      saveToHistory();
    } catch (error) {
      console.error("Printing failed", error);
      alert("Printing failed: " + (error instanceof Error ? error.message : String(error)));
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

          {/* Prompt standard login instructions */}
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Authorized Personnel Only</span>
            <span className="text-[9px] text-slate-400 font-semibold block mt-1">Default credentials: <strong className="text-slate-600 font-bold">admin</strong> / <strong className="text-slate-600 font-bold">admin</strong></span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 md:pb-0">
      {/* Header */}
      <header className="bg-emerald-600 text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-md">
              <Printer className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Dangi Print</h1>
              <p className="text-xs text-emerald-100 font-medium">2-Inch Thermal Solution</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {isSecurityEnabled && (
              <button 
                onClick={handleLogout}
                className="flex items-center gap-1.5 bg-emerald-700/60 hover:bg-emerald-700 px-3.5 py-2 rounded-full text-xs font-bold transition-all text-emerald-100 hover:text-white border-none cursor-pointer"
                title="Log Out / Lock App"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Lock App</span>
              </button>
            )}
            <button 
              onClick={() => {
                setNewLoginId(localStorage.getItem('tinyprint_username') || 'admin');
                setCredentialsChangeError('');
                setCredentialsChangeSuccess('');
                setShowChangeCredentialsModal(true);
              }}
              className="flex items-center gap-1.5 bg-emerald-800/50 hover:bg-emerald-700 px-3.5 py-2 rounded-full text-xs font-bold transition-all text-emerald-100 hover:text-white border-none cursor-pointer"
              title="Security Configuration"
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Security</span>
            </button>
            <button 
              onClick={connectPrinter}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all border-none cursor-pointer ${
                isPrinterConnected 
                  ? 'bg-green-500 hover:bg-green-600 text-white' 
                  : 'bg-white text-emerald-600 hover:bg-emerald-50 shadow-sm'
              }`}
            >
              {isPrinterConnected ? <Bluetooth className="w-4 h-4" /> : <Bluetooth className="w-4 h-4 animate-pulse" />}
              {isPrinterConnected ? 'Printer Ready' : 'Connect Printer'}
            </button>
          </div>
        </div>
      </header>

      {/* App Mode Switcher Sub-Header Bar */}
      <div className="bg-white border-b border-slate-200 py-3.5 px-4 sticky top-[73px] z-40 shadow-sm">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/60 w-full sm:w-auto">
            <button
              id="tab-template-mode"
              onClick={() => {
                setAppMode('TEMPLATE');
                setShowPdfPreviewTab(false);
              }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                appMode === 'TEMPLATE'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100'
                  : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
              }`}
            >
              <FileText className="w-4 h-4" />
              Template Receipt Builder
            </button>
            <button
              id="tab-pdf-mode"
              onClick={() => {
                setAppMode('PDF');
                setShowPdfPreviewTab(true);
              }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                appMode === 'PDF'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100'
                  : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
              }`}
            >
              <Scissors className="w-4 h-4" />
              PDF Smart Crop & Print Studio
            </button>
          </div>
          
          <div className="hidden md:flex items-center gap-2 text-xs font-bold text-slate-500">
            {appMode === 'TEMPLATE' ? (
              <span className="flex items-center gap-1.5 font-bold"><Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" /> Standard text-based thermal invoice templates</span>
            ) : (
              <span className="flex items-center gap-1.5 font-bold"><Printer className="w-4 h-4 text-emerald-500 animate-pulse" /> Direct high-fidelity binary monochrome crop engine</span>
            )}
          </div>
        </div>
      </div>


      <AnimatePresence mode="wait">
        {appMode === 'TEMPLATE' ? (
          <motion.main
            key="template-mode"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="container mx-auto p-4 lg:p-8 grid lg:grid-cols-12 gap-8"
          >
            {/* Left Side: Controls & Editor */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
          
          {/* Bill Type Selector */}
          <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-200">
            {[
              { id: 'MART', icon: Store, label: 'Super Mart' },
              { id: 'RESTAURANT', icon: Utensils, label: 'Restaurant' },
              { id: 'PETROL', icon: Fuel, label: 'Petrol Bill' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as BillType)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-all ${
                  activeTab === tab.id 
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
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
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Petrol Company</label>
                    <div className="grid grid-cols-4 gap-2">
                      {(['JIO_BP', 'HP', 'BHARAT_PETROLEUM', 'CUSTOM'] as PetrolCompany[]).map(co => (
                        <button
                          key={co}
                          type="button"
                          onClick={() => setData({
                            ...data, 
                            companyName: co === 'JIO_BP' ? 'Jio-bp' : co === 'HP' ? 'HP' : co === 'BHARAT_PETROLEUM' ? 'Bharat Petroleum' : (data.companyName === 'Jio-bp' || data.companyName === 'HP' || data.companyName === 'Bharat Petroleum' ? 'My Petrol' : data.companyName),
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
                              co === 'JIO_BP' ? PETROL_LOGOS.JIO_BP : co === 'HP' ? PETROL_LOGOS.HP : PETROL_LOGOS.BHARAT_PETROLEUM
                            )}
                          </div>
                          <span className="text-[9px] font-bold mt-1 tracking-tight truncate w-full text-center">
                            {co === 'JIO_BP' ? 'Jio-bp' : co === 'HP' ? 'HP' : co === 'BHARAT_PETROLEUM' ? 'BP' : 'Custom'}
                          </span>
                        </button>
                      ))}
                    </div>

                    {data.petrolDetails?.company === 'CUSTOM' && (
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
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-separate border-spacing-y-2">
                    <thead>
                      <tr className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                        <th className="pb-2">Description</th>
                        <th className="pb-2">Qty</th>
                        <th className="pb-2">Rate</th>
                        <th className="pb-2 text-right">Total</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence mode="popLayout">
                        {data.items.map((item) => (
                          <motion.tr 
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-slate-50/50 rounded-2xl group"
                          >
                            <td className="p-2 first:rounded-l-2xl">
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
                            <td className="p-2 last:rounded-r-2xl pr-4">
                              <button 
                                onClick={() => removeItem(item.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-lg"
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
                <div className="flex items-center gap-8 text-sm text-slate-500 font-bold">
                  <input 
                    type="text" 
                    value={data.taxLabel}
                    onChange={(e) => setData({...data, taxLabel: e.target.value})}
                    className="bg-transparent border-none text-right focus:outline-none p-0 w-32 font-bold cursor-edit"
                  />
                  <span className="w-24 text-right">₹{data.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-8 text-xl font-black text-emerald-600 bg-emerald-50 px-6 py-3 rounded-2xl">
                  <span>GRAND TOTAL</span>
                  <span className="w-32 text-right font-mono">₹{data.total.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {/* Scan for Logic */}
            <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center mb-4">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-800">Scan for Payment</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">Scan UPI QR to include on bill</p>
              <button 
                onClick={startScanner}
                className="w-full py-3 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95"
              >
                <QrCode className="w-5 h-5" /> Open Scanner
              </button>
            </div>

            {/* Quick Actions */}
            <div className="bg-[#121212] p-6 rounded-3xl shadow-2xl flex flex-col items-center text-center text-white">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-4">
                <Download className="w-6 h-6" />
              </div>
              <h3 className="font-bold">Generate & Print</h3>
              <p className="text-xs text-white/50 mt-1 mb-4">Optimized for 58mm Roll</p>
              <div className="flex flex-col gap-3 w-full">
                <button 
                  onClick={handlePrint}
                  className="w-full py-3 bg-emerald-500 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  <Printer className="w-5 h-5" /> PRINT RECEIPT
                </button>
                
                <div className="h-[1px] bg-white/10 w-full my-2"></div>
                
                <label className="w-full">
                  <input 
                    type="file" 
                    accept="application/pdf" 
                    onChange={handlePdfUpload}
                    className="hidden"
                    ref={fileInputRef}
                  />
                  <div className="w-full py-3 bg-white/5 text-xs text-white/70 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 font-bold flex items-center justify-center gap-2">
                    {isProcessingPdf ? "Processing..." : pdfCanvas ? "PDF Loaded (Ready)" : "Upload PDF to Print"}
                  </div>
                </label>
                
                {pdfCanvas && (
                  <button 
                    onClick={handlePrintPdf}
                    className="w-full py-2 bg-emerald-500/20 text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-500/30"
                  >
                    Send PDF to Printer
                  </button>
                )}
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
        <div className="lg:col-span-5 xl:col-span-4 sticky top-24 self-start">
          {pdfBuffer && (
            <div className="flex gap-2 justify-center mb-4 bg-white/80 backdrop-blur p-1 rounded-2xl shadow-sm border border-slate-200">
              <button 
                onClick={() => setShowPdfPreviewTab(false)}
                className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer ${
                  !showPdfPreviewTab 
                    ? 'bg-emerald-600 text-white shadow' 
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Template Form
              </button>
              <button 
                onClick={() => setShowPdfPreviewTab(true)}
                className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  showPdfPreviewTab 
                    ? 'bg-emerald-600 text-white shadow' 
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Scissors className="w-3" />
                Cropped PDF ({pdfPrinterWidth}px)
              </button>
            </div>
          )}
          
          <div className="relative group">
            {/* Paper Texture Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-900/5 to-slate-900/10 pointer-events-none rounded-[40px] z-10 opacity-50"></div>
            
            <div className="bg-white p-4 pt-12 pb-24 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] rounded-t-[40px] rounded-b-[40px] w-full max-w-[320px] mx-auto overflow-hidden relative border-t-[10px] border-emerald-100">
               
              {/* Receipt Content -> Strictly 2 inches width emulation */}
              <div ref={receiptPaperRef} className="receipt-paper font-mono text-[11px] leading-tight text-slate-800 antialiased mx-auto flex flex-col items-center">
                {showPdfPreviewTab && pdfCroppedUrl ? (
                  <div className="w-full">
                    <div className="text-center font-bold text-[10px] text-emerald-600 border border-emerald-100 bg-emerald-50 py-1.5 rounded-xl mb-4 leading-normal select-none">
                      ✂️ Cropped PDF Output
                      <div className="text-[8px] opacity-75 leading-tight uppercase font-medium mt-0.5">
                        {pdfPrinterWidth}px width proportional density
                      </div>
                    </div>
                    
                    <div className="w-full overflow-hidden border border-dashed border-slate-200 p-0.5 rounded-lg bg-white select-none relative">
                      <img 
                        src={pdfCroppedUrl} 
                        alt="Auto-Cropped Thermal Output" 
                        style={{
                          filter: pdfDitherMock 
                            ? 'contrast(3.0) brightness(0.95) grayscale(100%)' 
                            : 'contrast(1.5) brightness(0.99)'
                        }}
                        className="w-full h-auto object-contain select-none mix-blend-multiply transition-all" 
                      />
                    </div>
                    
                    <div className="text-center text-[9px] text-slate-400 font-bold mt-4 leading-normal">
                      ZERO WASTED WHITESPACE<br/>
                      {originalPdfDims.w && originalPdfDims.h ? (
                        <span className="font-medium font-mono text-[8px]">
                          ({originalPdfDims.w}x{originalPdfDims.h}px original → {pdfPrinterWidth}x{pdfCroppedCanvas ? pdfCroppedCanvas.height : '...'}px crop)
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : activeTab === 'PETROL' ? (
                  <div className="w-full font-black">
                    <div className="flex flex-col items-center mb-6 mt-4 min-h-[160px] justify-center w-full">
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
                    
                    <div className="text-center font-black text-[12px] mb-2">WELCOME!!!</div>
                    
                    <div className="text-center text-[11px] mb-4 leading-tight font-black">{data.companyName.toUpperCase()}</div>
                    <div className="text-center text-[10px] mb-4 leading-tight">{data.address}</div>
                    
                    <div className="text-[10px] space-y-1.5 mb-6">
                      <div className="flex justify-between"><span>TEL NO:</span> <span>{data.petrolDetails?.telNo}</span></div>
                      <div className="flex justify-between"><span>RECEIPT NO:</span> <span>{data.petrolDetails?.receiptNo}</span></div>
                      <div className="flex justify-between"><span>FCC ID:</span> <span>{data.petrolDetails?.fccId || 'N/A'}</span></div>
                      <div className="flex justify-between"><span>FIP NO:</span> <span>{data.petrolDetails?.fipNo || 'N/A'}</span></div>
                      <div className="flex justify-between"><span>NOZZLE NO:</span> <span>{data.petrolDetails?.nozzleNo || 'N/A'}</span></div>
                    </div>

                    <div className="text-[11px] space-y-2 mt-4 mb-6 py-4 border-y border-dashed border-slate-300 font-black">
                      <div className="flex justify-between uppercase"><span>PRODUCT:</span> <span>{data.petrolDetails?.product}</span></div>
                      <div className="flex justify-between uppercase"><span>RATE/LTR:</span> <span>{data.petrolDetails?.ratePerLtr.toFixed(2)}</span></div>
                      <div className="flex justify-between uppercase"><span>AMOUNT:</span> <span>₹{data.petrolDetails?.amount.toFixed(2)}</span></div>
                      <div className="flex justify-between uppercase"><span>VOLUME(LTR):</span> <span>{data.petrolDetails?.volumeLtr.toFixed(2)} lt</span></div>
                    </div>

                    <div className="text-[10px] space-y-1.5 mb-6">
                      <div className="flex justify-between uppercase"><span>VEH TYPE:</span> <span>{data.petrolDetails?.vehType}</span></div>
                      <div className="flex justify-between uppercase"><span>VEH NO:</span> <span>{data.petrolDetails?.vehicleNumber}</span></div>
                      <div className="flex justify-between uppercase"><span>CUSTOMER:</span> <span className="max-w-[120px] text-right">{data.petrolDetails?.customerName || ''}</span></div>
                    </div>

                    <div className="text-[10px] space-y-1.5 pt-2">
                      <div className="flex justify-between uppercase"><span>DATE:</span> <span>{data.date} {data.time}</span></div>
                      <div className="flex justify-between uppercase"><span>MODE:</span> <span>{data.paymentMode}</span></div>
                      <div className="flex justify-between uppercase"><span>VAT NO:</span> <span>{data.petrolDetails?.vatNo || 'N/A'}</span></div>
                      <div className="flex justify-between uppercase"><span>ATTENDANT:</span> <span>{data.petrolDetails?.attendantId}</span></div>
                    </div>

                    <div className="flex flex-col items-center mt-12 mb-4">
                      <div className="mb-2 tracking-widest text-slate-300">******************</div>
                      <div className="font-black text-[13px] uppercase">Thank You! Visit Again</div>
                      <div className="text-[9px] mt-1 font-bold">SAVE FUEL, SAVE MONEY, SAVE THE PLANET.</div>
                    </div>
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

                    <h1 className="text-base font-black text-center mb-1 leading-none uppercase">{data.companyName}</h1>
                    <p className="text-center text-[10px] whitespace-normal mb-2 max-w-[180px]">{data.address}</p>
                    <div className="w-full h-[1px] border-b border-dashed border-slate-300 my-2"></div>
                    
                    {/* Header Info */}
                    <div className="w-full flex justify-between px-1">
                      <span>DATE: {data.date}</span>
                      <span>TIME: {data.time}</span>
                    </div>
                    <div className="w-full px-1">BILL NO: {data.billNumber}</div>
                    {data.showGst !== false && <div className="w-full px-1">GSTIN: {data.gstNumber || 'N/A'}</div>}
                    <div className="w-full px-1 mb-2">MODE: {data.paymentMode}</div>

                    <div className="w-full h-[1px] border-b border-dashed border-slate-300 my-2"></div>
                    
                    {/* Items Table */}
                    <div className="w-full px-1">
                      <div className="flex justify-between font-black text-[10px] mb-1">
                        <span className="w-1/2">ITEM</span>
                        <span className="w-1/6 text-right">QTY</span>
                        <span className="w-1/3 text-right">TOTAL</span>
                      </div>
                      <div className="space-y-1 mb-2">
                        {data.items.map(item => (
                          <div key={item.id} className="flex justify-between items-start">
                            <span className="w-1/2 break-words leading-[1]">{item.name || 'Unnamed Item'}</span>
                            <span className="w-1/6 text-right">{item.quantity}</span>
                            <span className="w-1/3 text-right">₹{item.total.toFixed(2)}</span>
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
                      <div className="flex justify-between">
                        <span>{data.taxLabel}</span>
                        <span>₹{data.taxAmount.toFixed(2)}</span>
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

            {/* Preview Decoration */}
            <div className="hidden lg:flex items-center justify-center gap-2 mt-6 text-slate-400">
              <Info className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Live Paper Preview (58mm)</span>
            </div>
          </div>
        </div>
      </motion.main>
      ) : (
        <motion.main
          key="pdf-mode"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.25 }}
          className="container mx-auto p-4 lg:p-8 grid lg:grid-cols-12 gap-8"
        >
          {/* Left panel: Upload & Controls (7/8 columns) */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
            {pdfBuffer === null ? (
              <div
                id="pdf-drop-zone"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-3 border-dashed rounded-[32px] p-12 py-24 flex flex-col items-center text-center justify-center transition-all duration-300 ${
                  isDraggingPdf
                    ? 'border-emerald-500 bg-emerald-50/50 scale-[0.985] shadow-inner'
                    : 'border-slate-300 hover:border-emerald-400 bg-white shadow-md'
                }`}
              >
                <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[28px] flex items-center justify-center mb-6 shadow-sm shadow-emerald-100">
                  <Upload className="w-10 h-10 text-emerald-500 animate-pulse" />
                </div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Direct PDF Printing Studio</h3>
                <p className="text-sm text-slate-500 mt-3 max-w-md leading-relaxed font-semibold">
                  Upload an existing invoice, bill statement, or receipt PDF. Our smart engine auto-detects characters to crop out empty margins & resizes resolution perfectly back to thermal rolls.
                </p>
                
                <label className="mt-8 cursor-pointer group">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfUpload}
                    className="hidden"
                  />
                  <span className="px-8 py-3.5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Browse Invoice PDF
                  </span>
                </label>
                
                <div className="grid grid-cols-2 gap-4 mt-12 pt-8 border-t border-slate-100 w-full max-w-sm">
                  <div className="flex flex-col items-center">
                    <span className="text-xl font-black text-slate-800">Auto-Crop</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Zero Margin Waste</span>
                  </div>
                  <div className="flex flex-col items-center border-l border-slate-100">
                    <span className="text-xl font-black text-slate-800">Perfect DPI</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Crisp Fonts Resized</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-[32px] shadow-xl border border-slate-800 flex flex-col gap-6">
                <div className="flex justify-between items-center pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-2xl border border-emerald-500/30">
                      <Scissors className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-black tracking-tight flex items-center gap-2">
                        PDF Layout Optimizer
                        <span className="bg-green-400 text-slate-950 font-black font-mono text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">Active</span>
                      </h2>
                      <p className="text-[11px] text-slate-400 max-w-[220px] sm:max-w-xs truncate font-mono mt-0.5" title={pdfFileName}>
                        📄 {pdfFileName}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setPdfBuffer(null);
                      setPdfFileName('');
                      setPdfPageCount(0);
                      setPdfCroppedCanvas(null);
                      setPdfCanvas(null);
                      setPdfCroppedUrl('');
                      setShowPdfPreviewTab(false);
                    }}
                    className="px-4 py-2 bg-white/10 hover:bg-red-500 hover:text-white text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95"
                  >
                    Clear PDF
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Fine Tuning Controls */}
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-5">
                    <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5 border-b border-white/5 pb-2">
                      <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                      Marginal Trimming Controls
                    </h3>

                    {/* Page Selector if multi-page */}
                    {pdfPageCount > 1 && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] items-center justify-between flex font-black text-slate-400 uppercase tracking-wider">
                          <span>Select PDF Page</span>
                          <span className="font-mono text-white text-[11px] bg-slate-800 px-1.5 py-0.5 rounded font-black">{pdfCurrentPage} of {pdfPageCount}</span>
                        </label>
                        <div className="flex gap-2 items-center">
                          <button
                            disabled={pdfCurrentPage <= 1}
                            onClick={() => setPdfCurrentPage(prev => Math.max(1, prev - 1))}
                            className="p-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 transition-all text-white shrink-0"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <input
                            type="range"
                            min="1"
                            max={pdfPageCount}
                            value={pdfCurrentPage}
                            onChange={(e) => setPdfCurrentPage(parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                          />
                          <button
                            disabled={pdfCurrentPage >= pdfPageCount}
                            onClick={() => setPdfCurrentPage(prev => Math.min(pdfPageCount, prev + 1))}
                            className="p-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 transition-all text-white shrink-0"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Crop Detection Mode Selector */}
                    <div className="space-y-1.5 font-sans">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Crop Boundary Engine</span>
                      <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl border border-white/10">
                        <button
                          type="button"
                          onClick={() => setPdfCropMode('AUTO')}
                          className={`py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                            pdfCropMode === 'AUTO'
                              ? 'bg-emerald-600 text-white shadow-md'
                              : 'text-slate-400 hover:text-white bg-transparent hover:bg-white/5'
                          }`}
                        >
                          Auto Detect (AI)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            // Copy currently visible auto crop coordinates into manual controls so the user doesn't start from 0!
                            setPdfCropMode('MANUAL');
                            setManualCropLeft(Math.max(0, Math.floor(pdfCropRect.left)));
                            setManualCropTop(Math.max(0, Math.floor(pdfCropRect.top)));
                            setManualCropRight(Math.min(100, Math.ceil(pdfCropRect.left + pdfCropRect.width)));
                            setManualCropBottom(Math.min(100, Math.ceil(pdfCropRect.top + pdfCropRect.height)));
                          }}
                          className={`py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                            pdfCropMode === 'MANUAL'
                              ? 'bg-emerald-600 text-white shadow-md'
                              : 'text-slate-400 hover:text-white bg-transparent hover:bg-white/5'
                          }`}
                        >
                          Manual Crop Box
                        </button>
                      </div>
                    </div>

                    {/* Threshold Slider (Ink Sensitivity) */}
                    <div className="space-y-1.5 font-sans">
                      <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        <span>Ink Sensitivity Threshold</span>
                        <span className="font-mono text-emerald-400 font-bold">{pdfThreshold}</span>
                      </div>
                      <input
                        type="range"
                        min="160"
                        max="253"
                        value={pdfThreshold}
                        onChange={(e) => setPdfThreshold(parseInt(e.target.value))}
                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                      <div className="text-[9px] text-slate-500 italic leading-snug">
                        Decrease slightly if gray scanner lines or paper folds get picked up. Increase if light text fades.
                      </div>
                    </div>

                    {pdfCropMode === 'AUTO' ? (
                      /* Border Padding Slider (only in AUTO mode) */
                      <div className="space-y-1.5 font-sans">
                        <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          <span>Safe-Crop Border Cushion</span>
                          <span className="font-mono text-emerald-400 font-bold">{pdfPadding} px</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="25"
                          value={pdfPadding}
                          onChange={(e) => setPdfPadding(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <div className="text-[9px] text-slate-500 italic leading-snug">
                          Add fine padding cushion around cropped bounding box to prevent character edge truncation.
                        </div>
                      </div>
                    ) : (
                      /* Manual Crop Coordinate Sliders */
                      <div className="bg-slate-950/40 p-3.5 rounded-xl border border-white/5 space-y-4">
                        <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">Manual Frame Adjusters</span>
                          <button
                            type="button"
                            onClick={() => {
                              // Reset to safe defaults
                              setManualCropLeft(5);
                              setManualCropTop(5);
                              setManualCropRight(95);
                              setManualCropBottom(95);
                            }}
                            className="text-[9px] font-black uppercase text-slate-500 hover:text-white transition-all underline shrink-0 cursor-pointer"
                          >
                            Reset Frame
                          </button>
                        </div>

                        {/* Top Edge */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] font-bold text-slate-400">
                            <span>Top Margin (Crop down)</span>
                            <span className="font-mono text-emerald-400">{manualCropTop}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max={Math.min(90, manualCropBottom - 5)}
                            value={manualCropTop}
                            onChange={(e) => setManualCropTop(parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                          />
                        </div>

                        {/* Bottom Edge */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] font-bold text-slate-400">
                            <span>Bottom Margin (Crop up)</span>
                            <span className="font-mono text-emerald-400">{manualCropBottom}%</span>
                          </div>
                          <input
                            type="range"
                            min={Math.max(10, manualCropTop + 5)}
                            max="100"
                            value={manualCropBottom}
                            onChange={(e) => setManualCropBottom(parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                          />
                        </div>

                        {/* Left Edge */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] font-bold text-slate-400">
                            <span>Left Margin (Crop right)</span>
                            <span className="font-mono text-emerald-400">{manualCropLeft}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max={Math.min(90, manualCropRight - 5)}
                            value={manualCropLeft}
                            onChange={(e) => setManualCropLeft(parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                          />
                        </div>

                        {/* Right Edge */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] font-bold text-slate-400">
                            <span>Right Margin (Crop left)</span>
                            <span className="font-mono text-emerald-400">{manualCropRight}%</span>
                          </div>
                          <input
                            type="range"
                            min={Math.max(10, manualCropLeft + 5)}
                            max="100"
                            value={manualCropRight}
                            onChange={(e) => setManualCropRight(parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Output roll width & Stats */}
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5 border-b border-white/5 pb-2">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        Roll Resolution Optimizer
                      </h3>

                      {/* Resolution Preset / Roll Width */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Target Roll Standard</span>
                        <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-white/10">
                          {[
                            { width: 384, label: '2" (58mm)' },
                            { width: 512, label: '2.5"' },
                            { width: 576, label: '3" (80mm)' }
                          ].map((opt) => (
                            <button
                              key={opt.width}
                              onClick={() => setPdfPrinterWidth(opt.width)}
                              className={`py-2 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                                pdfPrinterWidth === opt.width
                                  ? 'bg-emerald-600 text-white shadow-md'
                                  : 'text-slate-400 hover:text-white bg-transparent hover:bg-white/5'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Dither Simulator */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Monochrome Bitmask Mode</span>
                          <span className="text-[9px] text-slate-400/60 italic leading-snug">Simulate pure absolute monochrome thermal printing</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPdfDitherMock(!pdfDitherMock)}
                          className={`w-10 h-6 rounded-full p-1 transition-colors shrink-0 ${
                            pdfDitherMock ? 'bg-emerald-500' : 'bg-slate-700'
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow transition-transform ${
                              pdfDitherMock ? 'transform translate-x-4' : ''
                            }`}
                          />
                        </button>
                      </div>

                      {/* Print Text Boldiness and Clarity Selector */}
                      <div className="space-y-1.5 pt-2 border-t border-white/5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Print Text Boldness</span>
                          <span className="font-mono text-emerald-400 font-bold">
                            {pdfBoldness === 0 ? 'Off (Crisp Thin)' : pdfBoldness === 1 ? 'Light Bold (+1px)' : pdfBoldness === 2 ? 'Medium Bold (+2px)' : 'Heavy Bold (+3px)'}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-xl border border-white/10">
                          {[
                            { value: 0, label: 'Off' },
                            { value: 1, label: 'Light' },
                            { value: 2, label: 'Mid' },
                            { value: 3, label: 'Heavy' }
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setPdfBoldness(opt.value)}
                              className={`py-1 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                                pdfBoldness === opt.value
                                  ? 'bg-emerald-600 text-white shadow-md'
                                  : 'text-slate-400 hover:text-white bg-transparent hover:bg-white/5'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <div className="text-[9px] text-slate-500 italic leading-snug">
                          Applies pixel-dilation thickness & high contrast to character bodies, ensuring clear physical transfer without gray blur.
                        </div>
                      </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="bg-slate-950 p-3 rounded-xl border border-white/5 text-[10px] space-y-1.5 font-sans">
                      <span className="text-slate-400 font-bold uppercase tracking-wider block border-b border-white/5 pb-1">Optimization metrics</span>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">Original Resolution:</span>
                        <span>{originalPdfDims.w} x {originalPdfDims.h} px</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">Content Cropbox:</span>
                        <span>{croppedPdfDims.w} x {croppedPdfDims.h} px</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-emerald-300 font-bold">Unused Margin Trimmed:</span>
                        <span className="text-green-400 font-black">
                          {Math.max(0, Math.round(100 - (croppedPdfDims.w * croppedPdfDims.h) / (originalPdfDims.w * originalPdfDims.h) * 100))}% saved
                        </span>
                      </div>
                      <div className="flex justify-between font-mono border-t border-dashed border-white/10 pt-1.5 text-[11px] font-black text-emerald-400">
                        <span>Final Print Density:</span>
                        <span className="font-bold text-white">{pdfPrinterWidth} x {pdfCroppedCanvas ? pdfCroppedCanvas.height : '...'} px</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/5">
                  <button
                    onClick={handlePrintPdf}
                    disabled={isProcessingPdf}
                    className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/20 text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer shadow-emerald-500/10"
                  >
                    <Printer className="w-5 h-5 shrink-0" />
                    PRINT CROPPED GRAPHICS
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right panel: Live Compared Visualizer (4/5 columns) */}
          <div className="lg:col-span-5 xl:col-span-4 sticky top-24 self-start">
            {pdfBuffer === null ? (
              <div className="bg-white rounded-[32px] p-8 border border-slate-200 text-center shadow-sm flex flex-col items-center justify-center min-h-[300px]">
                <FileText className="w-12 h-12 text-slate-300 mb-4 animate-pulse" />
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Awaiting PDF Document</h4>
                <p className="text-xs text-slate-400 max-w-xs mt-2 leading-relaxed font-semibold">
                  Upload or drop an invoice PDF in the left panel to trigger automatic cropping boundaries & side-by-side previews.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                
                {/* 1. Original Document Annotated Preview */}
                <div className="bg-white p-5 rounded-[32px] border border-slate-200 shadow-sm flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 select-none">
                    <Eye className="w-3.5 h-3.5 text-emerald-500" />
                    Original annotated PDF page
                  </span>
                  
                  <div className="relative bg-slate-950 rounded-2xl p-1.5 border border-slate-900 overflow-hidden flex items-center justify-center aspect-auto w-full">
                    {pdfProcessingError ? (
                      <div className="py-12 px-6 text-center text-red-400 font-mono text-xs max-w-sm space-y-3">
                        <span className="font-black text-sm uppercase block text-red-500">❌ Error Processing PDF</span>
                        <p className="leading-relaxed text-slate-300">{pdfProcessingError}</p>
                        <p className="text-[10px] text-slate-505 font-sans">Verify this is a standard valid digital PDF document.</p>
                      </div>
                    ) : pdfOriginalUrl ? (
                      <div className="relative max-h-[340px] max-w-full rounded-lg overflow-hidden flex items-center justify-center">
                        <img 
                          src={pdfOriginalUrl} 
                          alt="Original Page view" 
                          referrerPolicy="no-referrer"
                          className="max-h-[340px] w-auto h-auto object-contain select-none opacity-85 block" 
                        />
                        
                        {/* Live Crop Box Overlay! */}
                        <div 
                          className="absolute border-2 border-dashed border-emerald-400 bg-emerald-400/20 rounded shadow-[0_0_15px_rgba(52,211,153,0.45)] transition-all duration-300 ease-out z-20 pointer-events-none" 
                          style={{
                            left: `${pdfCropRect.left}%`,
                            top: `${pdfCropRect.top}%`,
                            width: `${pdfCropRect.width}%`,
                            height: `${pdfCropRect.height}%`
                          }}
                        >
                          {/* Corner Targets */}
                          <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-emerald-400"></div>
                          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-emerald-400"></div>
                          <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-emerald-400"></div>
                          <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-emerald-400"></div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-20 text-slate-400 text-xs font-mono font-black animate-pulse uppercase tracking-wider">Rendering PDF Scene...</div>
                    )}
                  </div>
                  <div className="text-[9px] text-slate-400/80 mt-2.5 font-bold leading-normal flex items-center gap-1 select-none">
                    <Info className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>THE EMERALD DASHED BOX HIGHLIGHTS AUTOMATICALLY EXTRACTED PRINT REGIONS.</span>
                  </div>
                </div>

                {/* 2. Processed Receipt Tape Output Preview */}
                <div className="bg-white p-5 rounded-[32px] border border-slate-200 shadow-sm flex flex-col items-center">
                  <div className="w-full flex justify-between items-center mb-3 text-slate-400">
                    <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 select-none">
                      <Printer className="w-3.5 h-3.5 text-emerald-500" />
                      Digital Thermal tape output
                    </span>
                  </div>
                  
                  <div className="relative group p-0.5 w-full bg-white rounded-[24px] shadow border border-slate-200 overflow-hidden flex flex-col items-center">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-900/5 to-slate-900/10 pointer-events-none z-10 opacity-30"></div>
                    
                    <div className="p-4 bg-white/95 text-slate-800 font-mono text-[11px] leading-tight flex flex-col items-center w-full">
                      <div className="w-full overflow-hidden border border-dashed border-slate-200 p-0.5 rounded-lg bg-white relative">
                        {pdfCroppedUrl ? (
                          <img 
                            src={pdfCroppedUrl} 
                            alt="Cropped Output" 
                            referrerPolicy="no-referrer"
                            style={{
                              filter: pdfDitherMock 
                                ? 'contrast(3.5) brightness(0.95) grayscale(100%)' 
                                : 'contrast(1.5) brightness(0.99)'
                            }}
                            className="w-full h-auto object-contain select-none mix-blend-multiply transition-all" 
                          />
                        ) : (
                          <div className="py-12 text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider select-none animate-pulse">
                            Waiting for cropped image output...
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Serrated Edge Bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-4 bg-[radial-gradient(circle_at_2px_0,transparent_1.5px,white_2px)] bg-[length:4px_4px]"></div>
                  </div>
                  
                  <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest text-center mt-3 font-mono">
                    READY FOR {pdfPrinterWidth}px OUTPUT HEADS
                  </div>
                </div>

              </div>
            )}
          </div>
        </motion.main>
      )}
      </AnimatePresence>

      {/* Floating Scanner Modal */}
      <AnimatePresence>
        {isScanning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[60] flex items-center justify-center p-4"
          >
            <div className="bg-white p-6 rounded-[40px] w-full max-w-sm overflow-hidden shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black tracking-tight">Scan Payment QR</h3>
                <button 
                  onClick={stopScanner}
                  className="bg-slate-100 p-2 rounded-full hover:bg-slate-200 text-slate-600"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>
              <div id="reader" className="w-full rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-lg mb-6"></div>
              <div className="flex items-center gap-3 bg-amber-50 p-4 rounded-2xl text-amber-600 border border-amber-100">
                <Smartphone className="w-6 h-6 shrink-0" />
                <p className="text-xs font-bold leading-normal">Place the UPI QR code within the frame to capture payment details.</p>
              </div>
            </div>
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
                Active Username: <strong className="text-slate-600 font-bold">{localStorage.getItem('tinyprint_username') || 'admin'}</strong>
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
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowQuickReprintModal(false)}
                  className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer border-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleQuickPrint}
                  className={`py-3 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer border-none flex items-center justify-center gap-2 shadow-lg ${
                    isPrinterConnected 
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10' 
                      : 'bg-emerald-400 cursor-not-allowed opacity-75'
                  }`}
                  disabled={!isPrinterConnected}
                  title={!isPrinterConnected ? "Connect printer to print" : "Send to printer"}
                >
                  <Printer className="w-4 h-4 shrink-0" />
                  Print Now
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
