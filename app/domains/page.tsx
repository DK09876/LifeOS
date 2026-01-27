'use client';

import { useState, useMemo } from 'react';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import DomainForm, { DomainFormData } from '@/components/DomainForm';
import { useTasks, useDomains, createDomain, updateDomainData, deleteDomain } from '@/lib/hooks';
import { Domain } from '@/types';

type SortField = 'name' | 'priority' | 'taskCount';
type SortDirection = 'asc' | 'desc';

export default function DomainsPage() {
  const tasks = useTasks();
  const domains = useDomains();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Modal state
  const [isDomainModalOpen, setIsDomainModalOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [domainToDelete, setDomainToDelete] = useState<string | null>(null);

  // Filter and sort domains
  const filteredDomains = useMemo(() => {
    let result = [...domains];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(d => d.name.toLowerCase().includes(query));
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'priority':
          comparison = a.priority.localeCompare(b.priority);
          break;
        case 'taskCount':
          comparison = (a.taskCount || 0) - (b.taskCount || 0);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [domains, searchQuery, sortField, sortDirection]);

  // Get task stats for a domain
  const getDomainStats = (domainId: string) => {
    const domainTasks = tasks.filter(t => t.domainId === domainId);
    return {
      total: domainTasks.length,
      active: domainTasks.filter(t => t.status !== 'Done' && t.status !== 'Archived').length,
      done: domainTasks.filter(t => t.status === 'Done').length,
    };
  };

  // Handlers
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case '1 - Critical': return 'bg-red-500/20 text-red-400';
      case '2 - Important': return 'bg-orange-500/20 text-orange-400';
      case '3 - Maintenance': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-blue-500/20 text-blue-400';
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="opacity-30">↕</span>;
    return sortDirection === 'asc' ? <span>↑</span> : <span>↓</span>;
  };

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

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search domains..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded text-white placeholder-[var(--muted)] focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Grid View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {filteredDomains.map(domain => {
          const stats = getDomainStats(domain.id);
          return (
            <div
              key={domain.id}
              className="bg-[var(--card-bg)] rounded-lg p-4 hover:bg-[var(--card-hover)] cursor-pointer transition-colors"
              onClick={() => handleEditDomain(domain)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{domain.icon || '📁'}</span>
                  <div>
                    <h3 className="text-white font-medium">{domain.name}</h3>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs mt-1 ${getPriorityColor(domain.priority)}`}>
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
                  <span className="text-white font-medium">{stats.active}</span>
                  <span className="text-[var(--muted)]"> active</span>
                </div>
                <div>
                  <span className="text-green-400 font-medium">{stats.done}</span>
                  <span className="text-[var(--muted)]"> done</span>
                </div>
                <div>
                  <span className="text-[var(--muted)]">{stats.total} total</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table View */}
      <div className="bg-[var(--card-bg)] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-color)]">
          <h2 className="text-sm font-medium text-[var(--muted)]">All Domains</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-color)]">
              <th className="w-12 px-4 py-3"></th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider cursor-pointer hover:text-white"
                onClick={() => handleSort('name')}
              >
                Name <SortIcon field="name" />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider cursor-pointer hover:text-white w-32"
                onClick={() => handleSort('priority')}
              >
                Priority <SortIcon field="priority" />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider cursor-pointer hover:text-white w-24"
                onClick={() => handleSort('taskCount')}
              >
                Tasks <SortIcon field="taskCount" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-24">
                Active
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider w-16">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {filteredDomains.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                  No domains found
                </td>
              </tr>
            ) : (
              filteredDomains.map(domain => {
                const stats = getDomainStats(domain.id);
                return (
                  <tr
                    key={domain.id}
                    className="hover:bg-[var(--card-hover)] cursor-pointer transition-colors"
                    onClick={() => handleEditDomain(domain)}
                  >
                    <td className="px-4 py-3 text-center">
                      <span className="text-xl">{domain.icon || '📁'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white font-medium">{domain.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${getPriorityColor(domain.priority)}`}>
                        {domain.priority.split(' - ')[1]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">
                      {stats.total}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">
                      {stats.active}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDomainToDelete(domain.id); }}
                        className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

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
