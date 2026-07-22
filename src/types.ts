export type BillType = 'MART' | 'RESTAURANT' | 'PETROL';

export type PetrolCompany = 'JIO_BP' | 'HP' | 'BHARAT_PETROLEUM' | 'CUSTOM';

export interface ReceiptItem {
  id: string;
  name: string;
  quantity: number;
  rate: number;
  total: number;
}

export interface ReceiptData {
  type: BillType;
  companyName: string;
  address: string;
  phone: string;
  gstNumber?: string;
  date: string;
  time: string;
  billNumber: string;
  items: ReceiptItem[];
  subtotal: number;
  taxLabel: string;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentMode: string;
  petrolDetails?: {
    company: PetrolCompany;
    customLogoUrl?: string;
    telNo: string;
    receiptNo: string;
    fccId: string;
    fipNo: string;
    nozzleNo: string;
    product: string;
    ratePerLtr: number;
    volumeLtr: number;
    amount: number;
    vehType: string;
    vehicleNumber: string;
    customerName: string;
    lstNo: string;
    vatNo: string;
    attendantId: string;
  };
  qrValue?: string;
  fontSize: 'small' | 'medium' | 'large';
  fontStyle: 'normal' | 'condensed' | 'bold';
  restaurantLogo?: 'UTENSILS' | 'COFFEE' | 'PIZZA' | 'FLAME' | 'BAR' | 'NONE' | 'CUSTOM';
  restaurantCustomLogoUrl?: string;
  showGst?: boolean;
}

export interface HistoryItem {
  id: string;
  savedAt: string; // ISO string
  receiptData: ReceiptData;
}

