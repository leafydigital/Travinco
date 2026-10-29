'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/admin-alert';
import {
  Upload,
  Download,
  FileSpreadsheet,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Users,
  Compass,
  Activity as ActivityIcon,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Filter,
  Check,
  AlertTriangle,
  CopyX,
  Loader2,
} from 'lucide-react';
import { getActivityById } from './actions';
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog';
import {
  saveActivity,
  deleteActivity,
  importLocationActivitiesAction,
  type ExcelActivityRow,
} from '@/lib/tour/master-actions';
import { BulkCreateActivitiesButton } from './bulk-create-modal';
import { cn } from '@/lib/utils/cn';
import { ModalPortal } from '@/components/ui/modal-portal';

interface Location {
  id: number | string;
  name: string;
  display_name?: string | null;
}

interface ActivityItem {
  id: number | string;
  location_id: number | string;
  name: string; // place activities
  category?: string | null; // categories (Sightseeing, Activity, etc.)
  preferred_types?: string | null; // Preferred Types (Adult, Children, Family, etc.)
  kind?: string | null;
  description?: string | null;
  duration?: string | null;
  timings?: string | null;
  closed_on?: string | null;
  entry_fee_adult?: number | null;
  entry_fee_child?: number | null;
  approx_cost_text?: string | null;
  sort_order?: number;
  is_optional_paid?: boolean;
  is_active?: boolean;
}

interface ActivitiesClientProps {
  initialActivities: ActivityItem[];
  locations: Location[];
  isAdmin: boolean;
  canEdit: boolean;
}

// -----------------------------------------------------------------------------
// Filter State Type
// -----------------------------------------------------------------------------
interface FilterCriteria {
  location: string;
  activityName: string;
  category: string;
  preferredTypes: string;
  status: 'all' | 'active' | 'inactive';
}

