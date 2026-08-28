import { PaginatedData } from 'src/database/dtos/common/paginated_response.dto';

export function createPaginatedData<T>(
  items: T[],
  totalItems: number,
  page: number,
  limit: number,
): PaginatedData<T> {
  const totalPages = Math.ceil(totalItems / limit);

  return {
    items,
    meta: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}
