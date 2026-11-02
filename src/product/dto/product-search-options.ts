export type ProductSearchOptions = {
  search?: string;
  category_id?: string;
  shop_id?: string;
  sort_by?: 'price_asc' | 'price_desc';
  page: number;
  limit: number;
};
