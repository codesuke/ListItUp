// Renders the List page's own content alongside the @drawer parallel
// slot (design-mocks/list-view's Item detail drawer) — the two sit
// side-by-side, matching the mock's `flex` row of `ln-main` + `.drawer`.
export default function ListLayout({
  children,
  drawer,
}: {
  children: React.ReactNode;
  drawer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen min-w-0 flex-1">
      <div className="min-w-0 flex-1">{children}</div>
      {drawer}
    </div>
  );
}
