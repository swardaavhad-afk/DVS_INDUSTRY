import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants';

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

/**
 * Parses and clamps raw query params into safe pagination values.
 */
export function parsePagination(rawPage?: unknown, rawPageSize?: unknown): PaginationParams {
  const page = Math.max(1, Number(rawPage) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(rawPageSize) || DEFAULT_PAGE_SIZE));

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}
