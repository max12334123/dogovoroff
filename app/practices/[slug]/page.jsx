import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_NAME, SITE_URL } from "../../site";
import { PRACTICE_PAGES, getPracticeBySlug } from "../practice-data";
import { PracticePageFrame } from "../practice-chrome";

export const dynamicParams = false;

export function generateStaticParams() {
  return PRACTICE_PAGES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const practice = getPracticeBySlug(slug);
  if (!practice) return {};

  const url = `/practices/${practice.slug}`;
  return {
    title: practice.seoTitle,
    description: practice.seoDescription,
    alternates: { canonical: url },
    openGraph: {
      title: `${practice.seoTitle} · ${SITE_NAME}`,
      description: practice.seoDescription,
      url,
      type: "article",
    },
  };
}

function StructuredData({ practice }) {
  const pageUrl = `${SITE_URL}/practices/${practice.slug}`;
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: practice.title,
      description: practice.seoDescription,
      url: pageUrl,
      areaServed: [
        { "@type": "City", name: "Нижневартовск" },
        { "@type": "Country", name: "Россия" },
      ],
      provider: {
        "@type": "LegalService",
        name: SITE_NAME,
        url: SITE_URL,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Практики", item: `${SITE_URL}/practices` },
        { "@type": "ListItem", position: 3, name: practice.title, item: pageUrl },
      ],
    },
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export default async function PracticePage({ params }) {
  const { slug } = await params;
  const practice = getPracticeBySlug(slug);
  if (!practice) notFound();

  const currentIndex = PRACTICE_PAGES.findIndex((item) => item.slug === practice.slug);
  const nextPractice = PRACTICE_PAGES[(currentIndex + 1) % PRACTICE_PAGES.length];
  const consultationHref = `/?service=${encodeURIComponent(practice.service)}#lead-form`;

  return (
    <PracticePageFrame>
      <StructuredData practice={practice} />
      <main id="practice-main">
        <section className="practice-detail-hero">
          <div className="page-shell practice-detail-hero__grid">
            <div className="practice-detail-hero__copy">
              <div className="practice-detail-hero__meta">
                <span>{practice.number}</span>
                <span>{practice.short}</span>
              </div>
              <h1>{practice.title}</h1>
              <p>{practice.description}</p>
              <div className="practice-detail-hero__actions">
                <Link className="action action--light" href={consultationHref}><span>Обсудить задачу</span></Link>
                <Link className="practice-text-link" href="/practices">Все практики</Link>
              </div>
            </div>

            <aside className="practice-detail-hero__scope" aria-label="Состав работы и ориентир стоимости">
              <p className="eyebrow">В составе работы</p>
              <ul>{practice.details.map((item) => <li key={item}>{item}</li>)}</ul>
              <div><span>Ориентир стоимости</span><strong>{practice.price}</strong></div>
              <p>Точная стоимость фиксируется после изучения задачи и материалов.</p>
            </aside>
          </div>
        </section>

        <section className="practice-detail-section practice-detail-section--light" aria-labelledby="situations-title">
          <div className="page-shell">
            <div className="practice-detail-heading">
              <p className="practice-page__index">01 / 03</p>
              <div>
                <p className="eyebrow">Когда подключаемся</p>
                <h2 id="situations-title">Ситуации, где важна точная позиция.</h2>
              </div>
            </div>
            <ol className="practice-situation-grid">
              {practice.situations.map((situation, index) => (
                <li key={situation}><span>{String(index + 1).padStart(2, "0")}</span><p>{situation}</p></li>
              ))}
            </ol>
          </div>
        </section>

        <section className="practice-detail-section practice-detail-section--dark" aria-labelledby="stages-title">
          <div className="page-shell">
            <div className="practice-detail-heading practice-detail-heading--dark">
              <p className="practice-page__index">02 / 03</p>
              <div>
                <p className="eyebrow">Порядок работы</p>
                <h2 id="stages-title">От материалов к согласованному решению.</h2>
              </div>
            </div>
            <ol className="practice-stage-grid">
              {practice.stages.map(([number, title, text]) => (
                <li key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></li>
              ))}
            </ol>
          </div>
        </section>

        <section className="practice-detail-section practice-detail-section--light" aria-labelledby="outcomes-title">
          <div className="page-shell practice-outcomes">
            <div className="practice-detail-heading">
              <p className="practice-page__index">03 / 03</p>
              <div>
                <p className="eyebrow">Результат работы</p>
                <h2 id="outcomes-title">Понятный объём. Один ответственный.</h2>
              </div>
            </div>
            <div className="practice-outcomes__grid">
              <ul>{practice.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}</ul>
              <aside>
                <p>{practice.note}</p>
                <Link className="action action--dark" href={consultationHref}><span>Получить оценку</span></Link>
              </aside>
            </div>
          </div>
        </section>

        <section className="practice-next">
          <div className="page-shell">
            <p>Следующая практика</p>
            <Link href={`/practices/${nextPractice.slug}`}>
              <span>{nextPractice.number}</span>
              <strong>{nextPractice.title}</strong>
              <svg aria-hidden="true" viewBox="0 0 48 24" width="48" height="24">
                <path d="M1 12h44M35 2l10 10-10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </section>
      </main>
      <Link className="practice-mobile-cta" href={consultationHref}>Оставить заявку</Link>
    </PracticePageFrame>
  );
}
