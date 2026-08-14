"use client";
import {useEffect,useState}from"react";
import Lenis from"lenis";
import{motion,useMotionValue,useSpring}from"framer-motion";

const CSS=`
html.lenis,html.lenis body{height:auto}
.lenis.lenis-smooth{scroll-behavior:auto!important}
@media(pointer:fine){html.cc,html.cc *{cursor:none}}
.cursor-dot,.cursor-ring{position:fixed;left:0;top:0;pointer-events:none;z-index:300;border-radius:50%;display:none;will-change:transform}
@media(pointer:fine){.cursor-dot,.cursor-ring{display:block}}
.cursor-dot{width:6px;height:6px;background:#121212;margin:-3px 0 0 -3px}
.cursor-ring{width:38px;height:38px;border:1px solid rgba(18,18,18,.4);margin:-19px 0 0 -19px;transition:background .3s,border-color .3s}
.cursor-ring.on{background:rgba(127,168,186,.16);border-color:#7fa8ba}
`;

function Cursor(){
  const[on,setOn]=useState(false);
  const[hover,setHover]=useState(false);
  const mx=useMotionValue(-100),my=useMotionValue(-100);
  const dx=useSpring(mx,{stiffness:900,damping:60});
  const dy=useSpring(my,{stiffness:900,damping:60});
  const rx=useSpring(mx,{stiffness:140,damping:20});
  const ry=useSpring(my,{stiffness:140,damping:20});
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
    <motion.div className="cursor-dot" style={{x:dx,y:dy}}/>
    <motion.div className={"cursor-ring"+(hover?" on":"")} style={{x:rx,y:ry}} animate={{scale:hover?1.5:1}}/>
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
