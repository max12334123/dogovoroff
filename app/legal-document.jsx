import Image from "next/image";
import Link from "next/link";
import { LEGAL } from "./legal";

export default function LegalDocument({ eyebrow, title, summary, sections, children }) {
  return (
    <div className="legal-page">
      <a className="skip-link" href="#legal-content">Перейти к документу</a>

      <header className="legal-header">
        <Link className="legal-brand" href="/" aria-label="ДоговорОфф — на главную">
          <Image src="/media/dogovoroff-mark.png" alt="" width={38} height={38} />
          <span>ДоговорОфф</span>
        </Link>
        <Link className="legal-header__back" href="/">На главную</Link>
      </header>

      <main id="legal-content">
        <section className="legal-hero" aria-labelledby="legal-title">
          <p className="eyebrow">{eyebrow}</p>
          <h1 id="legal-title">{title}</h1>
          <p className="legal-hero__summary">{summary}</p>
          <dl className="legal-meta">
            <div><dt>Редакция</dt><dd>{LEGAL.policyVersion}</dd></div>
            <div><dt>Действует с</dt><dd>{LEGAL.effectiveDate}</dd></div>
            <div><dt>Контакт</dt><dd><a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a></dd></div>
          </dl>
          {!LEGAL.operatorDetailsConfirmed && (
            <div className="legal-draft-notice" role="note">
              <strong>До публикации</strong>
              <p>Необходимо подтвердить полное наименование или ФИО оператора и адрес для обращений. Эти сведения намеренно не взяты из регистрационных скриншотов.</p>
            </div>
          )}
        </section>

        <div className="legal-layout">
          <aside className="legal-toc" aria-label="Содержание документа">
            <p>Содержание</p>
            <nav>
              {sections.map((section, index) => (
                <a href={`#${section.id}`} key={section.id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {section.label}
                </a>
              ))}
            </nav>
          </aside>

          <article className="legal-document">{children}</article>
        </div>
      </main>

      <footer className="legal-footer">
        <p>© {new Date().getFullYear()} «ДоговорОфф»</p>
        <div><Link href="/privacy">Политика обработки данных</Link><Link href="/personal-data-consent">Согласие на обработку данных</Link></div>
      </footer>
    </div>
  );
}
