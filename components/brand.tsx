import Link from "next/link";

export function Brand({ compact = false, href = "/" }: { compact?: boolean; href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="LogicLab — início">
      <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
      {!compact && <span>logic<span>lab</span></span>}
    </Link>
  );
}
