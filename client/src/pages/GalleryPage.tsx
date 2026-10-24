import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest, photoUrl } from '../api';
import type { ApiError } from '../api';
import type { Announcement, AnnouncementPage } from '../types/announcement';

const PAGE_SIZE = 20;

// Reads the page number from the address (?page=2). Anything invalid becomes page 1.
function readPage(value: string | null): number {
  const page = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(page) && page >= 1 ? page : 1;
}

// "2026-10-10" -> "10/10/2026" (written by hand to avoid time zone shifts).
function formatDate(day: string): string {
  return day.split('-').reverse().join('/');
}

function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const isFound = announcement.type === 'found';
  const firstPhoto = announcement.photos[0];
  return (
    <li>
      <Link className="gallery-item" to={`/announcements/${announcement.id}`}>
        {firstPhoto ? (
          <img className="gallery-photo" src={photoUrl(firstPhoto)} alt={announcement.title} loading="lazy" />
        ) : (
          <div className="gallery-photo gallery-no-photo">No photo</div>
        )}
        <div className="gallery-body">
          <span className={`gallery-badge ${isFound ? 'badge-found' : 'badge-lost'}`}>
            {isFound ? 'Found' : 'Lost'}
          </span>
          <h2>{announcement.title}</h2>
          <p>
            {announcement.category.name} · {announcement.objectType.name}
          </p>
          <p>{announcement.place.name}</p>
          <p>{formatDate(announcement.eventDate)}</p>
        </div>
      </Link>
    </li>
  );
}

// SCRUM-22: public gallery, one page at a time. The page number is kept in the address.
export default function GalleryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = readPage(searchParams.get('page'));
  const [data, setData] = useState<AnnouncementPage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiRequest<AnnouncementPage>(`/announcements?page=${page}&limit=${PAGE_SIZE}`)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError('');
        }
      })
      .catch((err: ApiError) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  function goToPage(next: number) {
    setSearchParams({ page: String(next) });
    window.scrollTo({ top: 0 });
  }

  const meta = data?.meta;
  const items = data?.announcements ?? [];

  return (
    <section className="gallery">
      <h1>Lost and found objects</h1>
      {error && (
        <p className="notice error" role="status">
          {error}
        </p>
      )}
      {loading && <p className="intro">Loading...</p>}
      {!loading && !error && data && items.length === 0 && <p className="intro">No announcements found.</p>}
      {items.length > 0 && (
        <ul className="gallery-grid">
          {items.map((announcement) => (
            <AnnouncementCard key={announcement.id} announcement={announcement} />
          ))}
        </ul>
      )}
      {meta && (meta.totalPages > 1 || page > 1) && (
        <nav className="gallery-pagination" aria-label="Pagination">
          <button
            className="secondary"
            disabled={page <= 1}
            onClick={() => goToPage(Math.min(page - 1, meta.totalPages))}
          >
            Previous
          </button>
          <span>
            Page {page} of {meta.totalPages} · {meta.total} results
          </span>
          <button className="secondary" disabled={page >= meta.totalPages} onClick={() => goToPage(page + 1)}>
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
