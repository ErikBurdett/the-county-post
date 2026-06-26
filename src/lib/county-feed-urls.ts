import { getOtherStatesWithCountyName, isAmbiguousCountyName } from "../data/county-name-index";
import { site } from "../data/site";
import type { StateSite } from "../data/states";

export type CountyFeedKind =
  | "localNews"
  | "localSports"
  | "localVideo"
  | "obituaries"
  | "politics"
  | "economy"
  | "crime"
  | "opinion";

function googleNewsRssUrl(query: string) {
  const url = new URL(site.links.googleNewsRssSearch);
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");
  return url.toString();
}

function countyDisambiguationExclusions(countyName: string, stateAbbr: string) {
  return getOtherStatesWithCountyName(countyName, stateAbbr)
    .map((state) => `-"${countyName} County ${state.name}" -"${countyName} County ${state.abbr}"`)
    .join(" ");
}

function countyScopedTerms(countyName: string, state: StateSite) {
  const exclusions = countyDisambiguationExclusions(countyName, state.abbr);
  if (isAmbiguousCountyName(countyName)) {
    return `"${countyName} County ${state.name}" OR "${countyName} County ${state.abbr}" OR "${countyName} ${state.abbr}" ${exclusions}`.trim();
  }
  return `${countyName} County ${state.name} OR ${countyName} ${state.abbr} ${exclusions}`.trim();
}

function scopedTopicQuery(scopedPlace: string, topics: string[]) {
  return `(${scopedPlace}) (${topics.join(" OR ")})`;
}

export function buildCountyFeedUrl(kind: CountyFeedKind, countyName: string, state: StateSite) {
  const scoped = countyScopedTerms(countyName, state);

  switch (kind) {
    case "localNews":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["local news", "community news"]));
    case "localSports":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["high school sports", "college sports", "football", "basketball", "baseball", "softball"]));
    case "localVideo":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["local news video", "news video"]));
    case "obituaries":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["obituaries", "obituary", "funeral home", "death notice"]));
    case "politics":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["politics", "council", "commission", "elections", "ballot"]));
    case "economy":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["economy", "jobs", "unemployment", "housing market", "business"]));
    case "crime":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["crime", "courts", "sheriff", "police", "arrests"]));
    case "opinion":
      return googleNewsRssUrl(scopedTopicQuery(scoped, ["opinion", "editorial", "column"]));
  }
}

export function buildMarketFeedUrl(kind: CountyFeedKind, placeName: string, state: StateSite) {
  const scopedPlace = `"${placeName} ${state.name}" OR "${placeName} ${state.abbr}"`;

  switch (kind) {
    case "localNews":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["local news"]));
    case "localSports":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["sports", "high school sports", "college sports"]));
    case "localVideo":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["news video"]));
    case "obituaries":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["obituaries", "funeral home"]));
    case "politics":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["politics", "city council", "elections"]));
    case "economy":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["economy", "jobs", "business"]));
    case "crime":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["crime", "police", "sheriff", "courts"]));
    case "opinion":
      return googleNewsRssUrl(scopedTopicQuery(scopedPlace, ["opinion", "editorial", "column"]));
  }
}
