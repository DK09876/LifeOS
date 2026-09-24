'use client';

/**
 * Things to remember, and lists to tick through.
 *
 * Kept apart from tasks on purpose: a shopping list or "the boiler code is
 * 4471" has nothing to prioritise, plan or finish, and putting them in the
 * backlog only made the backlog less honest about what is actually work.
 */

import { useState } from 'react';

import ConfirmDialog from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';
import { createNote, deleteNote, updateNote, useNotes } from '@/lib/hooks';
import type { Note } from '@/types';

const inputClass = 'w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

export default function NotesPage() {
  const notes = useNotes();
  const { showToast } = useToast();
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');

  const lists = notes.filter(n => n.kind === 'list');
  const plain = notes.filter(n => n.kind === 'note');

  async function add(kind: Note['kind']) {
    const title = newTitle.trim() || (kind === 'list' ? 'New list' : 'New note');
    try {
      await createNote({ title, kind });
      setNewTitle('');
    } catch { showToast('Could not create that', 'error'); }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white mb-1">Notes &amp; Lists</h1>
        <p className="text-[var(--muted)]">Things to remember and lists to tick through — no dates, no effort, no backlog</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Title (e.g. Shopping, Gift ideas)"
               aria-label="New note or list title"
               onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add('list'); } }}
               className={`${inputClass} flex-1 min-w-[12rem]`} />
        <button onClick={() => add('list')} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm">+ List</button>
        <button onClick={() => add('note')} className="px-3 py-2 rounded-lg bg-[var(--card-bg)] hover:bg-[var(--card-hover)] text-white text-sm border border-[var(--border-color)]">+ Note</button>
      </div>

      {notes.length === 0 && (
        <p className="text-[var(--muted)] bg-[var(--card-bg)] rounded-lg p-8 text-center">
          Nothing here yet. Start a shopping list, or jot down something you want to remember.
        </p>
      )}

      {lists.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-medium text-white mb-3">Lists</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lists.map(note => <ListCard key={note.id} note={note} onDelete={() => setToDelete(note.id)} />)}
          </div>
        </section>
      )}

      {plain.length > 0 && (
        <section>
          <h2 className="text-lg font-medium text-white mb-3">Notes</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plain.map(note => <NoteCard key={note.id} note={note} onDelete={() => setToDelete(note.id)} />)}
          </div>
        </section>
      )}

      <ConfirmDialog
        isOpen={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete) await deleteNote(toDelete); setToDelete(null); }}
        title="Delete"
        message="Delete this for good?"
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

function CardHeader({ note, onDelete }: { note: Note; onDelete: () => void }) {
  const [title, setTitle] = useState(note.title);
  return (
    <div className="flex items-center gap-2 mb-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)}
             onBlur={() => { if (title.trim() && title !== note.title) void updateNote(note.id, { title: title.trim() }); }}
             aria-label="Title"
             className="flex-1 min-w-0 bg-transparent text-white font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1" />
      <button onClick={() => updateNote(note.id, { pinned: !note.pinned })} title={note.pinned ? 'Unpin' : 'Pin to top'}
              className={`text-sm ${note.pinned ? 'opacity-100' : 'opacity-40 hover:opacity-80'}`}>📌</button>
      <button onClick={onDelete} title="Delete" className="text-sm text-red-400 hover:text-red-300">🗑️</button>
    </div>
  );
}

function ListCard({ note, onDelete }: { note: Note; onDelete: () => void }) {
  const [text, setText] = useState('');
  const open = note.items.filter(i => !i.done);
  const done = note.items.filter(i => i.done);

  const setItems = (items: Note['items']) => updateNote(note.id, { items });
  const addItem = () => {
    const value = text.trim();
    if (!value) return;
    void setItems([...note.items, { id: crypto.randomUUID(), text: value, done: false }]);
    setText('');
  };

  return (
    <div className="bg-[var(--card-bg)] rounded-lg p-4">
      <CardHeader note={note} onDelete={onDelete} />
      <div className="space-y-1">
        {[...open, ...done].map(item => (
          <div key={item.id} className="flex items-center gap-2 group">
            <input type="checkbox" checked={item.done} aria-label={item.text}
                   onChange={() => setItems(note.items.map(i => i.id === item.id ? { ...i, done: !i.done } : i))}
                   className="w-4 h-4 accent-green-500" />
            <span className={`flex-1 text-sm ${item.done ? 'text-[var(--muted)] line-through' : 'text-white'}`}>{item.text}</span>
            <button onClick={() => setItems(note.items.filter(i => i.id !== item.id))} aria-label={`Remove ${item.text}`}
                    className="text-xs text-[var(--muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100">✕</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add item" aria-label="Add item"
               onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
               className={inputClass} />
        <button onClick={addItem} className="px-3 rounded-lg bg-[var(--card-hover)] text-white text-sm">+</button>
      </div>
      {done.length > 0 && (
        <button onClick={() => setItems(open)} className="mt-2 text-xs text-[var(--muted)] hover:text-white">
          Clear {done.length} ticked
        </button>
      )}
    </div>
  );
}

function NoteCard({ note, onDelete }: { note: Note; onDelete: () => void }) {
  const [body, setBody] = useState(note.body);
  return (
    <div className="bg-[var(--card-bg)] rounded-lg p-4">
      <CardHeader note={note} onDelete={onDelete} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)}
                onBlur={() => { if (body !== note.body) void updateNote(note.id, { body }); }}
                rows={5} placeholder="Something to remember…" aria-label="Note"
                className={inputClass} />
    </div>
  );
}
