import { Link } from 'react-router-dom';

// Home page of a signed-in user: the entry points of the declarations.
export default function HomePage() {
  return (
    <section className="card found-card">
      <h1>What happened?</h1>
      <p className="intro">Declare an object, and FindIt helps it find its way back.</p>
      <div className="home-actions">
        <Link className="primary button-link" to="/announcements/new">
          I found an object
        </Link>
        <Link className="secondary button-link" to="/announcements/new?type=lost">
          I lost an object
        </Link>
        <Link className="secondary button-link" to="/gallery">
          Browse announcements
        </Link>
        <Link className="link-button" to="/my-announcements">
          See my announcements
        </Link>
      </div>
    </section>
  );
}
