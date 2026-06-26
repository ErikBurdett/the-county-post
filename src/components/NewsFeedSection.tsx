import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchNewsFeed, fetchNewsFeeds, type NewsFeedItem } from "../lib/rss";

type FeedKind = "general" | "sports" | "politics" | "economy" | "crime" | "obituaries" | "opinion";

type LocalityScope = {
  countyName?: string;
  stateName?: string;
  stateAbbr?: string;
  cities?: string[];
  strict?: boolean;
};

type Props = {
  title: string;
  feedUrl: string;
  fallbackUrl?: string;
  relatedUrls?: string[];
  expandedLabel?: string;
  kicker?: string;
  pageSize?: number;
  pageStep?: number;
  kind?: FeedKind;
  locality?: LocalityScope;
  actionLink?: {
    to: string;
    label: string;
  };
};

const MAX_REQUESTED_ITEMS = 200;
const EMPTY_RELATED_URLS: string[] = [];

export function NewsFeedSection({
  title,
  feedUrl,
  fallbackUrl,
  relatedUrls = EMPTY_RELATED_URLS,
  expandedLabel,
  kicker,
  pageSize = 12,
  pageStep = 16,
  kind = "general",
  locality,
  actionLink,
}: Props) {
  const [items, setItems] = useState<NewsFeedItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [error, setError] = useState<string>("");
  const [requestedCount, setRequestedCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const relatedUrlsKey = relatedUrls.join("|");
  const expandedUrls = useMemo(() => [fallbackUrl, ...relatedUrls].filter(Boolean) as string[], [fallbackUrl, relatedUrlsKey]);
  const feedUrls = useMemo(() => [feedUrl, ...expandedUrls].filter(Boolean) as string[], [feedUrl, expandedUrls]);
  const filteredItems = useMemo(() => filterFeedItems(items, kind, locality), [items, kind, locality]);
  const canRequestMore = requestedCount < MAX_REQUESTED_ITEMS && filteredItems.length < MAX_REQUESTED_ITEMS;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus("loading");
      setError("");
      try {
        const [primaryItems, expandedItems] = await Promise.all([
          fetchNewsFeed(feedUrl, requestedCount),
          expandedUrls.length ? fetchNewsFeeds(expandedUrls, requestedCount) : Promise.resolve([]),
        ]);
        const nextItems = combinePriorityFeeds(primaryItems, expandedItems, requestedCount);
        if (!cancelled && nextItems.length) {
          setItems(nextItems);
          setStatus("loaded");
          return;
        }

        if (!cancelled) {
          setStatus("error");
          setError("No stories found for this feed yet.");
        }
      } catch (reason) {
        if (!cancelled) {
          setStatus("error");
          setError(reason instanceof Error ? reason.message : "Unable to load this feed right now.");
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [feedUrls, requestedCount]);

  useEffect(() => {
    setItems([]);
    setRequestedCount(pageSize);
    const container = containerRef.current;
    if (container) container.scrollTop = 0;
  }, [pageSize, feedUrls]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = containerRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && canRequestMore) {
          setRequestedCount((count) => Math.min(MAX_REQUESTED_ITEMS, count + pageStep));
        }
      },
      { root: container || null, rootMargin: "320px 0px 320px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canRequestMore, pageStep]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => {
      if (canRequestMore && container.scrollTop + container.clientHeight >= container.scrollHeight - 240) {
        setRequestedCount((count) => Math.min(MAX_REQUESTED_ITEMS, count + pageStep));
      }
    };
    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, [canRequestMore, pageStep]);

  useEffect(() => {
    if (status === "loaded" && canRequestMore && filteredItems.length < pageSize) {
      setRequestedCount((count) => Math.min(MAX_REQUESTED_ITEMS, count + pageStep));
    }
  }, [canRequestMore, filteredItems.length, pageSize, pageStep, status]);

  return (
    <section className="section">
      <header className="section-heading">
        <div className="section-heading-rule" aria-hidden />
        <div>
          {kicker ? <p className="kicker">{kicker}</p> : null}
          <h2>{title}</h2>
          {actionLink ? (
            <Link to={actionLink.to} className="section-action">
              {actionLink.label}
            </Link>
          ) : null}
        </div>
        <div className="section-heading-rule" aria-hidden />
      </header>
      {status === "error" ? <p className="muted">{error}</p> : null}
      {status === "loading" && !items.length ? <p className="muted">Presses are warming…</p> : null}
      {expandedLabel && expandedUrls.length ? (
        <p className="muted">County-specific stories appear first. When coverage is sparse, this feed expands to {expandedLabel}.</p>
      ) : null}
      <div className="feed-scroll" ref={containerRef}>
        <div className="feed-grid">
          {filteredItems.map((item) => (
            <article key={item.id} className="feed-card">
              <div className="feed-card-body">
                <a href={item.link} target="_blank" rel="noreferrer" className="feed-title">
                  {item.title}
                </a>
                <p className="feed-meta">
                  {[item.source, formatDate(item.publishedAt)].filter(Boolean).join(" • ")}
                </p>
              </div>
            </article>
          ))}
        </div>
        <div ref={sentinelRef} aria-hidden style={{ height: "48px" }} />
        {status === "loading" && items.length ? <p className="muted">Loading more stories…</p> : null}
      </div>
      {!filteredItems.length && status === "loaded" ? <p className="muted">No matching stories available yet.</p> : null}
    </section>
  );
}

