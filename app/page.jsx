"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import "@fontsource-variable/geologica/wght.css";
import { track } from "@vercel/analytics";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
} from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeContactPayload } from "../lib/contact-form.mjs";
import { maskPhone, validateLead } from "../lib/form-utils.mjs";
import { getRequestModeFromSearch } from "../lib/public-navigation.mjs";
import { createSubmissionId } from "../lib/submission-id.mjs";
import { PRECHECK_PRACTICES, practiceIdFromService } from "../features/precheck/config.mjs";
import { CONFIG, FAQ, PRACTICES } from "./content";
import { LEGAL } from "./legal";
import NorthernMotion from "./northern-motion";
import HomepageStory from "./homepage-story";
import "./homepage.css";
import "./homepage-story.css";

const EASE = [0.22, 1, 0.36, 1];
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const PrecheckSection = dynamic(
  () => import("../features/precheck/precheck-section"),
  {
    ssr: false,
    loading: () => <p className="precheck__loading" role="status">Открываем предварительный разбор…</p>,
  },
);

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
      initial={reduceMotion ? false : { y: 20 }}
      whileInView={reduceMotion ? undefined : { y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </Component>
  );
}

function MagneticAction({ href, children, className = "", onClick, type, target, rel, disabled }) {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 190, damping: 18, mass: 0.35 });
  const springY = useSpring(y, { stiffness: 190, damping: 18, mass: 0.35 });

  const move = (event) => {
    if (reduceMotion || window.matchMedia("(pointer: coarse)").matches || !ref.current) return;
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
  const reduceMotion = useReducedMotion();
  const [hydrated, setHydrated] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [formVisible, setFormVisible] = useState(false);
  const [heroActionVisible, setHeroActionVisible] = useState(true);
  const [requestMode, setRequestMode] = useState("quick");
  const [precheckOpened, setPrecheckOpened] = useState(false);
  const [precheckInitialPractice, setPrecheckInitialPractice] = useState("");
  const [precheckSession, setPrecheckSession] = useState(0);
  const [form, setForm] = useState({ name: "", phone: "", service: "", message: "", website: "", agree: false });
  const [errors, setErrors] = useState({});
  const [submitState, setSubmitState] = useState("idle");
  const [submitError, setSubmitError] = useState("");
  const [mailHref, setMailHref] = useState("");
  const siteContentRef = useRef(null);
  const menuTriggerRef = useRef(null);
  const mobileNavRef = useRef(null);
  const menuRestoreFocusRef = useRef(true);
  const nameFieldRef = useRef(null);
  const repeatContactFocusRef = useRef(false);
  const phoneFieldRef = useRef(null);
  const serviceFieldRef = useRef(null);
  const consentFieldRef = useRef(null);
  const successRef = useRef(null);
  const setNameFieldElement = useCallback((element) => {
    nameFieldRef.current = element;
    if (element && repeatContactFocusRef.current) {
      repeatContactFocusRef.current = false;
      element.focus();
    }
  }, []);
  const setSuccessElement = useCallback((element) => {
    successRef.current = element;
    successRef.current?.focus();
  }, []);
  const quickFormHeadingRef = useRef(null);
  const requestRef = useRef(null);
  const heroActionRef = useRef(null);
  const quickSubmissionIdRef = useRef("");
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.35 });

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    const requestModeFromUrl = getRequestModeFromSearch(window.location.search);
    const targetsLeadForm = window.location.hash === "#lead-form";

    if (requestModeFromUrl === "precheck") {
      setPrecheckInitialPractice("");
      setPrecheckSession((current) => current + 1);
      setPrecheckOpened(true);
      setRequestMode("precheck");
    }

    if (!targetsLeadForm) return undefined;

    const scrollToLeadForm = () => {
      document.querySelector("#lead-form")?.scrollIntoView({ behavior: "auto" });
    };
    const scrollFrame = window.requestAnimationFrame(scrollToLeadForm);
    const settleTimer = window.setTimeout(scrollToLeadForm, 1000);
    return () => {
      window.cancelAnimationFrame(scrollFrame);
      window.clearTimeout(settleTimer);
    };
  }, []);

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
    quickSubmissionIdRef.current = "";
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

  const chooseService = (service) => {
    setRequestMode("quick");
    updateForm("service", service);
    document.querySelector("#lead-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const focusQuickForm = () => {
    setRequestMode("quick");
    window.requestAnimationFrame(() => quickFormHeadingRef.current?.focus());
  };

  const openPrecheck = (practiceId = form.service ? practiceIdFromService(form.service) : "") => {
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


  const deliverLead = async (lead) => {
    const body = `ID заявки: ${lead.submissionId || "будет присвоен сервером"}\nИмя: ${lead.name}\nТелефон: ${lead.phone}\nНаправление: ${lead.service}\nЗадача: ${lead.message || "Не указана"}\n\nСогласие на обработку персональных данных: предоставлено\nДокумент: ${LEGAL.siteUrl}/personal-data-consent\nВерсия: ${LEGAL.policyVersion} от ${LEGAL.effectiveDate}`;
    const fallbackMailHref = `mailto:${CONFIG.email}?subject=${encodeURIComponent("Заявка с сайта ДоговорОфф")}&body=${encodeURIComponent(body)}`;

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(lead),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.success !== true) {
        const message = response.status === 429
          ? "Слишком много попыток. Подождите несколько минут или отправьте письмо напрямую."
          : "Автоматическая отправка пока недоступна. Отправьте подготовленное письмо — данные уже заполнены.";
        return { success: false, error: message, mailHref: fallbackMailHref };
      }

      return { success: true, error: "", mailHref: fallbackMailHref, mode: result.mode || "none" };
    } catch {
      return {
        success: false,
        error: "Не удалось отправить обращение. Отправьте подготовленное письмо или попробуйте ещё раз.",
        mailHref: fallbackMailHref,
      };
    }
  };

  const submitPrecheckLead = async ({ name, phone, website, agree, description, precheckInput, submissionId }) => {
    const practice = PRECHECK_PRACTICES.find(({ id }) => id === precheckInput?.practiceId);
    if (!practice) {
      return { success: false, error: "Не удалось определить направление обращения.", mailHref: "" };
    }

    const situation = String(description || "").trim().slice(0, 2_000);
    const lead = {
      ...normalizeContactPayload({
      name,
      phone,
      service: practice.service,
      message: situation,
      website,
      submissionId,
      agree,
      }),
      precheckInput,
    };
    const delivery = await deliverLead(lead);
    if (delivery.success) {
      try { track("precheck_submitted"); } catch {}
    }
    return delivery;
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

    quickSubmissionIdRef.current ||= createSubmissionId();
    const lead = normalizeContactPayload({
      ...form,
      submissionId: quickSubmissionIdRef.current,
      precheck: null,
    });
    setSubmitState("sending");
    setSubmitError("");
    const delivery = await deliverLead(lead);
    setMailHref(delivery.mailHref);
    if (delivery.success) {
      setSubmitState("success");
    } else {
      setSubmitState("error");
      setSubmitError(delivery.error);
    }
  };

  const resetForm = () => {
    repeatContactFocusRef.current = true;
    setForm({ name: "", phone: "", service: "", message: "", website: "", agree: false });
    setErrors({});
    setSubmitError("");
    setMailHref("");
    setSubmitState("idle");
    quickSubmissionIdRef.current = "";
  };

  return (
    <>
      <div className="site-shell home-shell">
        <a className="skip-link" href="#main">Перейти к содержанию</a>
        <motion.div className="scroll-progress" style={{ scaleX: progress }} />

        <header className={`site-header${scrolled ? " site-header--scrolled" : ""}`}>
        <div className="site-header__inner">
          <a href="#top" aria-label="ДоговорОфф — на главную"><Brand /></a>
          <p className="site-header__descriptor">Юридическая компания<br />Нижневартовск</p>
          <nav className="desktop-nav" aria-label="Основная навигация">
            <a href="#practices">Практики</a>
            <a href="#approach">Подход</a>
            <a href="#team">Команда</a>
            <a href="#request">Контакты</a>
            <a href="/cabinet">Кабинет</a>
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
          <a className="site-header__contact" href="#lead-form">Обсудить дело <span aria-hidden="true">↗</span></a>
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

        {menuOpen && (
          <div
            ref={mobileNavRef}
            id="mobile-navigation"
            className="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Меню сайта"
          >
            <nav className="mobile-nav__links" aria-label="Мобильная навигация">
              <a className="mobile-nav__ai" href="#lead-form" onClick={startAiPrecheck}>AI-разбор</a>
              <a href="#practices" onClick={closeMenuAfterNavigation}>Практики</a>
              <a href="#approach" onClick={closeMenuAfterNavigation}>Подход</a>
              <a href="#formats" onClick={closeMenuAfterNavigation}>Форматы работы</a>
              <a href="#team" onClick={closeMenuAfterNavigation}>Команда</a>
              <a href="#request" onClick={closeMenuAfterNavigation}>Контакты</a>
              <a href="/cabinet">Личный кабинет</a>
            </nav>
            <div className="mobile-nav__footer">
              <a href={`mailto:${CONFIG.email}`}>{CONFIG.email}</a>
              <span>{CONFIG.geo}</span>
            </div>
          </div>
        )}

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
              <p className="hero__eyebrow">Юридическая компания / Нижневартовск</p>
              <motion.h1 id="hero-title" initial={reduceMotion ? false : { y: 24 }} animate={reduceMotion ? undefined : { y: 0 }} transition={{ delay: 0.08, duration: 1, ease: EASE }}>
                Право<br />на вашей<br /><span>стороне.</span>
              </motion.h1>
              <motion.p className="hero__subline" initial={reduceMotion ? false : { y: 12 }} animate={reduceMotion ? undefined : { y: 0 }} transition={{ delay: 0.3, duration: 0.8, ease: EASE }}>
                Юридическая стратегия для сложных решений.
              </motion.p>
              <motion.div ref={heroActionRef} className="hero__actions" initial={reduceMotion ? false : { y: 12 }} animate={reduceMotion ? undefined : { y: 0 }} transition={{ delay: 0.42, duration: 0.8, ease: EASE }}>
                <MagneticAction href="#lead-form" className="action--light">Обсудить дело <span aria-hidden="true">↗</span></MagneticAction>
              </motion.div>
              <div className="hero__meta">
                <span>{CONFIG.geo}</span><a href={`mailto:${CONFIG.email}`}>{CONFIG.email}</a><em>Стратегия / Защита / Результат</em>
              </div>
            </div>

            <motion.figure className="hero__art" role="img" aria-label="Абстрактная волна из северного чёрного хрома" initial={reduceMotion ? false : { scale: 1.02 }} animate={reduceMotion ? undefined : { scale: 1 }} transition={{ duration: 1.5, delay: 0.12, ease: EASE }}>
              <NorthernMotion />
            </motion.figure>
          </div>

        </section>

        <HomepageStory onChooseService={chooseService} onStartPrecheck={startPrecheck} />

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
          <h2 id="request-title" className="request__headline">Следующий ход — ваш.</h2>
          <div className="request__info">
            <div><p className="eyebrow">Контакт</p><h3>Обсудим дело.</h3><p>Для начала достаточно имени и номера телефона. Детали и документы безопаснее обсудить после первого контакта.</p></div>
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
                  <div className="lead-form__honeypot" aria-hidden="true"><label htmlFor="lead-website">Ваш сайт</label><input id="lead-website" value={form.website} onChange={(event) => updateForm("website", event.target.value)} autoComplete="off" tabIndex={-1} maxLength={200} /></div>
                  <div className="field"><label htmlFor="lead-name">Ваше имя</label><input ref={setNameFieldElement} id="lead-name" value={form.name} onChange={(event) => updateForm("name", event.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "lead-name-error" : undefined} aria-required="true" required autoComplete="name" placeholder="Как к вам обращаться" maxLength={80} />{errors.name && <span id="lead-name-error" className="field__error" role="alert">Укажите имя</span>}</div>
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
                <motion.div ref={setSuccessElement} key="success" className="lead-success" role="status" aria-live="polite" tabIndex={-1} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.55, ease: EASE }}>
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
                  onSubmitLead={submitPrecheckLead}
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
