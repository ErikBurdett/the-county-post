import { expect, test } from "@playwright/test";
import { getCountiesForState, getCounty, getCountyMarketCities } from "../../src/data/counties";
import { states } from "../../src/data/states";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/rss?**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const feedUrl = requestUrl.searchParams.get("url") || "";
    const decodedFeedUrl = decodeURIComponent(feedUrl);
    const query = new URL(decodedFeedUrl).searchParams.get("q") || "";
    const lowerQuery = query.toLowerCase();
    const isObituary = lowerQuery.includes("obituar") || lowerQuery.includes("funeral");
    const isSports = lowerQuery.includes("sports") || lowerQuery.includes("football") || lowerQuery.includes("basketball");
    const isCrime = lowerQuery.includes("crime") || lowerQuery.includes("police") || lowerQuery.includes("court");
    const isMarketFallback = lowerQuery.includes("amarillo");
    const isLubbock = lowerQuery.includes("lubbock");
    const isHouston = lowerQuery.includes("houston");
    const isBriscoe = lowerQuery.includes("briscoe");
    const isArkansas = lowerQuery.includes("arkansas") || lowerQuery.includes("little rock") || lowerQuery.includes("fayetteville");
    const isOpinion = lowerQuery.includes("opinion") || lowerQuery.includes("editorial") || lowerQuery.includes("column");

    const topic = isObituary ? "Obituary" : isSports ? "Sports" : isCrime ? "Crime" : "Local News";
    const source = isArkansas
      ? "Arkansas State Test"
      : isBriscoe
        ? "Briscoe County Test"
        : isLubbock
          ? "Lubbock Daily Test"
          : isHouston
            ? "Houston Daily Test"
            : isMarketFallback
              ? "Amarillo Daily Test"
              : "Randall County Test";
    const itemCount = isBriscoe ? 4 : 90;
    const items = Array.from({ length: itemCount }, (_, index) => {
      const date = new Date(Date.UTC(2026, 5, 26 - index + (isLubbock ? 1 : 0), 12, 0, 0));
      const title =
        index === 2 && !isObituary
          ? "Obituary notice should be filtered from non-obituary feeds"
          : index === 3 && isOpinion
            ? "Tennessee op-ed should be filtered from Potter County Texas"
            : isArkansas
              ? `Arkansas ${topic} story ${String(index + 1).padStart(2, "0")} from ${source}`
          : `${topic} story ${String(index + 1).padStart(2, "0")} from ${source}`;

      return `<item>
        <guid>${source}-${topic}-${index}</guid>
        <title>${escapeXml(title)}</title>
        <link>https://example.com/${source.toLowerCase().replace(/\s+/g, "-")}/${topic.toLowerCase().replace(/\s+/g, "-")}/${index}</link>
        <source>${escapeXml(source)}</source>
        <pubDate>${date.toUTCString()}</pubDate>
        <description>${escapeXml(title)}</description>
      </item>`;
    }).join("");

    await route.fulfill({
      status: 200,
      contentType: "application/rss+xml",
      body: `<?xml version="1.0" encoding="UTF-8"?><rss><channel>${items}</channel></rss>`,
    });
  });
});

test("county feeds merge nearby-market stories, sort newest first, filter sections, and load more on scroll", async ({ page }) => {
  await page.goto("/texas/randall");

  await expect(page.getByRole("heading", { name: /Randall County/i })).toBeVisible();
  await expect(page.getByText("Amarillo, TX")).toBeVisible();

  const localSection = page.locator("section", { has: page.getByRole("heading", { name: "Local headlines" }) });
  const localCards = localSection.locator(".feed-card");
  await expect.poll(async () => localCards.count()).toBeGreaterThanOrEqual(16);
  const initialLocalCount = await localCards.count();
  await expect(localCards.first()).toContainText("story 01");
  await expect(localSection).not.toContainText("Obituary notice should be filtered");
  await expect(localCards.first().locator("a")).toHaveAttribute("target", "_blank");
  await expect(localCards.first().locator(".feed-meta")).toContainText("Jun 26, 2026");

  await localSection.locator(".feed-scroll").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event("scroll"));
  });
  await expect.poll(async () => localCards.count()).toBeGreaterThan(initialLocalCount);

  const obituarySection = page.locator("section", { has: page.getByRole("heading", { name: "Obituaries & public notices" }) });
  await expect(obituarySection.locator(".feed-card").first()).toContainText("Obituary story 01");

  const opinionSection = page.locator("section", { has: page.getByRole("heading", { name: "Opinion & op-eds" }) });
  await expect(opinionSection).not.toContainText("Tennessee op-ed should be filtered");
});

test("state pages populate state headlines from broad in-state feeds", async ({ page }) => {
  await page.goto("/states/arkansas");

  await expect(page.getByRole("heading", { name: /Arkansas/i })).toBeVisible();
  const stateSection = page.locator("section", { has: page.getByRole("heading", { name: "State headlines" }) });
  await expect.poll(async () => stateSection.locator(".feed-card").count()).toBeGreaterThanOrEqual(12);
  await expect(stateSection.locator(".feed-card").first()).toContainText("Arkansas");
  await expect(stateSection.locator(".feed-card").first().locator(".feed-meta")).toContainText("Jun 26, 2026");
});

test("rural counties expand to nearby hubs while keeping county matches first", async ({ page }) => {
  await page.goto("/texas/briscoe");

  await expect(page.getByRole("heading", { name: /Briscoe County/i })).toBeVisible();
  await expect(page.getByText("Amarillo, TX")).toBeVisible();
  await expect(page.getByText(/expands to nearby markets including Amarillo and Lubbock/i).first()).toBeVisible();
  await expect(page.getByText(/Houston Daily Test/)).toHaveCount(0);

  const localSection = page.locator("section", { has: page.getByRole("heading", { name: "Local headlines" }) });
  const localCards = localSection.locator(".feed-card");
  await expect.poll(async () => localCards.count()).toBeGreaterThanOrEqual(16);
  await expect(localCards.first()).toContainText("Briscoe County Test");
  await expect(localSection).toContainText("Lubbock Daily Test");
});

test("one sampled county in every state receives an in-state fallback market", () => {
  for (const state of states) {
    const county = getCountiesForState(state.slug)[0];
    expect(county, `${state.name} should have counties`).toBeTruthy();

    const markets = getCountyMarketCities(county, 2);
    expect(markets.length, `${county.displayName}, ${state.name} should have fallback markets`).toBeGreaterThan(0);
  }

  const briscoe = getCounty("texas", "briscoe");
  expect(briscoe).toBeTruthy();
  expect(getCountyMarketCities(briscoe!, 2)).toEqual(["Amarillo", "Lubbock"]);
});

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
