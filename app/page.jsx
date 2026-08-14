"use client";
import React,{useState,useEffect,useRef}from"react";
import Lenis from"lenis";
import{motion,AnimatePresence,useScroll,useSpring,useTransform,useMotionValue,useMotionValueEvent,useInView,animate}from"framer-motion";
const CONFIG={brand:"ДоговорОфф",phone:"+7 (3466) 000-00-00",phoneHref:"tel:+73466000000",email:"dogovor.off@mail.ru",web3formsKey:"109ee3ca-96c1-4a49-8dd9-9c3611d26b16",telegram:"https://t.me/dogovor_off",max:"https://max.ru/",address:"г. Нижневартовск, ул. Ленина, 6, офис 402",hours:"Пн–Пт 09:00–19:00 · заявки — 24/7",geo:"61°32′ N — 76°58′ E"};
const EASE=[.22,.61,.21,1];
const CSS=
@import url('https://cdn.jsdelivr.net/npm/@fontsource/cormorant-garamond@latest/500.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/cormorant-garamond@latest/600.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/cormorant-garamond@latest/400-italic.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/tenor-sans@latest/index.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/manrope@latest/index.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/manrope@latest/500.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/manrope@latest/600.css');
:root{--bg:#0a0a0a;--bg2:#0e0e0e;--card:#131313;--white:#f4f2ee;--gray:#97979a;--line:rgba(244,242,238,.14);--ice:#8fb6c6;--shadow:0 30px 80px rgba(0,0,0,.5)}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-padding-top:96px}
html.lenis,html.lenis body{height:auto}.lenis.lenis-smooth{scroll-behavior:auto!important}
body{background:radial-gradient(1100px 700px at 85% -10%,rgba(244,242,238,.05),transparent 60%),var(--bg);color:var(--white);font:400 16px/1.7 'Manrope',system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
::selection{background:var(--white);color:var(--bg)}
img{display:block}a{color:inherit}button{font-family:inherit}
:focus-visible{outline:1px solid var(--white);outline-offset:4px}
.wrap{width:min(1240px,92%);margin:0 auto}
@media(pointer:fine){html.cc,html.cc *{cursor:none}}
.cursor-dot,.cursor-ring{position:fixed;left:0;top:0;pointer-events:none;z-index:300;border-radius:50%;mix-blend-mode:difference;display:none;will-change:transform}
@media(pointer:fine){.cursor-dot,.cursor-ring{display:block}}
.cursor-dot{width:5px;height:5px;background:#fff;margin:-2.5px 0 0 -2.5px}
.cursor-ring{width:36px;height:36px;border:1px solid #fff;margin:-18px 0 0 -18px}
.cursor-ring.on{background:rgba(255,255,255,.12)}
.k{display:inline-flex;align-items:center;gap:14px;font:400 10px 'Tenor Sans';letter-spacing:.42em;text-transform:uppercase;color:var(--gray)}
.k::before{content:"";width:40px;height:1px;background:var(--ice)}
h1,h2,h3{font-family:'Cormorant Garamond',serif;font-weight:500;line-height:1.02;color:var(--white)}
h1{font-size:clamp(52px,8.6vw,128px);letter-spacing:-.015em}
h1 em{font-style:italic;color:var(--ice)}
h2{font-size:clamp(34px,4.6vw,64px)}
.lead{color:var(--gray);font-size:clamp(15px,1.3vw,17px);line-height:1.8;max-width:560px}
.sec{padding:130px 0}
.shead{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;margin-bottom:70px;flex-wrap:wrap}
.shead h2{margin-top:18px}
.shead p{color:var(--gray);max-width:460px;font-size:14px;line-height:1.8}
.idx{font-family:'Cormorant Garamond';font-style:italic;color:var(--ice);font-size:14px;letter-spacing:.2em}
.progress{position:fixed;top:0;left:0;right:0;height:1px;background:var(--white);transform-origin:left center;z-index:70;opacity:.7}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:12px;font:400 11px 'Tenor Sans';letter-spacing:.3em;text-transform:uppercase;padding:20px 36px;border:1px solid rgba(244,242,238,.4);cursor:pointer;text-decoration:none;position:relative;overflow:hidden;background:transparent;color:var(--white);transition:color .55s cubic-bezier(.77,0,.18,1),border-color .4s,box-shadow .6s;isolation:isolate;-webkit-tap-highlight-color:transparent;white-space:nowrap}
.btn::before{content:"";position:absolute;inset:0;background:var(--white);transform:scaleX(0);transform-origin:left center;transition:transform .65s cubic-bezier(.77,0,.18,1);z-index:-1}
.btn:hover{color:var(--bg);border-color:var(--white);box-shadow:0 24px 60px rgba(0,0,0,.45)}
.btn:hover::before{transform:scaleX(1)}
.btn-g{background:var(--white);color:var(--bg);border-color:var(--white)}
.btn-g::before{background:var(--bg)}
.btn-g:hover{color:var(--white)}
.btn-sm{padding:14px 26px;font-size:10px}
.btn .arr{transition:transform .5s cubic-bezier(.22,.61,.21,1);display:inline-block}
.btn:hover .arr{transform:translateX(8px)}
#hd{position:fixed;top:0;left:0;right:0;z-index:50;transition:background .5s,border-color .5s;border-bottom:1px solid transparent}
#hd.scrolled{background:rgba(10,10,10,.86);backdrop-filter:blur(18px);border-color:var(--line)}
.hwrap{width:min(1360px,94%);margin:0 auto;height:88px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand{display:flex;align-items:center;gap:16px;text-decoration:none;min-width:0}
.lmark{width:40px;height:40px;color:var(--white);flex:0 0 auto;transition:transform .6s cubic-bezier(.22,.61,.21,1)}
.brand:hover .lmark{transform:rotate(90deg)}
.bname{font-family:'Cormorant Garamond';font-weight:600;font-size:22px;letter-spacing:.03em;line-height:1;display:flex;flex-direction:column;gap:5px}
.bsub{font:400 8.5px 'Tenor Sans';letter-spacing:.4em;text-transform:uppercase;color:var(--gray)}
.nav{display:flex;gap:34px}
.nav a{font:400 10px 'Tenor Sans';letter-spacing:.32em;text-transform:uppercase;color:var(--gray);text-decoration:none;position:relative;transition:color .35s;padding:6px 0}
.nav a::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--white);transform:scaleX(0);transform-origin:center;transition:transform .5s cubic-bezier(.22,.61,.21,1)}
.nav a:hover{color:var(--white)}
.nav a:hover::after{transform:scaleX(1)}
.hright{display:flex;align-items:center;gap:18px;flex:0 0 auto}
.hphone{font:400 12px 'Tenor Sans';letter-spacing:.08em;text-decoration:none;white-space:nowrap;transition:opacity .3s}
.hphone:hover{opacity:.6}
.burger{display:none;width:46px;height:46px;background:none;border:1px solid var(--line);cursor:pointer;position:relative;flex:0 0 auto;transition:border-color .4s}
.burger:hover{border-color:var(--white)}
.burger span{position:absolute;left:13px;right:13px;height:1px;background:var(--white);transition:.4s cubic-bezier(.22,.61,.21,1)}
.burger span:nth-child(1){top:17px}.burger span:nth-child(2){top:27px}
.burger.open span:nth-child(1){top:22px;transform:rotate(45deg)}
.burger.open span:nth-child(2){top:22px;transform:rotate(-45deg)}
.mnav{position:fixed;inset:0;background:rgba(10,10,10,.98);z-index:49;display:flex;flex-direction:column;justify-content:center;padding:90px 8% 50px;gap:4px;overflow-y:auto}
.mnav a{font-family:'Cormorant Garamond';font-size:34px;text-decoration:none;padding:10px 0;border-bottom:1px solid var(--line);transition:padding-left .4s,color .4s}
.mnav a:hover{color:var(--ice);padding-left:12px}
.mnav .mphone{font:400 14px 'Tenor Sans';border:none;margin-top:16px;letter-spacing:.1em}
.hero{padding:190px 0 120px;position:relative;overflow:hidden}
.aurora{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.aurora span{position:absolute;border-radius:50%;filter:blur(90px);opacity:.5}
.a1{width:640px;height:640px;left:-200px;top:-220px;background:radial-gradient(circle at 30% 30%,rgba(143,182,198,.14),transparent 70%)}
.a2{width:720px;height:720px;right:-260px;top:-160px;background:radial-gradient(circle at 60% 40%,rgba(244,242,238,.07),transparent 70%)}
.contours{position:absolute;left:0;right:0;bottom:-8px;opacity:.6;pointer-events:none}
.hgrid{display:grid;grid-template-columns:1.2fr .8fr;gap:80px;align-items:center;position:relative;z-index:1}
.hleft h1{margin:34px 0 30px}
.hcta{display:flex;gap:18px;margin-top:46px;flex-wrap:wrap}
.hstats{display:flex;gap:52px;margin-top:70px;flex-wrap:wrap}
.hstats div{border-left:1px solid var(--line);padding-left:22px}
.hstats b{display:block;font-family:'Cormorant Garamond';font-weight:500;font-size:36px;line-height:1}
.hstats span{font:400 9.5px 'Tenor Sans';letter-spacing:.3em;text-transform:uppercase;color:var(--gray)}
.geo{margin-top:40px;font:400 10px 'Tenor Sans';letter-spacing:.4em;text-transform:uppercase;color:var(--gray);display:flex;align-items:center;gap:14px}
.geo i{font-style:normal;color:var(--ice)}
.hright{position:relative}
.hclip{will-change:transform}
.hframe{position:relative;overflow:hidden}
.hframe img{width:100%;height:min(72vh,640px);object-fit:cover;filter:grayscale(1) contrast(1.1) brightness(.8);animation:kb 2.6s cubic-bezier(.22,.61,.21,1) .9s both}
@keyframes kb{from{transform:scale(1.12)}to{transform:scale(1)}}
.hframe::after{content:"";position:absolute;inset:14px;border:1px solid rgba(244,242,238,.25);pointer-events:none}
.hbadge{position:absolute;left:-20px;bottom:40px;z-index:2;background:var(--bg);border:1px solid var(--line);padding:16px 22px;display:flex;align-items:center;gap:12px;font:400 10px 'Tenor Sans';letter-spacing:.3em;text-transform:uppercase;animation:floaty 6s ease-in-out infinite}
@keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.dot{width:6px;height:6px;border-radius:50%;background:var(--ice);animation:pulse 2.4s infinite}
@keyframes pulse{70%{box-shadow:0 0 0 10px transparent}100%{box-shadow:0 0 0 0 transparent}}
.shint{position:absolute;bottom:26px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:10px;color:var(--gray);font:400 9px 'Tenor Sans';letter-spacing:.5em;text-transform:uppercase;z-index:1}
.shint svg{animation:bob 1.8s ease-in-out infinite}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(8px)}}
.ln{display:block;overflow:hidden;padding-bottom:.1em;margin-bottom:-.1em}
.ln-i{display:inline-block;will-change:transform}
.outline-mq{padding:34px 0;overflow:hidden;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.otrack{display:flex;width:max-content;animation:mq 50s linear infinite}
.otext{font-family:'Cormorant Garamond';font-weight:500;font-size:clamp(64px,10vw,150px);line-height:1;color:transparent;-webkit-text-stroke:1px rgba(244,242,238,.22);white-space:nowrap;padding-right:80px}
.otext b{color:var(--white);-webkit-text-stroke:0}
.otext i{font-style:normal;color:var(--ice);-webkit-text-stroke:0;font-size:.5em;vertical-align:middle;padding:0 14px}
.marquee{border-bottom:1px solid var(--line);overflow:hidden;padding:22px 0;background:var(--bg2)}
.mtrack{display:flex;width:max-content;animation:mq 40s linear infinite}
.mgroup{display:flex;align-items:center;gap:56px;padding-right:56px}
.mgroup span{font:400 13px 'Tenor Sans';letter-spacing:.3em;text-transform:uppercase;color:var(--gray);white-space:nowrap}
.mgroup i{color:var(--ice);font-style:normal;font-size:12px}
@keyframes mq{to{transform:translateX(-50%)}}
.cgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line)}
.ccard{background:var(--bg);padding:44px 34px;transition:background .6s;position:relative;overflow:hidden}
.ccard::after{content:"";position:absolute;top:0;left:0;height:1px;width:0;background:var(--ice);transition:width .7s cubic-bezier(.22,.61,.21,1)}
.ccard:hover{background:var(--card)}
.ccard:hover::after{width:100%}
.ccard h3{font-size:26px;margin-bottom:12px}
.ccard p{color:var(--gray);font-size:13.5px;line-height:1.75;margin-bottom:18px}
.ccard ul{list-style:none}
.ccard ul li{position:relative;padding-left:18px;margin:8px 0;font-size:13px;color:#c9c7c2}
.ccard ul li::before{content:"";position:absolute;left:0;top:10px;width:7px;height:1px;background:var(--ice)}
.sgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line)}
.scard{background:var(--bg);padding:48px 38px;display:flex;flex-direction:column;transition:background .6s;position:relative;overflow:hidden}
.scard::after{content:"";position:absolute;top:0;left:0;height:1px;width:0;background:var(--ice);transition:width .7s cubic-bezier(.22,.61,.21,1)}
.scard:hover{background:var(--card)}
.scard:hover::after{width:100%}
.snum{font-family:'Cormorant Garamond';font-style:italic;font-size:16px;color:var(--ice);margin-bottom:26px;letter-spacing:.15em}
.scard h3{font-size:30px;margin-bottom:14px}
.scard>p{color:var(--gray);font-size:14px;line-height:1.75;margin-bottom:20px}
.scard ul{list-style:none;margin-bottom:30px}
.scard ul li{position:relative;padding-left:18px;margin:8px 0;font-size:13.5px;color:#c9c7c2}
.scard ul li::before{content:"";position:absolute;left:0;top:10px;width:7px;height:1px;background:var(--ice)}
.sfoot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding-top:22px}
.price{font:400 15px 'Tenor Sans';letter-spacing:.06em}
.slink{background:none;border:none;cursor:pointer;font:400 10px 'Tenor Sans';letter-spacing:.3em;text-transform:uppercase;color:var(--white);padding:0;position:relative;transition:color .3s,letter-spacing .4s}
.slink::after{content:"";position:absolute;left:0;bottom:-6px;width:100%;height:1px;background:var(--ice);transform:scaleX(0);transform-origin:right;transition:transform .5s cubic-bezier(.22,.61,.21,1)}
.slink:hover{color:var(--ice);letter-spacing:.36em}
.slink:hover::after{transform:scaleX(1);transform-origin:left}
.nums{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line)}
.num-card{background:var(--bg);padding:48px 38px;transition:background .6s;position:relative;overflow:hidden}
.num-card:hover{background:var(--card)}
.num-card .big{font-family:'Cormorant Garamond';font-weight:500;font-size:clamp(56px,6vw,88px);line-height:1}
.num-card .big i{font-style:italic;font-size:.4em;color:var(--ice)}
.num-card small{display:block;margin-top:14px;font:400 10px 'Tenor Sans';letter-spacing:.28em;text-transform:uppercase;color:var(--gray);line-height:1.8}
.num-card::after{content:"❄";position:absolute;right:22px;top:20px;color:var(--ice);opacity:.5;font-size:13px}
.calc{display:grid;grid-template-columns:1.1fr .9fr;gap:1px;background:var(--line);border:1px solid var(--line)}
.calc-left{background:var(--bg);padding:48px 44px}
.calc-left h3{font-size:28px;margin-bottom:10px}
.chint{color:var(--gray);font-size:13px;margin-bottom:28px}
.chips{display:flex;flex-wrap:wrap;gap:12px}
.chip{border:1px solid var(--line);background:none;padding:14px 20px;font:400 10px 'Tenor Sans';letter-spacing:.24em;text-transform:uppercase;cursor:pointer;transition:all .45s cubic-bezier(.22,.61,.21,1);color:var(--gray)}
.chip:hover{border-color:var(--white);color:var(--white);transform:translateY(-2px)}
.chip.on{background:var(--white);color:var(--bg);border-color:var(--white)}
.calc-right{background:var(--card);padding:48px 44px;display:flex;flex-direction:column;position:relative;overflow:hidden}
.calc-right::after{content:"❄";position:absolute;right:28px;top:24px;color:var(--ice);opacity:.6;font-size:15px}
.calc-right .cl{font:400 10px 'Tenor Sans';letter-spacing:.4em;text-transform:uppercase;color:var(--gray)}
.cprice{font-family:'Cormorant Garamond';font-weight:500;font-size:clamp(52px,5vw,76px);line-height:1;margin:24px 0 6px}
.cprice small{font:400 13px 'Tenor Sans';color:var(--gray);letter-spacing:.1em}
.cnote{font-size:12px;color:var(--gray);margin-bottom:26px;line-height:1.7}
.cinc{list-style:none;margin-bottom:32px}
.cinc li{position:relative;padding-left:20px;margin:9px 0;font-size:13px;color:#c9c7c2}
.cinc li::before{content:"";position:absolute;left:0;top:9px;width:8px;height:1px;background:var(--ice)}
.calc-right .btn{margin-top:auto}
.pgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;align-items:stretch}
.pcard{border:1px solid var(--line);background:var(--bg);padding:52px 42px;display:flex;flex-direction:column;position:relative;transition:transform .6s cubic-bezier(.22,.61,.21,1),border-color .5s,box-shadow .6s}
.pcard:hover{transform:translateY(-10px);border-color:rgba(244,242,238,.5);box-shadow:var(--shadow)}
.pcard.hot{border-color:var(--white);background:linear-gradient(180deg,rgba(244,242,238,.05),var(--bg) 60%)}
.ptag{position:absolute;top:-12px;left:42px;background:var(--white);color:var(--bg);font:400 9px 'Tenor Sans';letter-spacing:.3em;text-transform:uppercase;padding:8px 16px}
.pname{font-family:'Cormorant Garamond';font-weight:600;font-size:32px}
.pdesc{color:var(--gray);font-size:13px;margin:10px 0 26px}
.psum{font-family:'Cormorant Garamond';font-weight:500;font-size:48px;line-height:1}
.psum small{font:400 11px 'Tenor Sans';color:var(--gray);letter-spacing:.1em}
.pcard ul{list-style:none;margin:30px 0 36px;flex:1}
.pcard ul li{position:relative;padding-left:24px;margin:12px 0;font-size:13.5px;color:#c9c7c2}
.pcard ul li::before{content:"✓";position:absolute;left:0;color:var(--ice);font-size:11px}
.pcard .btn{width:100%}
.pnote{margin-top:30px;color:var(--gray);font-size:13px;text-align:center}
.pnote a{color:var(--white);text-decoration:underline;text-underline-offset:5px;transition:color .3s}
.pnote a:hover{color:var(--ice)}
.tgrid{display:grid;grid-template-columns:1fr 1fr;gap:26px}
.tcard{border:1px solid var(--line);background:var(--bg);padding:54px 48px;display:flex;flex-direction:column;transition:border-color .5s,transform .6s cubic-bezier(.22,.61,.21,1),box-shadow .6s}
.tcard:hover{border-color:rgba(244,242,238,.5);transform:translateY(-8px);box-shadow:var(--shadow)}
.tmono{font-family:'Cormorant Garamond';font-style:italic;font-size:64px;color:rgba(244,242,238,.14);line-height:1;margin-bottom:24px}
.trole{font:400 10px 'Tenor Sans';letter-spacing:.36em;text-transform:uppercase;color:var(--ice);margin-bottom:14px}
.tcard h3{font-size:34px;margin-bottom:16px}
.tcard>p{color:var(--gray);font-size:14px;line-height:1.8;margin-bottom:22px}
.tcard ul{list-style:none;margin-bottom:30px}
.tcard ul li{position:relative;padding-left:18px;margin:9px 0;font-size:13.5px;color:#c9c7c2}
.tcard ul li::before{content:"";position:absolute;left:0;top:10px;width:7px;height:1px;background:var(--ice)}
.tfacts{margin-top:auto;border-top:1px solid var(--line);padding-top:20px;display:flex;gap:10px;flex-wrap:wrap}
.tfacts span{font:400 9px 'Tenor Sans';letter-spacing:.24em;text-transform:uppercase;color:var(--gray);border:1px solid var(--line);padding:8px 14px;transition:border-color .4s,color .4s}
.tcard:hover .tfacts span{border-color:var(--ice);color:var(--white)}
.prins{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);margin-top:26px}
.prin{background:var(--bg);padding:38px 32px;transition:background .6s}
.prin:hover{background:var(--card)}
.prin .pn2{font-family:'Cormorant Garamond';font-style:italic;font-size:20px;color:var(--ice);margin-bottom:12px}
.prin h4{font-family:'Cormorant Garamond';font-weight:600;font-size:24px;margin-bottom:10px}
.prin p{color:var(--gray);font-size:13px;line-height:1.75}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:38px;position:relative}
.pstep{border-top:1px solid var(--line);padding-top:40px;position:relative}
.pstep .pline{position:absolute;top:-1px;left:0;height:1px;background:var(--ice);transform-origin:left center;width:100%}
.pstep .pdot{position:absolute;top:-4px;left:-1px;width:7px;height:7px;border-radius:50%;background:var(--ice)}
.pstep .pn{font-family:'Cormorant Garamond';font-style:italic;font-size:52px;line-height:1;margin-bottom:22px;color:var(--white)}
.pstep h3{font-size:26px;margin-bottom:12px}
.pstep p{color:var(--gray);font-size:13.5px;line-height:1.75}
.pstep .psub{margin-top:14px;font:400 9.5px 'Tenor Sans';letter-spacing:.3em;text-transform:uppercase;color:var(--ice)}
.gbar{margin-top:64px;border:1px solid var(--line);background:var(--card);padding:38px 44px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;transition:box-shadow .6s,transform .6s}
.gbar:hover{box-shadow:var(--shadow);transform:translateY(-4px)}
.gbar b{font-family:'Cormorant Garamond';font-weight:600;font-size:28px}
.gbar span{color:var(--gray);font-size:13.5px;max-width:600px}
.faqwrap{max-width:880px;margin:0 auto}
.qa{border-bottom:1px solid var(--line)}
.qa-q{width:100%;display:flex;justify-content:space-between;align-items:center;gap:24px;padding:30px 0;background:none;border:none;color:var(--white);font:500 19px 'Manrope';cursor:pointer;text-align:left;transition:color .3s,padding-left .4s}
.qa-q:hover{color:var(--ice);padding-left:10px}
.qa-i{flex:0 0 14px;width:14px;height:14px;position:relative;transition:transform .5s cubic-bezier(.22,.61,.21,1)}
.qa-q:hover .qa-i{transform:rotate(90deg)}
.qa-i::before,.qa-i::after{content:"";position:absolute;background:var(--ice);transition:transform .4s}
.qa-i::before{left:0;top:6px;width:14px;height:1px}
.qa-i::after{left:6px;top:0;width:1px;height:14px}
.qa.open .qa-i::after{transform:scaleY(0)}
.qa-a p{padding:0 40px 30px 0;color:var(--gray);font-size:14.5px;line-height:1.85}
#request{background:linear-gradient(180deg,transparent,rgba(244,242,238,.03) 30%,transparent)}
.rgrid{display:grid;grid-template-columns:1fr 1fr;gap:90px;align-items:start}
.rleft h2{margin:20px 0 22px}
.rleft>p{color:var(--gray);font-size:15px;line-height:1.85;max-width:500px}
.rlist{list-style:none;margin:36px 0 44px}
.rlist li{position:relative;padding-left:28px;margin:14px 0;font-size:14.5px;color:#d5d3ce}
.rlist li::before{content:"✓";position:absolute;left:0;color:var(--ice)}
.rcontacts{display:flex;flex-direction:column;gap:12px;border-top:1px solid var(--line);padding-top:32px;max-width:440px}
.rcontacts a{text-decoration:none;font:400 16px 'Tenor Sans';letter-spacing:.06em;transition:opacity .3s,letter-spacing .4s;width:fit-content}
.rcontacts a:hover{opacity:.65;letter-spacing:.1em}
.rhours,.raddr{font-size:12.5px;color:var(--gray)}
.rmess{display:flex;gap:14px;margin-top:26px;flex-wrap:wrap}
.maxlogo{display:inline-flex;align-items:center;justify-content:center;font:600 9px 'Manrope';letter-spacing:.08em;border:1px solid currentColor;border-radius:5px;padding:3px 6px}
.fcard{background:var(--card);border:1px solid var(--line);padding:54px 50px;position:relative;box-shadow:var(--shadow)}
.fcard h3{font-size:32px;margin-bottom:8px}
.fsub{color:var(--gray);font-size:12.5px;margin-bottom:34px}
.frow{margin-bottom:30px;position:relative}
.frow label{display:block;font:400 10px 'Tenor Sans';letter-spacing:.34em;text-transform:uppercase;color:var(--gray);margin-bottom:10px}
.frow input,.frow select,.frow textarea{width:100%;background:transparent;border:none;border-bottom:1px solid rgba(244,242,238,.25);color:var(--white);font:400 16px 'Manrope';padding:12px 0;outline:none;transition:border-color .4s;border-radius:0}
.frow select{appearance:none;-webkit-appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23f4f2ee' stroke-width='1.5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 4px center}
.frow select:invalid{color:var(--gray)}
.frow select option{background:#131313;color:var(--white)}
.frow textarea{resize:vertical;min-height:88px;line-height:1.6}
.frow input:focus,.frow select:focus,.frow textarea:focus{border-color:var(--ice)}
.frow input::placeholder,.frow textarea::placeholder{color:#5c5c5e}
.fmsg{position:absolute;left:0;bottom:-18px;font-size:11px;color:#e08a76;opacity:0;transition:.3s}
.frow.bad input,.frow.bad select{border-color:#e08a76}
.frow.bad .fmsg{opacity:1}
.hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}
.agree{display:flex;gap:14px;align-items:flex-start;cursor:pointer;font-size:12px;color:var(--gray);line-height:1.7;margin:8px 0 32px}
.agree input{position:absolute;opacity:0;width:0}
.box{flex:0 0 18px;width:18px;height:18px;border:1px solid rgba(244,242,238,.4);margin-top:1px;position:relative;transition:.3s}
.agree:hover .box{border-color:var(--white)}
.agree input:checked + .box{background:var(--white);border-color:var(--white)}
.box::after{content:"";position:absolute;left:5px;top:2px;width:4px;height:9px;border:solid var(--bg);border-width:0 2px 2px 0;transform:rotate(45deg) scale(0);transition:.25s}
.agree input:checked + .box::after{transform:rotate(45deg) scale(1)}
.agree a{color:var(--white);text-decoration:underline;text-underline-offset:4px;cursor:pointer}
.fsubmit{width:100%}
.fsubmit.loading{pointer-events:none;opacity:.75}
.fsubmit.loading .btxt,.fsubmit.loading .arr{opacity:0}
.fsubmit.loading::after{content:"";position:absolute;width:18px;height:18px;border:2px solid var(--bg);border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.fnote{margin-top:18px;font-size:10.5px;color:#5c5c5e;text-align:center;letter-spacing:.06em}
.fsuccess{text-align:center;padding:34px 10px}
.fsuccess h3{font-size:34px;margin-bottom:12px}
.fsuccess p{color:var(--gray);font-size:14px;max-width:380px;margin:0 auto 30px;line-height:1.8}
.fsuccess .btn{margin:8px auto 0}
footer{border-top:1px solid var(--line);padding:80px 0 0;background:var(--bg2)}
.fgrid{display:grid;grid-template-columns:1.4fr 1fr 1fr 1.2fr;gap:48px;padding-bottom:70px}
.fgrid h4{font:400 10px 'Tenor Sans';letter-spacing:.4em;text-transform:uppercase;color:var(--gray);margin-bottom:24px}
.fgrid a{display:block;color:#b9b7b2;text-decoration:none;font-size:13.5px;margin:11px 0;transition:color .3s,padding-left .4s}
.fgrid a:hover{color:var(--white);padding-left:8px}
.fabout{color:var(--gray);font-size:13.5px;line-height:1.8;max-width:320px;margin-top:18px}
.fbrand .lmark{width:48px;height:48px}
.fbottom{border-top:1px solid var(--line);padding:26px 0;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;font-size:11.5px;color:#6d6d70}
.fbottom a{color:#97979a;text-decoration:none;cursor:pointer;transition:color .3s}
.fbottom a:hover{color:var(--white)}
.totop{position:fixed;right:28px;bottom:28px;width:52px;height:52px;border:1px solid var(--line);background:rgba(10,10,10,.85);backdrop-filter:blur(10px);color:var(--white);cursor:pointer;z-index:55;display:grid;place-items:center;transition:.4s}
.totop:hover{border-color:var(--white);background:var(--white);color:var(--bg);transform:translateY(-4px)}
.mbar{position:fixed;left:0;right:0;bottom:0;z-index:56;display:none;gap:10px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:rgba(10,10,10,.94);backdrop-filter:blur(14px);border-top:1px solid var(--line)}
.mbar a{flex:1;padding:15px 10px}
.mbar .mcall{flex:0 0 54px;padding:15px 0}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;z-index:100}
.mcard{width:min(700px,92%);max-height:82vh;overflow:auto;background:var(--card);border:1px solid var(--line);padding:52px;position:relative;box-shadow:var(--shadow)}
.mcard h3{font-size:32px;margin-bottom:20px}
.mcard p{color:var(--gray);font-size:13.5px;line-height:1.85;margin-bottom:14px}
.mclose{position:absolute;top:20px;right:20px;width:42px;height:42px;background:none;border:1px solid var(--line);color:var(--white);cursor:pointer;font-size:16px;transition:.3s}
.mclose:hover{border-color:var(--white);background:var(--white);color:var(--bg);transform:rotate(90deg)}
@media(max-width:1100px){
.nav{display:none}.burger{display:block}.hphone{display:none}
.hgrid{grid-template-columns:1fr;gap:70px}
.hframe img{height:60vh}
.cgrid,.sgrid,.nums{grid-template-columns:1fr 1fr}
.steps{grid-template-columns:1fr 1fr;gap:44px}
.rgrid{grid-template-columns:1fr;gap:70px}
.fgrid{grid-template-columns:1fr 1fr}
.calc{grid-template-columns:1fr}
}
@media(max-width:760px){
html{scroll-padding-top:76px}
body{padding-bottom:76px}
.sec{padding:90px 0}
.hero{padding:140px 0 90px}
.hwrap{height:72px;gap:10px}
#hd .btn-sm{display:none}
.bname{font-size:18px}
.lmark{width:32px;height:32px}
.hgrid{gap:50px}
.hframe img{height:52vh}
.hbadge{left:0;bottom:16px;padding:12px 16px;font-size:9px}
.hcta{flex-direction:column;align-items:stretch;gap:14px}
.hcta .btn{width:100%}
.btn{padding:17px 24px;font-size:10px;letter-spacing:.24em}
.hstats{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.hstats div{border-left:none;padding-left:0;border-top:1px solid var(--line);padding-top:14px}
.geo{letter-spacing:.26em;font-size:9px}
.shint{display:none}
.otext{font-size:60px}
.cgrid,.sgrid,.nums,.pgrid,.tgrid,.prins,.steps{grid-template-columns:1fr}
.num-card{padding:34px 26px}
.num-card .big{font-size:56px}
.sfoot{flex-direction:column;align-items:flex-start;gap:14px}
.scard{padding:36px 26px}
.scard h3{font-size:26px}
.tcard{padding:36px 26px}
.tcard h3{font-size:28px}
.tmono{font-size:48px}
.psum{font-size:40px}
.ptag{left:26px}
.pcard{padding:40px 28px}
.gbar{padding:30px 24px}
.gbar b{font-size:22px}
.qa-q{font-size:16px;padding:24px 0;gap:14px}
.qa-a p{padding-right:0}
.fcard{padding:36px 22px}
.frow select{font-size:15px}
.rmess{flex-direction:column}
.rmess .btn{width:100%}
.rcontacts a{font-size:14px;word-break:break-word}
.mnav a{font-size:26px}
.fgrid{grid-template-columns:1fr;gap:34px}
.mbar{display:flex}
.totop{bottom:auto;top:16px;right:14px;width:44px;height:44px}
.mcard{padding:36px 22px}
.calc-left,.calc-right{padding:34px 24px}
.cprice{font-size:48px}
}
@media(prefers-reduced-motion:reduce){,::before,*::after{animation:none!important;transition:none!important}html{scroll-behavior:auto}}
;

const CLIENTS=[
{t:"Малому и среднему бизнесу",d:"Когда штатный юрист не по карману, а вопросы есть каждый день.",l:["Договоры и претензии","Взыскание долгов","Проверки и споры","Кадровые вопросы"]},
{t:"Поставщикам в закупках",d:"Участникам тендеров по 44-ФЗ и 223-ФЗ — от заявки до контракта.",l:["Заявки под ключ","Жалобы в ФАС","Защита от РНП","Споры по контрактам"]},
{t:"УК, ТСЖ и подрядчикам ЖКХ",d:"Сфера ЖКХ — наша ежедневная практика: от предписаний ГЖИ до судов.",l:["Споры с ГЖИ","Работа с должниками","Споры с собственниками","Договоры с РСО"]},
{t:"Частным лицам",d:"Гражданам, которым нужен юрист без лишних слов и переплат.",l:["Договоры и сделки","Споры с застройщиками","Защита прав потребителей","Претензии и иски"]}
];
const SERVICES=[
{n:"01",t:"Тендеры и госзакупки",d:"44-ФЗ и 223-ФЗ под ключ: от анализа закупки до подписания контракта.",l:["Подготовка и подача заявок","Анализ закупки на скрытые риски","Сопровождение контракта","Обеспечение и банковские гарантии"],p:"от 7 700 ₽",base:7700,per:"",svc:"Тендеры и госзакупки (44-ФЗ, 223-ФЗ)"},
{n:"02",t:"ФАС и споры в закупках",d:"Защищаем участников закупок от необоснованных отказов и действий заказчиков.",l:["Жалобы в ФАС","Представительство на рассмотрениях","Обжалование итогов тендеров","Защита от включения в РНП"],p:"от 33 000 ₽",base:33000,per:"",svc:"ФАС и споры в закупках"},
{n:"03",t:"Юраутсорсинг бизнеса",d:"Штатный юрист не по карману? Мы закрываем правовые вопросы компании целиком.",l:["Абонентское обслуживание","Договоры и претензионная работа","Кадровые документы","Сопровождение проверок"],p:"от 24 200 ₽/мес",base:24200,per:"/мес",svc:"Юридический аутсорсинг бизнеса"},
{n:"04",t:"ЖКХ, УК и ТСЖ",d:"Сопровождаем управляющие организации и защищаем их в спорах с жителями и надзором.",l:["Работа с ГЖИ и муниципалитетом","Взыскание задолженности","Споры с собственниками","Договоры с ресурсоснабжающими организациями"],p:"от 13 200 ₽",base:13200,per:"",svc:"ЖКХ, УК и ТСЖ"},
{n:"05",t:"Арбитраж и суды",d:"Представляем интересы в арбитражных судах и судах общей юрисдикции.",l:["Взыскание долгов и убытков","Оспаривание сделок и решений","Банкротство кредитора","Возможна оплата за результат"],p:"от 49 500 ₽",base:49500,per:"",svc:"Арбитраж и суды"},
{n:"06",t:"Договоры и претензии",d:"Документы, которые работают на вас, а не против вас.",l:["Разработка и аудит договоров","Претензионная переписка","Правовые заключения","Сопровождение переговоров"],p:"от 4 400 ₽",base:4400,per:"",svc:"Договоры и претензии"}
];
const NUMS=[
{to:6,suf:"",txt:"практик права — глубоко и ежедневно"},
{to:2,suf:"",txt:"основателя ведут каждое дело лично"},
{to:100,suf:" %",txt:"стоимость фиксируется в договоре"},
{to:2,suf:" ч",txt:"максимум — ответ на вашу заявку"},
{to:24,suf:"/7",txt:"приём заявок онлайн, без выходных"},
{to:0,suf:" ₽",txt:"первая консультация — бесплатно"}
];
const PLANS=[
{name:"Старт",desc:"Разовая задача или консультация",sum:"от 4 400 ₽",small:"",hot:false,svc:"Другое / не знаю",l:["Консультация юриста — 60 минут","Разовый документ: договор, претензия","Правовое заключение по вопросу","Срок выполнения — от 1 рабочего дня","Оплата по факту согласования объёма"]},
{name:"Бизнес",desc:"Юридический отдел на аутсорсе",sum:"от 24 200 ₽",small:" / мес",hot:true,svc:"Юридический аутсорсинг бизнеса",l:["Всё из тарифа «Старт»","Безлимитные консультации","Полный документооборот компании","Кадровое сопровождение","Персональный юрист на связи","Скидка 20% на судебные дела"]},
{name:"Тендер",desc:"Тендерный отдел под ключ",sum:"от 38 500 ₽",small:" / мес",hot:false,svc:"Тендеры и госзакупки (44-ФЗ, 223-ФЗ)",l:["Всё из тарифа «Старт»","Подбор и анализ закупок","Заявки по 44-ФЗ и 223-ФЗ под ключ","Жалобы в ФАС и представительство","Контракты, обеспечение, сроки","Ежемесячная отчётность по торгам"]}
];
const TEAM=[
{n:"01",role:"Основатель · Начальник юридического отдела",t:"Суды, ЖКХ и сопровождение бизнеса",d:"Высшее юридическое образование. Руководит правовой практикой «ДоговорОфф»: арбитражные и гражданские споры, претензионная работа, абонентское обслуживание компаний и управляющих организаций.",l:["Арбитраж и взыскание долгов","Сопровождение УК, ТСЖ и подрядчиков ЖКХ","Договорная работа и правовые заключения","Споры с государственными органами"],f:["Высшее юридическое","Арбитраж и суды","ЖКХ и УК","Договоры"]},
{n:"02",role:"Сооснователь · Начальник тендерного отдела",t:"Госзакупки, ФАС и контракты",d:"Высшее юридическое образование. Руководит закупочной практикой «ДоговорОфф»: полное сопровождение участия в торгах по 44-ФЗ и 223-ФЗ, жалобы и представительство в ФАС, финансовое моделирование заявок.",l:["Заявки и тендерное сопровождение под ключ","Жалобы в ФАС и обжалование итогов","Защита от включения в РНП","Контракты, обеспечение и банковские гарантии"],f:["Высшее юридическое","44-ФЗ / 223-ФЗ","ФАС","Контракты"]}
];
const STEPS=[
{n:"01",t:"Заявка",d:"Вы оставляете заявку на сайте или звоните. В течение двух часов в рабочее время юрист связывается с вами.",s:"24/7 · бесплатно"},
{n:"02",t:"Консультация",d:"Бесплатно разбираем ситуацию, оцениваем перспективы и честно говорим, есть ли смысл идти в спор.",s:"30 минут · очно или онлайн"},
{n:"03",t:"Договор",d:"Фиксируем стоимость, сроки и состав работ. Никаких «допов» в процессе — цена не меняется.",s:"Цена фиксирована"},
{n:"04",t:"Результат",d:"Работаем и держим вас в курсе на каждом шаге: отчёты, документы, статусы — в одном чате.",s:"Отчёт после каждого действия"}
];
const FAQ=[
["Сколько стоит консультация?","Первая консультация — бесплатно, до 30 минут, очно или онлайн. Дальнейшая работа оценивается по прайсу и фиксируется в договоре до начала оказания услуг."],
["Что происходит после отправки заявки?","Заявка мгновенно приходит на почту компании, и в течение двух часов в рабочее время юрист связывается с вами: уточняет детали и назначает бесплатную консультацию. Данные заявки конфиденциальны."],
["Вы работаете с другими городами?","Да. Офис находится в Нижневартовске, но тендерное сопровождение, договорная работа и консультации полностью ведутся онлайн по всей России. В судах ХМАО участвуем лично, в других регионах — совместно с партнёрами или по видеосвязи."],
["Гарантируете ли вы результат?","Мы гарантируем честную оценку перспектив и качественную работу. Если дело бесперспективно — скажем об этом на первой консультации и не возьмём деньги за «борьбу ради борьбы». По ряду категорий возможна оплата за результат."],
["Как заключается договор и как платить?","Договор подписываем электронно или очно. Оплата — по счёту или картой, для абонентов — ежемесячный платёж."],
["Сохранится ли конфиденциальность?","Да. С первого обращения действует режим конфиденциальности, по запросу подписываем NDA. Документы хранятся в защищённом контуре, данные не передаются третьим лицам."]
];
const MARQUEE=["Тендеры и госзакупки","ФАС","Арбитраж","Юраутсорсинг","ЖКХ и УК","Договоры","Претензии","Банкротство"];

function Logo({className}){
  return(
    
      
      
      
      
    
  );
}
function Reveal({children,delay=0,x=0,scale=1,className="",style}){
  return({children});
}
function Counter({to,suf="",duration=2}){
  const ref=useRef(null);
  const inView=useInView(ref,{once:true,margin:"-40px"});
  const[v,setV]=useState(0);
  useEffect(()=>{if(!inView)return;const c=animate(0,to,{duration,ease:EASE,onUpdate:x=>setV(Math.round(x))});return()=>c.stop();},[inView,to]);
  return{v}{suf};
}
function useAnimatedNumber(t){
  const[v,setV]=useState(t);const p=useRef(t);
  useEffect(()=>{const c=animate(p.current,t,{duration:.9,ease:EASE,onUpdate:x=>setV(Math.round(x))});p.current=t;return()=>c.stop();},[t]);
  return v;
}
function Magnetic({href,className,children,onClick,type}){
  const ref=useRef(null);
  const mx=useMotionValue(0),my=useMotionValue(0);
  const sx=useSpring(mx,{stiffness:120,damping:16,mass:.5});
  const sy=useSpring(my,{stiffness:120,damping:16,mass:.5});
  const move=e=>{if(matchMedia("(pointer:coarse)").matches)return;const r=ref.current.getBoundingClientRect();mx.set((e.clientX-r.left-r.width/2).2);my.set((e.clientY-r.top-r.height/2).28);};
  const leave=()=>{mx.set(0);my.set(0);};
  const Tag=href?motion.a:motion.button;
  return({children});
}
function Cursor(){
  const[on,setOn]=useState(false);
  const[hover,setHover]=useState(false);
  const mx=useMotionValue(-100),my=useMotionValue(-100);
  const dx=useSpring(mx,{stiffness:2000,damping:60});
  const dy=useSpring(my,{stiffness:2000,damping:60});
  const rx=useSpring(mx,{stiffness:300,damping:25});
  const ry=useSpring(my,{stiffness:300,damping:25});
  useEffect(()=>{
    const fine=matchMedia("(pointer:fine)").matches;
    const rm=matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(!fine||rm)return;
    setOn(true);document.documentElement.classList.add("cc");
    const mv=e=>{mx.set(e.clientX);my.set(e.clientY);};
    const ov=e=>{setHover(!!e.target.closest("a,button,input,select,textarea,label"));};
    addEventListener("mousemove",mv);addEventListener("mouseover",ov);
    return()=>{removeEventListener("mousemove",mv);removeEventListener("mouseover",ov);document.documentElement.classList.remove("cc");};
  },[]);
  if(!on)return null;
  return<>
    
    
  ;
}
function maskPhone(raw){
  let d=raw.replace(/\D/g,"");
  if(d.charAt(0)==="8")d="7"+d.slice(1);
  if(d&&d.charAt(0)!=="7")d="7"+d;
  d=d.slice(0,11);
  if(d==="7")return"";
  let r="+7";
  if(d.length>1)r+=" ("+d.slice(1,4);
  if(d.length>=5)r+=") "+d.slice(4,7);
  if(d.length>=8)r+="-"+d.slice(7,9);
  if(d.length>=10)r+="-"+d.slice(9,11);
  return r;
}
const fmt=n=>n.toLocaleString("ru-RU");

export default function App(){
  const[intro,setIntro]=useState(true);
  const[scrolled,setScrolled]=useState(false);
  const[showTop,setShowTop]=useState(false);
  const[menu,setMenu]=useState(false);
  const[modal,setModal]=useState(false);
  const[openFaq,setOpenFaq]=useState(null);
  const[barHide,setBarHide]=useState(false);
  const[name,setName]=useState("");
  const[phone,setPhone]=useState("");
  const[svc,setSvc]=useState("");
  const[msg,setMsg]=useState("");
  const[agree,setAgree]=useState(false);
  const[bad,setBad]=useState({});
  const[agreeBad,setAgreeBad]=useState(false);
  const[loading,setLoading]=useState(false);
  const[done,setDone]=useState(false);
  const[fallbackHref,setFallbackHref]=useState(null);
  const[calcIdx,setCalcIdx]=useState(0);
  const heroRef=useRef(null);
  const reqRef=useRef(null);
  const lenisRef=useRef(null);
  const reqInView=useInView(reqRef,{margin:"-15% 0px -15% 0px"});
  useEffect(()=>setBarHide(reqInView),[reqInView]);

  useEffect(()=>{
    if(matchMedia("(prefers-reduced-motion: reduce)").matches){setIntro(false);return;}
    const t=setTimeout(()=>setIntro(false),1600);
    return()=>clearTimeout(t);
  },[]);
  useEffect(()=>{document.body.style.overflow=intro?"hidden":(menu||modal?"hidden":"");},[intro,menu,modal]);

  useEffect(()=>{
    if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    const lenis=new Lenis({duration:1.2,easing:t=>Math.min(1,1.001-Math.pow(2,-10*t)),smoothWheel:true});
    lenisRef.current=lenis;
    let raf;const loop=t=>{lenis.raf(t);raf=requestAnimationFrame(loop);};
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
        h.style.transform=translateY(${c*-18}px)`;
      });
    });};
    addEventListener("scroll",para,{passive:true});
    para();
    return()=>{cancelAnimationFrame(raf);cancelAnimationFrame(pr);removeEventListener("click",onClick);removeEventListener("scroll",para);lenis.destroy();lenisRef.current=null;};
  },[]);

  const{scrollYProgress}=useScroll();
  const barScale=useSpring(scrollYProgress,{stiffness:120,damping:22});
  const{scrollY}=useScroll();
  useMotionValueEvent(scrollY,"change",v=>{setScrolled(v>10);setShowTop(v>600);});
  const heroScroll=useScroll({target:heroRef,offset:["start start","end start"]});
  const frameY=useTransform(heroScroll.scrollYProgress,[0,1],[0,140]);

  const go=(el,off=-70)=>{if(lenisRef.current)lenisRef.current.scrollTo(el,{offset:off});else el?.scrollIntoView({behavior:"smooth"});};
  const pickSvc=v=>{setSvc(v);setBad(b=>({...b,svc:false}));go(document.getElementById("request"));};
  const calcSvc=SERVICES[calcIdx];
  const animPrice=useAnimatedNumber(calcSvc.base);

  const submit=e=>{
    e.preventDefault();
    if(e.target.querySelector('input[name="company"]')?.value)return;
    const nb={name:name.trim().length{if(!r.ok)throw new Error();return r.json();}).then(j=>{if(j&&j.success===false)throw new Error();})
    .catch(()=>{setFallbackHref("mailto:"+CONFIG.email+"?subject="+encodeURIComponent("Заявка с сайта ДоговорОфф: "+lead.service)+"&body="+encodeURIComponent("Имя: "+lead.name+"\nТелефон: "+lead.phone+"\nНаправление: "+lead.service+"\nЗадача: "+(lead.message||"—")));})
    .finally(()=>{setLoading(false);setDone(true);});
  };
  const resetForm=()=>{setDone(false);setFallbackHref(null);setName("");setPhone("");setSvc("");setMsg("");setAgree(false);};

  return(<>
    {CSS}
    
      {intro&&(
        
          
            
            ДоговорОфф
            юридическая компания · Сибирь
          
        
      )}
    
    
    

    
      
        
          
          {CONFIG.brand}юридическая компания · Сибирь
        
        
          КлиентыУслугиКалькуляторТарифы
          КомандаПроцессВопросы
        
        
          {CONFIG.phone}
          Оставить заявку
          setMenu(!menu)}>
        
      
    

    
      {menu&&(
        
          {[["#clients","Клиенты"],["#services","Услуги"],["#calc","Калькулятор"],["#pricing","Тарифы"],["#team","Команда"],["#process","Процесс"],["#faq","Вопросы"],["#request","Оставить заявку"]].map(([h,t],i)=>(
            setMenu(false)} initial={{opacity:0,x:-24}} animate={{opacity:1,x:0}} transition={{delay:.15+i*.05,duration:.5,ease:EASE}}>{t}
          ))}
          {CONFIG.phone}
        
      )}
    

    
      
        
          
          
        
        
          
          
          
        
        
          
            <Reveal delay
