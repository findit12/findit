import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { ApiError, apiRequest } from '../api';
import { useAuth } from '../auth/AuthContext';
import AdminGrid from '../components/AdminGrid';

// A row of GET /api/reports/admin/users.
interface UserRow {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  status: string;
  isVerified: boolean;
  createdAt: string;
}

// A row of GET /api/reports/admin/audit-log.
interface AuditRow {
  id: number;
  adminId: number;
  action: string;
  targetType: string;
  targetId: number;
  createdAt: string;
}

// FR-19: the accounts (block / unblock) and the audit trail of the moderation, in AG Grid tables.
export default function AdminUsersPage() {
  const { token, userId, signOut } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    try {
      const [userList, auditList] = await Promise.all([
        apiRequest<UserRow[]>('/reports/admin/users', { token }),
        apiRequest<AuditRow[]>('/reports/admin/audit-log', { token }),
      ]);
      setUsers(userList);
      setAudit(auditList);
    } catch (err) {
      if ((err as ApiError).status === 401) signOut();
      setError((err as Error).message);
    }
  }, [token, signOut]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = useCallback(
    async (user: UserRow, action: 'block' | 'unblock') => {
      const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;
      if (!window.confirm(`${action === 'block' ? 'Block' : 'Unblock'} ${name}?`)) return;
      setError('');
      setSuccess('');
      try {
        await apiRequest(`/reports/admin/users/${user.id}/${action}`, { method: 'PATCH', token });
        setSuccess(action === 'block' ? `${name} is blocked: their session stops at once.` : `${name} is unblocked.`);
        await load();
      } catch (err) {
        if ((err as ApiError).status === 401) signOut();
        setError((err as Error).message);
      }
    },
    [token, signOut, load],
  );

  const userColumns = useMemo<ColDef<UserRow>[]>(
    () => [
      { headerName: '#', field: 'id', maxWidth: 80 },
      { headerName: 'First name', field: 'firstName' },
      { headerName: 'Last name', field: 'lastName' },
      { headerName: 'Email', field: 'email', minWidth: 200 },
      { headerName: 'Role', field: 'role', maxWidth: 110 },
      { headerName: 'Status', field: 'status', maxWidth: 130 },
      { headerName: 'Verified', field: 'isVerified', maxWidth: 110 },
      {
        headerName: 'Created on',
        field: 'createdAt',
        filter: 'agDateColumnFilter',
        valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleDateString() : ''),
      },
      {
        headerName: 'Actions',
        sortable: false,
        filter: false,
        minWidth: 130,
        cellRenderer: (p: ICellRendererParams<UserRow>) => {
          const user = p.data;
          // An administrator cannot be blocked, and nobody blocks themselves.
          if (!user || user.role === 'admin' || user.id === userId) return null;
          return (
            <div className="grid-actions">
              {user.status === 'suspended' ? (
                <button onClick={() => changeStatus(user, 'unblock')}>Unblock</button>
              ) : (
                <button className="danger" onClick={() => changeStatus(user, 'block')}>
                  Block
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [changeStatus, userId],
  );

  const auditColumns = useMemo<ColDef<AuditRow>[]>(
    () => [
      {
        headerName: 'Date',
        field: 'createdAt',
        filter: 'agDateColumnFilter',
        valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleString() : ''),
      },
      { headerName: 'Administrator', field: 'adminId', maxWidth: 150 },
      { headerName: 'Action', field: 'action', maxWidth: 130 },
      { headerName: 'Target', field: 'targetType', maxWidth: 150 },
      { headerName: 'Target #', field: 'targetId', maxWidth: 120 },
    ],
    [],
  );

  return (
    <section className="card admin-card">
      <h1>Users</h1>
      <p className="intro">Block an abusive account, or unblock it. A blocked user loses access at once.</p>
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

      <h2>Accounts</h2>
      <AdminGrid rows={users} columns={userColumns} emptyText="No account yet." />

      <h2>Audit trail</h2>
      <AdminGrid rows={audit} columns={auditColumns} emptyText="No moderation action yet." />
    </section>
  );
}
