export type CreateOrderDto = {
  address_id: string;
  payment_method_id: string;
  shipping_method_id: string;
  items: Array<{
    product_variant_id: string;
    quantity: number;
  }>;
  voucher_codes?: string[];
  customer_note?: string;
};
