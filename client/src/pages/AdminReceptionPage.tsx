import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, apiRequest } from '../api';
import { useAuth } from '../auth/AuthContext';
import type { Announcement } from '../types/announcement';
import { ACCEPTED_TYPES, MAX_PHOTOS, photoError } from '../utils/photoRules';

// FR-32: the reception staff declare an object handed to them. The photo is the only mandatory
// field; the title, category, place and date are filled in by the server.
export default function AdminReceptionPage() {
  const { token, signOut } = useAuth();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<File[]>([]);
  const [hiddenDetail, setHiddenDetail] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const previews = useMemo(() => photos.map((photo) => URL.createObjectURL(photo)), [photos]);

  function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = '';
    const problems: string[] = [];
    const valid = chosen.filter((file) => {
      const problem = photoError(file);
      if (problem) problems.push(problem);
      return !problem;
    });
    if (valid.length > MAX_PHOTOS - photos.length) problems.push(`You can add up to ${MAX_PHOTOS} photos.`);
    setPhotos([...photos, ...valid.slice(0, MAX_PHOTOS - photos.length)]);
    setError(problems.join(' '));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (photos.length === 0) {
      setError('Add at least one photo.');
      return;
    }
    setError('');
    setSending(true);
    const body = new FormData();
    if (hiddenDetail.trim()) body.append('hiddenDetail', hiddenDetail.trim());
    photos.forEach((photo) => body.append('photos', photo));
    try {
      const data = await apiRequest<{ announcement: Announcement }>('/admin/announcements', {
        method: 'POST',
        token,
        body,
      });
      navigate(`/announcements/${data.announcement.id}`, {
        state: { notice: 'The object is declared at the reception.' },
      });
    } catch (err) {
      if ((err as ApiError).status === 401) signOut();
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="card wide-card">
      <h1>Declare an object at the reception</h1>
      <p className="intro">Add 1 to 4 photos. The other fields are filled in automatically (Unidentified, today).</p>
      <form onSubmit={submit}>
        <div className="photos-field">
          <span className="field-title">
            Photos (1 to 4) <span className="optional"> · JPEG, PNG or WebP, 5 MB max each</span>
          </span>
          {previews.length > 0 && (
            <ul className="photo-previews">
              {previews.map((url, index) => (
                <li key={url}>
                  <img src={url} alt={`Photo ${index + 1}`} />
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => setPhotos(photos.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          {photos.length < MAX_PHOTOS && (
            <input type="file" accept={ACCEPTED_TYPES.join(',')} multiple onChange={addPhotos} />
          )}
        </div>
        <label>
          Hidden detail <span className="optional">(optional)</span>
          <input
            type="text"
            value={hiddenDetail}
            maxLength={200}
            onChange={(event) => setHiddenDetail(event.target.value)}
            placeholder="A detail only the owner knows. It is never shown publicly."
          />
        </label>
        <button className="primary" disabled={sending}>
          {sending ? 'Sending…' : 'Declare'}
        </button>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
