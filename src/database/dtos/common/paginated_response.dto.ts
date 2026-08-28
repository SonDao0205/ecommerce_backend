export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** Response data chuẩn cho mọi API getAll thuộc management. */
export interface PaginatedData<T> {
  items: T[];
  meta: PaginationMeta;
}
