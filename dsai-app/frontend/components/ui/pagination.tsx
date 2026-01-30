import { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

export interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onPageChange: (page: number) => void;
  labels?: {
    range?: string;
    zero?: string;
    prev?: string;
    next?: string;
    perPage?: string;
    goToPage?: string;
    of?: string;
  };
  onPageSizeChange?: (limit: number) => void;
  pageSizeOptions?: number[];
}

export function TablePagination({
  page,
  limit,
  total,
  hasNextPage,
  hasPreviousPage,
  onPageChange,
  labels,
  onPageSizeChange,
  pageSizeOptions,
}: PaginationProps) {
  const [pageInput, setPageInput] = useState('');
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = total === 0 ? 0 : Math.min(total, page * limit);
  const totalPages = Math.ceil(total / limit) || 1;
  const zeroLabel = labels?.zero ?? '0 results';
  const rangeLabel = labels?.range ?? 'Showing {start}-{end} of {total}';
  const prevLabel = labels?.prev ?? 'Previous page';
  const nextLabel = labels?.next ?? 'Next page';
  const perPageLabel = labels?.perPage ?? 'Rows per page';
  const goToPageLabel = labels?.goToPage ?? 'Go to page';
  const ofLabel = labels?.of ?? 'of';

  const defaultOptions = pageSizeOptions ?? [10, 25, 50];
  const sizeOptions = Array.from(new Set([...defaultOptions, limit])).sort(
    (a, b) => a - b,
  );

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const targetPage = parseInt(pageInput, 10);
      if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages) {
        onPageChange(targetPage);
        setPageInput('');
      }
    }
  };

  const handleGoToPage = () => {
    const targetPage = parseInt(pageInput, 10);
    if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages) {
      onPageChange(targetPage);
      setPageInput('');
    }
  };

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (page > 3) {
        pages.push('...');
      }

      // Show pages around current page
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (page < totalPages - 2) {
        pages.push('...');
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        {total === 0
          ? zeroLabel
          : rangeLabel
              .replace('{start}', String(startItem))
              .replace('{end}', String(endItem))
              .replace('{total}', String(total))}
        {onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <span>{perPageLabel}</span>
            <Select
              value={String(limit)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-9 w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sizeOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {/* First page button */}
        <Button
          variant="outline"
          size="icon"
          disabled={page === 1}
          onClick={() => onPageChange(1)}
          aria-label="First page"
          className="hidden sm:flex"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* Previous page button */}
        <Button
          variant="outline"
          size="icon"
          disabled={!hasPreviousPage}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          aria-label={prevLabel}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Page numbers */}
        <div className="hidden items-center gap-1 md:flex">
          {getPageNumbers().map((pageNum, idx) => (
            typeof pageNum === 'number' ? (
              <Button
                key={idx}
                variant={pageNum === page ? 'default' : 'outline'}
                size="sm"
                className="h-9 w-9"
                onClick={() => onPageChange(pageNum)}
              >
                {pageNum}
              </Button>
            ) : (
              <span key={idx} className="px-2 text-muted-foreground">
                {pageNum}
              </span>
            )
          ))}
        </div>

        {/* Mobile page indicator */}
        <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground md:hidden">
          {page} {ofLabel} {totalPages}
        </span>

        {/* Next page button */}
        <Button
          variant="outline"
          size="icon"
          disabled={!hasNextPage}
          onClick={() => onPageChange(page + 1)}
          aria-label={nextLabel}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Last page button */}
        <Button
          variant="outline"
          size="icon"
          disabled={page === totalPages}
          onClick={() => onPageChange(totalPages)}
          aria-label="Last page"
          className="hidden sm:flex"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>

        {/* Go to page input */}
        {totalPages > 5 && (
          <div className="ml-2 hidden items-center gap-2 lg:flex">
            <span className="text-sm text-muted-foreground">{goToPageLabel}:</span>
            <Input
              type="number"
              min={1}
              max={totalPages}
              value={pageInput}
              onChange={handlePageInputChange}
              onKeyDown={handlePageInputKeyDown}
              placeholder={String(page)}
              className="h-9 w-16 text-center"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleGoToPage}
              disabled={!pageInput || parseInt(pageInput, 10) < 1 || parseInt(pageInput, 10) > totalPages}
            >
              Go
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
