/* Documents live outside the dashboard.
 *
 * They were rendering inside it — sidebar, top bar, and the floating
 * Sura widget sitting on top of the page. On screen that reads as a
 * report trapped in an application; on paper it was worse, because the
 * shell is not marked no-print and would have come out with it.
 *
 * A document is a document. This layout gives it the fonts and the
 * direction and nothing else. Authentication still applies: the proxy
 * gates every path that is not explicitly public, and each page
 * re-checks the role before it reads a row.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="print-root">{children}</div>;
}
