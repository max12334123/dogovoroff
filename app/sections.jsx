"use client";
import React,{useState}from"react";
import{motion,AnimatePresence}from"framer-motion";
import{Reveal,Counter,Magnetic,useAnimatedNumber,fmt,CONFIG,CLIENTS,SERVICES,NUMS,PLANS,TEAM,STEPS,FAQ,MARQUEE}from"./ui";

export function OutlineMarquee(){
  return(
    <div className="outline-mq" aria-hidden="true">
      <div className="otrack">
        {[0,1].map(g=>(<div className="otext" key={g}>СИБИРЬ<i>❄</i><b>ХАРАКТЕР</b><i>❄</i>ТОЧНОСТЬ<i>❄</i>НАДЁЖНОСТЬ<i>❄</i></div>))}
      </div>
    </div>
  );
}
export function Clients(){
  return(
    <section className="sec" id="clients">
      <div className="wrap">
        <Reveal className="shead">
          <div><span className="k">01 · Клиенты</span><h2>Кому мы помогаем</h2></div>
          <p>Мы работаем с теми, кому правовая ошибка стоит денег: от поставщика в тендере до управляющей компании.</p>
        </Reveal>
        <div className="cgrid">
          {CLIENTS.map((c,i)=>(<Reveal key={c.t} delay={i*.08} className="ccard"><h3>{c.t}</h3><p>{c.d}</p><ul>{c.l.map(x=><li key={x}>{x}</li>)}</ul></Reveal>))}
        </div>
      </div>
    </section>
  );
}
export function Marquee(){
  return(
    <div className="marquee" aria-hidden="true">
      <div className="mtrack">
        {[0,1].map(g=>(<div className="mgroup" key={g}>{MARQUEE.map(m=>(<React.Fragment key={m+g}><span>{m}</span><i>❄</i></React.Fragment>))}</div>))}
      </div>
    </div>
  );
}
export function Services({onPick}){
  return(
    <section className="sec" id="services">
      <div className="wrap">
        <Reveal className="shead">
          <div><span className="k">02 · Услуги</span><h2>Практики компании</h2></div>
          <p>Шесть направлений, в которых мы работаем глубоко и ежедневно. Цена фиксируется в договоре до начала работы.</p>
        </Reveal>
        <div className="sgrid">
          {SERVICES.map((s,i)=>(
            <Reveal key={s.n} delay={(i%3)*.08} className="scard">
              <div className="snum">/ {s.n}</div><h3>{s.t}</h3><p>{s.d}</p>
              <ul>{s.l.map(x=><li key={x}>{x}</li>)}</ul>
              <div className="sfoot"><span className="price">{s.p}</span><button className="slink" onClick={()=>onPick(s.svc)}>Оставить заявку →</button></div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
export function Nums(){
  return(
    <section className="sec" id="numbers">
      <div className="wrap">
        <Reveal className="shead">
          <div><span className="k">03 · Инфографика</span><h2>Компания в цифрах</h2></div>
          <p>Никаких «много лет опыта» — только факты, которые можно проверить.</p>
        </Reveal>
        <div className="nums">
          {NUMS.map((n,i)=>(<Reveal key={n.txt} delay={(i%3)*.08} className="num-card"><div className="big"><Counter to={n.to} suf={n.suf}/></div><small>{n.txt}</small></Reveal>))}
        </div>
      </div>
    </section>
  );
}
export function Calc({onPick}){
  const[calcIdx,setCalcIdx]=useState(0);
  const calcSvc=SERVICES[calcIdx];
  const animPrice=useAnimatedNumber(calcSvc.base);
  return(
    <section className="sec" id="calc">
      <div className="wrap">
        <Reveal className="shead">
          <div><span className="k">04 · Калькулятор</span><h2>Рассчитайте стоимость</h2></div>
          <p>Выберите направление — покажем ориентировочную цену. Точную смету зафиксируем в договоре.</p>
        </Reveal>
        <Reveal className="calc">
          <div className="calc-left">
            <h3>Направление</h3>
            <p className="chint">Нажмите на услугу — справа появится расчёт.</p>
            <div className="chips">
              {SERVICES.map((s,i)=>(<button key={s.n} className={"chip"+(calcIdx===i?" on":"")} onClick={()=>setCalcIdx(i)}>{s.t}</button>))}
            </div>
          </div>
          <div className="calc-right">
            <span className="cl">Ориентировочная стоимость</span>
            <div className="cprice">от {fmt(animPrice)} ₽<small>{calcSvc.per?" "+calcSvc.per:""}</small></div>
            <p className="cnote">Расчёт предварительный. Точную сумму зафиксируем в договоре — и она не изменится.</p>
            <ul className="cinc">{calcSvc.l.slice(0,3).map(x=><li key={x}>{x}</li>)}</ul>
            <Magnetic className="btn" onClick={()=>onPick(calcSvc.svc)}><span className="btxt">Получить точный расчёт</span><span className="arr">→</span></Magnetic>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
export function Pricing({onPick}){
  return(
    <section className="sec" id="pricing">
      <div className="wrap">
        <Reveal className="shead">
          <div><span className="k">05 · Тарифы</span><h2>Форматы работы</h2></div>
          <p>От разовой помощи до полноценного юридического отдела на аутсорсе. Стоимость фиксируется в договоре.</p>
        </Reveal>
        <div className="pgrid">
          {PLANS.map((p,i)=>(
            <Reveal key={p.name} delay={i*.1} x={i===0?-30:i===2?30:0} scale={i===1?.95:1} className={"pcard"+(p.hot?" hot":"")}>
              {p.hot&&<div className="ptag">Популярный выбор</div>}
              <div className="pname">{p.name}</div>
              <p className="pdesc">{p.desc}</p>
              <div className="psum">{p.sum}<small>{p.small}</small></div>
              <ul>{p.l.map(x=><li key={x}>{x}</li>)}</ul>
              <Magnetic className={"btn "+(p.hot?"btn-g":"")} onClick={()=>onPick(p.svc)}><span className="btxt">Выбрать формат</span>{p.hot&&<span className="arr">→</span>}</Magnetic>
            </Reveal>
          ))}
        </div>
        <Reveal delay={.2}><p className="pnote">Нужен индивидуальный формат? Соберём пакет под вашу задачу — <a href="#request">опишите её в заявке</a>, и мы предложим условия.</p></Reveal>
      </div>
    </section>
  );
}
export function Team(){
  return(
    <section className="sec" id="team">
      <div className="wrap">
        <Reveal className="shead">
          <div><span className="k">06 · Команда</span><h2>Кто ведёт ваши дела</h2></div>
          <p>Без конвейера: вашу задачу ведут основатели компании лично. Каждый документ проходит через нас.</p>
        </Reveal>
        <div className="tgrid">
          {TEAM.map((t,i)=>(
            <Reveal key={t.n} delay={i*.12} x={i===0?-30:30} className="tcard">
              <div className="tmono">{t.n}</div>
              <div className="trole">{t.role}</div>
              <h3>{t.t}</h3><p>{t.d}</p>
              <ul>{t.l.map(x=><li key={x}>{x}</li>)}</ul>
              <div className="tfacts">{t.f.map(x=><span key={x}>{x}</span>)}</div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={.15} className="prins">
          <div className="prin"><div className="pn2">/ 01</div><h4>Личное ведение</h4><p>Ваше дело ведут основатели компании, а не стажёры. Ответственность — конкретная, а не «отдел».</p></div>
          <div className="prin"><div className="pn2">/ 02</div><h4>Фиксированная цена</h4><p>Стоимость закрепляется в договоре и не меняется в процессе. Никаких внезапных «допов».</p></div>
          <div className="prin"><div className="pn2">/ 03</div><h4>Честный прогноз</h4><p>Если у дела нет перспектив — скажем об этом на первой консультации и не возьмём деньги за борьбу ради борьбы.</p></div>
        </Reveal>
      </div>
    </section>
  );
}
export function Process(){
  return(
    <section className="sec" id="process">
      <div className="wrap">
        <Reveal className="shead">
          <div><span className="k">07 · Процесс</span><h2>Как мы работаем</h2></div>
          <p>Прозрачный маршрут от первого обращения до результата. Вы всегда знаете, что происходит с вашим делом.</p>
        </Reveal>
        <div className="steps">
          {STEPS.map((s,i)=>(
            <Reveal key={s.n} delay={i*.1} className="pstep">
              <motion.span className="pline" initial={{scaleX:0}} whileInView={{scaleX:1}} viewport={{once:true}} transition={{duration:1,ease:[.22,.61,.21,1],delay:i*.12+.2}}/>
              <motion.span className="pdot" initial={{scale:0}} whileInView={{scale:1}} viewport={{once:true}} transition={{type:"spring",stiffness:260,damping:18,delay:i*.12+.3}}/>
              <div className="pn">{s.n}</div><h3>{s.t}</h3><p>{s.d}</p><div className="psub">{s.s}</div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={.2} className="gbar">
          <b>Договор · Фиксированная цена · Отчёты на каждом этапе</b>
          <span>Мы отвечаем за процесс и результат, а не за «количество часов». Если формат работы не подошёл — расторгаем договор и возвращаем оплату за невыполненные этапы.</span>
        </Reveal>
      </div>
    </section>
  );
}
export function Faq(){
  const[openFaq,setOpenFaq]=useState(null);
  return(
    <section className="sec" id="faq">
      <div className="wrap">
        <Reveal className="shead" style={{justifyContent:"center",textAlign:"center"}}>
          <div style={{margin:"0 auto"}}><span className="k" style={{justifyContent:"center"}}>08 · Вопросы</span><h2>Частые вопросы</h2></div>
        </Reveal>
        <Reveal className="faqwrap">
          {FAQ.map(([q,a],i)=>(
            <div className={"qa"+(openFaq===i?" open":"")} key={i}>
              <button className="qa-q" aria-expanded={openFaq===i} onClick={()=>setOpenFaq(openFaq===i?null:i)}>
                <span>{q}</span><span className="qa-i"></span>
              </button>
              <AnimatePresence initial={false}>
                {openFaq===i&&(
                  <motion.div className="qa-a" key="a" initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} transition={{duration:.5,ease:[.22,.61,.21,1]}} style={{overflow:"hidden"}}>
                    <p>{a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
export function Footer({onPol}){
  return(
    <footer>
      <div className="wrap">
        <div className="fgrid">
          <div>
            <a className="brand fbrand" href="#top">
              <svg className="lmark" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" aria-hidden="true"><path d="M16 34 L19 11 H31 V34"/><path d="M9 38 H39"/><path d="M9 38 L6.5 44 M39 38 L41.5 44"/><path d="M25 17 l2.1 4.9 4.9 2.1 -4.9 2.1 -2.1 4.9 -2.1 -4.9 -4.9 -2.1 4.9 -2.1 z" fill="currentColor" stroke="none"/></svg>
              <span className="bname">{CONFIG.brand}<span className="bsub">юридическая компания</span></span>
            </a>
            <p className="fabout">Юридическая компания «ДоговорОфф» для бизнеса и частных лиц: тендеры, арбитраж, аутсорсинг, ЖКХ. Сибирский характер: спокойно, точно, надёжно.</p>
          </div>
          <div>
            <h4>Навигация</h4>
            <a href="#clients">Клиенты</a><a href="#services">Услуги</a><a href="#calc">Калькулятор</a><a href="#pricing">Тарифы</a><a href="#team">Команда</a><a href="#process">Процесс</a><a href="#faq">Вопросы</a>
          </div>
          <div>
            <h4>Практики</h4>
            <a href="#services">Тендеры и закупки</a><a href="#services">ФАС</a><a href="#services">Аутсорсинг</a><a href="#services">ЖКХ</a><a href="#services">Арбитраж</a><a href="#services">Договоры</a>
          </div>
          <div>
            <h4>Контакты</h4>
            <a href={CONFIG.phoneHref}>{CONFIG.phone}</a>
            <a href={"mailto:"+CONFIG.email}>{CONFIG.email}</a>
            <a href="#request">{CONFIG.address}</a>
            <a href="#request">{CONFIG.hours}</a>
          </div>
        </div>
        <div className="fbottom">
          <span>© {new Date().getFullYear()} Юридическая компания «{CONFIG.brand}» · {CONFIG.geo}. Не является публичной офертой.</span>
          <a onClick={onPol}>Политика конфиденциальности</a>
        </div>
      </div>
    </footer>
  );
}
