import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest, photoUrl } from '../api';
import type { ApiError } from '../api';
import type { Announcement, AnnouncementPage, AnnouncementType, ReferenceData } from '../types/announcement';
import { useAuth } from '../auth/AuthContext';

// SCRUM-23: the filters kept in the address (?categoryId=1&placeId=3...). The tab ("type") and
// the page are kept in the address too, but they are not filters.
const FILTER_KEYS = ['categoryId', 'objectTypeId', 'placeId', 'dateFrom', 'dateTo', 'q', 'sort'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

// FR-08: the two tabs of the gallery.
const TABS: { type: AnnouncementType; label: string }[] = [
  { type: 'found', label: 'Found objects' },
  { type: 'lost', label: 'Lost announcements' },
];

// Reads the page number from the address (?page=2). Anything invalid becomes page 1.
function readPage(value: string | null): number {
  const page = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(page) && page >= 1 ? page : 1;
}

// "2026-10-10" -> "10/10/2026" (written by hand to avoid time zone shifts).
function formatDate(day: string): string {
  return day.split('-').reverse().join('/');
}

// FR-23: "closest date" needs a date, "best match" needs a keyword. A sort that is no longer
// possible is removed from the address (the server would refuse it).
function removeImpossibleSort(params: URLSearchParams) {
  const sort = params.get('sort');
  const hasDate = Boolean(params.get('dateFrom') || params.get('dateTo'));
  if ((sort === 'closestDate' && !hasDate) || (sort === 'bestMatch' && !params.get('q'))) {
    params.delete('sort');
  }
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

// SCRUM-22 to SCRUM-27: public gallery, 12 announcements per page (the server decides the size).
// Everything (tab, filters, keyword, sort, page) is kept in the address, so a search can be
// shared, bookmarked, reloaded, and the Back button restores the previous one (FR-30).
export default function GalleryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = readPage(searchParams.get('page'));
  const type: AnnouncementType = searchParams.get('type') === 'lost' ? 'lost' : 'found';
  const filters: Record<FilterKey, string> = {
    categoryId: searchParams.get('categoryId') ?? '',
    objectTypeId: searchParams.get('objectTypeId') ?? '',
    placeId: searchParams.get('placeId') ?? '',
    dateFrom: searchParams.get('dateFrom') ?? '',
    dateTo: searchParams.get('dateTo') ?? '',
    q: searchParams.get('q') ?? '',
    sort: searchParams.get('sort') ?? '',
  };
  const hasFilters = FILTER_KEYS.some((key) => filters[key] !== '');
  const hasDate = Boolean(filters.dateFrom || filters.dateTo);

  // SCRUM-27: only signed-in users can save a search. The tab, the sort and the page are not saved.
  const { token } = useAuth();
  const [saveNotice, setSaveNotice] = useState<{ text: string; error: boolean } | null>(null);
  const canSave = Boolean(
    filters.categoryId || filters.objectTypeId || filters.placeId || filters.dateFrom || filters.dateTo || filters.q,
  );
  const [reference, setReference] = useState<ReferenceData | null>(null);
  // SCRUM-24: what is typed in the search box. The search starts when the form is sent.
  const [searchText, setSearchText] = useState(filters.q);
  // "Clear filters" or the Back button change the address: the box follows.
  useEffect(() => {
    setSearchText(filters.q);
  }, [filters.q]);

  // The address sent to the API: the tab, the page and every filter that is filled in.
  const apiQuery = new URLSearchParams({ type, page: String(page) });
  FILTER_KEYS.forEach((key) => {
    if (filters[key]) apiQuery.set(key, filters[key]);
  });
  const queryString = apiQuery.toString();

  // The lists of the filters (categories, objects, places) are loaded once.
  useEffect(() => {
    apiRequest<ReferenceData>('/reference-data')
      .then(setReference)
      .catch(() => setReference(null));
  }, []);
  const [data, setData] = useState<AnnouncementPage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiRequest<AnnouncementPage>('/announcements?' + queryString)
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
  }, [queryString]);

  // SCRUM-27: sends the current filters and keyword to the server.
  async function saveSearch() {
    const body: Record<string, string | number> = {};
    if (filters.categoryId) body.categoryId = Number(filters.categoryId);
    if (filters.objectTypeId) body.objectTypeId = Number(filters.objectTypeId);
    if (filters.placeId) body.placeId = Number(filters.placeId);
    if (filters.dateFrom) body.dateFrom = filters.dateFrom;
    if (filters.dateTo) body.dateTo = filters.dateTo;
    if (filters.q) body.q = filters.q;
    try {
      await apiRequest('/saved-searches', { method: 'POST', token, body });
      setSaveNotice({ text: 'Search saved. You will get an email when a new announcement matches.', error: false });
    } catch (err) {
      setSaveNotice({ text: (err as Error).message, error: true });
    }
  }

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(next));
    setSearchParams(params);
    window.scrollTo({ top: 0 });
  }

  // FR-29: changing the tab goes back to page 1 and keeps the filters.
  function changeTab(next: AnnouncementType) {
    const params = new URLSearchParams(searchParams);
    params.set('type', next);
    params.delete('page');
    setSearchParams(params);
  }

  // FR-29: changing a filter or the sort goes back to page 1. A new category empties the object filter.
  function changeFilter(key: FilterKey, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    if (key === 'categoryId') params.delete('objectTypeId');
    removeImpossibleSort(params);
    params.delete('page');
    setSaveNotice(null);
    setSearchParams(params);
  }

  // "Clear filters" keeps the tab.
  function clearFilters() {
    setSaveNotice(null);
    setSearchParams({ type });
  }

  const objectTypes = reference?.categories.find((c) => String(c.id) === filters.categoryId)?.objectTypes ?? [];
  const meta = data?.meta;
  const items = data?.data ?? [];

  return (
    <section className="gallery">
      <h1>Lost and found objects</h1>
      <div className="tabs gallery-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.type}
            type="button"
            role="tab"
            aria-selected={type === tab.type}
            className={type === tab.type ? 'active' : ''}
            onClick={() => changeTab(tab.type)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <form
        className="gallery-search"
        onSubmit={(event) => {
          event.preventDefault();
          changeFilter('q', searchText.trim());
        }}
      >
        <input
          type="search"
          value={searchText}
          maxLength={100}
          placeholder="Search by keyword (title, description, brand or color)"
          aria-label="Search by keyword"
          onChange={(event) => setSearchText(event.target.value)}
        />
        <button type="submit">Search</button>
      </form>
      <form className="gallery-filters" onSubmit={(event) => event.preventDefault()}>
        <label>
          Category
          <select value={filters.categoryId} onChange={(event) => changeFilter('categoryId', event.target.value)}>
            <option value="">All categories</option>
            {reference?.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Object
          <select
            value={filters.objectTypeId}
            disabled={!filters.categoryId}
            onChange={(event) => changeFilter('objectTypeId', event.target.value)}
          >
            <option value="">All objects</option>
            {objectTypes.map((objectType) => (
              <option key={objectType.id} value={objectType.id}>
                {objectType.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Place
          <select value={filters.placeId} onChange={(event) => changeFilter('placeId', event.target.value)}>
            <option value="">All places</option>
            {reference?.places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input type="date" value={filters.dateFrom} onChange={(event) => changeFilter('dateFrom', event.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={filters.dateTo} onChange={(event) => changeFilter('dateTo', event.target.value)} />
        </label>
        <label>
          Sort
          <select value={filters.sort || 'newest'} onChange={(event) => changeFilter('sort', event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="closestDate" disabled={!hasDate}>
              Closest date (choose a date)
            </option>
            <option value="bestMatch" disabled={!filters.q}>
              Best match (type a keyword)
            </option>
          </select>
        </label>
        {hasFilters && (
          <button type="button" className="secondary" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </form>
      {token && (
        <div className="gallery-save">
          <button type="button" className="secondary" disabled={!canSave} onClick={saveSearch}>
            Save this search
          </button>
          {!canSave && <small>Choose a filter or a keyword to save a search.</small>}
          {saveNotice && (
            <span className={'notice ' + (saveNotice.error ? 'error' : 'success')} role="status">
              {saveNotice.text}
            </span>
          )}
          {saveNotice && !saveNotice.error && (
            <Link className="link-button" to="/saved-searches">
              My saved searches
            </Link>
          )}
        </div>
      )}
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
      {/* FR-28: the current page, Previous / Next and the total number of results. */}
      {meta && (
        <nav className="gallery-pagination" aria-label="Pagination">
          <button className="secondary" disabled={!meta.hasPrevious} onClick={() => goToPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {meta.page} of {meta.totalPages} · {meta.totalItems} {meta.totalItems === 1 ? 'result' : 'results'}
          </span>
          <button className="secondary" disabled={!meta.hasNext} onClick={() => goToPage(page + 1)}>
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
