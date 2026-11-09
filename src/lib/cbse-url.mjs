export const LEGACY_CBSE_HOST = "www.donyipolovidyaniketanpasighat.in";

export function legacyCbseUrl(fileName) {
  return `https://${LEGACY_CBSE_HOST}/cbse_information/${encodeURIComponent(fileName)}`;
}

export function publicDocumentUrl(document) {
  try {
    const url = new URL(document.url);
    if (
      url.protocol === "https:" &&
      url.hostname === LEGACY_CBSE_HOST &&
      url.pathname.startsWith("/cbse_information/")
    )
      return url.pathname;
  } catch {}
  return `/api/media/cbse/${document._id}`;
}