// -----------------------------------------------------------------------------
// String Cleaning & Edge-case Sanitization Helpers
// -----------------------------------------------------------------------------
function cleanCellString(val: any): string {
  if (val == null) return '';
  return String(val)
    .replace(/[\u00A0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanCellKey(val: any): string {
  return cleanCellString(val).toLowerCase();
}

// Helper to match comma-separated multiple search terms
function matchesMultiple(text: string | null | undefined, filterString: string): boolean {
  if (!filterString.trim()) return true;
  const terms = filterString
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (terms.length === 0) return true;
  const target = (text || '').toLowerCase();
  return terms.some((term) => target.includes(term));
}

function identifyHeader(rawKey: string): 'location' | 'activities' | 'categories' | 'preferred_types' | null {
  const clean = rawKey.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (
    clean === 'preferredtypes' ||
    clean === 'preferredtype' ||
    clean === 'prefredtypes' ||
    clean === 'prefredtype' ||
    clean === 'preferedtypes' ||
    clean === 'preferedtype' ||
    clean === 'allowedfor' ||
    clean === 'allowedtypes' ||
    clean === 'targettypes' ||
    clean === 'targetaudience' ||
    clean === 'allowed' ||
    clean === 'audience'
  ) {
    return 'preferred_types';
  }

  if (
    clean === 'categories' ||
    clean === 'category' ||
    clean === 'cat' ||
    clean === 'kind' ||
    clean === 'sightseeingoractivity' ||
    clean === 'sightseeingactivity' ||
    clean === 'activitytype' ||
    clean === 'placecategory'
  ) {
    return 'categories';
  }

  if (
    clean === 'location' ||
    clean === 'locations' ||
    clean === 'city' ||
    clean === 'destination' ||
    clean === 'placelocation'
  ) {
    return 'location';
  }

  if (
    clean === 'placeactivities' ||
    clean === 'placeactivity' ||
    clean === 'activities' ||
    clean === 'activity' ||
    clean === 'place' ||
    clean === 'placename' ||
    clean === 'activityname' ||
    clean === 'sightseeing' ||
    clean === 'attraction'
  ) {
    return 'activities';
  }

  if (clean.includes('pref') || clean.includes('allow')) return 'preferred_types';
  if (clean.includes('categ')) return 'categories';
  if (clean.includes('locat')) return 'location';
  if (clean.includes('place') || clean.includes('activ')) return 'activities';
  if (clean.includes('type')) return 'preferred_types';

  return null;
}

function normalizeCategoryValue(raw: string): string {
  const val = cleanCellString(raw);
  if (!val) return 'Sightseeing';
  const lower = val.toLowerCase();
  if (lower === 'sightseeing' || lower.includes('sight')) return 'Sightseeing';
  if (lower === 'activity' || lower.includes('activ')) return 'Activity';
  if (lower === 'experience') return 'Experience';
  if (lower === 'temple' || lower.includes('pilgrim')) return 'Temple';
  if (lower === 'shopping') return 'Shopping';
  if (lower === 'adventure') return 'Adventure';
  return val.charAt(0).toUpperCase() + val.slice(1);
}

function normalizePreferredTypesValue(raw: string): string {
  const val = cleanCellString(raw);
  if (!val) return 'All';
  const lower = val.toLowerCase();
  if (lower === 'all' || lower === 'everyone' || lower === 'any') return 'All';
  if (lower === 'adult' || lower === 'adults') return 'Adult';
  if (lower === 'children' || lower === 'child' || lower === 'kids') return 'Children';
  if (lower === 'family' || lower === 'families') return 'Family';
  if (lower.includes('adult') && lower.includes('child')) return 'Adult & Children';
  return val.charAt(0).toUpperCase() + val.slice(1);
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------
export function ActivitiesClient({
  initialActivities,
  locations,
  isAdmin,
  canEdit,
}: ActivitiesClientProps) {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);
  const [q, setQ] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter Modal State
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<FilterCriteria>({
    location: '',
    activityName: '',
    category: '',
    preferredTypes: '',
    status: 'all',
  });

  // Pagination
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ActivityItem | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<number | string | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ActivityItem | null>(null);

  const [isPending, startTransition] = useTransition();

  // Location map for fast lookup
  const locMap = useMemo(() => {
    const map = new Map<string, string>();
    locations.forEach((l) => {
      map.set(String(l.id), l.display_name || l.name);
    });
    return map;
  }, [locations]);

  // Handle Refresh button click
  const handleRefresh = () => {
    setIsRefreshing(true);
    startTransition(() => {
      router.refresh();
      setTimeout(() => {
        setIsRefreshing(false);
        toast.success('Activities data refreshed');
      }, 500);
    });
  };

  // On-demand fetch when user clicks Edit
  const handleOpenEdit = async (act: ActivityItem) => {
    setLoadingEditId(act.id);
    try {
      const res = await getActivityById(act.id);
      if (res.error || !res.activity) {
        toast.error(res.error || 'Failed to fetch activity details');
        setEditingItem(act);
      } else {
        setEditingItem({
          ...act,
          ...res.activity,
        });
      }
    } catch {
      toast.error('Failed to fetch activity details');
      setEditingItem(act);
    } finally {
      setLoadingEditId(null);
    }
  };

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.location.trim()) count++;
    if (filters.activityName.trim()) count++;
    if (filters.category.trim()) count++;
    if (filters.preferredTypes.trim()) count++;
    return count;
  }, [filters]);

  const hasActiveFilters = activeFiltersCount > 0;

  // Clear all filters
  const handleClearAllFilters = () => {
    setFilters({
      location: '',
      activityName: '',
      category: '',
      preferredTypes: '',
      status: 'all',
    });
    setQ('');
    setCurrentPage(1);
    toast.info('All filters cleared');
  };

  // Filtered rows
  const filteredActivities = useMemo(() => {
    const term = q.trim().toLowerCase();

    return activities.filter((act) => {
      const locName = locMap.get(String(act.location_id)) || 'General';
      const cat = act.category || act.kind || 'Sightseeing';
      const pref = act.preferred_types || 'All';

      // 1. Location filter (supports multiple comma-separated)
      if (filters.location.trim() && !matchesMultiple(locName, filters.location)) {
        return false;
      }

      // 2. Activity Name filter (supports multiple comma-separated)
      if (filters.activityName.trim() && !matchesMultiple(act.name, filters.activityName)) {
        return false;
      }

      // 3. Category filter (supports multiple comma-separated)
      if (filters.category.trim() && !matchesMultiple(cat, filters.category)) {
        return false;
      }

      // 4. Preferred Types filter (supports multiple comma-separated)
      if (filters.preferredTypes.trim() && !matchesMultiple(pref, filters.preferredTypes)) {
        return false;
      }

      // Quick Text search term
      if (!term) return true;
      const lowerLoc = locName.toLowerCase();
      const lowerName = act.name.toLowerCase();
      const lowerCat = cat.toLowerCase();
      const lowerPref = pref.toLowerCase();

      return (
        lowerLoc.includes(term) ||
        lowerName.includes(term) ||
        lowerCat.includes(term) ||
        lowerPref.includes(term)
      );
    });
  }, [activities, q, filters, locMap]);

  // Paginated items
  const paginatedActivities = useMemo(() => {
    if (pageSize >= 999999) return filteredActivities;
    const start = (currentPage - 1) * pageSize;
    return filteredActivities.slice(start, start + pageSize);
  }, [filteredActivities, currentPage, pageSize]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredActivities.length / (pageSize >= 999999 ? filteredActivities.length || 1 : pageSize))
  );

  // Export Soft Copy to Excel (with the exact 4 fields: location, place activities, categories, Preferred Types)
  const handleExportSoftCopy = async () => {
    try {
      const XLSX = await import('xlsx');
      const exportRows = filteredActivities.map((a) => ({
        location: locMap.get(String(a.location_id)) || 'General',
        'place activities': a.name,
        categories: a.category || a.kind || 'Sightseeing',
        'Preferred Types': a.preferred_types || 'All',
      }));

      let ws;
      if (exportRows.length === 0) {
        ws = XLSX.utils.aoa_to_sheet([
          ['location', 'place activities', 'categories', 'Preferred Types'],
        ]);
      } else {
        ws = XLSX.utils.json_to_sheet(exportRows);
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Locations & Activities');
      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `locations_and_activities_${dateStr}.xlsx`);
      toast.success('Soft copy exported successfully');
    } catch (err: any) {
      toast.error('Failed to export soft copy: ' + err.message);
    }
  };

  // Handle Delete (strictly Admin Only)
  const handleDeleteConfirm = () => {
    if (!itemToDelete) return;
    const targetId = itemToDelete.id;
    startTransition(async () => {
      const res = await deleteActivity(targetId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setActivities((prev) => prev.filter((a) => a.id !== targetId));
      setItemToDelete(null);
      toast.success('Activity deleted successfully');
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/* Action Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Upload Excel Button */}
          {canEdit && (
            <button
              onClick={() => setUploadOpen(true)}
              className="btn-primary inline-flex items-center gap-2 text-sm shadow-sm"
              type="button"
            >
              <Upload className="h-4 w-4" />
              <span>Upload Excel</span>
            </button>
          )}

          {/* Export Soft Copy Button */}
          <button
            onClick={handleExportSoftCopy}
            className="btn-outline inline-flex items-center gap-2 text-sm bg-white"
            type="button"
            title="Download soft copy of location activities in Excel format"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            <span>Download Soft Copy</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Bulk Create Activities Button */}
          {canEdit && (
            <BulkCreateActivitiesButton
              locations={locations}
              onSuccess={(created) => {
                if (created && created.length > 0) {
                  setActivities((prev) => [...created, ...prev]);
                }
                router.refresh();
              }}
            />
          )}

          {/* Add Activity Button */}
          {canEdit && (
            <button
              onClick={() => setIsNewOpen(true)}
              className="btn-outline inline-flex items-center gap-1.5 text-xs bg-white"
              type="button"
            >
              <Plus className="h-4 w-4 text-brand-600" />
              <span>Add Activity</span>
            </button>
          )}
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="card p-3 shadow-xs bg-white space-y-2.5">
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
            <input
              type="text"
              className="input pl-9 text-sm w-full"
              placeholder="Search by location, place activities, categories, or preferred types…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setCurrentPage(1);
              }}
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-2.5 text-ink-400 hover:text-ink-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Right side buttons: Refresh Button + Filter Button */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="btn-outline inline-flex items-center gap-1.5 text-sm h-9.5 px-3 bg-white hover:bg-sand-50 transition-colors"
              title="Refresh activities data"
            >
              <RotateCw className={cn('h-4 w-4 text-ink-600', isRefreshing && 'animate-spin text-brand-600')} />
              <span>Refresh</span>
            </button>

            {/* Filter Button */}
            <button
              type="button"
              onClick={() => setFilterModalOpen(true)}
              className={cn(
                'inline-flex items-center gap-2 text-sm h-9.5 px-3.5 rounded-xl border font-medium transition-all cursor-pointer',
                hasActiveFilters
                  ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-2xs font-semibold'
                  : 'btn-outline bg-white hover:bg-sand-50 text-ink-700'
              )}
              title="Open filters modal"
            >
              <Filter className={cn('h-4 w-4', hasActiveFilters ? 'text-brand-600' : 'text-ink-600')} />
              <span>Filter</span>
              {activeFiltersCount > 0 && (
                <span className="flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Active Filter Chips (if any filters are applied) */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-ink-100/70 text-xs">
            <span className="text-[11px] font-semibold text-ink-500 mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3 text-brand-600" /> Active Filters:
            </span>

            {/* Location Filter Tag */}
            {filters.location.trim() && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 text-brand-900 px-2.5 py-0.5 text-xs font-medium">
                <span>Location: <b>{filters.location}</b></span>
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, location: '' }))}
                  className="hover:text-rose-600 ml-0.5"
                  title="Remove location filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {/* Activity Name Filter Tag */}
            {filters.activityName.trim() && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sand-200 text-ink-900 px-2.5 py-0.5 text-xs font-medium">
                <span>Activity: <b>{filters.activityName}</b></span>
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, activityName: '' }))}
                  className="hover:text-rose-600 ml-0.5"
                  title="Remove activity filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {/* Category Filter Tag */}
            {filters.category.trim() && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 text-sky-900 px-2.5 py-0.5 text-xs font-medium">
                <span>Category: <b>{filters.category}</b></span>
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, category: '' }))}
                  className="hover:text-rose-600 ml-0.5"
                  title="Remove category filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {/* Preferred Types Filter Tag */}
            {filters.preferredTypes.trim() && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-900 px-2.5 py-0.5 text-xs font-medium">
                <span>Type: <b>{filters.preferredTypes}</b></span>
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, preferredTypes: '' }))}
                  className="hover:text-rose-600 ml-0.5"
                  title="Remove preferred type filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}


            {/* Clear All Button */}
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 ml-auto transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Showing count overview */}
        <div className="flex items-center justify-between text-xs text-ink-500 pt-0.5">
          <span>
            Showing <b>{filteredActivities.length}</b> of <b>{activities.length}</b> activities
          </span>
          <span className="text-[11px] text-ink-400">
            Excel Columns: <code>location</code> · <code>place activities</code> · <code>categories</code> · <code>Preferred Types</code>
          </span>
        </div>
      </div>

      {/* Main Activities Table */}
      <div className="card overflow-hidden shadow-xs bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-100 bg-ink-50/70 text-xs font-semibold uppercase tracking-wider text-ink-600">
              <tr>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Place Activities</th>
                <th className="px-4 py-3">Categories</th>
                <th className="px-4 py-3">Preferred Types</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {paginatedActivities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <div className="mx-auto max-w-sm space-y-3">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                        <FileSpreadsheet className="h-6 w-6" />
                      </div>
                      <p className="font-semibold text-ink-900">No activities found</p>
                      <p className="text-xs text-ink-500">
                        {activities.length === 0
                          ? 'Upload your Excel sheet with columns: location, place activities, categories, and Preferred Types to populate this table.'
                          : 'No activities match your search or filter criteria. Try adjusting the filters.'}
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={handleClearAllFilters}
                          className="btn-outline text-xs"
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedActivities.map((act) => {
                  const locName = locMap.get(String(act.location_id)) || 'General';
                  const cat = act.category || act.kind || 'Sightseeing';
                  const prefType = act.preferred_types || 'All';
                  const isSightseeing = cat.toLowerCase().includes('sight');
                  const isActivity = cat.toLowerCase().includes('activ');

                  return (
                    <tr key={act.id} className="hover:bg-sand-50/60 transition-colors">
                      {/* Location Column */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-50/80 px-2.5 py-1 text-xs font-semibold text-brand-900">
                          <MapPin className="h-3 w-3 text-brand-600" />
                          {locName}
                        </span>
                      </td>

                      {/* Place Activities Column */}
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink-900">{act.name}</p>
                        {act.description && (
                          <p className="text-xs text-ink-400 line-clamp-1 mt-0.5">{act.description}</p>
                        )}
                      </td>

                      {/* Categories Column (Sightseeing or Activity) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            isSightseeing
                              ? 'bg-sky-50 text-sky-800 border border-sky-200/60'
                              : isActivity
                              ? 'bg-amber-50 text-amber-800 border border-amber-200/60'
                              : 'bg-brand-50 text-brand-800 border border-brand-200/60'
                          }`}
                        >
                          {isSightseeing ? (
                            <Compass className="h-3 w-3 text-sky-600" />
                          ) : isActivity ? (
                            <ActivityIcon className="h-3 w-3 text-amber-600" />
                          ) : null}
                          {cat}
                        </span>
                      </td>

                      {/* Preferred Types Column (Adult, Children, Family, All, etc.) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          <Users className="h-3 w-3 text-emerald-600" />
                          {prefType}
                        </span>
                      </td>

                      {/* Actions Column */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit Action (Staff with canEdit) */}
                          {canEdit && (
                            <button
                              onClick={() => handleOpenEdit(act)}
                              disabled={loadingEditId === act.id}
                              className="rounded-lg p-1.5 text-ink-500 hover:bg-sand-100 hover:text-ink-900 transition-colors disabled:opacity-50"
                              title="Edit Activity"
                              type="button"
                            >
                              {loadingEditId === act.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                              ) : (
                                <Pencil className="h-4 w-4" />
                              )}
                            </button>
                          )}

                          {/* Delete Action (STRICTLY ADMIN ONLY!) */}
                          {isAdmin && (
                            <button
                              onClick={() => setItemToDelete(act)}
                              className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                              title="Delete Activity (Admin only)"
                              type="button"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredActivities.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-ink-100 px-4 py-3 text-xs text-ink-500 gap-3">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                className="input py-1 text-xs"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={999999}>All ({filteredActivities.length})</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span>
                Page <b>{currentPage}</b> of <b>{totalPages}</b>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-ink-200 p-1 hover:bg-sand-100 disabled:opacity-40 disabled:hover:bg-transparent"
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-ink-200 p-1 hover:bg-sand-100 disabled:opacity-40 disabled:hover:bg-transparent"
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Modal */}
      {filterModalOpen && (
        <FilterActivitiesModal
          isOpen={filterModalOpen}
          locations={locations}
          initialFilters={filters}
          onClose={() => setFilterModalOpen(false)}
          onApply={(newFilters) => {
            setFilters(newFilters);
            setFilterModalOpen(false);
            setCurrentPage(1);
            toast.success('Filters applied');
          }}
          onClear={() => {
            handleClearAllFilters();
            setFilterModalOpen(false);
          }}
        />
      )}

      {/* Delete Confirmation Dialog (Admin Only) */}
      <ConfirmDeleteDialog
        isOpen={itemToDelete !== null}
        isPending={isPending}
        title="Delete Activity"
        description={
          itemToDelete ? (
            <div>
              Are you sure you want to delete{' '}
              <b className="text-ink-900">{itemToDelete.name}</b> in{' '}
              <b className="text-ink-900">{locMap.get(String(itemToDelete.location_id)) || 'General'}</b>?
              <p className="mt-2 text-xs text-ink-500">
                This record will be safely soft-deleted from the database.
              </p>
            </div>
          ) : null
        }
        onConfirm={handleDeleteConfirm}
        onClose={() => setItemToDelete(null)}
      />

      {/* Edit Activity Modal */}
      {editingItem && (
        <ActivityFormModal
          activity={editingItem}
          locations={locations}
          onClose={() => setEditingItem(null)}
          onSaved={(saved) => {
            setActivities((prev) =>
              prev.map((a) => (a.id === saved.id ? { ...a, ...saved } : a))
            );
            setEditingItem(null);
            router.refresh();
          }}
        />
      )}

      {/* New Activity Modal */}
      {isNewOpen && (
        <ActivityFormModal
          locations={locations}
          onClose={() => setIsNewOpen(false)}
          onSaved={(newAct) => {
            setActivities((prev) => [newAct, ...prev]);
            setIsNewOpen(false);
            router.refresh();
          }}
        />
      )}

      {/* Excel Upload Modal */}
      {uploadOpen && (
        <ActivityExcelUploadModal
          isOpen={uploadOpen}
          onClose={() => setUploadOpen(false)}
          onSuccess={() => {
            setUploadOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Filter Activities Modal (Supports Multi-Location & Details Search via Inputs)
// -----------------------------------------------------------------------------
function FilterActivitiesModal({
  isOpen,
  locations,
  initialFilters,
  onClose,
  onApply,
  onClear,
}: {
  isOpen: boolean;
  locations: Location[];
  initialFilters: FilterCriteria;
  onClose: () => void;
  onApply: (filters: FilterCriteria) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState<FilterCriteria>(initialFilters);

  if (!isOpen) return null;

  // Quick toggle helper for comma-separated input values
  const toggleItemInInput = (currentVal: string, itemToAddOrRemove: string) => {
    const items = currentVal
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const index = items.findIndex((i) => i.toLowerCase() === itemToAddOrRemove.toLowerCase());
    if (index >= 0) {
      items.splice(index, 1);
    } else {
      items.push(itemToAddOrRemove);
    }
    return items.join(', ');
  };

  const CATEGORY_CHIPS = ['Sightseeing', 'Activity', 'Experience', 'Adventure', 'Temple', 'Shopping'];
  const PREFERRED_TYPE_CHIPS = ['Adult', 'Children', 'Family', 'All', 'Adult & Children', 'Couples'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply(draft);
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-ink-950/50 z-50 flex items-center justify-center p-4">
        <div className="card w-full max-w-lg p-6 shadow-xl space-y-4 max-h-[90vh] flex flex-col bg-white animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-ink-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Filter className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-ink-900">Filter Activities</h2>
                <p className="text-xs text-ink-500">
                  Search multiple locations, place names, categories, and preferred types
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-ink-400 hover:bg-sand-100 hover:text-ink-700"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
  
          {/* Filter Input Form */}
          <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-1">
            {/* 1. Location Input Field (Supports Multiple Locations) */}
            <div>
              <label className="label">
                <span>Location(s)</span>
                <span className="text-[11px] font-normal text-ink-400 ml-1.5">(Comma-separated for multiple)</span>
              </label>
              <input
                type="text"
                className="input text-sm"
                placeholder="e.g. Munnar, Cochin, Alleppey"
                value={draft.location}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
              />
              {/* Quick Location Pills */}
              <div className="mt-1.5 flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                {locations.slice(0, 10).map((loc) => {
                  const name = loc.display_name || loc.name;
                  const isSelected = draft.location
                    .toLowerCase()
                    .split(',')
                    .map((s) => s.trim())
                    .includes(name.toLowerCase());
  
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => setDraft({ ...draft, location: toggleItemInInput(draft.location, name) })}
                      className={cn(
                        'rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors border',
                        isSelected
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'bg-sand-50 text-ink-600 border-ink-200/60 hover:bg-sand-100'
                      )}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
  
            {/* 2. Place Activities Input Field */}
            <div>
              <label className="label">
                <span>Place Activities</span>
                <span className="text-[11px] font-normal text-ink-400 ml-1.5">(Name or keywords)</span>
              </label>
              <input
                type="text"
                className="input text-sm"
                placeholder="e.g. Tea Museum, Dam, Boating, Safari"
                value={draft.activityName}
                onChange={(e) => setDraft({ ...draft, activityName: e.target.value })}
              />
              <p className="mt-1 text-[11px] text-ink-400">Search for specific attractions or keywords</p>
            </div>
  
            {/* 3. Categories Input Field */}
            <div>
              <label className="label">
                <span>Categories</span>
                <span className="text-[11px] font-normal text-ink-400 ml-1.5">(Sightseeing, Activity, etc.)</span>
              </label>
              <input
                type="text"
                className="input text-sm"
                placeholder="e.g. Sightseeing, Activity"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              />
              {/* Quick Category Chips */}
              <div className="mt-1.5 flex flex-wrap gap-1">
                {CATEGORY_CHIPS.map((cat) => {
                  const isSelected = draft.category
                    .toLowerCase()
                    .split(',')
                    .map((s) => s.trim())
                    .includes(cat.toLowerCase());
  
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setDraft({ ...draft, category: toggleItemInInput(draft.category, cat) })}
                      className={cn(
                        'rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors border',
                        isSelected
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-sand-50 text-ink-600 border-ink-200/60 hover:bg-sand-100'
                      )}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
  
            {/* 4. Preferred Types Input Field */}
            <div>
              <label className="label">
                <span>Preferred Types</span>
                <span className="text-[11px] font-normal text-ink-400 ml-1.5">(Allowed for adult, children, family...)</span>
              </label>
              <input
                type="text"
                className="input text-sm"
                placeholder="e.g. Adult, Children, Family, All"
                value={draft.preferredTypes}
                onChange={(e) => setDraft({ ...draft, preferredTypes: e.target.value })}
              />
              {/* Quick Preferred Types Chips */}
              <div className="mt-1.5 flex flex-wrap gap-1">
                {PREFERRED_TYPE_CHIPS.map((type) => {
                  const isSelected = draft.preferredTypes
                    .toLowerCase()
                    .split(',')
                    .map((s) => s.trim())
                    .includes(type.toLowerCase());
  
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDraft({ ...draft, preferredTypes: toggleItemInInput(draft.preferredTypes, type) })}
                      className={cn(
                        'rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors border',
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-sand-50 text-ink-600 border-ink-200/60 hover:bg-sand-100'
                      )}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>
  
  
            {/* Modal Actions: Clear Filter, Close, Search */}
            <div className="flex items-center justify-between border-t border-ink-100 pt-3">
              <button
                type="button"
                onClick={onClear}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 underline decoration-dotted transition-colors"
              >
                Clear Filters
              </button>
  
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-outline text-xs px-3"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="btn-primary inline-flex items-center gap-1.5 text-xs px-4"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Search</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

// -----------------------------------------------------------------------------
// Activity Form Modal (Create & Edit)
// -----------------------------------------------------------------------------
function ActivityFormModal({
  activity,
  locations,
  onClose,
  onSaved,
}: {
  activity?: ActivityItem;
  locations: Location[];
  onClose: () => void;
  onSaved: (item: ActivityItem) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [f, setF] = useState({
    location_id: activity ? String(activity.location_id) : locations[0] ? String(locations[0].id) : '',
    name: activity?.name || '',
    category: activity?.category || activity?.kind || 'Sightseeing',
    preferred_types: activity?.preferred_types || 'All',
    description: activity?.description || '',
    is_active: activity?.is_active !== false,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.location_id) {
      toast.error('Please select a location');
      return;
    }
    if (!f.name.trim()) {
      toast.error('Please enter the place activity name');
      return;
    }

    startTransition(async () => {
      const payload: Record<string, unknown> = {
        location_id: Number(f.location_id),
        name: cleanCellString(f.name),
        category: cleanCellString(f.category) || 'Sightseeing',
        preferred_types: cleanCellString(f.preferred_types) || 'All',
        description: cleanCellString(f.description) || null,
        is_active: f.is_active,
        sort_order: activity?.sort_order ?? 100,
      };

      const res = await saveActivity(activity?.id ?? null, payload);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(activity ? 'Activity updated' : 'Activity created');
      onSaved({
        id: res?.id ?? activity?.id ?? Date.now(),
        ...payload,
        location_id: Number(f.location_id),
        name: cleanCellString(f.name),
        category: cleanCellString(f.category),
        preferred_types: cleanCellString(f.preferred_types),
      } as ActivityItem);
    });
  };

  const PREFERRED_TYPE_OPTIONS = ['All', 'Adult', 'Children', 'Family', 'Adult & Children', 'Couples'];

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-ink-950/50 z-50 flex items-center justify-center p-4">
        <div className="card w-full max-w-lg p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-ink-100 pb-3">
            <h2 className="text-base font-bold text-ink-900">
              {activity ? 'Edit Place Activity' : 'Add New Place Activity'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-ink-400 hover:bg-sand-100 hover:text-ink-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
  
          <form onSubmit={handleSave} className="mt-4 space-y-4">
            <div>
              <label className="label">Location *</label>
              <select
                className="input"
                value={f.location_id}
                onChange={(e) => setF({ ...f, location_id: e.target.value })}
                required
              >
                <option value="">Select location</option>
                {locations.map((l) => (
                  <option key={l.id} value={String(l.id)}>
                    {l.display_name || l.name}
                  </option>
                ))}
              </select>
            </div>
  
            <div>
              <label className="label">Place Activities *</label>
              <input
                type="text"
                className="input"
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
                placeholder="e.g. Tea Museum, Mattupetty Dam, Speed Boating"
                required
              />
            </div>
  
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Categories *</label>
                <select
                  className="input"
                  value={f.category}
                  onChange={(e) => setF({ ...f, category: e.target.value })}
                  required
                >
                  <option value="Sightseeing">Sightseeing</option>
                  <option value="Activity">Activity</option>
                  <option value="Experience">Experience</option>
                  <option value="Adventure">Adventure</option>
                  <option value="Temple">Temple / Pilgrimage</option>
                  <option value="Shopping">Shopping</option>
                </select>
              </div>
  
              <div>
                <label className="label">Preferred Types</label>
                <input
                  type="text"
                  className="input"
                  value={f.preferred_types}
                  onChange={(e) => setF({ ...f, preferred_types: e.target.value })}
                  placeholder="e.g. Adult, Children, Family, All"
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {PREFERRED_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setF({ ...f, preferred_types: opt })}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                        f.preferred_types === opt
                          ? 'bg-emerald-600 text-white'
                          : 'bg-sand-100 text-ink-600 hover:bg-sand-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
  
            <div>
              <label className="label">Description (Optional)</label>
              <textarea
                className="input"
                rows={2}
                value={f.description}
                onChange={(e) => setF({ ...f, description: e.target.value })}
                placeholder="Shown on itinerary quotations..."
              />
            </div>
  
  
            <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
              <button type="button" onClick={onClose} className="btn-outline">
                Cancel
              </button>
              <button type="submit" disabled={isPending} className="btn-primary">
                {isPending ? 'Saving…' : 'Save Activity'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

// -----------------------------------------------------------------------------
// Analyzed Row Structure for Upload Preview
// -----------------------------------------------------------------------------
interface AnalyzedExcelRow {
  rowNumber: number;
  location: string;
  activities: string;
  categories: string;
  preferred_types: string;
  status: 'valid' | 'duplicate_file' | 'invalid';
  reason?: string;
}

// -----------------------------------------------------------------------------
// Activity Excel Upload Modal (Strictly 4 Columns & Excel Validation)
// -----------------------------------------------------------------------------
function ActivityExcelUploadModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [analyzedRows, setAnalyzedRows] = useState<AnalyzedExcelRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'duplicate_file' | 'invalid'>('all');
  const [isPending, startTransition] = useTransition();

  // Counts breakdown (Purely Excel-focused)
  const counts = useMemo(() => {
    let valid = 0;
    let duplicateFile = 0;
    let invalid = 0;

    analyzedRows.forEach((r) => {
      if (r.status === 'valid') valid++;
      else if (r.status === 'duplicate_file') duplicateFile++;
      else if (r.status === 'invalid') invalid++;
    });

    return {
      total: analyzedRows.length,
      valid,
      duplicateFile,
      invalid,
    };
  }, [analyzedRows]);

  // Filtered rows for preview table
  const displayedPreviewRows = useMemo(() => {
    if (previewFilter === 'all') return analyzedRows;
    return analyzedRows.filter((r) => r.status === previewFilter);
  }, [analyzedRows, previewFilter]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setParseError(null);
    setPreviewFilter('all');

    try {
      const XLSX = await import('xlsx');
      const data = await f.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const wsName = wb.SheetNames[0];
      if (!wsName) {
        setParseError('The uploaded workbook contains no sheets.');
        return;
      }
      const sheet = wb.Sheets[wsName];
      if (!sheet) {
        setParseError('Could not read the worksheet.');
        return;
      }

      // Edge case: Handle sheets where row 1 is a title/banner
      let rawJson: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '', blankrows: false });
      const firstRow = rawJson[0] as Record<string, any> | undefined;
      let hasHeaders = !!firstRow && Object.keys(firstRow).some((k) => identifyHeader(k) !== null);

      if (!hasHeaders) {
        // Try offset 1, 2, or 3 if header was shifted down
        for (let offset = 1; offset <= 3; offset++) {
          const tryJson: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { range: offset, defval: '', blankrows: false });
          const sampleRow = tryJson[0] as Record<string, any> | undefined;
          if (sampleRow && Object.keys(sampleRow).some((k) => identifyHeader(k) !== null)) {
            rawJson = tryJson;
            hasHeaders = true;
            break;
          }
        }
      }

      if (rawJson.length === 0) {
        setParseError('The Excel sheet contains no readable rows.');
        return;
      }

      // Edge case: Verify at least location and activity headers exist
      const sampleKeys = Object.keys(rawJson[0] || {});
      const recognized = sampleKeys.map(identifyHeader).filter(Boolean);
      if (!recognized.includes('location') && !recognized.includes('activities')) {
        setParseError(
          'Could not find required columns. Please ensure your Excel sheet has columns: "location", "place activities", "categories", and "Preferred Types".'
        );
        return;
      }

      // Track duplicates within the uploaded file
      const seenInFile = new Set<string>();
      const rowsAnalyzed: AnalyzedExcelRow[] = [];

      let rowNum = 1;
      for (const row of rawJson) {
        rowNum++;
        let rawLoc = '';
        let rawAct = '';
        let rawCat = '';
        let rawPref = '';

        for (const [key, val] of Object.entries(row)) {
          const matched = identifyHeader(key);
          const strVal = cleanCellString(val);
          if (matched === 'location') rawLoc = strVal;
          else if (matched === 'activities') rawAct = strVal;
          else if (matched === 'categories') rawCat = strVal;
          else if (matched === 'preferred_types') rawPref = strVal;
        }

        // Skip completely empty rows
        if (!rawLoc && !rawAct && !rawCat && !rawPref) {
          continue;
        }

        // Edge case: Incomplete row (missing location or missing activity)
        if (!rawLoc || !rawAct) {
          rowsAnalyzed.push({
            rowNumber: rowNum,
            location: rawLoc || '(Missing Location)',
            activities: rawAct || '(Missing Activity)',
            categories: normalizeCategoryValue(rawCat),
            preferred_types: normalizePreferredTypesValue(rawPref),
            status: 'invalid',
            reason: !rawLoc && !rawAct ? 'Missing location & activity' : !rawLoc ? 'Missing location' : 'Missing place activity',
          });
          continue;
        }

        const locKey = cleanCellKey(rawLoc);
        const actKey = cleanCellKey(rawAct);
        const compositeKey = `${locKey}:::${actKey}`;

        // Edge case: Duplicate within the file itself
        if (seenInFile.has(compositeKey)) {
          rowsAnalyzed.push({
            rowNumber: rowNum,
            location: rawLoc,
            activities: rawAct,
            categories: normalizeCategoryValue(rawCat),
            preferred_types: normalizePreferredTypesValue(rawPref),
            status: 'duplicate_file',
            reason: 'Duplicate entry in Excel sheet (skipped)',
          });
          continue;
        }
        seenInFile.add(compositeKey);

        // Valid unique row
        rowsAnalyzed.push({
          rowNumber: rowNum,
          location: rawLoc,
          activities: rawAct,
          categories: normalizeCategoryValue(rawCat),
          preferred_types: normalizePreferredTypesValue(rawPref),
          status: 'valid',
        });
      }

      if (rowsAnalyzed.length === 0) {
        setParseError('No valid data rows found in spreadsheet.');
        return;
      }

      setAnalyzedRows(rowsAnalyzed);
    } catch (err: any) {
      setParseError('Failed to parse Excel file: ' + err.message);
    }
  };

  const handleImport = () => {
    // Only import valid unique rows
    const validRowsToImport: ExcelActivityRow[] = analyzedRows
      .filter((r) => r.status === 'valid')
      .map((r) => ({
        location: r.location,
        activities: r.activities,
        categories: r.categories,
        preferred_types: r.preferred_types,
      }));

    if (validRowsToImport.length === 0) {
      toast.error('No valid activities found to import.');
      return;
    }

    startTransition(async () => {
      const res = await importLocationActivitiesAction(validRowsToImport, { updateExisting: true });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Successfully imported ${res.imported ?? 0} activities across ${res.locationsCreated ?? 0} new locations!`
      );
      onSuccess();
    });
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-ink-950/50 z-50 flex items-center justify-center p-4">
        <div className="card w-full max-w-2xl p-6 shadow-xl space-y-4 max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-ink-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-ink-900">Upload Locations &amp; Activities</h2>
                <p className="text-xs text-ink-500">
                  Import places, categories, and allowed visitor types from Excel
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-ink-400 hover:bg-sand-100 hover:text-ink-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
  
          {/* Expected Format Alert (4 fields) */}
          <div className="rounded-xl bg-sand-50 border border-sand-200/80 p-3 text-xs text-ink-700 space-y-1.5">
            <div className="font-semibold text-ink-900">
              <span>Required Excel Columns (4 fields):</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
              <div className="rounded bg-white p-1.5 border border-ink-100 font-semibold text-brand-700 text-center">
                location
              </div>
              <div className="rounded bg-white p-1.5 border border-ink-100 font-semibold text-brand-700 text-center">
                place activities
              </div>
              <div className="rounded bg-white p-1.5 border border-ink-100 font-semibold text-brand-700 text-center">
                categories
              </div>
              <div className="rounded bg-white p-1.5 border border-ink-100 font-semibold text-brand-700 text-center">
                Preferred Types
              </div>
            </div>
            <p className="text-[11px] text-ink-500">
              • <b>categories</b>: Sightseeing or Activity • <b>Preferred Types</b>: Allowed for adult, children, family, etc.
            </p>
          </div>
  
          {/* File Drop Area */}
          <div className="border-2 border-dashed border-ink-200 rounded-xl p-5 text-center hover:border-brand-500 transition-colors bg-white/50">
            <input
              type="file"
              id="excel-file-input"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <label htmlFor="excel-file-input" className="cursor-pointer block space-y-2">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-ink-900">
                {file ? file.name : 'Click to select Excel file (.xlsx, .xls, .csv)'}
              </p>
              <p className="text-xs text-ink-400">
                Select or drop your spreadsheet containing location, place activities, categories, and Preferred Types
              </p>
            </label>
          </div>
  
          {/* Parse Error */}
          {parseError && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>{parseError}</div>
            </div>
          )}
  
          {/* Analysis Dashboard & Preview */}
          {analyzedRows.length > 0 && (
            <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
              {/* Status Counter Cards */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-emerald-50/90 border border-emerald-200 p-2.5 text-emerald-900">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Ready to Import
                    </span>
                    <span className="text-base font-bold">{counts.valid}</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 mt-0.5">Valid unique activities</p>
                </div>
  
                <div className="rounded-lg bg-amber-50/90 border border-amber-200 p-2.5 text-amber-900">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-1.5">
                      <CopyX className="h-4 w-4 text-amber-600" /> Duplicates
                    </span>
                    <span className="text-base font-bold">{counts.duplicateFile}</span>
                  </div>
                  <p className="text-[11px] text-amber-700 mt-0.5">Repeated in Excel (skipped)</p>
                </div>
  
                <div className="rounded-lg bg-rose-50/90 border border-rose-200 p-2.5 text-rose-900">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-rose-600" /> Incomplete
                    </span>
                    <span className="text-base font-bold">{counts.invalid}</span>
                  </div>
                  <p className="text-[11px] text-rose-700 mt-0.5">Missing location / activity</p>
                </div>
              </div>
  
              {/* Filter Tabs & Preview Count */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-ink-100 pb-1.5">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('all')}
                    className={`rounded px-2.5 py-1 font-medium transition-colors ${
                      previewFilter === 'all'
                        ? 'bg-brand-600 text-white'
                        : 'bg-sand-100 text-ink-600 hover:bg-sand-200'
                    }`}
                  >
                    All ({counts.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('valid')}
                    className={`rounded px-2.5 py-1 font-medium transition-colors ${
                      previewFilter === 'valid'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-sand-100 text-ink-600 hover:bg-sand-200'
                    }`}
                  >
                    Ready ({counts.valid})
                  </button>
                  {counts.duplicateFile > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('duplicate_file')}
                      className={`rounded px-2.5 py-1 font-medium transition-colors ${
                        previewFilter === 'duplicate_file'
                          ? 'bg-amber-600 text-white'
                          : 'bg-sand-100 text-ink-600 hover:bg-sand-200'
                      }`}
                    >
                      Duplicates ({counts.duplicateFile})
                    </button>
                  )}
                  {counts.invalid > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('invalid')}
                      className={`rounded px-2.5 py-1 font-medium transition-colors ${
                        previewFilter === 'invalid'
                          ? 'bg-rose-600 text-white'
                          : 'bg-sand-100 text-ink-600 hover:bg-sand-200'
                      }`}
                    >
                      Incomplete ({counts.invalid})
                    </button>
                  )}
                </div>
                <span className="text-[11px] text-ink-400">
                  Showing {displayedPreviewRows.length} rows
                </span>
              </div>
  
              {/* Preview Table with exactly the 4 Excel Columns */}
              <div className="border border-ink-100 rounded-lg overflow-y-auto max-h-48 text-xs">
                <table className="w-full text-left divide-y divide-ink-100">
                  <thead className="bg-ink-50 sticky top-0 font-semibold text-ink-700">
                    <tr>
                      <th className="p-2.5">Location</th>
                      <th className="p-2.5">Place Activities</th>
                      <th className="p-2.5">Categories</th>
                      <th className="p-2.5">Preferred Types</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {displayedPreviewRows.slice(0, 30).map((row, i) => (
                      <tr key={i} className="hover:bg-sand-50/50">
                        <td className="p-2.5 font-medium text-brand-700 whitespace-nowrap">
                          {row.location}
                        </td>
                        <td className="p-2.5 text-ink-900 font-medium">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{row.activities}</span>
                            {row.status === 'duplicate_file' && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                Duplicate (Skipped)
                              </span>
                            )}
                            {row.status === 'invalid' && (
                              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800">
                                {row.reason}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 text-ink-700 whitespace-nowrap">
                          {row.categories}
                        </td>
                        <td className="p-2.5 text-ink-600 whitespace-nowrap">
                          {row.preferred_types}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {displayedPreviewRows.length > 30 && (
                  <div className="p-2 text-center text-[11px] text-ink-400 bg-ink-50/50 border-t border-ink-100">
                    ...and {displayedPreviewRows.length - 30} more rows
                  </div>
                )}
              </div>
            </div>
          )}
  
          {/* Modal Actions */}
          <div className="flex justify-end gap-2 border-t border-ink-100 pt-3">
            <button type="button" onClick={onClose} className="btn-outline">
              Cancel
            </button>
            <button
              type="button"
              disabled={counts.valid === 0 || isPending}
              onClick={handleImport}
              className="btn-primary"
            >
              {isPending ? 'Importing…' : `Import ${counts.valid} Activities`}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
