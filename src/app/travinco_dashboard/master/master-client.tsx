'use client';

import { useState, useMemo, useTransition, useEffect, useCallback, useRef } from 'react';
import type { MasterHotelRateItem } from '@/lib/excel/master-parser';
import type { RateMasterQueryResult, MasterFilterOptions } from '@/lib/services/master-rates-db';
import {
  uploadMasterExcelAction,
  getMasterRateByIdAction,
  deleteMasterRateAction,
  updateMasterRateAction,
} from './actions';
import {
  Upload,
  Search,
  X,
  Trash2,
  Pencil,
  FileSpreadsheet,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  MapPin,
  Calendar,
  Database,
  Building2,
  SlidersHorizontal,
  Download,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface MasterClientProps {
  initialData: RateMasterQueryResult;
  filterOptions: MasterFilterOptions;
  isAdmin?: boolean;
}

const PAGE_SIZE_OPTIONS = [20, 50, 100];

function TableSkeletonRows({ count = 8, isAdmin = false }: { count?: number; isAdmin?: boolean }) {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <tr key={idx} className="animate-pulse border-b border-ink-50">
          <td className="py-3 px-3.5">
            <div className="h-4 w-36 rounded-md bg-ink-200/60" />
            <div className="h-3 w-20 rounded-md bg-ink-100 mt-1" />
          </td>
          <td className="py-3 px-3.5">
            <div className="h-4 w-20 rounded-md bg-ink-100" />
            <div className="h-3 w-24 rounded-md bg-ink-100 mt-1" />
          </td>
          <td className="py-3 px-3.5">
            <div className="h-4 w-20 rounded-md bg-ink-100" />
          </td>
          <td className="py-3 px-3.5 text-right">
            <div className="h-4 w-16 rounded-md bg-ink-200/60 ml-auto" />
            <div className="h-4 w-16 rounded-md bg-ink-200/60 ml-auto mt-1" />
          </td>
          <td className="py-3 px-3.5 text-right">
            <div className="h-3 w-24 rounded-md bg-ink-100 ml-auto" />
            <div className="h-3 w-24 rounded-md bg-ink-100 ml-auto mt-1" />
          </td>
          <td className="py-3 px-3.5">
            <div className="h-4 w-28 rounded-md bg-ink-100" />
          </td>
          {isAdmin && (
            <td className="py-3 px-3.5 text-center">
              <div className="h-6 w-14 rounded-lg bg-ink-100 mx-auto" />
            </td>
          )}
        </tr>
      ))}
    </>
  );
}

