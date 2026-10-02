"use client";

import Image from "next/image";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getNextTabIndex } from "../lib/a11y-utils.mjs";
import { chapterIndex, chapterPosition, chapterProgress, chapterScrollTop } from "../lib/homepage-motion.mjs";
import { PLANS, PRACTICES, STEPS, TEAM } from "./content";
import NorthernSculpture from "./northern-sculpture";

const EASE = [0.22, 1, 0.36, 1];
const PRACTICE_LINES = [
  ["От документации", "до исполнения контракта."],
  ["Правовая опора", "ежедневных решений."],
  ["Отрасль сложная.", "Позиция — ясная."],
  ["Сильная позиция.", "Выверенная стратегия."],
  ["Смысл — в деталях.", "Защита — в документе."],
];
const STEP_LINES = ["Ваш вопрос — точка отсчёта.", "Сначала — позиция.", "Условия без неизвестных.", "Каждый шаг — на связи."];

export function LineArrow({ className = "" }) {
  return <svg className={`line-arrow ${className}`} width="72" height="22" viewBox="0 0 72 22" fill="none" aria-hidden="true"><path d="M1 11H70M60 1L70 11L60 21" stroke="currentColor" strokeWidth="1.1" /></svg>;
}

function useChapters(count) {
  const ref = useRef(null);
  const tabs = useRef([]);
  const modeTransition = useRef(null);
  const [cinematic, setCinematic] = useState(false);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1000px) and (min-height: 760px) and (prefers-reduced-motion: no-preference)");
    let initialized = false;
    const update = () => {
      const section = ref.current;
      modeTransition.current = null;
      if (initialized && section && query.matches !== (section.dataset.mode === "cinematic")) {
        const focusedElement = document.activeElement;
        const focusedSection = focusedElement?.closest(".practice-atlas, .process-journey");
        const focusBounds = focusedElement?.getBoundingClientRect();
        const visibleFocus = focusedSection && focusBounds?.bottom > 112 && focusBounds.top < window.innerHeight
          && focusBounds.right > 0 && focusBounds.left < window.innerWidth;
        const focused = visibleFocus && focusedSection === section ? focusedElement : null;
        const focusedPanel = focused?.closest("[data-chapter]");
        const focusedTab = tabs.current.indexOf(focused);
        const panels = Array.from(section.querySelectorAll("[data-chapter]"));
        const bounds = section.getBoundingClientRect();
        const ownsViewport = bounds.top <= window.innerHeight / 2 && bounds.bottom > window.innerHeight / 2;
        let index = chapterIndex(scrollYProgress.get(), count);
        if (section.dataset.mode === "document") {
          let largest = 0;
          panels.forEach((panel, panelIndex) => {
            const box = panel.getBoundingClientRect();
            const visibleHeight = Math.max(0, Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 112));
            if (visibleHeight > largest) { largest = visibleHeight; index = panelIndex; }
          });
        }
        if (focusedPanel) index = Number(focusedPanel.dataset.chapter);
        else if (focusedTab >= 0) index = focusedTab;
        // A tab can keep focus after the visitor scrolls to another section.
        // Only visible focus may override the section currently being read.
        const preservePosition = visibleFocus ? focusedSection === section : ownsViewport;
        modeTransition.current = { index, focused, preservePosition };
      }
      initialized = true;
      setCinematic(query.matches);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [count, scrollYProgress]);

  useLayoutEffect(() => {
    const section = ref.current;
    if (!section) return undefined;
    const transition = modeTransition.current;
    modeTransition.current = null;
    let layoutFrame = 0;
    let focusFrame = 0;
    let layoutAttempts = 0;
    const synchronizeLayout = () => {
      const stage = section.querySelector(".atlas-stage, .journey-stage");
      const track = section.querySelector(".atlas-track, .journey-track");
      // Media-query styles and Motion's last render can settle in different
      // frames. Measure only once the browser reports the intended layout.
      const ready = cinematic
        ? window.getComputedStyle(stage).position === "sticky"
        : window.getComputedStyle(track).transform === "none";
      if (!ready) {
        if (++layoutAttempts < 12) layoutFrame = window.requestAnimationFrame(synchronizeLayout);
        else {
          console.warn("Homepage layout unavailable; keeping the readable document view.");
          setCinematic(false);
        }
        return;
      }
      if (transition?.preservePosition) {
        const bounds = section.getBoundingClientRect();
        const panel = section.querySelector(`[data-chapter="${transition.index}"]`);
        const top = cinematic
          ? chapterScrollTop(bounds.top + window.scrollY, bounds.height, window.innerHeight, transition.index, count)
          : (panel?.getBoundingClientRect().top ?? bounds.top) + window.scrollY - 112;
        window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
      }
      if (cinematic) {
        // A mode change does not necessarily emit a scroll event. Keep the
        // track, selected tab and inert panels synchronized explicitly.
        const bounds = section.getBoundingClientRect();
        const progress = chapterProgress(bounds.top + window.scrollY, bounds.height, window.innerHeight, window.scrollY);
        scrollYProgress.set(progress);
        setActive(chapterIndex(progress, count));
      } else if (transition) {
        setActive(transition.index);
      }
      if (!transition?.focused) return;
      focusFrame = window.requestAnimationFrame(() => {
        const previous = transition.focused;
        const current = document.activeElement;
        if (current !== previous && current !== document.body && current !== document.documentElement) return;
        if (previous.isConnected && previous.getClientRects().length && !previous.closest("[inert]")) {
          previous.focus({ preventScroll: true });
          return;
        }
        const index = cinematic ? chapterIndex(scrollYProgress.get(), count) : transition.index;
        section.querySelector(`[data-chapter="${index}"] h3`)?.focus({ preventScroll: true });
      });
    };
    layoutFrame = window.requestAnimationFrame(synchronizeLayout);
    return () => {
      window.cancelAnimationFrame(layoutFrame);
      window.cancelAnimationFrame(focusFrame);
    };
  }, [cinematic, count, scrollYProgress]);

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    if (cinematic) setActive(chapterIndex(value, count));
  });

  const choose = (index) => {
    const section = ref.current;
    if (!section) return;
    setActive(index);
    if (cinematic) {
      const bounds = section.getBoundingClientRect();
      window.scrollTo({ top: chapterScrollTop(bounds.top + window.scrollY, bounds.height, window.innerHeight, index, count), behavior: "smooth" });
    } else {
      section.querySelector(`[data-chapter="${index}"]`)?.scrollIntoView({ behavior: "auto", block: "start" });
    }
  };

  const onKeyDown = (event, index) => {
    const next = getNextTabIndex(event.key, index, count);
    if (next === null) return;
    event.preventDefault();
    choose(next);
    tabs.current[next]?.focus({ preventScroll: true });
  };
  return { ref, tabs, cinematic, active, progress: scrollYProgress, choose, onKeyDown };
}

