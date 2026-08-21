import { SITE_URL } from "./site";

export default function sitemap() {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
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
