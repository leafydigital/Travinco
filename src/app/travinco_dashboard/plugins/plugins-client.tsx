'use client';

import { useState, useTransition, useRef, useId, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  Code as CodeIcon,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Layers,
  Search,
  X,
  HelpCircle,
  ShieldCheck,
  RotateCcw,
  Power,
  PowerOff,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog';
import {
  MAX_PLUGIN_CODE_BYTES,
  VALID_PLUGIN_SLOTS,
  validateScriptHosts,
  findDuplicatePlugin,
} from '@/lib/plugins/validation';
import {
  createPlugin,
  updatePlugin,
  deletePlugin,
  togglePluginStatus,
  getPluginById,
  type PluginTableItem,
} from './actions';
import type { Plugin, PluginSlot } from '@/types/database';
import { ModalPortal } from '@/components/ui/modal-portal';

interface PluginsClientProps {
  initialPlugins?: PluginTableItem[];
  totalCount?: number;
  totalPages?: number;
  currentPage?: number;
  pageSize?: number;
  initialSearch?: string;
  initialSlot?: string;
}

const SLOT_LABELS: Record<PluginSlot, { label: string; description: string; badge: string }> = {
  'home-top': {
    label: 'Home Top',
    description: 'Directly below hero banner — ideal for search forms & booking widgets',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  'home-middle': {
    label: 'Home Middle',
    description: 'Between packages and travel experience highlights',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  'home-bottom': {
    label: 'Home Bottom',
    description: 'Above the final call to action & newsletter footer',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
  },
};

export function PluginsClient({
  initialPlugins = [],
  totalCount = 0,
  totalPages = 1,
  currentPage = 1,
  pageSize = 20,
  initialSearch = '',
  initialSlot = 'all',
}: PluginsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [plugins, setPlugins] = useState<PluginTableItem[]>(initialPlugins);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [slotFilter, setSlotFilter] = useState<'all' | PluginSlot>((initialSlot as any) || 'all');

  // Form Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlugin, setEditingPlugin] = useState<Plugin | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<number | null>(null);

  // Delete Dialog State
  const [pluginToDelete, setPluginToDelete] = useState<PluginTableItem | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Pending transition state
  const [isPending, startTransition] = useTransition();

  // Sync state when server data reloads
  useEffect(() => {
    setPlugins(initialPlugins);
  }, [initialPlugins]);

  // Sync search and slot when URL searchParams change
  useEffect(() => {
    setSearchQuery(searchParams.get('q') ?? '');
    setSlotFilter(((searchParams.get('slot') as PluginSlot) || 'all'));
  }, [searchParams]);

  function updateParams(newParams: Record<string, string | null | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([key, val]) => {
      if (val === null || val === undefined || val === '' || val === 'all') {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });

    if ('q' in newParams || 'slot' in newParams) {
      params.delete('page');
    }

    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ q: searchQuery.trim() });
  }

  function handleSlotChange(newSlot: string) {
    setSlotFilter(newSlot as any);
    updateParams({ slot: newSlot });
  }

  function handleClearAll() {
    setSearchQuery('');
    setSlotFilter('all');
    startTransition(() => {
      router.push('?');
    });
  }

  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return;
    updateParams({ page: String(page) });
  }

  const handleOpenAdd = () => {
    setEditingPlugin(null);
    setIsFormOpen(true);
  };

  // On-demand fetch of complete plugin details (including raw code) when clicking Edit
  const handleOpenEdit = async (pluginId: number) => {
    setLoadingEditId(pluginId);
    try {
      const res = await getPluginById(pluginId);
      if (res.error || !res.plugin) {
        toast.error(res.error || 'Failed to fetch plugin details.');
        return;
      }
      setEditingPlugin(res.plugin);
      setIsFormOpen(true);
    } catch (err) {
      console.error('Error fetching plugin:', err);
      toast.error('Could not load plugin details.');
    } finally {
      setLoadingEditId(null);
    }
  };

  // Toggle status with guaranteed order: loading state -> DB update -> visual state change -> toast snackbar
  const handleToggle = async (plugin: PluginTableItem) => {
    const newStatus = !plugin.active;
    setTogglingId(plugin.id);

    try {
      const res = await togglePluginStatus(plugin.id, newStatus);
      if (res.error) {
        toast.error(res.error);
        return;
      }

      // 1. Visually update state so the switch toggles and status pill flips in the DOM
      setPlugins((prev) =>
        prev.map((p) => (p.id === plugin.id ? { ...p, active: newStatus } : p))
      );

      // 2. Display snackbar notification strictly after status change has completed in UI
      requestAnimationFrame(() => {
        toast.success(
          `Plugin "${plugin.name}" ${newStatus ? 'activated' : 'deactivated'}`
        );
      });
    } catch {
      toast.error('Failed to change plugin status.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteConfirm = () => {
    if (!pluginToDelete) return;
    const target = pluginToDelete;

    startTransition(async () => {
      const res = await deletePlugin(target.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Plugin "${target.name}" deleted successfully`);
        setPlugins((prev) => prev.filter((p) => p.id !== target.id));
        setPluginToDelete(null);
        router.refresh();
      }
    });
  };

  const hasActiveFilters = Boolean(searchQuery.trim() || (slotFilter && slotFilter !== 'all'));
  const startIndex = (currentPage - 1) * pageSize;

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
            Plugins &amp; Widgets
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Manage third-party embeds (e.g. Travelpayouts flight &amp; hotel widgets) displayed on the customer home page.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="btn-primary inline-flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Add Plugin</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <form
        onSubmit={handleSearchSubmit}
        className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between"
      >
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onBlur={() => updateParams({ q: searchQuery.trim() })}
            placeholder="Search plugins by name or description…"
            className="input pl-9 pr-8 text-sm w-full bg-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                updateParams({ q: '' });
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 p-0.5 cursor-pointer"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs font-medium text-ink-600 whitespace-nowrap">Filter Slot:</label>
          <select
            value={slotFilter}
            onChange={(e) => handleSlotChange(e.target.value)}
            className="input text-xs sm:text-sm py-1.5 px-3 bg-white w-auto cursor-pointer"
          >
            <option value="all">All Slots</option>
            <option value="home-top">Home Top</option>
            <option value="home-middle">Home Middle</option>
            <option value="home-bottom">Home Bottom</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-brand-700 transition px-2 py-1.5 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Clear</span>
            </button>
          )}

          {isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-brand-600 shrink-0 ml-1" />
          )}
        </div>
      </form>

      {/* Plugins Table */}
      <div className="overflow-hidden rounded-xl border border-ink-200/80 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-ink-700">
            <thead className="border-b border-ink-100 bg-ink-50/75 text-xs font-semibold uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-5 py-3.5">Plugin / Widget</th>
                <th className="px-4 py-3.5">Slot Location</th>
                <th className="px-4 py-3.5 text-center">Position</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5">Created</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {plugins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-400 mb-3">
                      <CodeIcon className="h-6 w-6" />
                    </div>
                    <p className="text-base font-semibold text-ink-800">No plugins found</p>
                    <p className="mt-1 text-xs text-ink-500 max-w-sm mx-auto">
                      {hasActiveFilters
                        ? 'No plugins match your current filters. Try resetting the search or filter.'
                        : 'Get started by creating your first widget embed (such as a Travelpayouts flight search).'}
                    </p>
                    {hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={handleClearAll}
                        className="btn-outline mt-4 text-xs"
                      >
                        Reset filters
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleOpenAdd}
                        className="btn-primary mt-4 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Plugin
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                plugins.map((plugin) => {
                  const slotMeta = SLOT_LABELS[plugin.slot] || {
                    label: plugin.slot,
                    description: '',
                    badge: 'bg-ink-100 text-ink-700 border-ink-200',
                  };

                  return (
                    <tr
                      key={plugin.id}
                      className="hover:bg-ink-50/60 transition-colors"
                    >
                      {/* 1. Plugin / Widget */}
                      <td className="px-5 py-4">
                        <div className="font-semibold text-ink-900">{plugin.name}</div>
                        {plugin.description && (
                          <div className="text-xs text-ink-500 mt-0.5 line-clamp-1">
                            {plugin.description}
                          </div>
                        )}
                      </td>

                      {/* 2. Slot Location */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${slotMeta.badge}`}
                          title={slotMeta.description}
                        >
                          <Layers className="h-3 w-3" />
                          {slotMeta.label}
                        </span>
                      </td>

                      {/* 3. Position */}
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-md bg-ink-100 font-mono text-xs font-semibold text-ink-700">
                          {plugin.position}
                        </span>
                      </td>

                      {/* 4. Status */}
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            plugin.active
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-ink-100 text-ink-600 border border-ink-200'
                          }`}
                        >
                          {plugin.active ? (
                            <>
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <span className="h-1.5 w-1.5 rounded-full bg-ink-400" />
                              <span>Inactive</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* 5. Created */}
                      <td className="px-4 py-4 text-xs text-ink-500 whitespace-nowrap">
                        {new Date(plugin.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* 6. Actions */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Enable / Disable Toggle Switch */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={plugin.active}
                            onClick={() => handleToggle(plugin)}
                            disabled={togglingId === plugin.id}
                            className="inline-flex items-center gap-1.5 cursor-pointer select-none group mr-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={plugin.active ? 'Enabled — click to disable' : 'Disabled — click to enable'}
                          >
                            <span
                              className={`text-xs font-semibold transition-colors ${
                                plugin.active ? 'text-emerald-700' : 'text-ink-400'
                              }`}
                            >
                              {plugin.active ? 'Enabled' : 'Disabled'}
                            </span>
                            <div
                              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${
                                plugin.active ? 'bg-emerald-500' : 'bg-ink-300 group-hover:bg-ink-400'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-flex h-4 w-4 items-center justify-center transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                                  plugin.active ? 'translate-x-[18px]' : 'translate-x-[2px]'
                                }`}
                              >
                                {togglingId === plugin.id && (
                                  <Loader2 className="h-2.5 w-2.5 animate-spin text-ink-500" />
                                )}
                              </span>
                            </div>
                          </button>

                          {/* Edit Button with On-Demand Loading Spinner */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(plugin.id)}
                            disabled={loadingEditId === plugin.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50 hover:text-ink-900 transition cursor-pointer disabled:opacity-50"
                            title="Edit plugin"
                          >
                            {loadingEditId === plugin.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
                            ) : (
                              <Pencil className="h-3.5 w-3.5 text-ink-500" />
                            )}
                            <span>Edit</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => setPluginToDelete(plugin)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition cursor-pointer"
                            title="Delete plugin"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-ink-100 bg-white px-5 py-3 text-sm text-ink-500 gap-3">
            <span>
              Showing <span className="font-semibold text-ink-800">{startIndex + 1}</span>–
              <span className="font-semibold text-ink-800">
                {Math.min(startIndex + pageSize, totalCount)}
              </span> of <span className="font-semibold text-ink-800">{totalCount}</span> plugins
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1 || isPending}
                className="btn-outline px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Previous</span>
              </button>

              <span className="px-2 text-xs font-medium text-ink-600">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages || isPending}
                className="btn-outline px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Form Modal */}
      {isFormOpen && (
        <PluginFormModal
          plugin={editingPlugin}
          existingPlugins={plugins}
          onClose={() => setIsFormOpen(false)}
          onSuccess={(saved) => {
            setIsFormOpen(false);
            const tableItem: PluginTableItem = {
              id: saved.id,
              name: saved.name,
              description: saved.description,
              slot: saved.slot,
              position: saved.position,
              active: saved.active,
              created_at: saved.created_at,
            };
            setPlugins((prev) => {
              const exists = prev.some((p) => p.id === saved.id);
              if (exists) {
                return prev.map((p) => (p.id === saved.id ? tableItem : p));
              }
              return [tableItem, ...prev];
            });
            router.refresh();
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={Boolean(pluginToDelete)}
        isPending={isPending}
        title="Delete Plugin"
        description={
          pluginToDelete ? (
            <span>
              Are you sure you want to permanently delete the plugin{' '}
              <strong className="text-ink-900 font-semibold">&ldquo;{pluginToDelete.name}&rdquo;</strong>?
              This widget will immediately stop appearing on the customer website.
            </span>
          ) : null
        }
        onConfirm={handleDeleteConfirm}
        onClose={() => setPluginToDelete(null)}
      />
    </div>
  );
}

/**
 * Add / Edit Plugin Form Modal with Monospace Code Editor, File Upload, and Sandboxed Iframe Preview.
 */
function PluginFormModal({
  plugin,
  existingPlugins,
  onClose,
  onSuccess,
}: {
  plugin: Plugin | null;
  existingPlugins: { id: number; name: string; slot: string; code?: string }[];
  onClose: () => void;
  onSuccess: (saved: Plugin) => void;
}) {
  const isEditing = Boolean(plugin);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  // Form Fields
  const [name, setName] = useState(plugin?.name ?? '');
  const [description, setDescription] = useState(plugin?.description ?? '');
  const [slot, setSlot] = useState<PluginSlot>(plugin?.slot ?? 'home-top');
  const [position, setPosition] = useState<number>(plugin?.position ?? 0);
  const [code, setCode] = useState(plugin?.code ?? '');
  const [active, setActive] = useState(plugin?.active ?? true);

  // Tab: 'editor' vs 'preview'
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [previewKey, setPreviewKey] = useState<number>(0);
  const [formError, setFormError] = useState<string | null>(null);

  // Real-time duplicate check across existing plugins
  const duplicateInfo = findDuplicatePlugin(existingPlugins, { name, code }, plugin?.id);

  // Measure code size
  const codeSizeBytes = new TextEncoder().encode(code).length;
  const isOverSize = codeSizeBytes > MAX_PLUGIN_CODE_BYTES;

  // Handle local file upload (.html, .txt)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_PLUGIN_CODE_BYTES) {
      toast.error(`File is too large (${Math.round(file.size / 1024)} KB). Limit is 100 KB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setCode(content);
        const base = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        const autoName = base.charAt(0).toUpperCase() + base.slice(1);
        if (!name) setName(autoName);

        // Immediate duplicate check on uploaded file contents
        const dup = findDuplicatePlugin(
          existingPlugins,
          { name: name || autoName, code: content },
          plugin?.id
        );
        if (dup.isDuplicate) {
          toast.warning(`Note: Uploaded file matches existing plugin "${dup.matchedPlugin?.name}" in ${dup.matchedPlugin?.slot}`);
        } else {
          toast.success(`Loaded code from "${file.name}"`);
        }
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read file.');
    };
    reader.readAsText(file);

    // Reset input value so same file can be uploaded again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Plugin name is required.');
      return;
    }

    if (!code.trim()) {
      setFormError('Widget code is required.');
      return;
    }

    if (isOverSize) {
      setFormError(`Code size (${Math.round(codeSizeBytes / 1024)} KB) exceeds the 100 KB maximum limit.`);
      return;
    }

    // Duplicate check
    if (duplicateInfo.isDuplicate) {
      setFormError(duplicateInfo.message || 'A duplicate plugin was detected.');
      toast.error(duplicateInfo.message || 'A duplicate plugin was detected.');
      return;
    }

    // Script code validation
    const hostCheck = validateScriptHosts(code);
    if (!hostCheck.valid) {
      setFormError(hostCheck.error || 'Invalid or dangerous script code detected.');
      return;
    }

    startTransition(async () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        slot,
        position: Number(position) || 0,
        code: code.trim(),
        active,
      };

      if (isEditing && plugin) {
        const res = await updatePlugin(plugin.id, payload);
        if (res.error) {
          setFormError(res.error);
          toast.error(res.error);
        } else if (res.plugin) {
          toast.success(`Plugin "${res.plugin.name}" updated successfully!`);
          onSuccess(res.plugin);
        }
      } else {
        const res = await createPlugin(payload);
        if (res.error) {
          setFormError(res.error);
          toast.error(res.error);
        } else if (res.plugin) {
          toast.success(`Plugin "${res.plugin.name}" created successfully!`);
          onSuccess(res.plugin);
        }
      }
    });
  };

  // Safe Sandboxed HTML Document for Preview
  // Normalize protocol-relative URLs (//...) to https:// so they resolve cleanly inside about:srcdoc
  const normalizedCode = code.replace(
    /(src|href)=["']\/\/([a-zA-Z0-9.\-_~:/?#[\]@!$&'()*+,;=]+)/gi,
    '$1="https://$2'
  );

  const previewHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <base href="https://localhost/" />
  <style>
    body {
      margin: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
    }
  </style>
</head>
<body>
  ${normalizedCode}
</body>
</html>`;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-ink-950/50 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={isEditing ? 'Edit Plugin' : 'Add New Plugin'}
          className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white px-5 py-4 shadow-lg shadow-ink-900/5 transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-ink-100 pb-3">
            <div>
              <h2 className="text-lg font-bold text-ink-900">
                {plugin ? `Edit Plugin: ${plugin.name}` : 'Add New Plugin'}
              </h2>
              <p className="text-xs text-ink-500 mt-0.5">
                Paste widget HTML/scripts (e.g. Travelpayouts, Emerald, Trip.com) or upload a widget code file.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition cursor-pointer"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
  
          {/* Error Alert */}
          {formError && (
            <div className="mt-3 shrink-0 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Validation Error: </span>
                {formError}
              </div>
            </div>
          )}
  
          {/* Duplicate Warning Alert */}
          {duplicateInfo.isDuplicate && (
            <div className="mt-3 shrink-0 rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-950">Duplicate Plugin Detected: </span>
                {duplicateInfo.message}
                <div className="mt-1 text-[11px] text-amber-800">
                  To prevent duplicated widgets or conflicting scripts on your site, please choose a distinct name or edit the existing plugin.
                </div>
              </div>
            </div>
          )}
  
          <form onSubmit={handleSubmit} className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
            {/* Row 1: Name, Slot, Position */}
            <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_9rem]">
              <div>
                <label className="label">
                  Plugin Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Travelpayouts Flight Search"
                  className="input"
                />
              </div>
  
              <div>
                <label className="label">
                  Slot Location <span className="text-red-500">*</span>
                </label>
                <select
                  value={slot}
                  onChange={(e) => setSlot(e.target.value as PluginSlot)}
                  className="input bg-white"
                >
                  <option value="home-top">Home Top (Below Hero Banner)</option>
                  <option value="home-middle">Home Middle (Between Content Sections)</option>
                  <option value="home-bottom">Home Bottom (Above Final CTA)</option>
                </select>
              </div>
  
              <div>
                <label className="label">Position Order</label>
                <input
                  type="number"
                  value={position}
                  onChange={(e) => setPosition(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="input"
                  min={0}
                  step={1}
                  title="Lower numbers appear first within the slot"
                />
              </div>
            </div>
  
            {/* Row 2: Description + Active */}
            <div className="grid shrink-0 grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto]">
              <div>
                <label className="label">Description (Optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief notes about affiliate campaigns, widget ID, or placement..."
                  className="input"
                />
              </div>
              <div className="flex h-[38px] items-center gap-2 rounded-lg border border-ink-100 bg-sand-50/50 px-3">
                <input
                  type="checkbox"
                  id="plugin-active-checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                />
                <label
                  htmlFor="plugin-active-checkbox"
                  className="cursor-pointer select-none text-sm font-medium text-ink-800"
                  title="Uncheck to save as draft without displaying publicly"
                >
                  Active on customer website
                </label>
              </div>
            </div>
  
            {/* Code Section & Editor / Preview Controls */}
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-2 flex shrink-0 flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <label className="label mb-0">
                    Widget Code (HTML / Script) <span className="text-red-500">*</span>
                  </label>
                  <span
                    className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                      isOverSize ? 'bg-red-100 text-red-700 font-bold' : 'bg-ink-100 text-ink-600'
                    }`}
                  >
                    {(codeSizeBytes / 1024).toFixed(1)} / 100 KB
                  </span>
                </div>
  
                {/* Upload file + Tab switch */}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".html,.htm,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50 transition cursor-pointer"
                    title="Load HTML or text file into editor"
                  >
                    <Upload className="h-3.5 w-3.5 text-ink-500" />
                    <span>Upload .html / .txt</span>
                  </button>
  
                  <div className="inline-flex rounded-lg border border-ink-200 bg-ink-100 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveTab('editor')}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition cursor-pointer ${
                        activeTab === 'editor'
                          ? 'bg-white text-ink-900 shadow-2xs'
                          : 'text-ink-600 hover:text-ink-900'
                      }`}
                    >
                      <CodeIcon className="h-3.5 w-3.5" />
                      <span>Code</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('preview');
                        setPreviewKey((k) => k + 1);
                      }}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition cursor-pointer ${
                        activeTab === 'preview'
                          ? 'bg-white text-brand-700 shadow-2xs font-semibold'
                          : 'text-ink-600 hover:text-ink-900'
                      }`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Preview</span>
                    </button>
                  </div>
                </div>
              </div>
  
              {/* Active Tab View */}
              {activeTab === 'editor' ? (
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  placeholder={`<!-- Example Travelpayouts widget code -->\n<script async src="https://tp.media/content?currency=usd&trs=..." charset="utf-8"></script>`}
                  className="input min-h-[140px] flex-1 basis-[38vh] resize-none font-mono text-xs sm:text-sm bg-ink-950 text-emerald-400 focus:bg-ink-950 border-ink-800 focus:border-brand-500 focus:ring-brand-500 rounded-xl leading-relaxed"
                  spellCheck={false}
                />
              ) : (
                <div className="flex min-h-[140px] flex-1 basis-[38vh] flex-col overflow-hidden rounded-xl border border-ink-200 bg-white shadow-inner">
                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-ink-200 bg-ink-100/90 px-3 py-1.5 text-[11px] text-ink-700">
                    <span className="flex items-center gap-1 font-semibold text-ink-800">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      Sandboxed Preview
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewKey((k) => k + 1)}
                      className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] font-medium text-ink-700 border border-ink-200 hover:bg-ink-50 transition cursor-pointer"
                      title="Reload iframe and re-execute scripts"
                    >
                      <RotateCcw className="h-3 w-3 text-ink-500" />
                      <span>Reload</span>
                    </button>
                  </div>
  
                  {code.trim() ? (
                    <iframe
                      key={previewKey}
                      title="Widget Sandbox Preview"
                      srcDoc={previewHtml}
                      // Widget mode: storage/forms enabled so interactive affiliate widgets render realistically.
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                      className="min-h-0 w-full flex-1 border-0 bg-white"
                    />
                  ) : (
                    <div className="flex flex-1 items-center justify-center text-xs italic text-ink-400">
                      No code to preview yet. Switch back to the Code tab and paste your widget HTML.
                    </div>
                  )}
                </div>
              )}
            </div>
  
            {/* Form Actions Footer */}
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-ink-100 pt-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="btn-outline cursor-pointer"
              >
                Cancel
              </button>
  
              <button
                type="submit"
                disabled={isPending || isOverSize || duplicateInfo.isDuplicate}
                className="btn-primary inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{duplicateInfo.isDuplicate ? 'Duplicate Plugin' : isEditing ? 'Save Changes' : 'Create Plugin'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
