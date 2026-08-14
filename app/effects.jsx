"use client";
import {useEffect,useState}from"react";
import Lenis from"lenis";
import{motion,useMotionValue}from"framer-motion";

const CSS=`
html.lenis,html.lenis body{height:auto}
.lenis.lenis-smooth{scroll-behavior:auto!important}
@media(pointer:fine){html.cc,html.cc *{cursor:none}}
.cursor-dot,.cursor-ring{position:fixed;left:0;top:0;pointer-events:none;z-index:300;border-radius:50%;display:none;will-change:transform}
@media(pointer:fine){.cursor-dot,.cursor-ring{display:block}}
.cursor-dot{width:6px;height:6px;background:#121212;margin:-3px 0 0 -3px}
.cursor-ring{width:38px;height:38px;border:1px solid rgba(18,18,18,.4);margin:-19px 0 0 -19px;transition:background .3s,border-color .3s}
.cursor-ring.on{background:rgba(127,168,186,.16);border-color:#7fa8ba}
/* ---- премиальная шапка ---- */
#hd .hwrap{height:80px}
#hd .hphone{white-space:nowrap;font-size:13px;letter-spacing:.02em}
#hd .nav{gap:38px}
#hd .nav a{font:600 10.5px 'Manrope';letter-spacing:.26em}
#hd .nav a::after{width:100%;bottom:-7px;transform:scaleX(0);transform-origin:center;transition:transform .5s cubic-bezier(.22,.61,.21,1)}
#hd .nav a:hover::after{transform:scaleX(1)}
#hd .nav a + a::before{content:"";position:absolute;left:-21px;top:50%;width:3px;height:3px;margin-top:-1px;border-radius:50%;background:var(--ice);opacity:.75}
#hd .btn-sm{padding:15px 30px;font:700 10px 'Manrope';letter-spacing:.24em;box-shadow:inset 0 0 0 1px rgba(246,244,239,.28)}
#hd .btn-sm:hover{box-shadow:inset 0 0 0 1px rgba(18,18,18,.15),0 16px 34px rgba(18,18,18,.16)}
@media(max-width:1100px){#hd .nav a + a::before{display:none}}
`;

function Cursor(){
  const[on,setOn]=useState(false);
  const[hover,setHover]=useState(false);
  const mx=useMotionValue(-100),my=useMotionValue(-100);
  useEffect(()=>{
    const fine=matchMedia("(pointer:fine)").matches;
    const rm=matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(!fine||rm)return;
    setOn(true);
    document.documentElement.classList.add("cc");
    const mv=e=>{mx.set(e.clientX);my.set(e.clientY)};
    const ov=e=>{setHover(!!e.target.closest("a,button,input,select,textarea,label"))};
    addEventListener("mousemove",mv);addEventListener("mouseover",ov);
    return()=>{removeEventListener("mousemove",mv);removeEventListener("mouseover",ov);document.documentElement.classList.remove("cc")};
  },[]);
  if(!on)return null;
  return<>
    <motion.div className="cursor-dot" style={{x:mx,y:my}}/>
    <motion.div className={"cursor-ring"+(hover?" on":"")} style={{x:mx,y:my}} animate={{scale:hover?1.4:1}} transition={{duration:.25}}/>
  </>;
}

export default function Effects(){
  useEffect(()=>{
    if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    const lenis=new Lenis({duration:1.15,easing:t=>Math.min(1,1.001-Math.pow(2,-10*t)),smoothWheel:true});
    let raf;
    const loop=t=>{lenis.raf(t);raf=requestAnimationFrame(loop)};
    raf=requestAnimationFrame(loop);
    const onClick=e=>{
      const a=e.target.closest('a[href^="#"]');
      if(!a)return;
      const id=a.getAttribute("href");
      if(id.length>1){const el=document.querySelector(id);if(el){e.preventDefault();lenis.scrollTo(el,{offset:-80});}}
    };
    document.addEventListener("click",onClick);
    let pr;
    const para=()=>{pr=requestAnimationFrame(()=>{
      const vh=innerHeight;
      document.querySelectorAll("h2").forEach(h=>{
        const r=h.getBoundingClientRect();
        const c=(r.top+r.height/2-vh/2)/vh;
        h.style.transform=`translateY(${c*-16}px)`;
      });
    })};
    addEventListener("scroll",para,{passive:true});
    para();
    return()=>{cancelAnimationFrame(raf);cancelAnimationFrame(pr);removeEventListener("click",onClick);removeEventListener("scroll",para);lenis.destroy();};
  },[]);
  return<><style>{CSS}</style><Cursor/></>;
}
