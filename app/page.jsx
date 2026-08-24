"use client";

import Image from "next/image";
import { track } from "@vercel/analytics";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
} from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { getNextTabIndex } from "../lib/a11y-utils.mjs";
import { normalizeContactPayload } from "../lib/contact-form.mjs";
import { maskPhone, validateLead } from "../lib/form-utils.mjs";
import PrecheckSection from "../features/precheck/precheck-section";
import { PRECHECK_PRACTICES, practiceIdFromService } from "../features/precheck/config.mjs";
import { APPROACH, CLIENTS, CONFIG, FAQ, PLANS, PRACTICES, STATS, STEPS, TEAM } from "./content";
import { LEGAL } from "./legal";
import NorthernMotion from "./northern-motion";

const EASE = [0.22, 1, 0.36, 1];
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const PRECHECK_MESSAGE_MARKER = "Предварительный разбор:\n";

function confirmedPrecheckFromMessage(message, attachment) {
  if (!attachment || typeof message !== "string") return null;
  const markerIndex = message.indexOf(PRECHECK_MESSAGE_MARKER);
  if (markerIndex === -1) return null;
  const excerpt = message.slice(markerIndex + PRECHECK_MESSAGE_MARKER.length).trim().slice(0, 1_200);
  return excerpt ? { ...attachment, excerpt } : null;
}

