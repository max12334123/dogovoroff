import "./globals.css";
import Effects from "./effects";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "./site";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: ["юрист Нижневартовск", "тендеры", "44-ФЗ", "223-ФЗ", "ФАС", "арбитраж", "ЖКХ", "юридический аутсорсинг"],
  alternates: {
    canonical: "/",
  },
  creator: SITE_NAME,
  publisher: SITE_NAME,
  openGraph: {
    title: "ДоговорОфф — право для сложных решений",
    description: "Тендеры, арбитраж, юридический аутсорсинг и ЖКХ. Нижневартовск и вся Россия онлайн.",
    type: "website",
    locale: "ru_RU",
    url: "/",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: "ДоговорОфф — право для сложных решений",
    description: "Юридическая компания в Нижневартовске. Работаем очно и онлайн по всей России.",
  },
  icons: {
    icon: [{ url: "/media/dogovoroff-mark.png", type: "image/png" }],
    apple: [{ url: "/media/dogovoroff-mark.png", type: "image/png" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport = {
  colorScheme: "dark light",
  themeColor: "#050505",
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "LegalService",
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/media/dogovoroff-mark.png`,
  image: `${SITE_URL}/opengraph-image`,
  email: "dogovor.off@mail.ru",
  description: SITE_DESCRIPTION,
  areaServed: [
    {
      "@type": "City",
      name: "Нижневартовск",
    },
    {
      "@type": "Country",
      name: "Россия",
    },
  ],
  address: {
    "@type": "PostalAddress",
    addressLocality: "Нижневартовск",
    addressCountry: "RU",
  },
  sameAs: [
    "https://t.me/dogovoroff",
    "https://max.ru/u/f9LHodD0cOI3FvyOAn7Regyz-ygfprKzJGc_1_DZJlI4cF7xdugW7c6l5fs",
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        />
        {children}
        <Effects />
      </body>
    </html>
  );
}
