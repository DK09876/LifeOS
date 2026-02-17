'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import DomainForm, { DomainFormData } from '@/components/DomainForm';
import { ColumnsButton, SortButton, FilterButton, SortLevel, ColumnDef, FilterDef, multiLevelSort, usePersistedSet, usePersistedSortLevels, usePersistedFilters, matchesFilter } from '@/components/ViewControls';
import { useTasks, useDomains, createDomain, updateDomainData, deleteDomain } from '@/lib/hooks';
import { Domain } from '@/types';
import { getDomainPriorityColor } from '@/lib/colors';

const DOMAIN_COLUMNS: ColumnDef[] = [
  { key: 'icon', label: 'Icon', defaultVisible: true },
  { key: 'name', label: 'Name', defaultVisible: true },
  { key: 'priority', label: 'Priority', defaultVisible: true },
  { key: 'taskCount', label: 'Tasks', defaultVisible: true },
  { key: 'active', label: 'Active', defaultVisible: true },
  { key: 'done', label: 'Done', defaultVisible: false },
];

const SORTABLE_COLUMNS = DOMAIN_COLUMNS.filter(c => !['icon'].includes(c.key));

const DEFAULT_VISIBLE = new Set(DOMAIN_COLUMNS.filter(c => c.defaultVisible).map(c => c.key));

const DOMAIN_FILTERS: FilterDef[] = [
  {
    key: 'priority', label: 'Priority',
    options: [
      { value: 'all', label: 'All Priorities' },
      { value: '1 - Critical', label: 'Critical' },
      { value: '2 - Important', label: 'Important' },
      { value: '3 - Maintenance', label: 'Maintenance' },
    ],
  },
];

type DomainWithStats = Domain & { stats: { total: number; active: number; done: number } };

