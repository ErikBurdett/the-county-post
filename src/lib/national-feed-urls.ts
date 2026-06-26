import { site } from "../data/site";
import type { TopicFeedKind } from "./state-feed-urls";

function googleNewsRssUrl(query: string) {
  const url = new URL(site.links.googleNewsRssSearch);
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");
  return url.toString();
}

export function buildNationalTopicFeedUrls(kind: TopicFeedKind) {
  const topics: Record<TopicFeedKind, string[]> = {
    general: ["United States news", "U.S. news", "national news", "breaking news"],
    sports: ["United States sports", "NFL", "NBA", "MLB", "college sports", "high school sports"],
    politics: ["United States politics", "Congress", "White House", "federal government", "elections"],
    economy: ["United States economy", "business", "jobs", "housing market", "markets", "Federal Reserve"],
    crime: ["United States crime", "courts", "justice department", "police", "public safety"],
    obituaries: ["United States obituaries", "obituary", "funeral", "death notice"],
    opinion: ["United States opinion", "editorial", "column", "commentary", "op-ed"],
  };

  return [
    googleNewsRssUrl(`(${topics[kind].join(" OR ")})`),
    googleNewsRssUrl(`"United States" (${topics[kind].join(" OR ")})`),
  ];
}
