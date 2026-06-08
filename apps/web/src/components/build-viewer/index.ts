// Only the entry pieces the route imports through this barrel. The other
// viewer components (ViewerHeader, EmbedStrips, GuideDisplay, …) are reached
// via deep relative imports inside the package on purpose: barrel-re-exporting
// the full-page chrome (TanStack Router + react-markdown) would pull it into
// the router-less embed entry's chunk graph and defeat its lazy-loading
// (see embed-main.tsx / build-viewer-body.tsx).
export { BuildNotFound } from "./build-not-found"
export { BuildViewerBody } from "./build-viewer-body"
export { EmbedShell } from "./embed-shell"
