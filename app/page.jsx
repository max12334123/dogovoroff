"use client";

import Image from "next/image";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
} from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { maskPhone, validateLead } from "../lib/form-utils.mjs";
import { APPROACH, CLIENTS, CONFIG, FAQ, PLANS, PRACTICES, STATS, STEPS, TEAM } from "./content";
import IceMotion from "./ice-motion";

const EASE = [0.22, 1, 0.36, 1];

function Brand({ compact = false }) {
  return (
    <span className={`brand${compact ? " brand--compact" : ""}`}>
      <span className="brand__mark">
        <Image src="/media/dogovoroff-mark.png" alt="" width={64} height={64} sizes="48px" priority />
      </span>
      <span className="brand__name">{CONFIG.brand}</span>
    </span>
  );
}

function Reveal({ children, className = "", delay = 0, as = "div", id }) {
  const reduceMotion = useReducedMotion();
  const Component = motion[as] || motion.div;
  return (
    <Component
      id={id}
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 28, filter: "blur(5px)" }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </Component>
  );
}

function MagneticAction({ href, children, className = "", onClick, type, target, rel, disabled }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 190, damping: 18, mass: 0.35 });
  const springY = useSpring(y, { stiffness: 190, damping: 18, mass: 0.35 });

  const move = (event) => {
    if (window.matchMedia("(pointer: coarse)").matches || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((event.clientX - rect.left - rect.width / 2) * 0.12);
    y.set((event.clientY - rect.top - rect.height / 2) * 0.16);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };
  const Tag = href ? motion.a : motion.button;

  return (
    <Tag
      ref={ref}
      href={href}
      className={`action ${className}`}
      onClick={onClick}
      onMouseMove={move}
      onMouseLeave={reset}
      onBlur={reset}
      type={type}
      target={target}
      rel={rel}
      disabled={disabled}
      style={{ x: springX, y: springY }}
      whileTap={{ scale: 0.985 }}
    >
      <span>{children}</span>
    </Tag>
  );
}

function SectionHeading({ index, eyebrow, title, text, dark = false }) {
  return (
    <Reveal className={`section-heading${dark ? " section-heading--dark" : ""}`}>
      <p className="section-heading__index">{index}</p>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {text ? <p className="section-heading__text">{text}</p> : <span />}
    </Reveal>
  );
}

