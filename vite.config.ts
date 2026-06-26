import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function rssProxy(): Plugin {
  const handleRssRequest = async (requestUrl: string | undefined, response: import("node:http").ServerResponse) => {
    const request = new URL(requestUrl || "", "http://localhost");
    const feedUrl = request.searchParams.get("url");

    if (!feedUrl) {
      response.statusCode = 400;
      response.end("Missing url parameter");
      return;
    }

    try {
      const upstream = await fetch(feedUrl, {
        headers: {
          "user-agent": "TheCountyPost/1.0 (+https://thecountypost.com)",
          accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        },
      });

      if (!upstream.ok) {
        response.statusCode = upstream.status;
        response.end(`Upstream RSS failed: ${upstream.statusText}`);
        return;
      }

      response.setHeader("content-type", upstream.headers.get("content-type") || "application/rss+xml; charset=utf-8");
      response.setHeader("cache-control", "public, max-age=300");
      response.end(await upstream.text());
    } catch (error) {
      response.statusCode = 502;
      response.end(error instanceof Error ? error.message : "Unable to fetch RSS feed");
    }
  };

  return {
    name: "rss-proxy",
    configureServer(server) {
      server.middlewares.use("/api/rss", (request, response) => {
        void handleRssRequest(request.url, response);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/rss", (request, response) => {
        void handleRssRequest(request.url, response);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), rssProxy()],
});
