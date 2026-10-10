import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, apiRequest } from '../api';
import { useAuth } from '../auth/AuthContext';
import AnnouncementForm from '../components/AnnouncementForm';
import { Announcement, AnnouncementFormValues, ReferenceData } from '../types/announcement';

// Page "I found an object": loads the lists, shows the form, sends it with the photos.
export default function NewAnnouncementPage() {
  const { token, signOut } = useAuth();
  const navigate = useNavigate();
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
      navigate(`/announcements/${data.announcement.id}`, { state: { created: true } });
    } catch (error) {
      if ((error as ApiError).status === 401) {
        signOut(); // the session has expired: back to the sign-in page
      }
      throw error; // the form shows the message and keeps its values
    }
  }

  return (
    <section className="card wide-card">
      <h1>I found an object</h1>
      <p className="intro">Describe the object so its owner can recognise it.</p>
      {loadError && <p className="notice error">{loadError}</p>}
      {reference && (
        <AnnouncementForm type="found" reference={reference} withPhotos submitLabel="Publish" onSubmit={send} />
      )}
    </section>
  );
}
