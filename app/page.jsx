"use client";
import React,{useState,useEffect,useRef}from"react";
import Lenis from"lenis";
import{motion,AnimatePresence,useScroll,useSpring,useTransform,useMotionValue,useMotionValueEvent,useInView,animate}from"framer-motion";
const CONFIG={brand:"ДоговорОфф",phone:"+7 (3466) 000-00-00",phoneHref:"tel:+73466000000",email:"dogovor.off@mail.ru",web3formsKey:"109ee3ca-96c1-4a49-8dd9-9c3611d26b16",telegram:"https://t.me/dogovor_off",max:"https://max.ru/",address:"г. Нижневартовск, ул. Ленина, 6, офис 402",hours:"Пн–Пт 09:00–19:00 · заявки — 24/7",geo:"61°32′ N — 76°58′ E"};
const EASE=[.22,.61,.21,1];
const CSS=
@import url('https://cdn.jsdelivr.net/npm/@fontsource/cormorant-garamond@latest/index.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/cormorant-garamond@latest/500.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/cormorant-garamond@latest/600.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/cormorant-garamond@latest/400-italic.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/manrope@latest/index.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/manrope@latest/500.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/manrope@latest/600.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/manrope@latest/700.css');
:root{--bg:#f6f4ef;--bg2:#fbfaf7;--card:#fff;--ink:#121212;--gray:#6e6a63;--dgray:#9a968e;--line:rgba(18,18,18,.14);--ice:#7fa8ba;--err:#c2543f;--shadow:0 30px 70px rgba(18,18,18,.12)}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-padding-top:96px}
html.lenis,html.lenis body{height:auto}
.lenis.lenis-smooth{scroll-behavior:auto!important}
body{background:radial-gradient(1000px 600px at 85% -10%,rgba(255,255,255,.9),transparent 60%),radial-gradient(900px 700px at -10% 100%,rgba(255,255,255,.7),transparent 55%),var(--bg);color:var(--ink);font:400 16px/1.7 'Manrope',system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
body::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:4;opacity:.025;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
::selection{background:var(--ink);color:var(--bg)}
img{display:block}a{color:inherit}button{font-family:inherit}
:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
.wrap{width:min(1200px,92%);margin:0 auto}
@media(pointer:fine){html.cc,html.cc *{cursor:none}}
.cursor-dot,.cursor-ring{position:fixed;left:0;top:0;pointer-events:none;z-index:300;border-radius:50%;display:none;will-change:transform}
@media(pointer:fine){.cursor-dot,.cursor-ring{display:block}}
.cursor-dot{width:6px;height:6px;background:var(--ink);margin:-3px 0 0 -3px}
.cursor-ring{width:38px;height:38px;border:1px solid rgba(18,18,18,.4);margin:-19px 0 0 -19px;transition:background .3s,border-color .3s}
.cursor-ring.on{background:rgba(127,168,186,.16);border-color:var(--ice)}
.intro{position:fixed;inset:0;background:var(--bg);z-index:200;display:grid;place-items:center}
.intro-in{text-align:center}
.intro-logo{width:66px;height:78px;color:var(--ink);margin:0 auto}
.intro-name{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:36px;margin-top:16px}
.intro-sub{font:700 10px 'Manrope';letter-spacing:.34em;text-transform:uppercase;color:var(--gray);margin-top:8px}
.k{display:inline-flex;align-items:center;gap:12px;font:700 11px 'Manrope';letter-spacing:.3em;text-transform:uppercase;color:var(--ink)}
.k::before{content:"";width:34px;height:1px;background:var(--ink)}
h1,h2,h3{font-family:'Cormorant Garamond',serif;font-weight:500;line-height:1.05;color:var(--ink)}
h1{font-size:clamp(42px,6.4vw,92px)}
h1 em{font-style:italic;color:var(--gray)}
h2{font-size:clamp(30px,4.2vw,56px)}
.lead{color:var(--gray);font-size:clamp(16px,1.4vw,18px);line-height:1.75;max-width:580px}
.sec{padding:110px 0}
.shead{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;margin-bottom:56px;flex-wrap:wrap}
.shead h2{margin-top:16px}
.shead p{color:var(--gray);max-width:480px;font-size:15px;line-height:1.75}
.progress{position:fixed;top:0;left:0;right:0;height:2px;background:var(--ink);transform-origin:left center;z-index:70}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;font:700 12px 'Manrope';letter-spacing:.16em;text-transform:uppercase;padding:18px 30px;border:1px solid var(--ink);cursor:pointer;text-decoration:none;position:relative;overflow:hidden;background:transparent;color:var(--ink);transition:color .5s,box-shadow .5s;isolation:isolate;-webkit-tap-highlight-color:transparent;white-space:nowrap}
.btn::before{content:"";position:absolute;inset:0;background:var(--ink);transform:scaleX(0);transform-origin:left center;transition:transform .65s cubic-bezier(.77,0,.18,1);z-index:-1}
.btn::after{content:"";position:absolute;top:0;left:-70%;width:45%;height:100%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.4),transparent);transform:skewX(-20deg);transition:left .9s cubic-bezier(.22,.61,.21,1);pointer-events:none}
.btn:hover{color:var(--bg);box-shadow:0 20px 44px rgba(18,18,18,.16)}
.btn:hover::before{transform:scaleX(1)}
.btn:hover::after{left:130%}
.btn-g{background:var(--ink);color:var(--bg)}
.btn-g::before{background:var(--bg)}
.btn-g:hover{color:var(--ink)}
.btn-sm{padding:13px 22px}
.btn .arr{transition:transform .45s;display:inline-block}
.btn:hover .arr{transform:translateX(6px)}
#hd{position:fixed;top:0;left:0;right:0;z-index:50;transition:.5s;border-bottom:1px solid transparent}
#hd.scrolled{background:rgba(246,244,239,.9);backdrop-filter:blur(16px);border-color:var(--line);box-shadow:0 10px 30px rgba(18,18,18,.05)}
.hwrap{width:min(1320px,94%);margin:0 auto;height:82px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand{display:flex;align-items:center;gap:14px;text-decoration:none;min-width:0}
.lmark{width:36px;height:43px;color:var(--ink);flex:0 0 auto;transition:transform .5s}
.brand:hover .lmark{transform:translateY(-2px) rotate(-2deg)}
.bname{font-family:'Cormorant Garamond';font-weight:600;font-size:21px;line-height:1.1;display:flex;flex-direction:column}
.bsub{font:600 9.5px 'Manrope';letter-spacing:.26em;text-transform:uppercase;color:var(--gray)}
.nav{display:flex;gap:28px}
.nav a{font:600 11.5px 'Manrope';letter-spacing:.18em;text-transform:uppercase;color:var(--gray);text-decoration:none;position:relative;transition:color .3s}
.nav a::after{content:"";position:absolute;left:0;bottom:-6px;width:0;height:1px;background:var(--ink);transition:width .45s}
.nav a:hover{color:var(--ink)}
.nav a:hover::after{width:100%}
.hright{display:flex;align-items:center;gap:16px}
.hphone{font:600 14px 'Manrope';text-decoration:none;transition:opacity .3s}
.hphone:hover{opacity:.65}
.burger{display:none;width:44px;height:44px;background:none;border:1px solid var(--line);cursor:pointer;position:relative;flex:0 0 auto;transition:.4s}
.burger:hover{border-color:var(--ink);transform:translateY(-2px)}
.burger span{position:absolute;left:12px;right:12px;height:1.5px;background:var(--ink);transition:.4s}
.burger span:nth-child(1){top:16px}.burger span:nth-child(2){top:24px}
.burger.open span:nth-child(1){top:20px;transform:rotate(45deg)}
.burger.open span:nth-child(2){top:20px;transform:rotate(-45deg)}
.mnav{position:fixed;inset:0;background:rgba(246,244,239,.98);backdrop-filter:blur(10px);z-index:49;display:flex;flex-direction:column;justify-content:center;padding:90px 8% 50px;gap:6px;overflow-y:auto}
.mnav a{font-family:'Cormorant Garamond';font-size:30px;text-decoration:none;padding:8px 0;border-bottom:1px solid var(--line);transition:.4s}
.mnav a:hover{color:var(--gray);padding-left:10px}
.mnav .mphone{font:600 15px 'Manrope';border:none;margin-top:14px}
.hero{padding:175px 0 110px;position:relative;overflow:hidden}
.aurora{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.aurora span{position:absolute;border-radius:50%;filter:blur(70px)}
.a1{width:560px;height:560px;left:-160px;top:-180px;background:radial-gradient(circle at 30% 30%,rgba(157,195,210,.5),transparent 70%)}
.a2{width:680px;height:680px;right:-240px;top:-140px;background:radial-gradient(circle at 60% 40%,rgba(146,180,166,.38),transparent 70%)}
.a3{width:480px;height:480px;left:28%;top:44%;background:radial-gradient(circle at 50% 50%,rgba(157,195,210,.3),transparent 70%)}
.contours{position:absolute;left:0;right:0;bottom:-8px;opacity:.5;pointer-events:none}
.hgrid{display:grid;grid-template-columns:1.15fr .85fr;gap:70px;align-items:center;position:relative;z-index:1}
.hleft h1{margin:26px 0 24px}
.hcta{display:flex;gap:16px;margin-top:38px;flex-wrap:wrap}
.hstats{display:flex;gap:46px;margin-top:56px;flex-wrap:wrap}
.hstats div{border-left:1px solid var(--line);padding-left:20px}
.hstats b{display:block;font-family:'Cormorant Garamond';font-weight:600;font-size:32px;line-height:1}
.hstats span{font:600 10.5px 'Manrope';letter-spacing:.2em;text-transform:uppercase;color:var(--gray)}
.geo{margin-top:34px;font:700 11px 'Manrope';letter-spacing:.3em;text-transform:uppercase;color:var(--gray);display:flex;align-items:center;gap:12px}
.geo i{font-style:normal;color:var(--ice)}
.hright{position:relative}
.hclip{will-change:clip-path}
.hframe{position:relative;z-index:1;overflow:hidden;box-shadow:var(--shadow)}
.hframe::after{content:"";position:absolute;inset:0;transform:translate(18px,18px);border:1px solid rgba(18,18,18,.5);z-index:-1}
.hframe img{width:100%;height:min(70vh,620px);object-fit:cover;filter:grayscale(1) contrast(1.06);transition:filter .8s}
.hframe:hover img{filter:grayscale(.55) contrast(1.04)}
.hbadge{position:absolute;left:-26px;bottom:34px;z-index:2;background:var(--card);border:1px solid var(--line);padding:14px 20px;display:flex;align-items:center;gap:10px;font:600 11.5px 'Manrope';letter-spacing:.16em;text-transform:uppercase;box-shadow:0 16px 40px rgba(18,18,18,.1);animation:floaty 6s ease-in-out infinite}
@keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
.dot{width:8px;height:8px;border-radius:50%;background:var(--ink);animation:pulse 2.4s infinite}
@keyframes pulse{70%{box-shadow:0 0 0 10px transparent}100%{box-shadow:0 0 0 0 transparent}}
.shint{position:absolute;bottom:22px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--gray);font:700 9.5px 'Manrope';letter-spacing:.34em;text-transform:uppercase;z-index:1}
.shint svg{animation:bob 1.8s ease-in-out infinite}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(7px)}}
.ln{display:block;overflow:hidden;padding-bottom:.08em;margin-bottom:-.08em}
.ln-i{display:inline-block;will-change:transform}
.outline-mq{padding:26px 0;overflow:hidden;border-bottom:1px solid var(--line)}
.otrack{display:flex;width:max-content;animation:mq 60s linear infinite}
.otext{font-family:'Cormorant Garamond';font-weight:600;font-size:clamp(56px,8.6vw,132px);line-height:1;color:transparent;-webkit-text-stroke:1px rgba(18,18,18,.3);white-space:nowrap;padding-right:70px}
.otext b{color:var(--ink);-webkit-text-stroke:0}
.otext i{font-style:normal;color:var(--ice);-webkit-text-stroke:0;font-size:.6em;vertical-align:middle;padding:0 10px}
.marquee{border-top:1px solid var(--line);border-bottom:1px solid var(--line);overflow:hidden;padding:20px 0;background:var(--bg2)}
.mtrack{display:flex;width:max-content;animation:mq 40s linear infinite}
.marquee:hover .mtrack{animation-play-state:paused}
.mgroup{display:flex;align-items:center;gap:52px;padding-right:52px}
.mgroup span{font-family:'Cormorant Garamond';font-style:italic;font-size:21px;color:var(--gray);white-space:nowrap}
.mgroup i{color:var(--ice);font-style:normal;font-size:14px}
@keyframes mq{to{transform:translateX(-50%)}}
.cgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line)}
.ccard{background:var(--card);padding:36px 30px;transition:transform .6s,box-shadow .6s;position:relative;overflow:hidden}
.ccard::after{content:"";position:absolute;top:0;left:0;height:2px;width:0;background:var(--ink);transition:width .6s}
.ccard:hover{transform:translateY(-6px);box-shadow:var(--shadow);z-index:1}
.ccard:hover::after{width:100%}
.ccard h3{font-size:24px;margin-bottom:10px}
.ccard p{color:var(--gray);font-size:14px;line-height:1.7;margin-bottom:16px}
.ccard ul{list-style:none}
.ccard ul li{position:relative;padding-left:16px;margin:7px 0;font-size:13.5px;color:#3c3a36}
.ccard ul li::before{content:"";position:absolute;left:0;top:10px;width:6px;height:1px;background:var(--ink)}
.sgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line)}
.scard{background:var(--card);padding:40px 34px;display:flex;flex-direction:column;transition:transform .6s,box-shadow .6s;position:relative;overflow:hidden}
.scard::after{content:"";position:absolute;top:0;left:0;height:2px;width:0;background:var(--ink);transition:width .6s}
.scard:hover{transform:translateY(-6px);box-shadow:var(--shadow);z-index:1}
.scard:hover::after{width:100%}
.snum{font-family:'Cormorant Garamond';font-style:italic;font-size:18px;color:var(--gray);margin-bottom:22px}
.scard h3{font-size:27px;margin-bottom:12px}
.scard>p{color:var(--gray);font-size:14.5px;line-height:1.7;margin-bottom:18px}
.scard ul{list-style:none;margin-bottom:26px}
.scard ul li{position:relative;padding-left:16px;margin:7px 0;font-size:14px;color:#3c3a36}
.scard ul li::before{content:"";position:absolute;left:0;top:10px;width:6px;height:1px;background:var(--ink)}
.sfoot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding-top:18px}
.price{font:700 14px 'Manrope'}
.slink{background:none;border:none;cursor:pointer;font:700 11px 'Manrope';letter-spacing:.18em;text-transform:uppercase;color:var(--ink);padding:0;position:relative;transition:letter-spacing .4s}
.slink::after{content:"";position:absolute;left:0;bottom:-5px;width:100%;height:1px;background:var(--ink);transform:scaleX(0);transform-origin:right;transition:transform .45s}
.slink:hover{letter-spacing:.22em}
.slink:hover::after{transform:scaleX(1);transform-origin:left}
.nums{display:grid;grid
