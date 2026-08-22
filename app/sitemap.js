import { SITE_URL } from "./site";
import { PRACTICE_PAGES } from "./practices/practice-data";

export default function sitemap() {
  const practicePages = PRACTICE_PAGES.map((practice) => ({
    url: `${SITE_URL}/practices/${practice.slug}`,
    lastModified: new Date("2026-08-22"),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/practices`,
      lastModified: new Date("2026-08-22"),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    ...practicePages,
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date("2026-08-15"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/personal-data-consent`,
      lastModified: new Date("2026-08-15"),
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}
