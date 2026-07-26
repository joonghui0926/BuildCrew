interface BrandLogoProps {
  compact?: boolean;
}

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <span className="brand" aria-label="BuildCrew">
      <svg className="brand__mark" viewBox="0 0 42 42" aria-hidden="true">
        <path d="M9 8.5 21 2l12 6.5v10.2L21 25 9 18.7Z" fill="currentColor" opacity=".24" />
        <path d="m9 23.3 12 6.3 12-6.3v10.2L21 40 9 33.5Z" fill="currentColor" />
        <path d="m9 8.5 12 6.3v10.1L9 18.7Zm24 0-12 6.3v10.1l12-6.2Z" fill="currentColor" />
      </svg>
      {!compact && <span className="brand__word">BuildCrew</span>}
    </span>
  );
}
