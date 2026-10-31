import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

export function CatalogPagination({ page, pages, pageUrl }: { page: number; pages: number; pageUrl: (page: number) => string }) {
  if (pages <= 1) return null;
  const visible = Array.from(new Set([1, page - 1, page, page + 1, pages])).filter(value => value >= 1 && value <= pages).sort((a, b) => a - b);
  return <nav className="rx-catalog-pages" aria-label="Catalog pages">
    {page > 1 ? <Link href={pageUrl(page - 1)} aria-label="Previous catalog page" rel="prev"><ArrowLeft size={17} aria-hidden="true" /></Link> : <span className="rx-page-disabled" aria-hidden="true"><ArrowLeft size={17} /></span>}
    <div>{visible.map((value, index) => <span key={value} className="rx-page-item">{index > 0 && value - visible[index - 1] > 1 && <span className="rx-page-gap" aria-hidden="true">…</span>}<Link href={pageUrl(value)} aria-label={`Catalog page ${value}`} aria-current={value === page ? "page" : undefined}>{value}</Link></span>)}</div>
    {page < pages ? <Link href={pageUrl(page + 1)} aria-label="Next catalog page" rel="next"><ArrowRight size={17} aria-hidden="true" /></Link> : <span className="rx-page-disabled" aria-hidden="true"><ArrowRight size={17} /></span>}
  </nav>;
}