function getFocusableElements(container) {
  if (!container) return [];

  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getAttribute("aria-hidden") !== "true",
  );
}

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
  const [hydrated, setHydrated] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openPractice, setOpenPractice] = useState(0);
  const [activePrice, setActivePrice] = useState(0);
  const [openFaq, setOpenFaq] = useState(0);
  const [formVisible, setFormVisible] = useState(false);
  const [heroActionVisible, setHeroActionVisible] = useState(true);
  const [requestMode, setRequestMode] = useState("quick");
  const [precheckOpened, setPrecheckOpened] = useState(false);
  const [precheckInitialPractice, setPrecheckInitialPractice] = useState("");
  const [precheckSession, setPrecheckSession] = useState(0);
  const [precheckAttachment, setPrecheckAttachment] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", service: "", message: "", website: "", agree: false });
  const [errors, setErrors] = useState({});
  const [submitState, setSubmitState] = useState("idle");
  const [submitError, setSubmitError] = useState("");
  const [mailHref, setMailHref] = useState("");
  const siteContentRef = useRef(null);
  const menuTriggerRef = useRef(null);
  const mobileNavRef = useRef(null);
  const menuRestoreFocusRef = useRef(true);
  const priceTabRefs = useRef([]);
  const nameFieldRef = useRef(null);
  const phoneFieldRef = useRef(null);
  const serviceFieldRef = useRef(null);
  const consentFieldRef = useRef(null);
  const successRef = useRef(null);
  const quickFormHeadingRef = useRef(null);
  const requestRef = useRef(null);
  const heroActionRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.35 });
  const selectedPractice = useMemo(() => PRACTICES[activePrice], [activePrice]);

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (submitState !== "success") return undefined;

    const focusSuccess = window.requestAnimationFrame(() => successRef.current?.focus());
    return () => window.cancelAnimationFrame(focusSuccess);
  }, [submitState]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("is-locked", menuOpen);
    return () => {
      document.body.classList.remove("is-locked");
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!siteContentRef.current) return undefined;
    siteContentRef.current.inert = menuOpen;
    return () => {
      if (siteContentRef.current) siteContentRef.current.inert = false;
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen || !mobileNavRef.current) return undefined;

    const navigation = mobileNavRef.current;
    menuRestoreFocusRef.current = true;
    const focusFirstLink = window.requestAnimationFrame(() => {
      getFocusableElements(navigation)[0]?.focus();
    });

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        menuRestoreFocusRef.current = true;
        setMenuOpen(false);
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = [menuTriggerRef.current, ...getFocusableElements(navigation)].filter(Boolean);
      if (!focusable.length) return;

      const currentIndex = focusable.indexOf(document.activeElement);
      if (event.shiftKey && currentIndex <= 0) {
        event.preventDefault();
        focusable.at(-1)?.focus();
      } else if (!event.shiftKey && currentIndex === focusable.length - 1) {
        event.preventDefault();
        focusable[0]?.focus();
      } else if (currentIndex === -1) {
        event.preventDefault();
        focusable[0]?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFirstLink);
      document.removeEventListener("keydown", onKeyDown);
      if (menuRestoreFocusRef.current) {
        window.requestAnimationFrame(() => menuTriggerRef.current?.focus());
      }
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!requestRef.current) return undefined;
    const observer = new IntersectionObserver(([entry]) => setFormVisible(entry.isIntersecting), { threshold: 0.18 });
    observer.observe(requestRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!heroActionRef.current) return undefined;
    const observer = new IntersectionObserver(([entry]) => setHeroActionVisible(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(heroActionRef.current);
    return () => observer.disconnect();
  }, []);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: false }));
    if (submitState === "error") {
      setSubmitState("idle");
      setSubmitError("");
    }
  };

  const closeMenuAfterNavigation = () => {
    menuRestoreFocusRef.current = false;
    setMenuOpen(false);
  };

  const handlePriceKeyDown = (event, index) => {
    const nextIndex = getNextTabIndex(event.key, index, PRACTICES.length);
    if (nextIndex === null) return;

    event.preventDefault();
    setActivePrice(nextIndex);
    priceTabRefs.current[nextIndex]?.focus();
  };

  const chooseService = (service) => {
    setRequestMode("quick");
    updateForm("service", service);
    document.querySelector("#lead-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const focusQuickForm = () => {
    setRequestMode("quick");
    window.requestAnimationFrame(() => quickFormHeadingRef.current?.focus());
  };

  const openPrecheck = (practiceId = practiceIdFromService(form.service)) => {
    setPrecheckInitialPractice(practiceId);
    setPrecheckOpened(true);
    setRequestMode("precheck");
  };

  const startPrecheck = (service) => {
    setPrecheckInitialPractice(practiceIdFromService(service));
    setPrecheckSession((current) => current + 1);
    setPrecheckOpened(true);
    setRequestMode("precheck");
    document.querySelector("#lead-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const startAiPrecheck = (event) => {
    event.preventDefault();
    menuRestoreFocusRef.current = false;
    setMenuOpen(false);
    setPrecheckInitialPractice("");
    setPrecheckSession((current) => current + 1);
    setPrecheckOpened(true);
    setRequestMode("precheck");
    window.requestAnimationFrame(() => {
      document.querySelector("#lead-form")?.scrollIntoView({ behavior: "smooth" });
    });
  };

  const usePrecheckSummary = (attachment) => {
    const practice = PRECHECK_PRACTICES.find(({ id }) => id === attachment.practiceId);
    if (!practice) return;
    const block = `${PRECHECK_MESSAGE_MARKER}${attachment.excerpt}`;
    setPrecheckAttachment(attachment);
    setForm((current) => {
      const availableForExisting = Math.max(0, 2_000 - block.length - 2);
      const existing = current.message.trim().slice(0, availableForExisting);
      return {
        ...current,
        service: practice.service,
        message: existing ? `${existing}\n\n${block}` : block,
      };
    });
    setErrors((current) => ({ ...current, service: false }));
    focusQuickForm();
  };

  const removePrecheckSummary = () => {
    setForm((current) => {
      const markerIndex = current.message.indexOf(PRECHECK_MESSAGE_MARKER);
      return {
        ...current,
        message: markerIndex === -1 ? current.message : current.message.slice(0, markerIndex).trim(),
      };
    });
    setPrecheckAttachment(null);
  };

  const submitLead = async (event) => {
    event.preventDefault();
    const nextErrors = validateLead(form);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      const invalidFields = {
        name: nameFieldRef,
        phone: phoneFieldRef,
        service: serviceFieldRef,
        agree: consentFieldRef,
      };
      const firstInvalid = Object.keys(invalidFields).find((field) => nextErrors[field]);
      window.requestAnimationFrame(() => invalidFields[firstInvalid]?.current?.focus());
      return;
    }

    const confirmedPrecheck = confirmedPrecheckFromMessage(form.message, precheckAttachment);
    const lead = normalizeContactPayload({ ...form, precheck: confirmedPrecheck });
    const body = `Имя: ${lead.name}\nТелефон: ${lead.phone}\nНаправление: ${lead.service}\nЗадача: ${lead.message || "Не указана"}\n\nСогласие на обработку персональных данных: предоставлено\nДокумент: ${LEGAL.siteUrl}/personal-data-consent\nВерсия: ${LEGAL.policyVersion} от ${LEGAL.effectiveDate}`;
    setMailHref(`mailto:${CONFIG.email}?subject=${encodeURIComponent("Заявка с сайта ДоговорОфф")}&body=${encodeURIComponent(body)}`);
    setSubmitState("sending");
    setSubmitError("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(lead),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.success !== true) {
        if (response.status === 429) {
          throw new Error("Слишком много попыток. Подождите несколько минут или отправьте письмо напрямую.");
        }
        throw new Error("Автоматическая отправка пока недоступна. Отправьте подготовленное письмо — данные уже заполнены.");
      }

      setSubmitState("success");
      if (lead.precheck) {
        try { track("precheck_submitted"); } catch {}
      }
      setPrecheckAttachment(null);
    } catch (error) {
      setSubmitState("error");
      setSubmitError(error instanceof Error ? error.message : "Не удалось отправить обращение. Попробуйте ещё раз.");
    }
  };

  const resetForm = () => {
    setForm({ name: "", phone: "", service: "", message: "", website: "", agree: false });
    setPrecheckAttachment(null);
    setErrors({});
    setSubmitError("");
    setMailHref("");
    setSubmitState("idle");
    window.requestAnimationFrame(() => nameFieldRef.current?.focus());
  };

  return (
    <>
      <div className="site-shell">
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
          <a
            className={`site-header__ai${menuOpen ? " is-menu-open" : ""}`}
            href="#lead-form"
            aria-label="Начать AI-разбор ситуации"
            aria-hidden={menuOpen ? true : undefined}
            tabIndex={menuOpen ? -1 : undefined}
            onClick={startAiPrecheck}
          >
            <span className="site-header__ai-full">AI-разбор</span>
            <span className="site-header__ai-short" aria-hidden="true">AI</span>
          </a>
          <button
            ref={menuTriggerRef}
            className="menu-trigger"
            type="button"
            aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? "Закрыть" : "Меню"}
          </button>
        </div>
        </header>

        <AnimatePresence>
        {menuOpen && (
          <motion.div
            ref={mobileNavRef}
            id="mobile-navigation"
            className="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Меню сайта"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <nav className="mobile-nav__links" aria-label="Мобильная навигация">
              <a className="mobile-nav__ai" href="#lead-form" onClick={startAiPrecheck}>AI-разбор</a>
              <a href="#practices" onClick={closeMenuAfterNavigation}>Практики</a>
              <a href="#approach" onClick={closeMenuAfterNavigation}>Подход</a>
              <a href="#formats" onClick={closeMenuAfterNavigation}>Форматы работы</a>
              <a href="#team" onClick={closeMenuAfterNavigation}>Команда</a>
              <a href="#request" onClick={closeMenuAfterNavigation}>Контакты</a>
            </nav>
            <div className="mobile-nav__footer">
              <a href={`mailto:${CONFIG.email}`}>{CONFIG.email}</a>
              <span>{CONFIG.geo}</span>
            </div>
          </motion.div>
        )}
        </AnimatePresence>

        <div className="site-content" ref={siteContentRef} aria-hidden={menuOpen ? true : undefined}>
          <main id="main" tabIndex={-1}>
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
              <motion.div ref={heroActionRef} className="hero__actions" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42, duration: 0.8, ease: EASE }}>
                <MagneticAction href="#lead-form" className="action--light">Получить консультацию</MagneticAction>
              </motion.div>
              <motion.div className="hero__meta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.62, duration: 0.9 }}>
                <span>Нижневартовск</span><a href={`mailto:${CONFIG.email}`}>{CONFIG.email}</a><em>Конфиденциально. Точно. Лично.</em>
              </motion.div>
            </div>

            <motion.figure className="hero__art" role="img" aria-label="Абстрактный ледяной разлом — образ северной точности" initial={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }} animate={{ opacity: 1, clipPath: "inset(0 0 0% 0)" }} transition={{ duration: 1.25, delay: 0.12, ease: EASE }}>
              <NorthernMotion />
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
                  <button
                    ref={(element) => {
                      priceTabRefs.current[index] = element;
                    }}
                    id={`estimate-tab-${index}`}
                    type="button"
                    role="tab"
                    aria-selected={activePrice === index}
                    aria-controls="estimate-panel"
                    tabIndex={activePrice === index ? 0 : -1}
                    className={activePrice === index ? "is-active" : ""}
                    onClick={() => setActivePrice(index)}
                    onKeyDown={(event) => handlePriceKeyDown(event, index)}
                    key={practice.number}
                  >
                    <span>{practice.number}</span><strong>{practice.short}</strong>
                  </button>
                ))}
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  id="estimate-panel"
                  className="estimator__result"
                  key={selectedPractice.number}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  role="tabpanel"
                  aria-labelledby={`estimate-tab-${activePrice}`}
                  tabIndex={0}
                >
                  <p className="eyebrow">{selectedPractice.short}</p>
                  <h3>{selectedPractice.title}</h3>
                  <p>{selectedPractice.description}</p>
                  <div className="estimator__price"><span>Ориентир</span><strong>{selectedPractice.price}</strong></div>
                  <MagneticAction onClick={() => startPrecheck(selectedPractice.service)} className="action--light" type="button">Получить точную оценку</MagneticAction>
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
                <Reveal as="article" className="team-profile" key={member.number} delay={index * 0.1}>
                  <div className="team-profile__topline">
                    <span>{member.number}</span>
                    <strong>{member.experience} опыта</strong>
                  </div>
                  <div className="team-profile__content">
                    <p className="team-profile__role">{member.role}</p>
                    <h3>{member.title}</h3>
                    <dl className="team-profile__facts">
                      <div><dt>Опыт</dt><dd>{member.experience}</dd></div>
                      <div><dt>Город</dt><dd>{member.location}</dd></div>
                      <div><dt>Образование</dt><dd>{member.education}</dd></div>
                    </dl>
                    <p className="team-profile__text">{member.text}</p>
                    <p className="team-profile__focus"><span>Фокус</span>{member.focus}</p>
                    <div className="team-profile__tags" aria-label={`Направления работы: ${member.title}`}>{member.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                  </div>
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
            <div className="request__contacts"><a href={`mailto:${CONFIG.email}`}>{CONFIG.email}</a><span>{CONFIG.address}</span><span>{CONFIG.hours}</span></div>
            <div className="request__messengers"><MessengerLink href={CONFIG.telegram} icon="/media/telegram.png" label="Telegram" light /><MessengerLink href={CONFIG.max} icon="/media/max.png" label="MAX" light /></div>
          </div>

          <div className="request__form-wrap" id="lead-form">
            <div className="request-mode" role="tablist" aria-label="Способ обращения">
              <button id="request-mode-quick" type="button" role="tab" aria-selected={requestMode === "quick"} aria-controls="request-panel-quick" className={requestMode === "quick" ? "is-active" : ""} onClick={focusQuickForm}>Быстрая заявка</button>
              <button id="request-mode-precheck" type="button" role="tab" aria-selected={requestMode === "precheck"} aria-controls="request-panel-precheck" className={requestMode === "precheck" ? "is-active" : ""} onClick={() => openPrecheck()}>Предварительный разбор</button>
            </div>
            <div id="request-panel-quick" role="tabpanel" aria-labelledby="request-mode-quick" hidden={requestMode !== "quick"}>
              <AnimatePresence mode="wait" initial={false}>
              {submitState !== "success" ? (
                <motion.form key="form" className="lead-form" onSubmit={submitLead} noValidate initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -12 }}>
                  <div ref={quickFormHeadingRef} className="lead-form__heading" tabIndex={-1}><span>Первичная консультация</span><strong>Бесплатно</strong></div>
                  {precheckAttachment ? <div className="precheck-attachment"><span>Карта ситуации добавлена к заявке</span><button type="button" onClick={removePrecheckSummary}>Удалить</button></div> : null}
                  <div className="lead-form__honeypot" aria-hidden="true"><label htmlFor="lead-website">Ваш сайт</label><input id="lead-website" value={form.website} onChange={(event) => updateForm("website", event.target.value)} autoComplete="off" tabIndex={-1} maxLength={200} /></div>
                  <div className="field"><label htmlFor="lead-name">Ваше имя</label><input ref={nameFieldRef} id="lead-name" value={form.name} onChange={(event) => updateForm("name", event.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "lead-name-error" : undefined} aria-required="true" required autoComplete="name" placeholder="Как к вам обращаться" maxLength={80} />{errors.name && <span id="lead-name-error" className="field__error" role="alert">Укажите имя</span>}</div>
                  <div className="field"><label htmlFor="lead-phone">Телефон</label><input ref={phoneFieldRef} id="lead-phone" value={form.phone} onChange={(event) => updateForm("phone", event.target.value ? maskPhone(event.target.value) : "")} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "lead-phone-error" : undefined} aria-required="true" required autoComplete="tel" inputMode="tel" placeholder="+7 (___) ___-__-__" maxLength={32} />{errors.phone && <span id="lead-phone-error" className="field__error" role="alert">Введите номер полностью</span>}</div>
                  <div className="field"><label htmlFor="lead-service">Направление</label><select ref={serviceFieldRef} id="lead-service" value={form.service} onChange={(event) => updateForm("service", event.target.value)} aria-invalid={Boolean(errors.service)} aria-describedby={errors.service ? "lead-service-error" : undefined} aria-required="true" required><option value="">Выберите направление</option>{PRACTICES.map((practice) => <option key={practice.service}>{practice.service}</option>)}<option>Частный вопрос</option><option>Другое / не знаю</option></select>{errors.service && <span id="lead-service-error" className="field__error" role="alert">Выберите направление</span>}</div>
                  <div className="field"><label htmlFor="lead-message">Коротко о задаче</label><textarea id="lead-message" value={form.message} onChange={(event) => updateForm("message", event.target.value)} placeholder="Пары предложений достаточно" rows={4} maxLength={2000} /></div>
                  <div className={`consent${errors.agree ? " consent--error" : ""}`}>
                    <input ref={consentFieldRef} id="lead-consent" type="checkbox" checked={form.agree} onChange={(event) => updateForm("agree", event.target.checked)} aria-invalid={Boolean(errors.agree)} aria-describedby={errors.agree ? "lead-consent-error" : undefined} aria-required="true" required />
                    <span><label htmlFor="lead-consent">Даю отдельное согласие на обработку персональных данных</label> (<a href="/personal-data-consent" target="_blank" rel="noreferrer">текст согласия</a>).</span>
                  </div>
                  {errors.agree && <span id="lead-consent-error" className="field__error field__error--consent" role="alert">Нужно согласие на обработку данных</span>}
                  {submitError && <div className="lead-form__submit-error" role="alert"><p>{submitError}</p><a href={mailHref}>Отправить по электронной почте</a></div>}
                  <MagneticAction className="action--dark lead-form__submit" type="submit" disabled={!hydrated || submitState === "sending"}>{submitState === "sending" ? "Отправляем…" : "Отправить обращение"}</MagneticAction>
                  <noscript><p className="lead-form__noscript">Для отправки формы включите JavaScript или напишите нам по электронной почте либо в мессенджере.</p></noscript>
                  <p className="lead-form__note">После отправки заявка поступит компании напрямую. Порядок обработки описан в <a href="/privacy" target="_blank" rel="noreferrer">Политике</a>.</p>
                </motion.form>
              ) : (
                <motion.div ref={successRef} key="success" className="lead-success" role="status" aria-live="polite" tabIndex={-1} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.55, ease: EASE }}>
                  <p className="eyebrow">Обращение отправлено</p><h3>Спасибо. Мы на связи.</h3><p>Заявка поступила компании. Мы свяжемся с вами по указанному номеру в рабочее время.</p>
                  <button className="text-link lead-success__action" type="button" onClick={resetForm}>Отправить ещё одно обращение</button>
                </motion.div>
              )}
              </AnimatePresence>
            </div>
            {precheckOpened ? (
              <div id="request-panel-precheck" role="tabpanel" aria-labelledby="request-mode-precheck" hidden={requestMode !== "precheck"}>
                <PrecheckSection
                  key={`${precheckSession}-${precheckInitialPractice}`}
                  initialPracticeId={precheckInitialPractice}
                  onUseSummary={usePrecheckSummary}
                  onChooseQuickForm={focusQuickForm}
                />
              </div>
            ) : <div id="request-panel-precheck" role="tabpanel" aria-labelledby="request-mode-precheck" hidden />}
          </div>
        </section>
          </main>

          <footer className="site-footer">
        <div className="site-footer__top">
          <div><a href="#top" aria-label="ДоговорОфф — наверх"><Brand compact /></a><p>Право для сложных решений. Нижневартовск и вся Россия онлайн.</p></div>
          <nav aria-label="Навигация в подвале"><a href="#practices">Практики</a><a href="#formats">Форматы</a><a href="#team">Команда</a><a href="#faq">Вопросы</a></nav>
          <div className="site-footer__contacts"><a href={`mailto:${CONFIG.email}`}>{CONFIG.email}</a><span>{CONFIG.address}</span></div>
        </div>
        <div className="site-footer__bottom"><span>© {new Date().getFullYear()} «ДоговорОфф» · Не является публичной офертой</span><a href="/privacy">Политика обработки данных</a><a href="/personal-data-consent">Согласие</a><a href="/ai-processing-consent">AI-обработка</a><span>{CONFIG.geo}</span></div>
          </footer>

          <AnimatePresence>
            {!formVisible && !heroActionVisible && <motion.div className="mobile-action-bar" initial={{ y: "120%" }} animate={{ y: 0 }} exit={{ y: "120%" }} transition={{ duration: 0.45, ease: EASE }}><a href="#lead-form">Оставить заявку</a></motion.div>}
          </AnimatePresence>
        </div>
      </div>

    </>
  );
}
