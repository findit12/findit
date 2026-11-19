import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, apiRequest } from '../api';
import { useAuth } from '../auth/AuthContext';

interface Report {
  id: number;
  reason: string;
  status: string;
  createdAt: string;
  announcement: {
    id: number;
    title: string;
    type: string;
    status: string;
    authorId: number;
  };
  reporter: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export default function AdminReportsPage() {
  const { token, signOut } = useAuth();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    apiRequest<Report[]>('/reports/admin/queue', { token })
      .then((data) => {
        if (active) setReports(data);
      })
      .catch((err: ApiError) => {
        if (!active) return;
        if (err.status === 401) signOut();
        setError(err.message);
      });

    return () => {
      active = false;
    };
  }, [token, signOut]);

  async function handleAction(
    report: Report,
    path: string,
    method: 'PATCH' | 'DELETE',
    confirmText: string,
    successText: string,
    removeByAnnouncement = true,
  ) {
    if (!window.confirm(confirmText)) return;

    setError('');
    setSuccess('');
    setBusyId(report.id);

    try {
      await apiRequest(path, { method, token });
      setReports((current) =>
        current
          ? current.filter((item) =>
              removeByAnnouncement
                ? item.announcement.id !== report.announcement.id
                : item.id !== report.id,
            )
          : current,
      );
      setSuccess(successText);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 401) signOut();
      setError(apiErr.message || 'Moderation action failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="card wide-card">
      <h1>Report moderation</h1>

      <p className="intro">
        Review announcements reported by users.
      </p>

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

      {reports === null && !error && (
        <p className="intro">Loading reports...</p>
      )}

      {reports && reports.length === 0 && (
        <p className="intro">There are no pending reports.</p>
      )}

      {reports && reports.length > 0 && (
        <ul className="my-list">
          {reports.map((report) => (
            <li key={report.id}>
              <div>
                <div className="my-labels">
                  <span className="badge">Report #{report.id}</span>
                  <span className="status">{report.status}</span>
                </div>

                <h2>Reason for report</h2>
                <p>{report.reason}</p>

                <h3>Announcement</h3>
                <Link
                  className="my-title"
                  to={`/announcements/${report.announcement.id}`}
                >
                  {report.announcement.title}
                </Link>
                <small>
                  {report.announcement.type} ´ {report.announcement.status} · Author #{report.announcement.authorId}
                </small>

                <h3>Reported by</h3>
                <p>
                  {report.reporter.firstName} {report.reporter.lastName}
                </p>
                <small>{report.reporter.email}</small>

                <p>
                  <small>
                    Submitted: {new Date(report.createdAt).toLocaleString()}
                  </small>
                </p>

                <div className="owner-actions">
                  <button
                    type="button"
                    className="secondary"
                    disabled={busyId === report.id}
                    onClick={() =>
                      handleAction(
                        report,
                        `/reports/admin/announcements/${report.announcement.id}/hide` ,
                        'PATCH',
                        'Hide this announcement from public views?',
                        'Announcement hidden.',
                      )
                    }
                  >
                    Hide announcement
                  </button>

                  <button
                    type="button"
                    className="secondary danger"
                    disabled={busyId === report.id}
                    onClick={() =>
                      handleAction(
                        report,
                        `/reports/admin/announcements/${report.announcement.id}`,
                        'DELETE',
                        'Permanently remove this announcement from the platform?',
                        'Announcement deleted.',
                      )
                    }
                  >
                    Delete announcement
                  </button>

                  <button
                    type="button"
                    className="secondary danger"
                    disabled={busyId === report.id}
                    onClick={() =>
                      handleAction(
                        report,
                        `/reports/admin/users/${report.announcement.authorId}/block`,
                        'PATCH',
                        'Block the author of this announcement and revoke their session?',
                        'User account blocked.',
                        false,
                      )
                    }
                  >
                    Block user
                  </button>

                  <button
                    type="button"
                    className="secondary"
                    disabled={busyId === report.id}
                    onClick={() =>
                      handleAction(
                        report,
                        `/reports/admin/${report.id}` ,
                        'DELETE',
                        'Dismiss this report?',
                        'Report dismissed.',
                        false,
                      )
                    }
                  >
                    Dismiss report
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p>
        <Link className="secondary button-link" to="/gallery">
          Back to gallery
        </Link>
      </p>
    </section>
  );
}
