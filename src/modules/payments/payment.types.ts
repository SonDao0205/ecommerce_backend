import { PaymentMethod, PaymentProvider, PaymentStatus } from '@entities';

export interface PaymentView {
  id: string;
  orderId: string;
  amount: number;
  status: PaymentStatus;
  provider: PaymentProvider;
  method: PaymentMethod;
  invoiceNumber: string;
  providerOrderId: string | null;
  transactionId: string | null;
  currency: string;
  attemptNumber: number;
  expiresAt: Date | null;
  paidAt: Date | null;
  failedAt: Date | null;
  cancelledAt: Date | null;
  lastVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SepayCheckoutFields {
  merchant: string;
  operation: 'PURCHASE';
  payment_method: 'BANK_TRANSFER' | 'CARD' | 'NAPAS_BANK_TRANSFER';
  order_invoice_number: string;
  order_amount: string;
  currency: 'VND';
  order_description: string;
  customer_id: string;
  success_url: string;
  error_url: string;
  cancel_url: string;
  signature: string;
}

export interface SepayCheckout {
  actionUrl: string;
  fields: SepayCheckoutFields;
}

export interface SepayIpnPayload {
  timestamp: number;
  notificationType: 'ORDER_PAID' | 'TRANSACTION_VOID';
  order: {
    id: string;
    orderId: string;
    status: string;
    currency: string;
    amount: string;
    invoiceNumber: string;
  };
  transaction: {
    id: string;
    transactionId: string;
    status: string;
    amount: string;
    currency: string;
    paymentMethod: string;
    transactionDate: string | null;
  };
  raw: Record<string, unknown>;
}
