import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Archive, ArchiveRestore, CheckCircle2, Download, Eye, Repeat, Trash2, Upload } from 'lucide-react';
import { db } from '../lib/db';
import { Empty, Modal, PageHeader, useUI } from '../components/ui';
import { BankSummary, QuestionList } from '../components/BankPreview';
import { activateBank, archiveBank, deleteBank, restoreBank, toBankFile } from '../lib/banks';
import { downloadJSON, slug } from '../lib/util';
import type { Bank } from '../types';

export default function Banks() {
  const banks = useLiveQuery(() => db.banks.orderBy('importedAt').reverse().toArray(), []);
  const ui = useUI();
  const nav = useNavigate();
  const [preview, setPreview] = useState<Bank | null>(null);
  if (!banks) return null;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); ui.toast(ok, 'success'); } catch (e) { ui.toast(`Failed: ${(e as Error).message}`, 'error'); }
  };
  const onDelete = async (b: Bank) => {
    if (await ui.confirm({ title: 'Delete question bank?', danger: true, confirmLabel: 'Delete',
      body: <p>“{b.title}” will be permanently removed. Your test history keeps its own question snapshots and is not affected.</p> }))
      run(() => deleteBank(b.id), 'Question bank deleted');
  };
  const onArchive = async (b: Bank) => {
    if (await ui.confirm({ title: 'Archive question bank?', confirmLabel: 'Archive',
      body: <p>“{b.title}” will be moved to the archive and can be restored later.</p> }))
      run(() => archiveBank(b.id), 'Question bank archived');
  };

  const Group = ({ title, items }: { title: string; items: Bank[] }) => items.length === 0 ? null : (
    <div className="mt">
      <h3 style={{ marginBottom: 10 }}>{title}</h3>
      <div className="stack" style={{ gap: 10 }}>
        {items.map((b) => (
          <div className="bank" key={b.id}>
            <div>
              <div className="row gap" style={{ gap: 8 }}>
                <b>{b.title}</b>
                <span className={`chip ${b.status === 'active' ? 'chip-active' : b.status === 'archived' ? 'chip-archived' : ''}`}>{b.status === 'available' ? 'library' : b.status}</span>
              </div>
              <div className="caption">{b.subject} · {b.questions.length} questions · {b.durationMinutes} min · {b.totalMarks} marks · {b.sections.length} section(s)</div>
            </div>
            <div className="bank-actions">
              <button className="btn btn-sm" onClick={() => setPreview(b)}><Eye size={14} /> Preview</button>
              {b.status !== 'active' && b.status !== 'archived' && <button className="btn btn-sm" onClick={() => run(() => activateBank(b.id), 'Question bank activated')}><CheckCircle2 size={14} /> Activate</button>}
              {b.status === 'active' && <button className="btn btn-sm" onClick={() => nav('/import?mode=replace')}><Repeat size={14} /> Replace</button>}
              {b.status === 'archived'
                ? <button className="btn btn-sm" onClick={() => run(() => restoreBank(b.id), 'Question bank restored')}><ArchiveRestore size={14} /> Restore</button>
                : <button className="btn btn-sm" onClick={() => onArchive(b)}><Archive size={14} /> Archive</button>}
              <button className="btn btn-sm" onClick={() => downloadJSON(`${slug(b.setId)}.json`, toBankFile(b))}><Download size={14} /> Export</button>
              <button className="btn btn-sm btn-danger" onClick={() => onDelete(b)}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <PageHeader title="Question Banks" sub="Each bank is an independent, replaceable question set."
        actions={<>
          <Link className="btn" to="/import"><Upload size={15} /> Import Questions</Link>
          <Link className="btn btn-primary" to="/import?mode=replace"><Repeat size={15} /> Replace Active Question Bank</Link>
        </>} />
      {banks.length === 0 ? (
        <Empty title="No question banks" text="Import a JSON question bank to get started. You can download a template or a sample on the import page."
          action={<Link className="btn btn-primary" to="/import">Import Questions</Link>} />
      ) : (
        <>
          <Group title="Active" items={banks.filter((b) => b.status === 'active')} />
          <Group title="Library" items={banks.filter((b) => b.status === 'available')} />
          <Group title="Archived" items={banks.filter((b) => b.status === 'archived')} />
        </>
      )}
      {preview && (
        <Modal title={preview.title} wide onClose={() => setPreview(null)} footer={<button className="btn" onClick={() => setPreview(null)}>Close</button>}>
          <BankSummary bank={preview} />
          <div className="mt-s" />
          <QuestionList bank={preview} />
        </Modal>
      )}
    </>
  );
}
