'use client';

import { useState, useMemo, useTransition, useEffect, useCallback } from 'react';
import type { MasterHotelRateItem } from '@/lib/excel/master-parser';
import type { RateMasterQueryResult, MasterFilterOptions } from '@/lib/services/master-rates-db';
import {
  uploadMasterExcelAction,
  getMasterRatesAction,
  deleteMasterRateAction,
} from './actions';
import {
  Upload,
  Search,
  X,
  Trash2,
  FileSpreadsheet,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  MapPin,
  Calendar,
  Database,
  ArrowUpDown,
  Building2,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';

interface MasterClientProps {
  initialData: RateMasterQueryResult;
  filterOptions: MasterFilterOptions;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function TableSkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <tr key={idx} className="animate-pulse">
          {/* Location */}
          <td className="py-3 px-3 whitespace-nowrap">
            <div className="h-4 w-20 rounded-md bg-ink-200/60" />
          </td>
          {/* Hotel Name */}
          <td className="py-3 px-3 whitespace-nowrap">
            <div className="h-4 w-36 rounded-md bg-ink-200/60" />
          </td>
          {/* Category */}
          <td className="py-3 px-3 whitespace-nowrap">
            <div className="h-4 w-16 rounded-md bg-ink-100" />
          </td>
          {/* Season */}
          <td className="py-3 px-3 whitespace-nowrap">
            <div className="h-4 w-24 rounded-md bg-ink-100" />
          </td>
          {/* Date Range */}
          <td className="py-3 px-3 whitespace-nowrap">
            <div className="h-4 w-32 rounded-md bg-ink-100" />
          </td>
          {/* Room Category */}
          <td className="py-3 px-3 whitespace-nowrap">
            <div className="h-4 w-28 rounded-md bg-ink-100" />
          </td>
          {/* CP Cost */}
          <td className="py-3 px-3 text-right whitespace-nowrap">
            <div className="h-4 w-16 rounded-md bg-ink-200/60 ml-auto" />
          </td>
          {/* MAP Cost */}
          <td className="py-3 px-3 text-right whitespace-nowrap">
            <div className="h-4 w-16 rounded-md bg-ink-200/60 ml-auto" />
          </td>
          {/* Extra Adult CP */}
          <td className="py-3 px-3 text-right whitespace-nowrap">
            <div className="h-4 w-14 rounded-md bg-ink-100 ml-auto" />
          </td>
          {/* Extra Adult MAP */}
          <td className="py-3 px-3 text-right whitespace-nowrap">
            <div className="h-4 w-14 rounded-md bg-ink-100 ml-auto" />
          </td>
          {/* Child Bed */}
          <td className="py-3 px-3 text-right whitespace-nowrap">
            <div className="h-4 w-14 rounded-md bg-ink-100 ml-auto" />
          </td>
          {/* Child No Bed */}
          <td className="py-3 px-3 text-right whitespace-nowrap">
            <div className="h-4 w-14 rounded-md bg-ink-100 ml-auto" />
          </td>
          {/* Infant Policy */}
          <td className="py-3 px-3">
            <div className="h-4 w-20 rounded-md bg-ink-100" />
          </td>
          {/* Mandatory Surcharges */}
          <td className="py-3 px-3">
            <div className="h-4 w-24 rounded-md bg-ink-100" />
          </td>
          {/* Notes */}
          <td className="py-3 px-3">
            <div className="h-4 w-20 rounded-md bg-ink-100" />
          </td>
          {/* Action */}
          <td className="py-3 px-3 text-center whitespace-nowrap">
            <div className="h-6 w-6 rounded-lg bg-ink-100 mx-auto" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function MasterClient({ initialData, filterOptions }: MasterClientProps) {
  const [rates, setRates] = useState<MasterHotelRateItem[]>(initialData.data);
  const [totalCount, setTotalCount] = useState<number>(initialData.total);
  const [totalPages, setTotalPages] = useState<number>(initialData.totalPages);
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  // Modal states
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Row Delete Confirmation Modal state
  const [itemToDelete, setItemToDelete] = useState<MasterHotelRateItem | null>(null);

  // Search & Filter states
  const [globalSearch, setGlobalSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [hotelFilter, setHotelFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [seasonFilter, setSeasonFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState('');

  // Pagination & Sort states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<string>('location');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (globalSearch) count++;
    if (locationFilter) count++;
    if (hotelFilter) count++;
    if (categoryFilter) count++;
    if (seasonFilter) count++;
    if (roomFilter) count++;
    if (dateRangeFilter) count++;
    return count;
  }, [
    globalSearch,
    locationFilter,
    hotelFilter,
    categoryFilter,
    seasonFilter,
    roomFilter,
    dateRangeFilter,
  ]);

  // Load rates from DB with current filters and pagination
  const loadRates = useCallback(
    async (pageToLoad = currentPage, sizeToLoad = pageSize) => {
      setIsLoading(true);
      try {
        const res = await getMasterRatesAction({
          search: globalSearch,
          location: locationFilter,
          hotelName: hotelFilter,
          hotelCategory: categoryFilter,
          season: seasonFilter,
          roomCategory: roomFilter,
          dateRange: dateRangeFilter,
          page: pageToLoad,
          pageSize: sizeToLoad,
          sortBy,
          sortOrder,
        });

        setRates(res.data);
        setTotalCount(res.total);
        setTotalPages(res.totalPages);
        setCurrentPage(res.page);
      } catch (err) {
        console.error('Failed to load master rates from DB:', err);
        toast.error('Failed to load rates from database.');
      } finally {
        setIsLoading(false);
      }
    },
    [
      currentPage,
      pageSize,
      globalSearch,
      locationFilter,
      hotelFilter,
      categoryFilter,
      seasonFilter,
      roomFilter,
      dateRangeFilter,
      sortBy,
      sortOrder,
    ]
  );

  // Debounced / Triggered reload when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      loadRates(1, pageSize);
    }, 250);
    return () => clearTimeout(timer);
  }, [
    globalSearch,
    locationFilter,
    hotelFilter,
    categoryFilter,
    seasonFilter,
    roomFilter,
    dateRangeFilter,
    sortBy,
    sortOrder,
  ]);

  const resetFilters = () => {
    setGlobalSearch('');
    setLocationFilter('');
    setHotelFilter('');
    setCategoryFilter('');
    setSeasonFilter('');
    setRoomFilter('');
    setDateRangeFilter('');
    setCurrentPage(1);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Format currency
  const formatCost = (val: number | null) => {
    if (val === null || val === undefined) return '—';
    return `₹${val.toLocaleString('en-IN')}`;
  };

  // Handle File Upload Submit
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select an Excel file first.');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await uploadMasterExcelAction(formData);

      if (res.success) {
        setIsUploadOpen(false);
        setSelectedFile(null);

        const ins = res.insertedCount ?? 0;
        const upd = res.updatedCount ?? 0;
        const skp = res.skippedCount ?? 0;

        if (ins > 0 && upd === 0 && skp === 0) {
          toast.success(`Imported ${ins.toLocaleString('en-IN')} new hotel rates into the database!`);
        } else if (ins === 0 && upd === 0 && skp > 0) {
          toast.info(`All ${skp.toLocaleString('en-IN')} rates in the file are already up to date. No duplicate rows added.`);
        } else if (ins === 0 && upd > 0 && skp === 0) {
          toast.success(`Updated ${upd.toLocaleString('en-IN')} hotel rates with new prices/details.`);
        } else {
          toast.success(
            `Import complete: ${ins} added, ${upd} updated, ${skp} unchanged records skipped.`
          );
        }

        loadRates(1, pageSize);
      } else {
        toast.error(res.errors?.[0] || 'Excel upload failed. Please check the file format.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Confirm Delete Single Row
  const handleConfirmDeleteRow = () => {
    if (!itemToDelete?.id) return;
    const targetId = itemToDelete.id;
    const hotelDesc = itemToDelete.hotelName || 'hotel rate';
    setItemToDelete(null);

    startTransition(async () => {
      const res = await deleteMasterRateAction(targetId);
      if (res.success) {
        toast.success(`Deleted rate record for ${hotelDesc}.`);
        loadRates(currentPage, pageSize);
      } else {
        toast.error(res.error || 'Failed to delete record.');
      }
    });
  };

  return (
    <div className="font-sans space-y-6 antialiased text-ink-900">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-ink-100 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-ink-950">
              Master Data
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200/60 px-3 py-0.5 text-xs font-semibold text-brand-800 shadow-xs">
              <Database className="h-3.5 w-3.5 text-brand-600" />
              {totalCount.toLocaleString('en-IN')} {totalCount === 1 ? 'Rate' : 'Rates'}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-500 font-normal">
            Hotel tariffs, seasonal meal plans, room categories, and contract rates.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setSelectedFile(null);
              setIsUploadOpen(true);
            }}
            className="btn-primary inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 shadow-sm hover:shadow-md transition-all rounded-xl"
          >
            <Upload className="h-4 w-4" />
            Upload Excel
          </button>
        </div>
      </div>

      {/* Upload Excel Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card w-full max-w-lg overflow-hidden shadow-2xl rounded-2xl border border-ink-200/80 animate-in zoom-in-95 duration-200 bg-white">
            <div className="flex items-center justify-between border-b border-ink-100 bg-sand-50/50 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100/80 text-brand-800 shadow-xs">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-ink-900">
                    Upload Rate Master Excel
                  </h3>
                  <p className="text-xs text-ink-500">
                    Supports .xlsx and .xls files with Rate Master tab
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isUploading && setIsUploadOpen(false)}
                className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFileUpload} className="p-6 space-y-5">
              {/* File Dropzone */}
              <div className="relative rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/40 p-8 text-center transition-all hover:border-brand-500 hover:bg-brand-50/30">
                <input
                  type="file"
                  accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setSelectedFile(f);
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  disabled={isUploading}
                />
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 shadow-inner">
                    <Upload className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink-800">
                      {selectedFile ? selectedFile.name : 'Click to browse or drop Excel file here'}
                    </p>
                    <p className="mt-1 text-xs text-ink-400">
                      {selectedFile
                        ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                        : '.xlsx or .xls files up to 15MB'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="btn-ghost text-sm font-medium px-4 py-2"
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || isUploading}
                  className="btn-primary inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl shadow-xs"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Importing to Database…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload & Save
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Row Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card w-full max-w-md overflow-hidden shadow-2xl rounded-2xl border border-ink-200 bg-white p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-semibold text-ink-950">
                  Delete Hotel Rate?
                </h3>
                <p className="text-xs text-ink-600 leading-relaxed">
                  Are you sure you want to delete the rate for{' '}
                  <strong className="text-ink-900 font-semibold">{itemToDelete.hotelName || 'this hotel'}</strong>{' '}
                  ({itemToDelete.roomCategory || 'Standard Room'}
                  {itemToDelete.dateRange ? ` • ${itemToDelete.dateRange}` : ''})?
                </p>
                <p className="text-[11px] text-ink-400">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-ink-100">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="btn-ghost text-xs font-medium px-3.5 py-2"
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRow}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 transition-colors shadow-xs"
              >
                {isPending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Yes, Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="card p-4 space-y-3.5 rounded-2xl border border-ink-200/80 shadow-xs bg-white">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Global Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              placeholder="Search by hotel name, location, room category, notes..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="input pl-10 h-10 text-sm rounded-xl"
            />
            {globalSearch && (
              <button
                type="button"
                onClick={() => setGlobalSearch('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 p-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Active filters pill */}
          <div className="flex items-center gap-2 shrink-0">
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 rounded-xl border border-coral-200 bg-coral-50/80 px-3 py-1.5 text-xs font-semibold text-coral-800 hover:bg-coral-100 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Clear {activeFiltersCount} Filters
              </button>
            )}
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 pt-1">
          {/* Location filter */}
          <div>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="input h-9 py-1 text-xs text-ink-700 rounded-lg"
            >
              <option value="">All Locations</option>
              {filterOptions.locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Hotel Category filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input h-9 py-1 text-xs text-ink-700 rounded-lg"
            >
              <option value="">All Categories</option>
              {filterOptions.hotelCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Season filter */}
          <div>
            <select
              value={seasonFilter}
              onChange={(e) => setSeasonFilter(e.target.value)}
              className="input h-9 py-1 text-xs text-ink-700 rounded-lg"
            >
              <option value="">All Seasons</option>
              {filterOptions.seasons.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Room Category filter */}
          <div>
            <input
              type="text"
              placeholder="Filter Room..."
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="input h-9 py-1 text-xs rounded-lg"
            />
          </div>

          {/* Hotel Name search filter */}
          <div>
            <input
              type="text"
              placeholder="Filter Hotel..."
              value={hotelFilter}
              onChange={(e) => setHotelFilter(e.target.value)}
              className="input h-9 py-1 text-xs rounded-lg"
            />
          </div>

          {/* Date range filter */}
          <div>
            <input
              type="text"
              placeholder="Filter Date..."
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
              className="input h-9 py-1 text-xs rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card overflow-hidden relative rounded-2xl border border-ink-200/80 shadow-xs bg-white">
        {/* Responsive Table summary bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-sand-50/40 px-4 py-3 text-xs text-ink-600">
          <span>
            Showing{' '}
            <strong className="text-ink-900 font-semibold">
              {totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              -
              {Math.min(currentPage * pageSize, totalCount)}
            </strong>{' '}
            of <strong className="text-ink-900 font-semibold">{totalCount.toLocaleString('en-IN')}</strong> database records
          </span>

          <div className="flex items-center gap-2">
            <span className="text-ink-500">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                setPageSize(newSize);
                loadRates(1, newSize);
              }}
              className="h-8 rounded-lg border border-ink-200 bg-white pl-2.5 pr-[1.625rem] text-xs text-ink-800 font-medium focus:border-brand-500 focus:outline-none cursor-pointer"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} rows
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Data Table / Empty State */}
        {!isLoading && rates.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 mb-3 shadow-inner">
              <Database className="h-7 w-7" />
            </div>
            <h3 className="text-base font-semibold text-ink-900">
              {totalCount === 0
                ? 'No Master Rates in Database'
                : 'No matching records found'}
            </h3>
            <p className="mt-1 max-w-md text-xs text-ink-500">
              {totalCount === 0
                ? 'Upload an Excel (.xlsx or .xls) file using the button above to import your hotel tariffs into the database.'
                : 'Try adjusting your search criteria or clear the active filters to view all records.'}
            </p>
            {totalCount === 0 ? (
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(true)}
                  className="btn-primary inline-flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-xl"
                >
                  <Upload className="h-4 w-4" />
                  Upload First Excel File
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={resetFilters}
                className="btn-outline mt-4 text-xs font-medium rounded-xl"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-ink-200 bg-sand-50/90 font-semibold text-ink-700 backdrop-blur-xs">
                <tr>
                  <th
                    onClick={() => handleSort('location')}
                    className="py-3 px-3 cursor-pointer select-none hover:text-brand-700 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      Location
                      <ArrowUpDown className="h-3 w-3 text-ink-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('hotelName')}
                    className="py-3 px-3 cursor-pointer select-none hover:text-brand-700 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      Hotel Name
                      <ArrowUpDown className="h-3 w-3 text-ink-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('hotelCategory')}
                    className="py-3 px-3 cursor-pointer select-none hover:text-brand-700 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      Category
                      <ArrowUpDown className="h-3 w-3 text-ink-400" />
                    </div>
                  </th>
                  <th className="py-3 px-3">Season</th>
                  <th className="py-3 px-3">Date Range</th>
                  <th
                    onClick={() => handleSort('roomCategory')}
                    className="py-3 px-3 cursor-pointer select-none hover:text-brand-700 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      Room Category
                      <ArrowUpDown className="h-3 w-3 text-ink-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('cpCost')}
                    className="py-3 px-3 text-right cursor-pointer select-none hover:text-brand-700 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1">
                      CP Cost
                      <ArrowUpDown className="h-3 w-3 text-ink-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('mapCost')}
                    className="py-3 px-3 text-right cursor-pointer select-none hover:text-brand-700 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1">
                      MAP Cost
                      <ArrowUpDown className="h-3 w-3 text-ink-400" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-right">Extra Adult (CP)</th>
                  <th className="py-3 px-3 text-right">Extra Adult (MAP)</th>
                  <th className="py-3 px-3 text-right">Child Bed</th>
                  <th className="py-3 px-3 text-right">Child No Bed</th>
                  <th className="py-3 px-3">Infant Policy</th>
                  <th className="py-3 px-3">Mandatory Surcharges</th>
                  <th className="py-3 px-3">Notes</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {isLoading ? (
                  <TableSkeletonRows count={Math.min(pageSize, 10)} />
                ) : (
                  rates.map((item, idx) => (
                  <tr
                    key={item.id || idx}
                    className="transition-colors hover:bg-sand-50/60"
                  >
                    {/* Location */}
                    <td className="py-2.5 px-3 font-medium text-ink-900 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                        {item.location || '—'}
                      </span>
                    </td>

                    {/* Hotel Name */}
                    <td className="py-2.5 px-3 font-semibold text-brand-900 whitespace-nowrap">
                      {item.hotelName || '—'}
                    </td>

                    {/* Hotel Category */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {item.hotelCategory ? (
                        <span className="inline-flex items-center rounded-lg bg-sand-100 px-2 py-0.5 text-[11px] font-medium text-sand-800">
                          {item.hotelCategory}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Season */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {item.season ? (
                        <span
                          className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold ${String(item.season).toLowerCase().includes('surge')
                            ? 'bg-purple-50 text-purple-700 border border-purple-200/60'
                            : String(item.season).toLowerCase().includes('peak')
                              ? 'bg-coral-50 text-coral-700 border border-coral-200/60'
                              : 'bg-ocean-50 text-ocean-700 border border-ocean-200/60'
                            }`}
                        >
                          {item.season}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Date Range */}
                    <td className="py-2.5 px-3 text-ink-600 whitespace-nowrap">
                      {item.dateRange ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px]">
                          <Calendar className="h-3.5 w-3.5 text-ink-400 shrink-0" />
                          {item.dateRange}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Room Category */}
                    <td className="py-2.5 px-3 text-ink-800 font-medium whitespace-nowrap">
                      {item.roomCategory || '—'}
                    </td>

                    {/* CP Cost */}
                    <td className="py-2.5 px-3 text-right font-semibold text-ink-950 whitespace-nowrap">
                      {formatCost(item.cpCost ?? null)}
                    </td>

                    {/* MAP Cost */}
                    <td className="py-2.5 px-3 text-right font-semibold text-brand-700 whitespace-nowrap">
                      {formatCost(item.mapCost ?? null)}
                    </td>

                    {/* Extra Adult CP */}
                    <td className="py-2.5 px-3 text-right text-ink-700 whitespace-nowrap">
                      {formatCost(item.extraAdultCP ?? null)}
                    </td>

                    {/* Extra Adult MAP */}
                    <td className="py-2.5 px-3 text-right text-ink-700 whitespace-nowrap">
                      {formatCost(item.extraAdultMAP ?? null)}
                    </td>

                    {/* Child Bed Cost */}
                    <td className="py-2.5 px-3 text-right text-ink-700 whitespace-nowrap">
                      {formatCost(item.childBedCost ?? null)}
                    </td>

                    {/* Child No Bed Cost */}
                    <td className="py-2.5 px-3 text-right text-ink-700 whitespace-nowrap">
                      {formatCost(item.childNoBedCost ?? null)}
                    </td>

                    {/* Infant Policy */}
                    <td className="py-2.5 px-3 text-ink-600 max-w-xs truncate" title={item.infantPolicy || ''}>
                      {item.infantPolicy || '—'}
                    </td>

                    {/* Mandatory Surcharges */}
                    <td className="py-2.5 px-3 text-ink-600 max-w-xs truncate" title={item.mandatorySurcharges || ''}>
                      {item.mandatorySurcharges || '—'}
                    </td>

                    {/* Notes */}
                    <td className="py-2.5 px-3 text-ink-600 max-w-xs truncate" title={item.notes || ''}>
                      {item.notes || '—'}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setItemToDelete(item)}
                        disabled={isPending || isLoading}
                        className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Delete this record"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 bg-white px-4 py-3">
            <span className="text-xs text-ink-500 font-medium">
              Page {currentPage} of {totalPages}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadRates(Math.max(1, currentPage - 1), pageSize)}
                disabled={currentPage === 1 || isLoading}
                className="btn-outline h-8 px-3 text-xs font-medium rounded-lg disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <button
                type="button"
                onClick={() => loadRates(Math.min(totalPages, currentPage + 1), pageSize)}
                disabled={currentPage >= totalPages || isLoading}
                className="btn-outline h-8 px-3 text-xs font-medium rounded-lg disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
