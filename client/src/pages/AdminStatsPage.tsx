import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, apiRequest } from '../api';
import { useAuth } from '../auth/AuthContext';

interface RecoveryStatistics {
  declaredCount: number;
  returnedCount: number;
  recoveryRate: number;
  averageReturnTimeHours: number | null;
  averageReturnTimeDays: number | null;
  breakdown: {
    foundDeclared: number;
    lostDeclared: number;
    foundReturned: number;
    lostReturned: number;
    activeCount: number;
    closedCount: number;
    archivedCount: number;
    hiddenCount: number;
  };
}

function formatAvg(stats: RecoveryStatistics): string {
  if (stats.averageReturnTimeHours === null || stats.averageReturnTimeDays === null) return 'N/A (no returns yet)';
  if (stats.averageReturnTimeHours < 24) return `${stats.averageReturnTimeHours} h`;
  return `${stats.averageReturnTimeDays} d (${stats.averageReturnTimeHours} h)`;
}

export default function AdminStatsPage() {
  const { token, signOut } = useAuth();
  const [stats, setStats] = useState<RecoveryStatistics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest<RecoveryStatistics>('/announcements/admin/statistics', { token })
      .then((data) => { if (active) setStats(data); })
      .catch((err: ApiError) => {
        if (!active) return;
        if (err.status === 401) signOut();
        setError(err.message || 'Unable to load recovery statistics.');
      });
    return () => { active = false; };
  }, [token, signOut]);

  return (
    <section className="card wide-card">
      <h1>Recovery statistics</h1>
      <p className="intro">Platform performance indicators across all declared lost and found objects.</p>
      {error && <p className="notice error" role="alert">{error}</p>}
      {stats === null && !error && <p className="intro">Loading statistics...</p>}
      {stats && (
        <>
          <div className="stats-grid">
            <article className="stat-card">
              <span className="stat-label">Declared announcements</span>
              <strong className="stat-value">{stats.declaredCount}</strong>
              <small>{stats.breakdown.foundDeclared} found · {stats.breakdown.lostDeclared} lost</small>
            </article>
            <article className="stat-card">
              <span className="stat-label">Returned objects</span>
              <strong className="stat-value">{stats.returnedCount}</strong>
              <small>{stats.breakdown.foundReturned} found · {stats.breakdown.lostReturned} lost</small>
            </article>
            <article className="stat-card">
              <span className="stat-label">Recovery rate</span>
              <strong className="stat-value">{stats.recoveryRate}%</strong>
              <small>{stats.returnedCount} of {stats.declaredCount} declared</small>
            </article>
            <article className="stat-card">
              <span className="stat-label">Average return time</span>
              <strong className="stat-value">{formatAvg(stats)}</strong>
              <small>From declaration to return confirmation</small>
            </article>
          </div>
          <h2>Status breakdown</h2>
          <dl className="facts">
            <div><dt>Active (Available / Open)</dt><dd>{stats.breakdown.activeCount}</dd></div>
            <div><dt>Returned</dt><dd>{stats.returnedCount}</dd></div>
            <div><dt>Closed without return</dt><dd>{stats.breakdown.closedCount}</dd></div>
            <div><dt>Archived (expired)</dt><dd>{stats.breakdown.archivedCount}</dd></div>
            <div><dt>Hidden by moderation</dt><dd>{stats.breakdown.hiddenCount}</dd></div>
          </dl>
        </>
      )}
      <p>
        <Link className="secondary button-link" to="/admin/reports">Report moderation</Link>{' '}
        <Link className="secondary button-link" to="/gallery">Back to gallery</Link>
      </p>
    </section>
  );
}