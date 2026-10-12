import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Announcement, AnnouncementFormValues, AnnouncementType, ReferenceData } from '../types/announcement';
import { ACCEPTED_TYPES, MAX_PHOTOS, photoError } from '../utils/photoRules';

// Today's date as "YYYY-MM-DD", used as the latest date that can be chosen.
function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function emptyValues(type: AnnouncementType): AnnouncementFormValues {
  return {
    type,
    title: '',
    categoryId: '',
    objectTypeId: '',
    description: '',
    brand: '',
    color: '',
    eventDate: today(),
    placeId: '',
    placeDetails: '',
    currentLocation: '',
    hiddenDetail: '',
  };
}

// Fills the form with an existing announcement, for the edit page.
export function valuesFromAnnouncement(announcement: Announcement): AnnouncementFormValues {
  return {
    type: announcement.type,
    title: announcement.title,
    categoryId: String(announcement.category.id),
    objectTypeId: String(announcement.objectType.id),
    description: announcement.description,
    brand: announcement.brand ?? '',
    color: announcement.color ?? '',
    eventDate: announcement.eventDate,
    placeId: String(announcement.place.id),
    placeDetails: announcement.placeDetails ?? '',
    currentLocation: announcement.currentLocation ?? '',
    hiddenDetail: announcement.hiddenDetail ?? '',
  };
}

interface AnnouncementFormProps {
  type: AnnouncementType;
  reference: ReferenceData;
  initialValues?: AnnouncementFormValues;
  // "create": photos and current location are asked. "edit": they are not changed.
  mode: 'create' | 'edit';
  submitLabel: string;
  // Called with the typed values and the chosen photos. If it throws, the error is shown
  // and every value stays in the form.
  onSubmit: (values: AnnouncementFormValues, photos: File[]) => Promise<void>;
}

// The declaration form, shared by "I found an object", "I lost an object" and the edit page.
export default function AnnouncementForm(props: AnnouncementFormProps) {
  const { type, reference, mode, submitLabel, onSubmit } = props;
  const isFound = type === 'found';
  const isCreate = mode === 'create';

  const [values, setValues] = useState<AnnouncementFormValues>(props.initialValues ?? emptyValues(type));
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  // FR-22: the "precise object" list only shows the objects of the chosen category.
  const objectTypes = useMemo(
    () => reference.categories.find((category) => String(category.id) === values.categoryId)?.objectTypes ?? [],
    [reference, values.categoryId],
  );

  // Small previews of the chosen photos. The temporary addresses are freed when the list changes.
  const previews = useMemo(() => photos.map((photo) => URL.createObjectURL(photo)), [photos]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  // Updates one field. Changing the category also empties the precise object.
  function update(field: keyof AnnouncementFormValues, value: string) {
    setValues((current) => ({
      ...current,
      [field]: value,
      ...(field === 'categoryId' ? { objectTypeId: '' } : {}),
    }));
  }

  // SCRUM-19: keeps the valid photos and explains why the others are refused.
  function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = ''; // allows choosing the same file again after removing it

    const problems: string[] = [];
    const valid = chosen.filter((file) => {
      const problem = photoError(file);
      if (problem) problems.push(problem);
      return problem === null;
    });

    const room = MAX_PHOTOS - photos.length;
    if (valid.length > room) {
      problems.push(`You can add up to ${MAX_PHOTOS} photos.`);
    }

    setPhotos([...photos, ...valid.slice(0, room)]);
    setError(problems.join(' '));
  }

  function removePhoto(index: number) {
    setPhotos((current) => current.filter((_, i) => i !== index));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (isCreate && isFound && photos.length === 0) {
      setError('Add at least one photo.');
      return;
    }

    setSending(true);
    try {
      await onSubmit(values, photos);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="announcement-form" onSubmit={submit}>
      <label>
        Title
        <input value={values.title} onChange={(e) => update('title', e.target.value)} maxLength={100} required />
      </label>

      <div className="field-row">
        <label>
          Category
          <select value={values.categoryId} onChange={(e) => update('categoryId', e.target.value)} required>
            <option value="">Choose…</option>
            {reference.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Precise object
          <select
            value={values.objectTypeId}
            onChange={(e) => update('objectTypeId', e.target.value)}
            disabled={!values.categoryId}
            required
          >
            <option value="">Choose…</option>
            {objectTypes.map((objectType) => (
              <option key={objectType.id} value={objectType.id}>
                {objectType.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        Description
        <textarea
          value={values.description}
          onChange={(e) => update('description', e.target.value)}
          maxLength={1000}
          required
        />
      </label>

      <div className="field-row">
        <label>
          <span>
            Brand <span className="optional">(optional)</span>
          </span>
          <input value={values.brand} onChange={(e) => update('brand', e.target.value)} maxLength={50} />
        </label>
        <label>
          <span>
            Color <span className="optional">(optional)</span>
          </span>
          <input value={values.color} onChange={(e) => update('color', e.target.value)} maxLength={50} />
        </label>
      </div>

      <div className="field-row">
        <label>
          {isFound ? 'Date found' : 'Date lost'}
          <input
            type="date"
            value={values.eventDate}
            max={today()}
            onChange={(e) => update('eventDate', e.target.value)}
            required
          />
        </label>
        <label>
          Place
          <select value={values.placeId} onChange={(e) => update('placeId', e.target.value)} required>
            <option value="">Choose…</option>
            {reference.places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        <span>
          Place details <span className="optional">(optional)</span>
        </span>
        <input
          value={values.placeDetails}
          onChange={(e) => update('placeDetails', e.target.value)}
          maxLength={200}
          placeholder="For example: second floor, near the printers"
        />
      </label>

      {isCreate && isFound && (
        <fieldset className="choice">
          <legend>Where is the object now?</legend>
          <label>
            <input
              type="radio"
              name="currentLocation"
              checked={values.currentLocation === 'finder'}
              onChange={() => update('currentLocation', 'finder')}
              required
            />
            I keep it
          </label>
          <label>
            <input
              type="radio"
              name="currentLocation"
              checked={values.currentLocation === 'reception'}
              onChange={() => update('currentLocation', 'reception')}
            />
            I left it at the reception
          </label>
        </fieldset>
      )}

      <label>
        <span>
          Hidden detail {!isFound && <span className="optional">(optional)</span>}
        </span>
        <input
          value={values.hiddenDetail}
          onChange={(e) => update('hiddenDetail', e.target.value)}
          maxLength={200}
          required={isFound}
          placeholder="A detail only the owner knows. It is never shown publicly."
        />
      </label>

      {isCreate && (
        <div className="photos-field">
          <span className="field-title">
            Photos {isFound ? '(1 to 4)' : <span className="optional">(optional, up to 4)</span>}
            <span className="optional"> · JPEG, PNG or WebP, 5 MB max each</span>
          </span>
          {previews.length > 0 && (
            <ul className="photo-previews">
              {previews.map((url, index) => (
                <li key={url}>
                  <img src={url} alt={`Photo ${index + 1}`} />
                  <button type="button" className="link-button" onClick={() => removePhoto(index)}>
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
      )}

      <button className="primary" disabled={sending}>
        {sending ? 'Sending…' : submitLabel}
      </button>

      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
