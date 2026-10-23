import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api';
import type { ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import type { ReferenceData, SavedSearch } from '../types/announcement';

// "2026-10-10" -> "10/10/2026" (written by hand to avoid time zone shifts).
function formatDate(day: string): string {
  return day.split('-').reverse().join('/');
}

// Describes a saved search in words, for example: Electronics · Phone · Library · "keys".
function describe(search: SavedSearch, reference: ReferenceData | null): string {
  const category = reference?.categories.find((item) => item.id === search.categoryId);
  const objectType = category?.objectTypes.find((item) => item.id === search.objectTypeId);
  const place = reference?.places.find((item) => item.id === search.placeId);
  const parts: string[] = [];
  if (search.categoryId) parts.push(category?.name ?? 'Category ' + search.categoryId);
  if (search.objectTypeId) parts.push(objectType?.name ?? 'Object ' + search.objectTypeId);
  if (search.placeId) parts.push(place?.name ?? 'Place ' + search.placeId);
  if (search.dateFrom) parts.push('from ' + formatDate(search.dateFrom));
  if (search.dateTo) parts.push('to ' + formatDate(search.dateTo));
  if (search.q) parts.push('"' + search.q + '"');
  return parts.join(' · ');
}

// The address of the gallery with the same filters, to run the saved search again.
function galleryLink(search: SavedSearch): string {
  const params = new URLSearchParams();
  if (search.categoryId) params.set('categoryId', String(search.categoryId));
  if (search.objectTypeId) params.set('objectTypeId', String(search.objectTypeId));
  if (search.placeId) params.set('placeId', String(search.placeId));
  if (search.dateFrom) params.set('dateFrom', search.dateFrom);
  if (search.dateTo) params.set('dateTo', search.dateTo);
  if (search.q) params.set('q', search.q);
  return '/gallery?' + params.toString();
}

// SCRUM-27: the searches saved by the signed-in user. Each one sends an email when a new
// announcement matches.
export default function MySavedSearchesPage() {
  const { token, signOut } = useAuth();
  const [searches, setSearches] = useState<SavedSearch[] | null>(null);
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ savedSearches: SavedSearch[] }>('/saved-searches', { token })
      .then((data) => setSearches(data.savedSearches))
      .catch((err: ApiError) => {
        if (err.status === 401) signOut();
        setError(err.message);
      });
  }, [token, signOut]);

  // The names of the categories, objects and places, to write the searches in words.
  useEffect(() => {
    apiRequest<ReferenceData>('/reference-data')
      .then(setReference)
      .catch(() => setReference(null));
  }, []);

  async function remove(search: SavedSearch) {
    if (!window.confirm('Delete this saved search? You will no longer receive emails for it.')) {
      return;
    }
    try {
      await apiRequest('/saved-searches/' + search.id, { method: 'DELETE', token });
      setSearches((current) => (current ?? []).filter((item) => item.id !== search.id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="card wide-card">
      <h1>My saved searches</h1>
      <p className="intro">You receive an email when a new announcement matches one of these searches.</p>
      {error && <p className="notice error">{error}</p>}
      {searches && searches.length === 0 && (
        <p className="intro">
          You have no saved search yet. Choose filters in the <Link to="/gallery">gallery</Link>, then click
          "Save this search".
        </p>
      )}

      {searches && searches.length > 0 && (
        <ul className="my-list">
          {searches.map((search) => (
            <li key={search.id}>
              <div>
                <Link className="my-title" to={galleryLink(search)}>
                  {describe(search, reference)}
                </Link>
                <small>Saved on {new Date(search.createdAt).toLocaleDateString()}</small>
              </div>
              <div className="row-actions">
                <Link className="link-button" to={galleryLink(search)}>
                  Open
                </Link>
                <button className="link-button danger" onClick={() => remove(search)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
