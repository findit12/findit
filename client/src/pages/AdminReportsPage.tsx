import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { ApiError, apiRequest } from '../api';
import { useAuth } from '../auth/AuthContext';
import AdminGrid from '../components/AdminGrid';

// A row of the moderation queue (GET /api/reports/admin/queue).
interface Report {
  id: number;
  reason: string;
  status: string;
  createdAt: string;
  announcement: { id: number; title: string; type: string; status: string; authorId: number };
  reporter: { id: number; email: string; firstName: string | null; lastName: string | null };
}

// A hidden announcement (GET /api/reports/admin/announcements/hidden).
interface HiddenAnnouncement {
  id: number;
  title: string;
  type: string;
  authorId: number;
  createdAt: string;
}

// UC-4 and FR-19: the moderation queue and the hidden announcements, in AG Grid tables.
export default function AdminReportsPage() {
  const { token, signOut } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [hidden, setHidden] = useState<HiddenAnnouncement[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    try {
      const [queue, hiddenList] = await Promise.all([
        apiRequest<Report[]>('/reports/admin/queue', { token }),
        apiRequest<HiddenAnnouncement[]>('/reports/admin/announcements/hidden', { token }),
      ]);
      setReports(queue);
      setHidden(hiddenList);
    } catch (err) {
      if ((err as ApiError).status === 401) signOut();
      setError((err as Error).message);
    }
  }, [token, signOut]);

  useEffect(() => {
    void load();
  }, [load]);

  // Every action asks for a confirmation, calls the API, then reloads both tables.
  const act = useCallback(
    async (path: string, method: 'PATCH' | 'DELETE', question: string, done: string) => {
      if (!window.confirm(question)) return;
      setError('');
      setSuccess('');
      try {
        await apiRequest(path, { method, token });
        setSuccess(done);
        await load();
      } catch (err) {
        if ((err as ApiError).status === 401) signOut();
        setError((err as Error).message);
      }
    },
    [token, signOut, load],
  );

  const reportColumns = useMemo<ColDef<Report>[]>(
    () => [
      { headerName: '#', field: 'id', maxWidth: 80 },
      {
        headerName: 'Announcement',
        valueGetter: (p) => p.data?.announcement.title,
        cellRenderer: (p: ICellRendererParams<Report>) =>
          p.data ? <Link to={`/announcements/${p.data.announcement.id}`}>{p.data.announcement.title}</Link> : null,
        minWidth: 160,
      },
      { headerName: 'Type', valueGetter: (p) => p.data?.announcement.type, maxWidth: 100 },
      { headerName: 'Reason', field: 'reason', minWidth: 200, tooltipField: 'reason' },
      {
        headerName: 'Reported by',
        valueGetter: (p) => `${p.data?.reporter.firstName ?? ''} ${p.data?.reporter.lastName ?? ''}`.trim(),
      },
      {
        headerName: 'Date',
        field: 'createdAt',
        filter: 'agDateColumnFilter',
        valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleString() : ''),
      },
      {
        headerName: 'Actions',
        sortable: false,
        filter: false,
        minWidth: 330,
        cellRenderer: (p: ICellRendererParams<Report>) => {
          const r = p.data;
          if (!r) return null;
          return (
            <div className="grid-actions">
              <button
                onClick={() =>
                  act(`/reports/admin/announcements/${r.announcement.id}/hide`, 'PATCH', 'Hide this announcement?', 'Announcement hidden.')
                }
              >
                Hide
              </button>
              <button
                className="danger"
                onClick={() =>
                  act(`/reports/admin/announcements/${r.announcement.id}`, 'DELETE', 'Delete this announcement? It disappears from FindIt.', 'Announcement deleted.')
                }
              >
                Delete
              </button>
              <button
                className="danger"
                onClick={() =>
                  act(`/reports/admin/users/${r.announcement.authorId}/block`, 'PATCH', 'Block the author of this announcement?', 'User blocked.')
                }
              >
                Block author
              </button>
              <button onClick={() => act(`/reports/admin/${r.id}`, 'DELETE', 'Dismiss this report?', 'Report dismissed.')}>
                Dismiss
              </button>
            </div>
          );
        },
      },
    ],
    [act],
  );

  const hiddenColumns = useMemo<ColDef<HiddenAnnouncement>[]>(
    () => [
      { headerName: '#', field: 'id', maxWidth: 80 },
      { headerName: 'Title', field: 'title' },
      { headerName: 'Type', field: 'type', maxWidth: 110 },
      { headerName: 'Author', field: 'authorId', maxWidth: 110 },
      {
        headerName: 'Declared on',
        field: 'createdAt',
        filter: 'agDateColumnFilter',
        valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleDateString() : ''),
      },
      {
        headerName: 'Actions',
        sortable: false,
        filter: false,
        minWidth: 190,
        cellRenderer: (p: ICellRendererParams<HiddenAnnouncement>) => {
          const a = p.data;
          if (!a) return null;
          return (
            <div className="grid-actions">
              <button onClick={() => act(`/reports/admin/announcements/${a.id}/restore`, 'PATCH', 'Make this announcement visible again?', 'Announcement restored.')}>
                Restore
              </button>
              <button
                className="danger"
                onClick={() => act(`/reports/admin/announcements/${a.id}`, 'DELETE', 'Delete this announcement?', 'Announcement deleted.')}
              >
                Delete
              </button>
            </div>
          );
        },
      },
    ],
    [act],
  );

  return (
    <section className="card admin-card">
      <h1>Report moderation</h1>
      <p className="intro">Review the reported announcements. Every action is written in the audit trail.</p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="notice success" role="status">
          {success}
        </p>
      )}

      <h2>Pending reports</h2>
      <AdminGrid rows={reports} columns={reportColumns} emptyText="There are no pending reports." />

      <h2>Hidden announcements</h2>
      <AdminGrid rows={hidden} columns={hiddenColumns} emptyText="No announcement is hidden." />
    </section>
  );
}
