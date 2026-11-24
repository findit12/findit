import { useEffect, useState } from 'react';
import Highcharts from 'highcharts';
import { HighchartsReact } from 'highcharts-react-official';
import { ApiError, apiRequest } from '../api';
import { useAuth } from '../auth/AuthContext';

// Answer of GET /api/announcements/admin/statistics.
interface RecoveryStatistics {
  declaredCount: number;
  returnedCount: number;
  recoveryRate: number;
  averageReturnTimeHours: number | null;
  averageReturnTimeDays: number | null;
  registeredAccounts: number;
  monthly: { month: string; declared: number; returned: number }[];
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
  if (stats.averageReturnTimeHours === null || stats.averageReturnTimeDays === null) return 'N/A';
  if (stats.averageReturnTimeHours < 24) return `${stats.averageReturnTimeHours} h`;
  return `${stats.averageReturnTimeDays} d`;
}

// "2026-11" -> "Nov 2026".
function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// Colors of FindIt for the charts.
const FINDIT_COLORS = ['#ce1052', '#1f7a53', '#5c061e', '#e58fb0', '#9aa0a6'];

// FR-19 and SDD 3.4 "Goodie 2": the recovery statistics as Highcharts charts.
export default function AdminStatsPage() {
  const { token, signOut } = useAuth();
  const [stats, setStats] = useState<RecoveryStatistics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest<RecoveryStatistics>('/announcements/admin/statistics', { token })
      .then((data) => {
        if (active) setStats(data);
      })
      .catch((err: ApiError) => {
        if (!active) return;
        if (err.status === 401) signOut();
        setError(err.message || 'Unable to load recovery statistics.');
      });
    return () => {
      active = false;
    };
  }, [token, signOut]);

  // Declared vs returned per month (column chart).
  const monthlyChart: Highcharts.Options | null = stats && {
    chart: { type: 'column', backgroundColor: 'transparent' },
    title: { text: 'Declared and returned per month' },
    colors: FINDIT_COLORS,
    xAxis: { categories: stats.monthly.map((m) => monthLabel(m.month)) },
    yAxis: { min: 0, allowDecimals: false, title: { text: 'Announcements' } },
    series: [
      { type: 'column', name: 'Declared', data: stats.monthly.map((m) => m.declared) },
      { type: 'column', name: 'Returned', data: stats.monthly.map((m) => m.returned) },
    ],
    credits: { enabled: false },
  };

  // Where the declared announcements are now (pie chart).
  const statusChart: Highcharts.Options | null = stats && {
    chart: { type: 'pie', backgroundColor: 'transparent' },
    title: { text: 'Status of the declared announcements' },
    colors: FINDIT_COLORS,
    tooltip: { pointFormat: '<b>{point.y}</b> ({point.percentage:.1f}%)' },
    series: [
      {
        type: 'pie',
        name: 'Announcements',
        data: [
          { name: 'Active', y: stats.breakdown.activeCount },
          { name: 'Returned', y: stats.returnedCount },
          { name: 'Closed', y: stats.breakdown.closedCount },
          { name: 'Hidden', y: stats.breakdown.hiddenCount },
          { name: 'Archived', y: stats.breakdown.archivedCount },
        ],
      },
    ],
    credits: { enabled: false },
  };

  return (
    <section className="card admin-card">
      <h1>Recovery statistics</h1>
      <p className="intro">How well FindIt helps objects find their way back.</p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {stats === null && !error && <p className="intro">Loading statistics...</p>}
      {stats && (
        <>
          <div className="stats-grid">
            <article className="stat-card">
              <span className="stat-label">Declared</span>
              <strong className="stat-value">{stats.declaredCount}</strong>
              <small>
                {stats.breakdown.foundDeclared} found · {stats.breakdown.lostDeclared} lost
              </small>
            </article>
            <article className="stat-card">
              <span className="stat-label">Returned</span>
              <strong className="stat-value">{stats.returnedCount}</strong>
              <small>
                {stats.breakdown.foundReturned} found · {stats.breakdown.lostReturned} lost
              </small>
            </article>
            <article className="stat-card">
              <span className="stat-label">Recovery rate</span>
              <strong className="stat-value">{stats.recoveryRate}%</strong>
              <small>Goal: 50% (BRD)</small>
            </article>
            <article className="stat-card">
              <span className="stat-label">Average return time</span>
              <strong className="stat-value">{formatAvg(stats)}</strong>
              <small>From declaration to return</small>
            </article>
            <article className="stat-card">
              <span className="stat-label">Registered accounts</span>
              <strong className="stat-value">{stats.registeredAccounts}</strong>
              <small>All roles</small>
            </article>
          </div>

          <div className="charts-grid">
            <div className="chart-box">
              <HighchartsReact highcharts={Highcharts} options={monthlyChart} />
            </div>
            <div className="chart-box">
              <HighchartsReact highcharts={Highcharts} options={statusChart} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
