'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EventForm, { EventFormData } from '@/components/EventForm';
import { useToast } from '@/components/Toast';
import { useEvents, useDomains, createEvent, updateEventData, deleteEvent } from '@/lib/hooks';
import { Event } from '@/types';

export default function EventsPage() {
  const events = useEvents();
  const domains = useDomains();

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Categorize events
  const { today, upcoming, past } = useMemo(() => {
    const today: Event[] = [];
    const upcoming: Event[] = [];
    const past: Event[] = [];

    for (const event of events) {
      if (event.date === todayStr) {
        today.push(event);
      } else if (event.date > todayStr) {
        upcoming.push(event);
      } else {
        past.push(event);
      }
    }

    return { today, upcoming, past };
  }, [events, todayStr]);

  const { showToast } = useToast();

  // Handlers
  function handleOpenCreate() {
    setEditingEvent(null);
    setIsModalOpen(true);
  }

  function handleEdit(event: Event) {
    setEditingEvent(event);
    setIsModalOpen(true);
  }

  async function handleSubmit(data: EventFormData) {
    try {
      if (editingEvent) {
        await updateEventData(editingEvent.id, data);
      } else {
        await createEvent(data);
      }
      setIsModalOpen(false);
      setEditingEvent(null);
    } catch { showToast('Failed to save event', 'error'); }
  }

  async function handleConfirmDelete() {
    try {
      if (eventToDelete) {
        await deleteEvent(eventToDelete);
        setEventToDelete(null);
      }
    } catch { showToast('Failed to delete event', 'error'); }
  }

  function renderEvent(event: Event) {
    const domainInfo = event.domain;
    const isPast = event.date < todayStr;

    return (
      <div
        key={event.id}
        onClick={() => handleEdit(event)}
        className={`bg-[var(--card-bg)] rounded-lg p-4 group hover:bg-[var(--card-hover)] cursor-pointer transition-colors border-l-3 border-indigo-500 ${
          isPast ? 'opacity-60' : ''
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate">{event.eventName}</p>
            <div className="flex items-center gap-3 mt-1 text-sm text-[var(--muted)]">
              <span>{format(new Date(event.date + 'T00:00:00'), 'EEE, MMM d')}</span>
              {event.time && <span>{new Date(`2000-01-01T${event.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>}
              {event.duration && <span>{event.duration}min</span>}
            </div>
            <div className="flex items-center gap-2 mt-2">
              {domainInfo && (
                <span className="text-xs text-[var(--muted)] bg-[var(--background)] px-2 py-0.5 rounded">
                  {domainInfo.icon || '📁'} {domainInfo.name}
                </span>
              )}
              {event.recurrence !== 'None' && (
                <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                  {event.recurrence}
                </span>
              )}
              {event.actionPoints && (
                <span className="text-xs text-[var(--muted)] bg-[var(--background)] px-2 py-0.5 rounded">
                  AP: {event.actionPoints}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setEventToDelete(event.id); }}
            className="text-red-400 hover:text-red-300 text-sm opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity ml-2"
            aria-label={`Delete "${event.eventName}"`}
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">Events</h1>
          <p className="text-[var(--muted)]">
            {events.length} total events ({today.length} today, {upcoming.length} upcoming)
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        >
          + New Event
        </button>
      </div>

      {/* Today Section */}
      {today.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            Today
          </h2>
          <div className="space-y-3">
            {today.map(renderEvent)}
          </div>
        </div>
      )}

      {/* Upcoming Section */}
      {upcoming.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Upcoming
          </h2>
          <div className="space-y-3">
            {upcoming.map(renderEvent)}
          </div>
        </div>
      )}

      {/* Past Section */}
      {past.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-[var(--muted)] mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-500"></span>
            Past
          </h2>
          <div className="space-y-3">
            {past.map(renderEvent)}
          </div>
        </div>
      )}

      {/* Empty State */}
      {events.length === 0 && (
        <div className="bg-[var(--card-bg)] rounded-lg p-12 text-center">
          <div className="text-4xl mb-4">🕐</div>
          <h3 className="text-lg font-medium text-white mb-2">No events yet</h3>
          <p className="text-[var(--muted)] mb-6">
            Create your first event for appointments, meetings, or time commitments.
          </p>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            + Create Event
          </button>
        </div>
      )}

      {/* Modals */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingEvent(null); }}
        title={editingEvent ? 'Edit Event' : 'Create Event'}
        maxWidth="lg"
      >
        <EventForm
          key={editingEvent?.id ?? 'new'}
          event={editingEvent}
          domains={domains}
          onSubmit={handleSubmit}
          onCancel={() => { setIsModalOpen(false); setEditingEvent(null); }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={eventToDelete !== null}
        onClose={() => setEventToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Event"
        message="Are you sure you want to delete this event? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