export default function DomainsPage() {
  const tasks = useTasks();
  const domains = useDomains();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleColumns, setVisibleColumns] = usePersistedSet('domains-visible-columns', DEFAULT_VISIBLE);
  const [sortLevels, setSortLevels] = usePersistedSortLevels('domains-sort-levels', [{ field: 'priority', direction: 'asc' }]);
  const [filterValues, setFilterValues] = usePersistedFilters('domains-filters', { priority: [] });
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  // Persist view mode
  useEffect(() => {
    const stored = localStorage.getItem('domains-view-mode');
    if (stored === 'cards' || stored === 'list') setViewMode(stored);
  }, []);
  const handleSetViewMode = useCallback((mode: 'cards' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('domains-view-mode', mode);
  }, []);

  // Modal state
  const [isDomainModalOpen, setIsDomainModalOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [domainToDelete, setDomainToDelete] = useState<string | null>(null);

  // Get task stats for a domain
  const getDomainStats = (domainId: string) => {
    const domainTasks = tasks.filter(t => t.domainId === domainId);
    return {
      total: domainTasks.length,
      active: domainTasks.filter(t => t.status !== 'Done' && t.status !== 'Archived').length,
      done: domainTasks.filter(t => t.status === 'Done').length,
    };
  };

  const comparators: Record<string, (a: DomainWithStats, b: DomainWithStats) => number> = useMemo(() => ({
    name: (a, b) => a.name.localeCompare(b.name),
    priority: (a, b) => a.priority.localeCompare(b.priority),
    taskCount: (a, b) => a.stats.total - b.stats.total,
    active: (a, b) => a.stats.active - b.stats.active,
    done: (a, b) => a.stats.done - b.stats.done,
  }), []);

  // Filter and sort domains
  const filteredDomains = useMemo(() => {
    let result: DomainWithStats[] = domains.map(d => ({ ...d, stats: getDomainStats(d.id) }));

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(d => d.name.toLowerCase().includes(query));
    }

    // Apply multi-select filter
    result = result.filter(d => matchesFilter(filterValues.priority || [], d.priority));

    return multiLevelSort(result, sortLevels, comparators);
  }, [domains, tasks, searchQuery, filterValues, sortLevels, comparators]);

  // Handlers
  function handleOpenCreateDomain() {
    setEditingDomain(null);
    setIsDomainModalOpen(true);
  }

  function handleEditDomain(domain: Domain) {
    setEditingDomain(domain);
    setIsDomainModalOpen(true);
  }

  async function handleDomainSubmit(data: DomainFormData) {
    if (editingDomain) {
      await updateDomainData(editingDomain.id, data);
    } else {
      await createDomain(data);
    }
    setIsDomainModalOpen(false);
    setEditingDomain(null);
  }

  async function handleConfirmDeleteDomain() {
    if (domainToDelete) {
      await deleteDomain(domainToDelete);
      setDomainToDelete(null);
    }
  }

  const show = (key: string) => visibleColumns.has(key);
  const colCount = Array.from(visibleColumns).length + 1; // +1 for actions

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">Domains</h1>
          <p className="text-[var(--muted)]">{filteredDomains.length} domains</p>
        </div>
        <button
          onClick={handleOpenCreateDomain}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          + New Domain
        </button>
      </div>

      {/* Search + View Controls */}
      <div className="flex items-center gap-4 mb-6">
        <input
          type="text"
          placeholder="Search domains..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 max-w-md px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded text-white placeholder-[var(--muted)] focus:outline-none focus:border-blue-500"
        />
        <FilterButton filters={DOMAIN_FILTERS} values={filterValues} onChange={setFilterValues} />
        <ColumnsButton columns={DOMAIN_COLUMNS} visibleColumns={visibleColumns} onChange={setVisibleColumns} />
        <SortButton columns={SORTABLE_COLUMNS} sortLevels={sortLevels} onChange={setSortLevels} />
        <div className="flex bg-[var(--card-bg)] border border-[var(--border-color)] rounded overflow-hidden">
          <button
            onClick={() => handleSetViewMode('cards')}
            className={`px-3 py-2 text-sm transition-colors ${viewMode === 'cards' ? 'bg-blue-600 text-white' : 'text-[var(--muted)] hover:text-white'}`}
            title="Card view"
          >
            Cards
          </button>
          <button
            onClick={() => handleSetViewMode('list')}
            className={`px-3 py-2 text-sm transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-[var(--muted)] hover:text-white'}`}
            title="List view"
          >
            List
          </button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'cards' && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDomains.map(domain => (
          <div
            key={domain.id}
            className="group bg-[var(--card-bg)] rounded-lg p-4 hover:bg-[var(--card-hover)] cursor-pointer transition-colors"
            onClick={() => handleEditDomain(domain)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{domain.icon || '📁'}</span>
                <div>
                  <h3 className="text-white font-medium">{domain.name}</h3>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs mt-1 ${getDomainPriorityColor(domain.priority)}`}>
                    {domain.priority.split(' - ')[1]}
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setDomainToDelete(domain.id); }}
                className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100"
              >
                ×
              </button>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-white font-medium">{domain.stats.active}</span>
                <span className="text-[var(--muted)]"> active</span>
              </div>
              <div>
                <span className="text-green-400 font-medium">{domain.stats.done}</span>
                <span className="text-[var(--muted)]"> done</span>
              </div>
              <div>
                <span className="text-[var(--muted)]">{domain.stats.total} total</span>
              </div>
            </div>
          </div>
        ))}
      </div>}

      {/* Table View */}
      {viewMode === 'list' && <div className="bg-[var(--card-bg)] rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-color)]">
              {show('icon') && <th className="w-12 px-4 py-3"></th>}
              {show('name') && (
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Name</th>
              )}
              {show('priority') && (
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-32">Priority</th>
              )}
              {show('taskCount') && (
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-24">Tasks</th>
              )}
              {show('active') && (
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-24">Active</th>
              )}
              {show('done') && (
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-24">Done</th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-16">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {filteredDomains.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-[var(--muted)]">
                  No domains found
                </td>
              </tr>
            ) : (
              filteredDomains.map(domain => (
                <tr
                  key={domain.id}
                  className="hover:bg-[var(--card-hover)] cursor-pointer transition-colors"
                  onClick={() => handleEditDomain(domain)}
                >
                  {show('icon') && (
                    <td className="px-4 py-3 text-center">
                      <span className="text-xl">{domain.icon || '📁'}</span>
                    </td>
                  )}
                  {show('name') && (
                    <td className="px-4 py-3">
                      <span className="text-white font-medium">{domain.name}</span>
                    </td>
                  )}
                  {show('priority') && (
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${getDomainPriorityColor(domain.priority)}`}>
                        {domain.priority.split(' - ')[1]}
                      </span>
                    </td>
                  )}
                  {show('taskCount') && (
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">
                      {domain.stats.total}
                    </td>
                  )}
                  {show('active') && (
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">
                      {domain.stats.active}
                    </td>
                  )}
                  {show('done') && (
                    <td className="px-4 py-3 text-sm text-green-400">
                      {domain.stats.done}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setDomainToDelete(domain.id); }}
                      className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>}

      {/* Modals */}
      <Modal
        isOpen={isDomainModalOpen}
        onClose={() => { setIsDomainModalOpen(false); setEditingDomain(null); }}
        title={editingDomain ? 'Edit Domain' : 'Create Domain'}
      >
        <DomainForm
          domain={editingDomain}
          onSubmit={handleDomainSubmit}
          onCancel={() => { setIsDomainModalOpen(false); setEditingDomain(null); }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={domainToDelete !== null}
        onClose={() => setDomainToDelete(null)}
        onConfirm={handleConfirmDeleteDomain}
        title="Delete Domain"
        message="Are you sure you want to delete this domain? Tasks will be unassigned but not deleted."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
