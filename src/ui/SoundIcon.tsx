export function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 9.5v5h3.2L12 18.5v-13L7.2 9.5H4z" strokeLinejoin="round" />
      {on ? (
        <>
          <path d="M15.4 9.2a4 4 0 0 1 0 5.6" strokeLinecap="round" />
          <path d="M17.9 6.8a7.5 7.5 0 0 1 0 10.4" strokeLinecap="round" />
        </>
      ) : (
        <path d="M16 9.8l4.6 4.6M20.6 9.8L16 14.4" strokeLinecap="round" />
      )}
    </svg>
  )
}
