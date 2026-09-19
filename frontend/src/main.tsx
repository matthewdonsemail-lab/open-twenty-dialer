import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/components/auth/AuthProvider";
import App from "@/App";
import "@/index.css";

// A deploy replaces hashed chunks: a tab holding a stale index.html then fails
// to import a deleted chunk (served as text/html by the SPA fallback). Recover
// once per session with a cache-busting reload instead of a dead page.
const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /Loading chunk \d+ failed/i,
  /Loading CSS chunk .* failed/i,
];
function chunkLoadFailed(message: string): boolean {
  return CHUNK_ERROR_PATTERNS.some((rx) => rx.test(message || ""));
}
function recoverFromStaleChunk() {
  try {
    if (sessionStorage.getItem("chunk-reloaded")) return;
    sessionStorage.setItem("chunk-reloaded", "1");
  } catch {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set("_r", String(Date.now()));
  window.location.replace(url.toString());
}
window.addEventListener("error", (e) => {
  if (chunkLoadFailed(e?.message || "")) recoverFromStaleChunk();
});
window.addEventListener("vite:preloadError", () => recoverFromStaleChunk());
window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
  const msg = String((e?.reason as any)?.message || e?.reason || "");
  if (chunkLoadFailed(msg)) recoverFromStaleChunk();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);