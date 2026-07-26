import Image from "next/image";

interface BrandLogoProps {
  compact?: boolean;
}

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <span className="brand" aria-label="BuildCrew">
      <Image
        alt=""
        aria-hidden="true"
        className="brand__mark"
        height={36}
        priority
        src="/brand/buildcrew-mark.png"
        width={36}
      />
      {!compact && <span className="brand__word">BuildCrew</span>}
    </span>
  );
}
