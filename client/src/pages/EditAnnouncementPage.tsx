import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, apiRequest } from '../api';
import { useAuth } from '../auth/AuthContext';
import AnnouncementForm, { valuesFromAnnouncement } from '../components/AnnouncementForm';
import { Announcement, AnnouncementFormValues, ReferenceData } from '../types/announcement';

// Page /announcements/:id/edit: the form, filled with the current values, sent as JSON.
export default function EditAnnouncementPage() {
  const { id } = useParams();
  const { token, signOut } = useAuth();
  const navigate = useNavigate();

  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // The two requests run at the same time; the page waits for both.
    Promise.all([
      apiRequest<ReferenceData>('/reference-data'),
      apiRequest<{ announcement: Announcement }>(`/announcements/mine/${id}`, { token }),
    ])
      .then(([referenceData, data]) => {
        setReference(referenceData);
        setAnnouncement(data.announcement);
      })
      .catch((err: ApiError) => {
        if (err.status === 401) signOut();
        setError(err.message);
      });
  }, [id, token, signOut]);

  async function save(values: AnnouncementFormValues) {
    try {
      await apiRequest(`/announcements/${id}`, {
        method: 'PATCH',
        token,
        body: {
          title: values.title,
          categoryId: Number(values.categoryId),
          objectTypeId: Number(values.objectTypeId),
          description: values.description,
          brand: values.brand,
          color: values.color,
          eventDate: values.eventDate,
          placeId: Number(values.placeId),
          placeDetails: values.placeDetails,
          hiddenDetail: values.hiddenDetail,
        },
      });
      navigate(`/announcements/${id}`, { state: { notice: 'Your changes are saved.' } });
    } catch (err) {
      if ((err as ApiError).status === 401) signOut();
      throw err; // shown by the form, which keeps the values
    }
  }

  return (
    <section className="card wide-card">
      <h1>Edit the announcement</h1>
      {error && <p className="notice error">{error}</p>}
      {reference && announcement && (
        <AnnouncementForm
          type={announcement.type}
          reference={reference}
          initialValues={valuesFromAnnouncement(announcement)}
          mode="edit"
          submitLabel="Save changes"
          onSubmit={save}
        />
      )}
    </section>
  );
}
