export default function Home() {
  return (
    <div className="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, marginBottom: '8px' }}>
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      </svg>
      <p style={{ fontSize: '1.25rem', fontWeight: 500 }}>Select an article to start reading</p>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Choose from the timeline on the left.</p>
    </div>
  );
}
