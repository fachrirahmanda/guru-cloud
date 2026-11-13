import { displayName, initials } from '../history';

/** Profil akun: avatar, nama, email, dan peran. */
export function Profile({ me }: { me: { email: string; is_admin: boolean } }) {
  const name = displayName(me.email);
  return (
    <div className="page container">
      <header className="page-head">
        <div>
          <h1>Profil</h1>
          <p>Informasi akun Guru Anda.</p>
        </div>
      </header>

      <section className="card profile-card">
        <div className="card-body profile-body">
          <span className="avatar avatar-xl">{initials(me.email)}</span>
          <div className="profile-text">
            <strong className="profile-name">{name}</strong>
            <span className="text-muted">{me.email}</span>
          </div>
        </div>
        <dl className="stat-list card-body" style={{ borderTop: '1px solid var(--separator)' }}>
          <dt>Nama</dt><dd>{name}</dd>
          <dt>Email</dt><dd>{me.email}</dd>
          <dt>Peran</dt><dd>{me.is_admin ? 'Admin' : 'Member'}</dd>
        </dl>
      </section>
    </div>
  );
}
