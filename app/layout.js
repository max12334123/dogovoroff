import Script from "next/script";
import Effects from "./effects";

export const metadata = {
  title: "ДоговорОфф — юридическая компания в Нижневартовске | Тендеры, арбитраж, ЖКХ",
  description: "Юридические услуги для бизнеса и частных лиц: тендеры 44-ФЗ и 223-ФЗ, ФАС, арбитраж, юраутсорсинг, ЖКХ. Первая консультация бесплатно.",
  keywords: "юрист Нижневартовск, тендеры, 44-ФЗ, 223-ФЗ, ФАС, арбитраж, ЖКХ, юраутсорсинг, договоры",
  openGraph: {
    title: "ДоговорОфф — юридическая компания",
    description: "Тендеры, арбитраж, юраутсорсинг, ЖКХ. Работаем по всей России.",
    type: "website", locale: "ru_RU",
    images: [{ url: "/og.jpg", width: 1200, height: 630 }],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        {children}
        <Effects />
        <Script id="yandex-metrika" strategy="afterInteractive">
          {`
            (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
            (window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");
            ym(00000000,"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});
          `}
        </Script>
      </body>
    </html>
  );
}
