import Link from "next/link";
import { PRACTICE_PAGES } from "./practice-data";
import { PracticePageFrame } from "./practice-chrome";

export const metadata = {
  title: "Юридические практики",
  description:
    "Пять направлений ДоговорОфф: тендеры, юридический аутсорсинг, ЖКХ, арбитражные споры, договоры и претензии.",
  alternates: { canonical: "/practices" },
  openGraph: {
    title: "Юридические практики · ДоговорОфф",
    description: "Точечная юридическая экспертиза для бизнеса, поставщиков, УК, ТСЖ и частных лиц.",
    url: "/practices",
  },
};

export default function PracticesPage() {
  return (
    <PracticePageFrame>
      <main id="practice-main">
        <section className="practice-index-hero">
          <div className="page-shell">
            <p className="practice-page__index">01 / 02</p>
            <p className="eyebrow">Правовые практики</p>
            <h1>Точечная экспертиза.<br /><span>Пять направлений.</span></h1>
            <p className="practice-index-hero__lead">
              Выберите задачу, чтобы увидеть состав работы, порядок подключения и ориентир стоимости. Если направление неочевидно — начнём с первичного разбора.
            </p>
          </div>
        </section>

        <section className="practice-index-list" aria-labelledby="practice-index-title">
          <div className="page-shell">
            <div className="practice-index-list__heading">
              <p className="practice-page__index">02 / 02</p>
              <h2 id="practice-index-title">Каждая задача требует своей логики.</h2>
            </div>
            <div className="practice-directory">
              {PRACTICE_PAGES.map((practice) => (
                <Link className="practice-directory__item" href={`/practices/${practice.slug}`} key={practice.slug}>
                  <span className="practice-directory__number">{practice.number}</span>
                  <span className="practice-directory__copy">
                    <strong>{practice.title}</strong>
                    <small>{practice.description}</small>
                  </span>
                  <span className="practice-directory__price">{practice.price}</span>
                  <span className="practice-directory__arrow" aria-hidden="true">
                    <svg viewBox="0 0 48 24" width="48" height="24">
                      <path d="M1 12h44M35 2l10 10-10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </Link>
              ))}
            </div>
            <div className="practice-index-list__cta">
              <p>Не нашли точного совпадения? Опишите ситуацию своими словами — мы определим нужный формат после первичного разбора.</p>
              <Link className="action action--dark" href="/#lead-form"><span>Обсудить задачу</span></Link>
            </div>
          </div>
        </section>
      </main>
      <Link className="practice-mobile-cta" href="/#lead-form">Оставить заявку</Link>
    </PracticePageFrame>
  );
}