function LitLine({ children, progress, range }) {
  const color = useTransform(progress, range, ["#697680", "#f3f6f7"]);
  const reduce = useReducedMotion();
  return <motion.span style={reduce ? undefined : { color }}>{children}</motion.span>;
}

function Manifesto() {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 55%"] });
  const y = useTransform(scrollYProgress, [0, 1], [60, -40]);
  return (
    <section className="story-manifesto story-gutter" id="approach" ref={ref} aria-labelledby="manifesto-title">
      <div className="story-label"><span>Наш подход</span><i /></div>
      <h2 id="manifesto-title">
        <LitLine progress={scrollYProgress} range={[0, .3]}>Сложность —</LitLine>
        <LitLine progress={scrollYProgress} range={[.15, .5]}>исходные данные.</LitLine>
        <LitLine progress={scrollYProgress} range={[.35, .8]}>Ясность — результат.</LitLine>
      </h2>
      <div className="manifesto-principles">
        {[["Позиция", "Проверяем документы и правовые риски."], ["Стратегия", "Определяем последовательность действий."], ["Контроль", "Фиксируем сроки и держим вас в курсе."]].map(([title, text]) => (
          <div key={title}><h3>{title}</h3><p>{text}</p></div>
        ))}
      </div>
      <motion.div className="manifesto-horizon" style={reduce ? undefined : { y }} aria-hidden="true"><Image src="/media/northern-horizon.webp" alt="" fill sizes="100vw" /></motion.div>
    </section>
  );
}

