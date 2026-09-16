// Required by Parallel Routes: the fallback the @drawer slot renders on a
// hard navigation/refresh that doesn't match its one intercepted route
// (viewing the List page itself, not an Item) — see
// node_modules/next/dist/docs .../parallel-routes.md.
export default function Default() {
  return null;
}
