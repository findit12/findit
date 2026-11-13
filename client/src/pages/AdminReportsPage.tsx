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
                  {report.announcement.type} · {report.announcement.status}
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
              </div>
            </li>
          ))}
        </ul>
      )}

      <p>
        <Link className="link-button" to="/gallery">
          Back to gallery
        </Link>
      </p>
    </section>
  );
}