function combinePriorityFeeds(primaryItems: NewsFeedItem[], expandedItems: NewsFeedItem[], maxItems: number) {
  const seen = new Set<string>();
  const addUnique = (item: NewsFeedItem) => {
    const key = item.link || `${item.title}-${item.publishedAt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
  return [...primaryItems.filter(addUnique), ...expandedItems.filter(addUnique)].slice(0, maxItems);
}

const obituaryTerms = [
  "obituary",
  "obituaries",
  "death notice",
  "funeral",
  "memorial service",
  "celebration of life",
  "passed away",
  "died",
];

const sportsTerms = ["sports", "football", "basketball", "baseball", "softball", "volleyball", "soccer", "athletics", "score"];

const categoryRules: Record<FeedKind, { include?: string[]; exclude?: string[] }> = {
  general: {
    exclude: [...obituaryTerms, ...sportsTerms],
  },
  sports: {
    include: sportsTerms,
    exclude: obituaryTerms,
  },
  politics: {
    include: ["politics", "election", "council", "commission", "ballot", "mayor", "governor", "legislature", "congress"],
    exclude: [...obituaryTerms, ...sportsTerms],
  },
  economy: {
    include: ["economy", "business", "jobs", "unemployment", "housing", "development", "market", "employer", "industry"],
    exclude: [...obituaryTerms, ...sportsTerms],
  },
  crime: {
    include: ["crime", "police", "sheriff", "court", "arrest", "charged", "indicted", "trial", "sentenced"],
    exclude: obituaryTerms,
  },
  obituaries: {
    include: obituaryTerms,
    exclude: ["arrest", "charged", "crime", "police", "sheriff", "election", "sports", "football", "basketball"],
  },
  opinion: {
    include: ["opinion", "editorial", "column", "letter to the editor", "commentary", "op-ed", "op ed"],
    exclude: obituaryTerms,
  },
};

const stateNames = [
  "alabama",
  "alaska",
  "arizona",
  "arkansas",
  "california",
  "colorado",
  "connecticut",
  "delaware",
  "florida",
  "georgia",
  "hawaii",
  "idaho",
  "illinois",
  "indiana",
  "iowa",
  "kansas",
  "kentucky",
  "louisiana",
  "maine",
  "maryland",
  "massachusetts",
  "michigan",
  "minnesota",
  "mississippi",
  "missouri",
  "montana",
  "nebraska",
  "nevada",
  "new hampshire",
  "new jersey",
  "new mexico",
  "new york",
  "north carolina",
  "north dakota",
  "ohio",
  "oklahoma",
  "oregon",
  "pennsylvania",
  "rhode island",
  "south carolina",
  "south dakota",
  "tennessee",
  "texas",
  "utah",
  "vermont",
  "virginia",
  "washington",
  "west virginia",
  "wisconsin",
  "wyoming",
];

function filterFeedItems(items: NewsFeedItem[], kind: FeedKind, locality?: LocalityScope) {
  const rules = categoryRules[kind];
  return items.filter((item) => {
    const contentHaystack = `${item.title} ${item.description || ""}`.toLowerCase();
    const haystack = `${contentHaystack} ${item.source || ""}`.toLowerCase();
    if (rules.exclude?.some((term) => haystack.includes(term))) return false;
    if (rules.include?.length && !rules.include.some((term) => haystack.includes(term))) return false;
    return matchesLocality(contentHaystack, haystack, locality);
  });
}

function matchesLocality(contentHaystack: string, fullHaystack: string, locality?: LocalityScope) {
  if (!locality?.strict) return true;

  const allowedStateName = locality.stateName?.toLowerCase();
  const mentionsOtherState = stateNames.some((stateName) => stateName !== allowedStateName && includesTerm(contentHaystack, stateName));
  if (mentionsOtherState) return false;

  const localityTerms = [
    locality.countyName,
    locality.countyName ? `${locality.countyName} county` : undefined,
    locality.stateName,
    locality.stateAbbr,
    ...(locality.cities || []),
  ]
    .filter(Boolean)
    .map((term) => term!.toLowerCase());

  return localityTerms.length ? localityTerms.some((term) => includesTerm(fullHaystack, term)) : true;
}

function includesTerm(value: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(value);
}

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}