export function MasterClient({ initialData, filterOptions, isAdmin = false }: MasterClientProps) {
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

  // Row Edit Modal state
  const [itemToEdit, setItemToEdit] = useState<MasterHotelRateItem | null>(null);
  const [editForm, setEditForm] = useState({
    cpCost: '',
    mapCost: '',
    extraAdultCP: '',
    extraAdultMAP: '',
    childBedCost: '',
    childNoBedCost: '',
    notes: '',
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);

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
  const [pageSize, setPageSize] = useState(20);
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

  // In-flight list request (aborted when superseded or when the page unmounts)
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  // Load rates from DB with current filters and pagination
  const loadRates = useCallback(
    async (pageToLoad = currentPage, sizeToLoad = pageSize) => {
      // Cancel any in-flight request (newer filters win; also avoids out-of-order results)
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      try {
        // Plain GET fetch instead of a Server Action: Server Actions are queued with
        // router navigations in Next 14, so a slow reload would block leaving the page.
        const qs = new URLSearchParams();
        const params: Record<string, string | number> = {
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
        };
        Object.entries(params).forEach(([k, v]) => {
          if (v !== '' && v !== undefined && v !== null) qs.set(k, String(v));
        });

        const response = await fetch(`/api/admin/master/rates?${qs.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const res = (await response.json()) as RateMasterQueryResult;

        setRates(res.data);
        setTotalCount(res.total);
        setTotalPages(res.totalPages);
        setCurrentPage(res.page);
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return; // superseded or page left
        console.error('Failed to load master rates from DB:', err);
        toast.error('Failed to load rates from database.');
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setIsLoading(false);
        }
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

  // Debounced / Triggered reload when filters change.
  // Skipped on first render: the server already streamed page 1 as initialData.
  // Compared by value (not a "first run" flag) so React Strict Mode's double effect doesn't refetch.
  const filterKey = JSON.stringify([
    pageSize, globalSearch, locationFilter, hotelFilter, categoryFilter,
    seasonFilter, roomFilter, dateRangeFilter, sortBy, sortOrder,
  ]);
  const lastFilterKey = useRef(filterKey);
  useEffect(() => {
    if (lastFilterKey.current === filterKey) return;
    lastFilterKey.current = filterKey;
    const timer = setTimeout(() => {
      loadRates(1, pageSize);
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
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

  // Handle Download Sample Excel Template
  const handleDownloadSampleTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const sampleData = [
        {
          'Location': 'Munnar',
          'Hotel Name': 'Tea Valley Resort',
          'Hotel Category': '4 Star',
          'Season': 'Peak',
          'Date Range': '01-10-2026 to 31-03-2027',
          'Room Category': 'Deluxe Room',
          'CP Cost': 4500,
          'MAP Cost': 6000,
          'Extra Adult CP': 1200,
          'Extra Adult MAP': 1800,
          'Child Bed Cost': 800,
          'Child No Bed Cost': 400,
          'Infant Policy': 'Free up to 5 yrs',
          'Mandatory Surcharges': 'Xmas & New Year Gala Dinner extra',
          'Notes': 'Includes breakfast and Wi-Fi',
        },
        {
          'Location': 'Thekkady',
          'Hotel Name': 'Elephant Court',
          'Hotel Category': '5 Star',
          'Season': 'Regular',
          'Date Range': '01-10-2026 to 31-03-2027',
          'Room Category': 'Executive Suite',
          'CP Cost': 5500,
          'MAP Cost': 7200,
          'Extra Adult CP': 1500,
          'Extra Adult MAP': 2200,
          'Child Bed Cost': 1000,
          'Child No Bed Cost': 500,
          'Infant Policy': 'Free below 6 yrs',
          'Mandatory Surcharges': '',
          'Notes': 'Tariff includes taxes',
        },
        {
          'Location': 'Alleppey',
          'Hotel Name': 'Lake Palace Resort',
          'Hotel Category': 'Luxury',
          'Season': 'Peak',
          'Date Range': '01-11-2026 to 15-01-2027',
          'Room Category': 'Lake View Cottage',
          'CP Cost': 8500,
          'MAP Cost': 10500,
          'Extra Adult CP': 2500,
          'Extra Adult MAP': 3200,
          'Child Bed Cost': 1500,
          'Child No Bed Cost': 800,
          'Infant Policy': 'Complimentary',
          'Mandatory Surcharges': 'Peak surcharge applies',
          'Notes': 'Complimentary boat transfer',
        },
      ];
      const ws = XLSX.utils.json_to_sheet(sampleData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Rate Master');
      XLSX.writeFile(wb, 'Rate_Master_Sample_Template.xlsx');
      toast.success('Sample Rate Master template downloaded!');
    } catch (err) {
      console.error('Error generating sample template:', err);
      toast.error('Could not generate sample template.');
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

  // Open Edit Modal - fetches complete rate record on demand from DB
  const handleOpenEdit = async (item: MasterHotelRateItem) => {
    if (!item.id) return;
    setLoadingEditId(item.id);

    try {
      const res = await getMasterRateByIdAction(item.id);
      if (res.error || !res.data) {
        toast.error(res.error || 'Failed to fetch rate details.');
        return;
      }

      const fullItem = res.data;
      setItemToEdit(fullItem);
      setEditForm({
        cpCost: fullItem.cpCost != null ? String(fullItem.cpCost) : '',
        mapCost: fullItem.mapCost != null ? String(fullItem.mapCost) : '',
        extraAdultCP: fullItem.extraAdultCP != null ? String(fullItem.extraAdultCP) : '',
        extraAdultMAP: fullItem.extraAdultMAP != null ? String(fullItem.extraAdultMAP) : '',
        childBedCost: fullItem.childBedCost != null ? String(fullItem.childBedCost) : '',
        childNoBedCost: fullItem.childNoBedCost != null ? String(fullItem.childNoBedCost) : '',
        notes: fullItem.notes || '',
      });
    } catch (err) {
      console.error('Error fetching rate by id:', err);
      toast.error('Could not load rate details.');
    } finally {
      setLoadingEditId(null);
    }
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToEdit || !itemToEdit.id) return;
    setIsSavingEdit(true);

    try {
      const res = await updateMasterRateAction(itemToEdit.id, {
        cpCost: editForm.cpCost.trim() ? Number(editForm.cpCost) : null,
        mapCost: editForm.mapCost.trim() ? Number(editForm.mapCost) : null,
        extraAdultCP: editForm.extraAdultCP.trim() ? Number(editForm.extraAdultCP) : null,
        extraAdultMAP: editForm.extraAdultMAP.trim() ? Number(editForm.extraAdultMAP) : null,
        childBedCost: editForm.childBedCost.trim() ? Number(editForm.childBedCost) : null,
        childNoBedCost: editForm.childNoBedCost.trim() ? Number(editForm.childNoBedCost) : null,
        notes: editForm.notes.trim() || null,
      });

      if (!res.success) {
        toast.error(res.error || 'Failed to update rate');
        return;
      }

      toast.success('Rate updated successfully');
      setRates((prev) =>
        prev.map((r) =>
          r.id === itemToEdit.id
            ? {
                ...r,
                cpCost: editForm.cpCost.trim() ? Number(editForm.cpCost) : null,
                mapCost: editForm.mapCost.trim() ? Number(editForm.mapCost) : null,
                extraAdultCP: editForm.extraAdultCP.trim() ? Number(editForm.extraAdultCP) : null,
                extraAdultMAP: editForm.extraAdultMAP.trim() ? Number(editForm.extraAdultMAP) : null,
                childBedCost: editForm.childBedCost.trim() ? Number(editForm.childBedCost) : null,
                childNoBedCost: editForm.childNoBedCost.trim() ? Number(editForm.childNoBedCost) : null,
                notes: editForm.notes.trim() || null,
              }
            : r
        )
      );
      setItemToEdit(null);
    } catch {
      toast.error('An unexpected error occurred while saving.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="font-sans space-y-6 antialiased text-ink-900">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-ink-100/80 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
              Rate Master
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200/80 px-3 py-1 text-xs font-semibold text-brand-800 shadow-xs">
              <Database className="h-3.5 w-3.5 text-brand-600" />
              {totalCount.toLocaleString('en-IN')} {totalCount === 1 ? 'Rate' : 'Rates'}
            </span>
          </div>
          <p className="text-sm text-ink-500 font-normal max-w-2xl leading-relaxed">
            Hotel tariffs, seasonal meal plans, room categories, and contract rates.
          </p>
        </div>

        {isAdmin && (
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
        )}
      </div>

      {/* Upload Excel Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl rounded-2xl border border-ink-200/80 animate-in zoom-in-95 duration-200 bg-white">
            <div className="flex items-center justify-between border-b border-ink-100 bg-sand-50/50 px-6 py-4 shrink-0">
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
                className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFileUpload} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* File Dropzone */}
              <div className="relative rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/40 p-6 sm:p-8 text-center transition-all hover:border-brand-500 hover:bg-brand-50/30">
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
                <div className="flex flex-col items-center justify-center space-y-2.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 shadow-inner">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink-800">
                      {selectedFile ? selectedFile.name : 'Click to browse or drop Excel file here'}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {selectedFile
                        ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                        : '.xlsx or .xls files up to 15MB'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Sheet & Column Specifications */}
              <div className="rounded-xl border border-ink-200/80 bg-ink-50/60 p-4 space-y-3 text-xs">
                {/* Required Sheet Tab Banner & Sample Download Button */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-ink-200/70">
                  <div className="flex items-center gap-1.5 text-ink-800">
                    <span className="font-semibold text-brand-900">Required Sheet Tab:</span>
                    <span className="font-mono font-bold bg-brand-100 text-brand-900 px-2 py-0.5 rounded border border-brand-300">
                      Rate Master
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadSampleTemplate}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-2.5 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-50 transition shadow-2xs cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5 text-brand-700" />
                    Download Sample Template
                  </button>
                </div>

                {/* Mandatory Columns Section */}
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-coral-700 mb-1.5">
                    <span className="h-2 w-2 rounded-full bg-coral-500 inline-block" />
                    Mandatory Columns (Required in Excel):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 pl-3 text-ink-800 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="text-coral-600 font-bold">•</span>
                      <span>Hotel Name</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-coral-600 font-bold">•</span>
                      <span>Location</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-coral-600 font-bold">•</span>
                      <span>Room Category</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-coral-600 font-bold">•</span>
                      <span>CP Cost <span className="text-[10px] text-ink-400 font-normal">(or MAP Cost)</span></span>
                    </span>
                    <span className="flex items-center gap-1.5 sm:col-span-2 md:col-span-1">
                      <span className="text-coral-600 font-bold">•</span>
                      <span>Date Range</span>
                    </span>
                  </div>
                </div>

                {/* Optional Columns Section */}
                <div className="pt-2 border-t border-ink-200/70">
                  <div className="flex items-center gap-1.5 font-semibold text-ink-700 mb-1.5">
                    <span className="h-2 w-2 rounded-full bg-ink-400 inline-block" />
                    Optional / Additional Columns:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pl-3 text-ink-600 text-[11px]">
                    <span>• Hotel Category</span>
                    <span>• Season</span>
                    <span>• MAP Cost</span>
                    <span>• Extra Adult CP</span>
                    <span>• Extra Adult MAP</span>
                    <span>• Child Bed Cost</span>
                    <span>• Child No Bed Cost</span>
                    <span>• Infant Policy</span>
                    <span>• Mandatory Surcharges</span>
                    <span>• Notes</span>
                  </div>
                </div>

                {/* Flexible synonym notes */}
                <p className="text-[11px] text-ink-400 italic pt-1 border-t border-ink-100">
                  💡 Note: Common header variations (e.g. &quot;City&quot;, &quot;Property&quot;, &quot;Room Type&quot;, &quot;Validity&quot;) are automatically recognized.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="btn-ghost text-sm font-medium px-4 py-2 cursor-pointer"
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || isUploading}
                  className="btn-primary inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl shadow-xs cursor-pointer"
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
          <div className="w-full overflow-hidden">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-ink-200 bg-sand-50/90 font-semibold text-ink-700 backdrop-blur-xs">
                <tr>
                  <th className="py-3 px-3.5">
                    Hotel & Location
                  </th>
                  <th className="py-3 px-3.5">
                    Season & Dates
                  </th>
                  <th className="py-3 px-3.5">
                    Room Category
                  </th>
                  <th className="py-3 px-3.5 text-right">
                    Tariff (CP / MAP)
                  </th>
                  <th className="hidden sm:table-cell py-3 px-3.5 text-right">
                    Extra Guests
                  </th>
                  <th className="hidden md:table-cell py-3 px-3.5">
                    Notes & Policies
                  </th>
                  {isAdmin && <th className="py-3 px-3.5 text-center whitespace-nowrap">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {isLoading ? (
                  <TableSkeletonRows count={Math.min(pageSize, 10)} isAdmin={isAdmin} />
                ) : (
                  rates.map((item, idx) => (
                    <tr
                      key={item.id || idx}
                      className="transition-colors hover:bg-sand-50/60 border-b border-ink-50"
                    >
                      {/* Hotel & Location */}
                      <td className="py-2.5 px-3.5">
                        <div className="font-semibold text-brand-900 leading-snug">
                          {item.hotelName || '—'}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] text-ink-500">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-brand-600 shrink-0" />
                            <span>{item.location || '—'}</span>
                          </span>
                          {item.hotelCategory && (
                            <span className="inline-flex items-center rounded bg-sand-100 px-1.5 py-0.2 text-[10px] font-medium text-sand-800">
                              {item.hotelCategory}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Season & Dates */}
                      <td className="py-2.5 px-3.5">
                        {item.season ? (
                          <span
                            className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold ${
                              String(item.season).toLowerCase().includes('surge')
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
                        {item.dateRange && (
                          <div className="flex items-center gap-1 mt-1 text-[11px] text-ink-500">
                            <Calendar className="h-3 w-3 text-ink-400 shrink-0" />
                            <span className="truncate max-w-[150px]">{item.dateRange}</span>
                          </div>
                        )}
                      </td>

                      {/* Room Category */}
                      <td className="py-2.5 px-3.5 text-ink-800 font-medium">
                        {item.roomCategory || '—'}
                      </td>

                      {/* CP & MAP Cost */}
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <div className="font-semibold text-ink-950">
                          <span className="text-[10px] text-ink-400 font-normal mr-1">CP:</span>
                          {formatCost(item.cpCost ?? null)}
                        </div>
                        <div className="font-semibold text-brand-700 mt-0.5">
                          <span className="text-[10px] text-ink-400 font-normal mr-1">MAP:</span>
                          {formatCost(item.mapCost ?? null)}
                        </div>
                      </td>

                      {/* Extra Rates */}
                      <td className="hidden sm:table-cell py-2.5 px-3.5 text-right text-[11px] text-ink-600 whitespace-nowrap">
                        <div>
                          <span className="text-ink-400">Adult: </span>
                          <span>{formatCost(item.extraAdultCP ?? null)}</span>
                          <span className="text-ink-300"> / </span>
                          <span>{formatCost(item.extraAdultMAP ?? null)}</span>
                        </div>
                        <div className="mt-0.5">
                          <span className="text-ink-400">Child: </span>
                          <span>{formatCost(item.childBedCost ?? null)}</span>
                          <span className="text-ink-300"> / </span>
                          <span>{formatCost(item.childNoBedCost ?? null)}</span>
                        </div>
                      </td>

                      {/* Notes & Policies */}
                      <td className="hidden md:table-cell py-2.5 px-3.5 text-[11px] text-ink-600 max-w-[180px]">
                        {item.notes ? (
                          <p className="truncate" title={item.notes}>
                            {item.notes}
                          </p>
                        ) : item.mandatorySurcharges ? (
                          <p className="truncate text-amber-700" title={item.mandatorySurcharges}>
                            {item.mandatorySurcharges}
                          </p>
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      {isAdmin && (
                        <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              disabled={isPending || isLoading || loadingEditId === item.id}
                              className="rounded-lg p-1.5 text-ink-500 hover:bg-brand-50 hover:text-brand-700 transition-colors disabled:opacity-50 cursor-pointer"
                              title="Edit this rate"
                            >
                              {loadingEditId === item.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
                              ) : (
                                <Pencil className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setItemToDelete(item)}
                              disabled={isPending || isLoading}
                              className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="Delete this record"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
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

      {/* Edit Rate Modal */}
      {itemToEdit && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink-950/60 backdrop-blur-xs p-4"
        >
          <div className="card w-full max-w-xl bg-white p-6 shadow-2xl rounded-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-ink-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-ink-900">Edit Hotel Rate</h3>
                <p className="text-xs text-ink-500 mt-0.5">
                  {itemToEdit.hotelName} ({itemToEdit.location}) · {itemToEdit.roomCategory} · {itemToEdit.season}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setItemToEdit(null)}
                className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="label">CP Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editForm.cpCost}
                    onChange={(e) => setEditForm((f) => ({ ...f, cpCost: e.target.value }))}
                    placeholder="e.g. 3500"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">MAP Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editForm.mapCost}
                    onChange={(e) => setEditForm((f) => ({ ...f, mapCost: e.target.value }))}
                    placeholder="e.g. 4500"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Extra Adult CP (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editForm.extraAdultCP}
                    onChange={(e) => setEditForm((f) => ({ ...f, extraAdultCP: e.target.value }))}
                    placeholder="e.g. 1000"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Extra Adult MAP (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editForm.extraAdultMAP}
                    onChange={(e) => setEditForm((f) => ({ ...f, extraAdultMAP: e.target.value }))}
                    placeholder="e.g. 1500"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Child Bed Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editForm.childBedCost}
                    onChange={(e) => setEditForm((f) => ({ ...f, childBedCost: e.target.value }))}
                    placeholder="e.g. 700"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Child No Bed Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editForm.childNoBedCost}
                    onChange={(e) => setEditForm((f) => ({ ...f, childNoBedCost: e.target.value }))}
                    placeholder="e.g. 400"
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">Notes / Policy Details</label>
                <input
                  type="text"
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Additional rate notes, validity or policies..."
                  className="input"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-ink-100">
                <button
                  type="button"
                  onClick={() => setItemToEdit(null)}
                  disabled={isSavingEdit}
                  className="btn-outline cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="btn-primary cursor-pointer"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
