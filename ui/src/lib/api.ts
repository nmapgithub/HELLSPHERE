export function getBackendUrl(path: string): string {
  const targetPath = path.startsWith("/") ? path : `/${path}`;
  const analyzeEndpoint =
    process.env.NEXT_PUBLIC_ANALYZE_ENDPOINT ?? "/api/analyze";

  const fallbackOrigin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  try {
    const url = new URL(analyzeEndpoint, fallbackOrigin);
    url.pathname = targetPath.replace(/\/+/g, "/");
    url.search = "";
    return url.toString();
  } catch (error) {
    console.warn("Failed to build backend URL, falling back to relative path", error);
    return targetPath;
  }
}
