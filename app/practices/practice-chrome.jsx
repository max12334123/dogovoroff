import Image from "next/image";
import Link from "next/link";
import { CONFIG } from "../content";

function PracticeBrand() {
  return (
    <span className="brand">
      <span className="brand__mark">
        <Image src="/media/dogovoroff-mark.png" alt="" width={48} height={48} sizes="48px" priority />
      </span>
      <span className="brand__name">{CONFIG.brand}</span>
    </span>
  );
}

export function PracticeHeader() {
  return (
    <header className="practice-header">
      <div className="practice-header__inner">
        <Link href="/" aria-label="ДоговорОфф — на главную"><PracticeBrand /></Link>
        <p>Юридическая компания · Нижневартовск</p>
        <nav aria-label="Навигация по разделу практик">
          <Link href="/practices">Все практики</Link>
          <Link href="/#team">Команда</Link>
          <Link href="/#lead-form">Контакты</Link>
        </nav>
      </div>
    </header>
  );
}

export function PracticeFooter() {
  return (
    <footer className="practice-footer">
      <div className="practice-footer__top">
        <div>
          <Link href="/" aria-label="ДоговорОфф — на главную"><PracticeBrand /></Link>
          <p>Право для сложных решений. Нижневартовск и вся Россия онлайн.</p>
        </div>
        <nav aria-label="Навигация в подвале">
          <Link href="/practices">Все практики</Link>
          <Link href="/#team">Команда</Link>
          <Link href="/#faq">Вопросы</Link>
        </nav>
        <div className="practice-footer__contacts">
          <a href={`mailto:${CONFIG.email}`}>{CONFIG.email}</a>
          <span>{CONFIG.address}</span>
          <span>{CONFIG.hours}</span>
        </div>
      </div>
      <div className="practice-footer__bottom">
        <span>© {new Date().getFullYear()} «ДоговорОфф» · Не является публичной офертой</span>
        <Link href="/privacy">Политика обработки данных</Link>
        <Link href="/personal-data-consent">Согласие</Link>
        <span>{CONFIG.geo}</span>
      </div>
    </footer>
  );
}

export function PracticePageFrame({ children }) {
  return (
    <div className="practice-page">
      <a className="skip-link" href="#practice-main">Перейти к содержанию</a>
      <PracticeHeader />
      {children}
      <PracticeFooter />
    </div>
  );
}
