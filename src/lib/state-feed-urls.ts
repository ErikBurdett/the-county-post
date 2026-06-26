import { site } from "../data/site";
import { stateNewsHubs } from "../data/state-news-hubs";
import type { StateSite } from "../data/states";

export type TopicFeedKind = "general" | "sports" | "politics" | "economy" | "crime" | "obituaries" | "opinion";

function googleNewsRssUrl(query: string) {
  const url = new URL(site.links.googleNewsRssSearch);
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");
  return url.toString();
}

export function buildStateFeedUrl(state: StateSite) {
  return googleNewsRssUrl(
    `"${state.name}" ("news" OR "politics" OR "legislature" OR "governor" OR "economy" OR "crime")`,
  );
}

export function buildStateFeedUrls(state: StateSite) {
  const hubs = stateNewsHubs[state.slug] || [];
  return [
    buildStateFeedUrl(state),
    googleNewsRssUrl(`"${state.name}" ("breaking news" OR "top stories" OR "local news")`),
    googleNewsRssUrl(`"${state.name}" ("state legislature" OR "governor" OR "attorney general" OR "supreme court")`),
    ...hubs.map((hub) => googleNewsRssUrl(`"${hub.city} ${state.name}" OR "${hub.city} ${state.abbr}"`)),
  ];
}

export function buildStateTopicFeedUrls(state: StateSite, kind: TopicFeedKind) {
  if (kind === "general") return buildStateFeedUrls(state);

  const topics: Record<Exclude<TopicFeedKind, "general">, string[]> = {
    sports: ["sports", "high school sports", "college sports", "football", "basketball", "baseball"],
    politics: ["politics", "election", "legislature", "governor", "attorney general", "supreme court"],
    economy: ["economy", "business", "jobs", "housing market", "development", "industry"],
    crime: ["crime", "courts", "police", "sheriff", "arrests", "trial"],
    obituaries: ["obituaries", "obituary", "funeral home", "death notice"],
    opinion: ["opinion", "editorial", "column", "commentary", "op-ed"],
  };

  const topicQuery = topics[kind].join(" OR ");
  const hubs = stateNewsHubs[state.slug] || [];
  return [
    googleNewsRssUrl(`"${state.name}" (${topicQuery})`),
    googleNewsRssUrl(`"${state.abbr}" "${state.name}" (${topicQuery})`),
    ...hubs.map((hub) => googleNewsRssUrl(`"${hub.city} ${state.name}" (${topicQuery})`)),
  ];
}