function PracticeAtlas({ onChooseService, onStartPrecheck }) {
  const chapters = useChapters(PRACTICES.length);
  const x = useTransform(chapters.progress, value => `${-100 * chapterPosition(value, PRACTICES.length)}%`);
  return (
    <section ref={chapters.ref} id="practices" className="practice-atlas" data-mode={chapters.cinematic ? "cinematic" : "document"} aria-labelledby="atlas-title">
      <span id="estimate" className="story-anchor" />
      <div className="atlas-stage story-gutter">
        <div className="atlas-topline"><h2 id="atlas-title">Правовые практики</h2><span aria-hidden="true">{String(chapters.active + 1).padStart(2, "0")} <em>/ 05</em></span></div>
        <NorthernSculpture progress={chapters.progress} chapter={chapters.active} />
        <div className="atlas-window">
          <motion.div className="atlas-track" style={chapters.cinematic ? { x } : undefined}>
            {PRACTICES.map((practice, index) => (
              <article id={`practice-panel-${index}`} className="atlas-chapter" key={practice.number} data-chapter={index} role={chapters.cinematic ? "tabpanel" : undefined} aria-labelledby={chapters.cinematic ? `estimate-tab-${index}` : `practice-title-${index}`} aria-hidden={chapters.cinematic && chapters.active !== index ? true : undefined} inert={chapters.cinematic && chapters.active !== index ? true : undefined}>
                <div className="atlas-copy">
                  <h3 id={`practice-title-${index}`} tabIndex={-1}>{practice.short}.</h3>
                  <p className="atlas-statement">{PRACTICE_LINES[index][0]}<br />{PRACTICE_LINES[index][1]}</p>
                  <p className="atlas-description">{practice.description}</p>
                  <ul className="atlas-details">{practice.details.map((item) => <li key={item}>{item}</li>)}</ul>
                  <button type="button" className="story-action" onClick={() => onChooseService(practice.service)}>Обсудить задачу <LineArrow /></button>
                </div>
                <div className="atlas-price"><span>Ориентир стоимости</span><strong>{practice.price}</strong><button type="button" onClick={() => onStartPrecheck(practice.service)}>Получить точную оценку <LineArrow /></button></div>
              </article>
            ))}
          </motion.div>
        </div>
        <div className="chapter-navigation" role={chapters.cinematic ? "tablist" : "group"} aria-label="Выбор направления">
          {PRACTICES.map((practice, index) => <button ref={(el) => { chapters.tabs.current[index] = el; }} id={`estimate-tab-${index}`} key={practice.number} type="button" role={chapters.cinematic ? "tab" : undefined} aria-selected={chapters.cinematic ? chapters.active === index : undefined} aria-controls={`practice-panel-${index}`} tabIndex={!chapters.cinematic || chapters.active === index ? 0 : -1} className={chapters.active === index ? "is-active" : ""} onClick={() => chapters.choose(index)} onKeyDown={(event) => chapters.onKeyDown(event, index)}><span>{practice.short}</span></button>)}
        </div>
      </div>
    </section>
  );
}

function CinematicFilm() {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let cancelled = false;
    const update = () => {
      if (mediaQuery.matches || navigator.connection?.saveData || !visible || document.hidden) {
        video.pause();
        setPlaying(false);
        return;
      }
      if (!video.getAttribute("src")) video.src = "/media/higgsfield-northern-film.mp4";
      video.playbackRate = .8;
      video.play().then(() => { if (!cancelled && visible && !video.paused && !document.hidden) setPlaying(true); }).catch(() => { if (!cancelled) setPlaying(false); });
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }, { threshold: .01 });
    observer.observe(video);
    mediaQuery.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => { cancelled = true; observer.disconnect(); mediaQuery.removeEventListener("change", update); document.removeEventListener("visibilitychange", update); video.pause(); video.removeAttribute("src"); video.load(); };
  }, []);
  return <div className="journey-film" aria-hidden="true" data-playing={playing}><Image src="/media/northern-horizon.webp" alt="" fill sizes="100vw" /><video ref={ref} muted loop playsInline preload="none" tabIndex={-1} /><div className="journey-film__shade" /></div>;
}

