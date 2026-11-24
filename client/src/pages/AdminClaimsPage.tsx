import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { ApiError, apiRequest } from '../api';
import { useAuth } from '../auth/AuthContext';
import AdminGrid from '../components/AdminGrid';

// A row of GET /api/admin/claims.
interface ClaimRow {
  id: number;
  announcementId: number;
  announcementTitle: string;
  hiddenDetail: string | null;
  proof: string;
  claimant: { id: number; firstName: string | null; lastName: string | null };
  createdAt: string;
}

// FR-16 and FR-19: the reception claims, in an AG Grid table. The staff compare the proof with
// the hidden detail, then confirm the handover or decline the claim.
export default function AdminClaimsPage() {
  const { token, signOut } = useAuth();
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<{ claims: ClaimRow[] }>('/admin/claims', { token });
      setClaims(data.claims);
    } catch (err) {
      if ((err as ApiError).status === 401) signOut();
      setError((err as Error).message);
    }
  }, [token, signOut]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (claim: ClaimRow, action: 'confirm-handover' | 'decline') => {
      const question =
        action === 'confirm-handover'
          ? `Confirm the handover of "${claim.announcementTitle}"? It becomes Returned.`
          : 'Decline this claim? The claimant is notified.';
      if (!window.confirm(question)) return;
      setError('');
      setSuccess('');
      try {
        await apiRequest(`/admin/claims/${claim.id}/${action}`, { method: 'POST', token });
        setSuccess(action === 'confirm-handover' ? 'Handover confirmed.' : 'Claim declined.');
        await load();
      } catch (err) {
        if ((err as ApiError).status === 401) signOut();
        setError((err as Error).message);
      }
    },
    [token, signOut, load],
  );

  const columns = useMemo<ColDef<ClaimRow>[]>(
    () => [
      { headerName: '#', field: 'id', maxWidth: 80 },
      {
        headerName: 'Announcement',
        valueGetter: (p) => p.data?.announcementTitle,
        cellRenderer: (p: ICellRendererParams<ClaimRow>) =>
          p.data ? <Link to={`/announcements/${p.data.announcementId}`}>{p.data.announcementTitle}</Link> : null,
        minWidth: 160,
      },
      { headerName: 'Hidden detail (finder)', field: 'hiddenDetail', minWidth: 200, tooltipField: 'hiddenDetail' },
      { headerName: 'Proof (claimant)', field: 'proof', minWidth: 200, tooltipField: 'proof' },
      {
        headerName: 'Claimant',
        valueGetter: (p) => `${p.data?.claimant.firstName ?? ''} ${p.data?.claimant.lastName ?? ''}`.trim(),
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
        minWidth: 240,
        cellRenderer: (p: ICellRendererParams<ClaimRow>) => {
          const claim = p.data;
          if (!claim) return null;
          return (
            <div className="grid-actions">
              <button onClick={() => act(claim, 'confirm-handover')}>Confirm handover</button>
              <button className="danger" onClick={() => act(claim, 'decline')}>
                Decline
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
      <h1>Reception claims</h1>
      <p className="intro">Compare the proof with the hidden detail, then confirm the handover or decline the claim.</p>
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
      <AdminGrid rows={claims} columns={columns} emptyText="There are no pending claims." />
    </section>
  );
}
