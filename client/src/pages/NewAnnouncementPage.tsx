import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, apiRequest } from '../api';
import { useAuth } from '../auth/AuthContext';
import AnnouncementForm from '../components/AnnouncementForm';
import { Announcement, AnnouncementFormValues, AnnouncementType, ReferenceData } from '../types/announcement';

// Pages "I found an object" (/announcements/new) and "I lost an object" (/announcements/new?type=lost):
// loads the lists, shows the form, sends it with the photos.
export default function NewAnnouncementPage() {
  const { token, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type: AnnouncementType = searchParams.get('type') === 'lost' ? 'lost' : 'found';
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    apiRequest<ReferenceData>('/reference-data')
      .then(setReference)
      .catch((error: Error) => setLoadError(error.message));
  }, []);

  async function send(values: AnnouncementFormValues, photos: File[]) {
    // A form with files is sent as multipart/form-data: every value becomes a text field.
    const body = new FormData();
    for (const [field, value] of Object.entries(values)) {
      if (value !== '') {
        body.append(field, value);
      }
    }
    photos.forEach((photo) => body.append('photos', photo));

    try {
      const data = await apiRequest<{ announcement: Announcement }>('/announcements', {
        method: 'POST',
        body,
        token,
      });
      navigate(`/announcements/${data.announcement.id}`, {
        state: { notice: 'Your announcement is published. A confirmation email is on its way.' },
      });
    } catch (error) {
      if ((error as ApiError).status === 401) {
        signOut(); // the session has expired: back to the sign-in page
      }
      throw error; // the form shows the message and keeps its values
    }
  }

  return (
    <section className="card wide-card">
      <h1>{type === 'found' ? 'I found an object' : 'I lost an object'}</h1>
      <p className="intro">
        {type === 'found'
          ? 'Describe the object so its owner can recognise it.'
          : 'Describe your object so a finder can recognise it.'}
      </p>
      {loadError && <p className="notice error">{loadError}</p>}
      {reference && (
        // key={type}: switching between "found" and "lost" starts a new, empty form.
        <AnnouncementForm key={type} type={type} reference={reference} mode="create" submitLabel="Publish" onSubmit={send} />
      )}
    </section>
  );
}