function MessengerLink({ href, icon, label, light = false }) {
  return (
    <a className={`messenger-link${light ? " messenger-link--light" : ""}`} href={href} target="_blank" rel="noreferrer">
      <span className="messenger-link__icon">
        <Image src={icon} alt="" width={36} height={36} sizes="24px" />
      </span>
      <span>{label}</span>
    </a>
  );
}

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openPractice, setOpenPractice] = useState(0);
  const [activePrice, setActivePrice] = useState(0);
  const [openFaq, setOpenFaq] = useState(0);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", service: "", message: "", agree: false });
  const [errors, setErrors] = useState({});
  const [submitState, setSubmitState] = useState("idle");
  const [mailHref, setMailHref] = useState("");
  const requestRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.35 });
  const selectedPractice = useMemo(() => PRACTICES[activePrice], [activePrice]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("is-locked", menuOpen || privacyOpen);
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setPrivacyOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("is-locked");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, privacyOpen]);

  useEffect(() => {
    if (!requestRef.current) return undefined;
    const observer = new IntersectionObserver(([entry]) => setFormVisible(entry.isIntersecting), { threshold: 0.18 });
    observer.observe(requestRef.current);
    return () => observer.disconnect();
  }, []);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: false }));
  };

  const chooseService = (service) => {
    updateForm("service", service);
    document.querySelector("#request")?.scrollIntoView({ behavior: "smooth" });
  };

  const submitLead = (event) => {
    event.preventDefault();
    const nextErrors = validateLead(form);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    const body = `Имя: ${form.name.trim()}\nТелефон: ${form.phone}\nНаправление: ${form.service}\nЗадача: ${form.message.trim() || "Не указана"}`;
    setMailHref(`mailto:${CONFIG.email}?subject=${encodeURIComponent("Заявка с сайта ДоговорОфф")}&body=${encodeURIComponent(body)}`);
    setSubmitState("success");
  };

  const resetForm = () => {
    setForm({ name: "", phone: "", service: "", message: "", agree: false });
    setErrors({});
    setMailHref("");
    setSubmitState("idle");
  };

  return (
    <>
      <a className="skip-link" href="#main">Перейти к содержанию</a>
      <motion.div className="scroll-progress" style={{ scaleX: progress }} />

      <header className={`site-header${scrolled ? " site-header--scrolled" : ""}`}>
        <div className="site-header__inner">
          <a href="#top" aria-label="ДоговорОфф — на главную"><Brand /></a>
          <p className="site-header__descriptor">Юридическая компания · Нижневартовск</p>
          <nav className="desktop-nav" aria-label="Основная навигация">
            <a href="#practices">Практики</a>
            <a href="#approach">Подход</a>
            <a href="#team">Команда</a>
            <a href="#request">Контакты</a>
          </nav>
          <button className="menu-trigger" type="button" aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen((value) => !value)}>
            {menuOpen ? "Закрыть" : "Меню"}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.nav id="mobile-navigation" className="mobile-nav" aria-label="Мобильная навигация" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: EASE }}>
            <div className="mobile-nav__links">
              <a href="#practices" onClick={() => setMenuOpen(false)}>Практики</a>
              <a href="#approach" onClick={() => setMenuOpen(false)}>Подход</a>
              <a href="#formats" onClick={() => setMenuOpen(false)}>Форматы работы</a>
              <a href="#team" onClick={() => setMenuOpen(false)}>Команда</a>
              <a href="#request" onClick={() => setMenuOpen(false)}>Контакты</a>
            </div>
            <div className="mobile-nav__footer">
              <a href={CONFIG.phoneHref}>{CONFIG.phone}</a>
              <span>{CONFIG.geo}</span>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      <main id="main">
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="hero__layout">
            <aside className="practice-rail" aria-label="Ключевые практики">
              <p className="practice-rail__title">Практики</p>
              {PRACTICES.slice(0, 4).map((practice) => (
                <a key={practice.number} href="#practices"><span>{practice.number}</span><strong>{practice.short}</strong></a>
              ))}
            </aside>

            <div className="hero__copy">
              <motion.h1 id="hero-title" initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 1, ease: EASE }}>
                Холодная<br />точность.<br /><span>Сильная позиция.</span>
              </motion.h1>
              <motion.p className="hero__subline" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8, ease: EASE }}>
                Право для сложных решений.
              </motion.p>
              <motion.div className="hero__actions" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42, duration: 0.8, ease: EASE }}>
                <MagneticAction href="#request" className="action--light">Получить консультацию</MagneticAction>
                <a className="hero__messenger" href={CONFIG.telegram} target="_blank" rel="noreferrer" aria-label="Написать в Telegram">
                  <Image src="/media/telegram.png" alt="" width={40} height={40} sizes="20px" />
                </a>
              </motion.div>
              <motion.div className="hero__meta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.62, duration: 0.9 }}>
                <span>Нижневартовск</span><a href={CONFIG.phoneHref}>{CONFIG.phone}</a><em>Конфиденциально. Точно. Лично.</em>
              </motion.div>
            </div>

            <motion.figure className="hero__art" initial={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }} animate={{ opacity: 1, clipPath: "inset(0 0 0% 0)" }} transition={{ duration: 1.25, delay: 0.12, ease: EASE }}>
              <IceMotion />
            </motion.figure>
          </div>

          <div className="approach-strip" id="approach">
            <div className="approach-strip__intro"><p>Наш подход<br />к делу</p><span>Без лишнего шума</span></div>
            {APPROACH.map(([title, text], index) => (
              <Reveal className="approach-strip__item" key={title} delay={index * 0.06}><h2>{title}</h2><p>{text}</p></Reveal>
            ))}
          </div>
        </section>

        <section className="section section--light practices" id="practices">
          <div className="page-shell">
            <SectionHeading index="01 / 08" eyebrow="Правовые практики" title="Точечная экспертиза вместо универсальных обещаний." text="Каждое направление ведётся как отдельная дисциплина — со своей логикой, рисками и стратегией." />
            <div className="practice-list">
              {PRACTICES.map((practice, index) => {
                const open = openPractice === index;
                return (
                  <Reveal className={`practice-row${open ? " practice-row--open" : ""}`} key={practice.number} delay={Math.min(index * 0.04, 0.2)}>
                    <button className="practice-row__button" type="button" aria-expanded={open} aria-controls={`practice-panel-${index}`} onClick={() => setOpenPractice(open ? -1 : index)}>
                      <span className="practice-row__number">{practice.number}</span>
                      <span className="practice-row__title">{practice.title}</span>
                      <span className="practice-row__summary">{practice.description}</span>
                      <span className="practice-row__price">{practice.price}</span>
                      <span className="practice-row__state">{open ? "Свернуть" : "Подробнее"}</span>
                    </button>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div id={`practice-panel-${index}`} className="practice-row__panel" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.48, ease: EASE }}>
                          <div className="practice-row__panel-inner">
                            <p>В составе работы</p>
                            <ul>{practice.details.map((item) => <li key={item}>{item}</li>)}</ul>
                            <MagneticAction onClick={() => chooseService(practice.service)} className="action--dark" type="button">Обсудить задачу</MagneticAction>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section section--dark clients" aria-labelledby="clients-title">
          <div className="page-shell">
            <SectionHeading index="02 / 08" eyebrow="Кому мы полезны" title="Работаем там, где цена ошибки особенно высока." text="Подключаемся к разовой задаче или становимся внешней юридической функцией — без шаблонного подхода." dark />
            <div className="client-grid">
              {CLIENTS.map(([number, title, text], index) => (
                <Reveal className="client-item" key={number} delay={index * 0.07}><span>{number}</span><h3>{title}</h3><p>{text}</p></Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--light evidence" aria-labelledby="evidence-title">
          <div className="page-shell">
            <Reveal className="evidence__statement">
              <p className="eyebrow">Северная дисциплина</p>
              <h2 id="evidence-title">Не усложняем общение. Углубляемся в право.</h2>
              <p>Вы получаете понятную позицию, заранее согласованный план и одного ответственного юриста. Без передачи дела по цепочке и неожиданных доплат.</p>
            </Reveal>
            <div className="stat-grid">
              {STATS.map(([value, label], index) => (
                <Reveal className="stat-item" key={label} delay={index * 0.06}><strong>{value}</strong><span>{label}</span></Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--dark estimator" id="estimate">
          <div className="page-shell">
            <SectionHeading index="03 / 08" eyebrow="Ориентир стоимости" title="Понимание бюджета до начала работы." text="Выберите направление. Точная стоимость зависит от материалов и цели, но согласуется до заключения договора." dark />
            <div className="estimator__grid">
              <div className="estimator__choices" role="tablist" aria-label="Выбор направления">
                {PRACTICES.map((practice, index) => (
                  <button type="button" role="tab" aria-selected={activePrice === index} className={activePrice === index ? "is-active" : ""} onClick={() => setActivePrice(index)} key={practice.number}>
                    <span>{practice.number}</span><strong>{practice.short}</strong>
                  </button>
                ))}
              </div>
              <AnimatePresence mode="wait">
                <motion.div className="estimator__result" key={selectedPractice.number} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: EASE }} role="tabpanel">
                  <p className="eyebrow">{selectedPractice.short}</p>
                  <h3>{selectedPractice.title}</h3>
                  <p>{selectedPractice.description}</p>
                  <div className="estimator__price"><span>Ориентир</span><strong>{selectedPractice.price}</strong></div>
                  <MagneticAction onClick={() => chooseService(selectedPractice.service)} className="action--light" type="button">Получить точную оценку</MagneticAction>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </section>

        <section className="section section--light formats" id="formats">
          <div className="page-shell">
            <SectionHeading index="04 / 08" eyebrow="Форматы работы" title="Под задачу, а не под шаблонный пакет." text="Три отправные точки. Итоговый объём работы формируем только после первичного разбора ситуации." />
            <div className="plan-grid">
              {PLANS.map((plan, index) => (
                <Reveal className="plan" key={plan.name} delay={index * 0.08}>
                  <div className="plan__topline"><span>0{index + 1}</span><span>{plan.caption}</span></div>
                  <h3>{plan.name}</h3><p className="plan__price">{plan.price}</p>
                  <ul>{plan.items.map((item) => <li key={item}>{item}</li>)}</ul>
                  <MagneticAction className="action--dark" type="button" onClick={() => chooseService(plan.service)}>Обсудить формат</MagneticAction>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--dark team" id="team">
          <div className="page-shell">
            <SectionHeading index="05 / 08" eyebrow="Команда" title="Руководители практик участвуют лично." text="Ключевые решения не уходят в безличный поток. Ответственность остаётся у человека, с которым вы договорились о результате." dark />
            <div className="team-grid">
              {TEAM.map((member, index) => (
                <Reveal className="team-profile" key={member.number} delay={index * 0.1}>
                  <p className="team-profile__number">{member.number}</p><p className="team-profile__role">{member.role}</p>
                  <h3>{member.title}</h3><p className="team-profile__text">{member.text}</p>
                  <div className="team-profile__tags">{member.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--light process" id="process">
          <div className="page-shell">
            <SectionHeading index="06 / 08" eyebrow="Процесс" title="Четыре понятных этапа." text="С самого начала вы знаете, что происходит сейчас, что будет дальше и за что отвечаем мы." />
            <div className="step-grid">
              {STEPS.map(([number, title, text, note], index) => (
                <Reveal className="step" key={number} delay={index * 0.06}><span className="step__number">{number}</span><h3>{title}</h3><p>{text}</p><span className="step__note">{note}</span></Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--light faq" id="faq">
          <div className="page-shell faq__grid">
            <div className="faq__intro"><p className="section-heading__index">07 / 08</p><p className="eyebrow">Вопросы</p><h2>До первого разговора.</h2><p>Короткие ответы на то, что обычно важно понять до обращения к юристу.</p></div>
            <div className="faq__list">
              {FAQ.map(([question, answer], index) => {
                const open = openFaq === index;
                return (
                  <div className={`faq-item${open ? " faq-item--open" : ""}`} key={question}>
                    <button type="button" aria-expanded={open} aria-controls={`faq-answer-${index}`} onClick={() => setOpenFaq(open ? -1 : index)}>
                      <span>{String(index + 1).padStart(2, "0")}</span><strong>{question}</strong><em>{open ? "Скрыть" : "Ответ"}</em>
                    </button>
                    <AnimatePresence initial={false}>
                      {open && <motion.div id={`faq-answer-${index}`} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.42, ease: EASE }}><p>{answer}</p></motion.div>}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="request" id="request" ref={requestRef} aria-labelledby="request-title">
          <div className="request__info">
            <div><p className="section-heading__index">08 / 08</p><p className="eyebrow">Контакт</p><h2 id="request-title">Обсудим вашу задачу лично.</h2><p>Для начала достаточно имени и номера телефона. Детали и документы безопаснее обсудить после первого контакта.</p></div>
            <div className="request__contacts"><a href={CONFIG.phoneHref}>{CONFIG.phone}</a><a href={`mailto:${CONFIG.email}`}>{CONFIG.email}</a><span>{CONFIG.address}</span><span>{CONFIG.hours}</span></div>
            <div className="request__messengers"><MessengerLink href={CONFIG.telegram} icon="/media/telegram.png" label="Telegram" light /><MessengerLink href={CONFIG.max} icon="/media/max.png" label="MAX" light /></div>
          </div>

          <div className="request__form-wrap">
            <AnimatePresence mode="wait" initial={false}>
              {submitState !== "success" ? (
                <motion.form key="form" className="lead-form" onSubmit={submitLead} noValidate initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -12 }}>
                  <div className="lead-form__heading"><span>Первичная консультация</span><strong>Бесплатно</strong></div>
                  <div className="field"><label htmlFor="lead-name">Ваше имя</label><input id="lead-name" name="name" value={form.name} onChange={(event) => updateForm("name", event.target.value)} aria-invalid={Boolean(errors.name)} autoComplete="name" placeholder="Как к вам обращаться" />{errors.name && <span className="field__error">Укажите имя</span>}</div>
                  <div className="field"><label htmlFor="lead-phone">Телефон</label><input id="lead-phone" name="phone" value={form.phone} onChange={(event) => updateForm("phone", event.target.value ? maskPhone(event.target.value) : "")} aria-invalid={Boolean(errors.phone)} autoComplete="tel" inputMode="tel" placeholder="+7 (___) ___-__-__" />{errors.phone && <span className="field__error">Введите номер полностью</span>}</div>
                  <div className="field"><label htmlFor="lead-service">Направление</label><select id="lead-service" name="service" value={form.service} onChange={(event) => updateForm("service", event.target.value)} aria-invalid={Boolean(errors.service)}><option value="">Выберите направление</option>{PRACTICES.map((practice) => <option key={practice.service}>{practice.service}</option>)}<option>Частный вопрос</option><option>Другое / не знаю</option></select>{errors.service && <span className="field__error">Выберите направление</span>}</div>
                  <div className="field"><label htmlFor="lead-message">Коротко о задаче</label><textarea id="lead-message" name="message" value={form.message} onChange={(event) => updateForm("message", event.target.value)} placeholder="Пары предложений достаточно" rows={4} /></div>
                  <label className={`consent${errors.agree ? " consent--error" : ""}`}><input type="checkbox" checked={form.agree} onChange={(event) => updateForm("agree", event.target.checked)} /><span>Согласен на обработку данных по <button type="button" onClick={() => setPrivacyOpen(true)}>условиям конфиденциальности</button>.</span></label>
                  {errors.agree && <span className="field__error field__error--consent">Нужно согласие на обработку данных</span>}
                  <MagneticAction className="action--dark lead-form__submit" type="submit">Подготовить обращение</MagneticAction>
                  <p className="lead-form__note">Данные не отправляются автоматически: после проверки откроется ваше почтовое приложение.</p>
                </motion.form>
              ) : (
                <motion.div key="success" className="lead-success" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.55, ease: EASE }}>
                  <p className="eyebrow">Обращение подготовлено</p><h3>Остался один шаг.</h3><p>Откройте письмо, проверьте данные и отправьте его компании.</p>
                  <a className="action action--dark lead-success__action" href={mailHref}><span>Открыть письмо</span></a>
                  <button className="text-link" type="button" onClick={resetForm}>Заполнить заново</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="site-footer__top">
          <div><a href="#top" aria-label="ДоговорОфф — наверх"><Brand compact /></a><p>Право для сложных решений. Нижневартовск и вся Россия онлайн.</p></div>
          <nav aria-label="Навигация в подвале"><a href="#practices">Практики</a><a href="#formats">Форматы</a><a href="#team">Команда</a><a href="#faq">Вопросы</a></nav>
          <div className="site-footer__contacts"><a href={CONFIG.phoneHref}>{CONFIG.phone}</a><a href={`mailto:${CONFIG.email}`}>{CONFIG.email}</a><span>{CONFIG.address}</span></div>
        </div>
        <div className="site-footer__bottom"><span>© {new Date().getFullYear()} «ДоговорОфф» · Не является публичной офертой</span><button type="button" onClick={() => setPrivacyOpen(true)}>Конфиденциальность</button><span>{CONFIG.geo}</span></div>
      </footer>

      <AnimatePresence>
        {!formVisible && <motion.div className="mobile-action-bar" initial={{ y: "120%" }} animate={{ y: 0 }} exit={{ y: "120%" }} transition={{ duration: 0.45, ease: EASE }}><a href={CONFIG.phoneHref}>Позвонить</a><a href="#request">Оставить заявку</a></motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {privacyOpen && (
          <motion.div className="privacy-modal" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setPrivacyOpen(false); }}>
            <motion.div className="privacy-modal__panel" role="dialog" aria-modal="true" aria-labelledby="privacy-title" initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 18, opacity: 0 }} transition={{ duration: 0.42, ease: EASE }}>
              <div className="privacy-modal__top"><p className="eyebrow">Персональные данные</p><button type="button" onClick={() => setPrivacyOpen(false)}>Закрыть</button></div>
              <h2 id="privacy-title">Условия конфиденциальности</h2>
              <p>В форме указываются имя, номер телефона, направление и необязательный текст обращения. Сайт только формирует черновик письма; данные не отправляются автоматически и не передаются стороннему сервису формы.</p>
              <p>Не добавляйте банковские сведения, копии документов и подробности, которые не нужны для первого контакта. После открытия почтового приложения вы можете изменить или удалить любые данные до отправки.</p>
              <p>Запрос по уже отправленному письму можно направить на {CONFIG.email}.</p>
              <p className="privacy-modal__note">Этот краткий текст описывает работу формы и не заменяет полную политику оператора персональных данных с реквизитами организации.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
