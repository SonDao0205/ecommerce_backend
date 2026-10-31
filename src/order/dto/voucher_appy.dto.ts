export type OrderPriceInput = {
  /** Subtotal do OrderService tính từ các order item, không lấy trực tiếp từ client. */
  subtotal: string;
  /** Không truyền mã nào thì voucher service trả lại nguyên subtotal. */
  voucher_codes?: string[];
  /** Bắt buộc khi áp dụng voucher scope SHOP. */
  shop_id?: string;
};
