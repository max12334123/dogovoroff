import "./globals.css";
import Effects from "./effects";

export const metadata = {
  metadataBase: new URL("https://dogovoroff.vercel.app"),
  title: "ДоговорОфф — юридическая компания в Нижневартовске",
  description: "Юридическая помощь бизнесу и частным лицам: тендеры, ФАС, арбитраж, аутсорсинг, ЖКХ, договоры и претензии.",
  keywords: ["юрист Нижневартовск", "тендеры", "44-ФЗ", "223-ФЗ", "ФАС", "арбитраж", "ЖКХ", "юридический аутсорсинг"],
  openGraph: {
    title: "ДоговорОфф — право для сложных решений",
    description: "Тендеры, арбитраж, юридический аутсорсинг и ЖКХ. Нижневартовск и вся Россия онлайн.",
    type: "website",
    locale: "ru_RU",
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  colorScheme: "dark light",
  themeColor: "#050505",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        {children}
        <Effects />
      </body>
    </html>
  );
}