function ProcessJourney() {
  const chapters = useChapters(STEPS.length);
  const y = useTransform(chapters.progress, value => `${-100 * chapterPosition(value, STEPS.length)}%`);
  return (
    <section id="process" className="process-journey" ref={chapters.ref} data-mode={chapters.cinematic ? "cinematic" : "document"} aria-labelledby="journey-title">
      <div className="journey-stage story-gutter">
        <CinematicFilm />
        <div className="journey-topline"><h2 id="journey-title">От первого вопроса<br />до решения</h2><span>Очно или онлайн</span></div>
        <div className="journey-window"><motion.div className="journey-track" style={chapters.cinematic ? { y } : undefined}>
          {STEPS.map(([number, title, text, note], index) => <article id={`journey-panel-${index}`} className="journey-chapter" key={number} data-chapter={index} role={chapters.cinematic ? "tabpanel" : undefined} aria-labelledby={chapters.cinematic ? `journey-tab-${index}` : `journey-heading-${index}`} aria-hidden={chapters.cinematic && chapters.active !== index ? true : undefined} inert={chapters.cinematic && chapters.active !== index ? true : undefined}>
            <span className="journey-number" aria-hidden="true">{number}</span><div className="journey-copy"><p className="journey-statement">{STEP_LINES[index]}</p><h3 id={`journey-heading-${index}`} tabIndex={-1}>{title}.</h3><p className="journey-description">{text}</p><span className="journey-note">{note}</span></div>
          </article>)}
        </motion.div></div>
        <div className="chapter-navigation journey-navigation" role={chapters.cinematic ? "tablist" : "group"} aria-label="Этапы работы">
          {STEPS.map(([number, title], index) => <button ref={(el) => { chapters.tabs.current[index] = el; }} key={number} id={`journey-tab-${index}`} type="button" role={chapters.cinematic ? "tab" : undefined} aria-selected={chapters.cinematic ? chapters.active === index : undefined} aria-controls={`journey-panel-${index}`} tabIndex={!chapters.cinematic || chapters.active === index ? 0 : -1} className={chapters.active === index ? "is-active" : ""} onClick={() => chapters.choose(index)} onKeyDown={(event) => chapters.onKeyDown(event, index)}><span>{number}</span><strong>{title}</strong></button>)}
        </div>
      </div>
    </section>
  );
}

function WorkFormats({ onChooseService }) {
  const [open, setOpen] = useState(1);
  const reduce = useReducedMotion();
  return (
    <section id="formats" className="work-formats story-gutter" aria-labelledby="formats-title">
      <div className="formats-heading"><h2 id="formats-title">Ваш масштаб.<br /><span>Наш формат.</span></h2><p>Объём и стоимость фиксируем до начала работы.</p></div>
      <div className="format-list">{PLANS.map((plan, index) => <article key={plan.name} className={`format-line${open === index ? " is-open" : ""}`}>
        <button type="button" className="format-line__trigger" aria-expanded={open === index} aria-controls={`format-details-${index}`} onClick={() => setOpen(open === index ? -1 : index)}><span className="format-line__number">0{index + 1}</span><h3>{plan.name}</h3><span className="format-line__caption">{plan.caption}</span><span className="format-line__price">{plan.price}</span><LineArrow /></button>
        <AnimatePresence initial={false}>{open === index && <motion.div id={`format-details-${index}`} className="format-line__details" initial={{ height: 0, opacity: .4 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduce ? 0 : .55, ease: EASE }}><div><ul>{plan.items.map((item) => <li key={item}>{item}</li>)}</ul><button className="story-action" type="button" onClick={() => onChooseService(plan.service)}>Обсудить формат <LineArrow /></button></div></motion.div>}</AnimatePresence>
      </article>)}</div>
    </section>
  );
}

function TeamEditorial() {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const drift = useTransform(scrollYProgress, [0, 1], [80, -60]);
  return <section id="team" className="team-editorial story-gutter" ref={ref} aria-labelledby="team-editorial-title">
    <div className="story-label"><span>Команда</span><i /></div>
    <h2 id="team-editorial-title">Решения<br />принимают люди.</h2>
    <div className="team-editorial__profiles">{TEAM.map((member, index) => <motion.article key={member.number} className="team-editorial__profile" style={!reduce && index === 1 ? { y: drift } : undefined}>
      <h3>{member.title}</h3><div className="team-editorial__experience"><strong aria-hidden="true">{index ? "05" : "07"}</strong><span>{member.experience}<br />практики</span></div><p className="team-editorial__role">{member.role}</p><p>{member.text}</p><p className="team-editorial__focus">{member.focus}</p><span className="team-editorial__education">{member.education} образование · {member.location}</span>
    </motion.article>)}</div>
  </section>;
}

export default function HomepageStory({ onChooseService, onStartPrecheck }) {
  return <><Manifesto /><PracticeAtlas onChooseService={onChooseService} onStartPrecheck={onStartPrecheck} /><ProcessJourney /><WorkFormats onChooseService={onChooseService} /><TeamEditorial /></>;
}
