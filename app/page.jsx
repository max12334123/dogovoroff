"use client";
/* ============================================================
   «ДоговорОфф» — React + Framer Motion. Премиум, северный характер.
   Next.js: app/page.jsx · Vite/CRA: App.jsx
   Заявки: dogovor.off@mail.ru (Web3Forms)
   ============================================================ */
import React, { useState, useEffect, useRef } from "react";
import {
  motion, AnimatePresence, useScroll, useSpring, useTransform,
  useMotionValue, useMotionValueEvent, useInView, animate
} from "framer-motion";

const CONFIG = {
  brand: "ДоговорОфф",
  phone: "+7 (3466) 000-00-00",
  phoneHref: "tel:+73466000000",
  email: "dogovor.off@mail.ru",
  web3formsKey: "109ee3ca-96c1-4a49-8dd9-9c3611d26b16",
  telegram: "https://t.me/dogovor_off",
  /* Ссылка на ваш профиль/чат в мессенджере MAX (замените на свою) */
  max: "https://max.ru/",
  address: "г. Нижневартовск, ул. Ленина, 6, офис 402",
  hours: "Пн–Пт 09:00–19:00 · заявки — 24/7",
  geo: "61°32′ N — 76°58′ E"
};

const EASE = [0.22, 0.61, 0.21, 1];
const SWEEP = [0.77, 0, 0.18, 1];

const CSS = `
@import url('https://cdn.jsdelivr.net/npm/@fontsource/cormorant-garamond@latest/index.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/cormorant-garamond@latest/500.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/cormorant-garamond@latest/600.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/cormorant-garamond@latest/400-italic.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/cormorant-garamond@latest/500-italic.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/manrope@latest/index.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/manrope@latest/500.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/manrope@latest/600.css');
@import url('https://cdn.jsdelivr.net/npm/@fontsource/manrope@latest/700.css');
:root{
  --bg:#f6f4ef; --bg2:#fbfaf7; --card:#ffffff;
  --ink:#121212; --gray:#6e6a63; --dgray:#9a968e;
  --line:rgba(18,18,18,.14); --ice:#7fa8ba; --ice2:#9dc3d2;
  --err:#c2543f; --shadow:0 30px 70px rgba(18,18,18,.12);
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;scroll-padding-top:96px}
body{background:radial-gradient(1000px 600px at 85% -10%,rgba(255,255,255,.9),transparent 60%),radial-gradient(900px 700px at -10% 100%,rgba(255,255,255,.7),transparent 55%),var(--bg);color:var(--ink);font:400 16px/1.7 'Manrope',system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
body::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:4;opacity:.025;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
::selection{background:var(--ink);color:var(--bg)}
img{display:block}a{color:inherit}button{font-family:inherit}
:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
.wrap{width:min(1200px,92%);margin:0 auto}
/* ---------- интро ---------- */
.intro{position:fixed;inset:0;background:var(--bg);z-index:200;display:grid;place-items:center}
.intro-in{text-align:center}
.intro-logo{width:66px;height:78px;color:var(--ink);margin:0 auto}
.intro-name{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:36px;margin-top:16px;letter-spacing:.02em}
.intro-sub{font:700 10px 'Manrope';letter-spacing:.34em;text-transform:uppercase;color:var(--gray);margin-top:8px}
/* ---------- базовые ---------- */
.k{display:inline-flex;align-items:center;gap:12px;font:700 11px 'Manrope';letter-spacing:.3em;text-transform:uppercase;color:var(--ink)}
.k::before{content:"";width:34px;height:1px;background:var(--ink)}
h1,h2,h3{font-family:'Cormorant Garamond',serif;font-weight:500;line-height:1.05;color:var(--ink)}
h1{font-size:clamp(42px,6.4vw,92px);letter-spacing:-.01em}
h1 em{font-style:italic;color:var(--gray)}
h2{font-size:clamp(30px,4.2vw,56px)}
.lead{color:var(--gray);font-size:clamp(16px,1.4vw,18px);line-height:1.75;max-width:580px}
.sec{padding:110px 0}
.shead{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;margin-bottom:56px;flex-wrap:wrap}
.shead h2{margin-top:16px}
.shead p{color:var(--gray);max-width:480px;font-size:15px;line-height:1.75}
.progress{position:fixed;top:0;left:0;right:0;height:2px;background:var(--ink);transform-origin:left center;z-index:70}
/* ---------- кнопки: плавный sweep + блик ---------- */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;font:700 12px 'Manrope';letter-spacing:.16em;text-transform:uppercase;padding:18px 30px;border:1px solid var(--ink);cursor:pointer;text-decoration:none;position:relative;overflow:hidden;background:transparent;color:var(--ink);transition:color .5s EASE,box-shadow .5s EASE,border-color .5s;isolation:isolate;-webkit-tap-highlight-color:transparent;white-space:nowrap;will-change:transform}
.btn::before{content:"";position:absolute;inset:0;background:var(--ink);transform:scaleX(0);transform-origin:left center;transition:transform .65s SWEEP;z-index:-1}
.btn::after{content:"";position:absolute;top:0;left:-70%;width:45%;height:100%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.4),transparent);transform:skewX(-20deg);transition:left .9s cubic-bezier(.22,.61,.21,1);pointer-events:none}
.btn:hover{color:var(--bg);box-shadow:0 20px 44px rgba(18,18,18,.16)}
.btn:hover::before{transform:scaleX(1)}
.btn:hover::after{left:130%}
.btn-g{background:var(--ink);color:var(--bg)}
.btn-g::before{background:var(--bg)}
.btn-g:hover{color:var(--ink)}
.btn-sm{padding:13px 22px}
.btn .arr{transition:transform .45s EASE;display:inline-block}
.btn:hover .arr{transform:translateX(6px)}
/* ---------- шапка ---------- */
#hd{position:fixed;top:0;left:0;right:0;z-index:50;transition:background .5s,border-color .5s,box-shadow .5s;border-bottom:1px solid transparent}
#hd.scrolled{background:rgba(246,244,239,.9);backdrop-filter:blur(16px);border-color:var(--line);box-shadow:0 10px 30px rgba(18,18,18,.05)}
.hwrap{width:min(1320px,94%);margin:0 auto;height:82px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand{display:flex;align-items:center;gap:14px;text-decoration:none;flex:0 0 auto;min-width:0}
.lmark{width:36px;height:43px;color:var(--ink);flex:0 0 auto;transition:transform .5s EASE}
.brand:hover .lmark{transform:translateY(-2px) rotate(-2deg)}
.bname{font-family:'Cormorant Garamond';font-weight:600;font-size:21px;letter-spacing:.04em;line-height:1.1;display:flex;flex-direction:column;color:var(--ink)}
.bsub{font:600 9.5px 'Manrope';letter-spacing:.26em;text-transform:uppercase;color:var(--gray)}
.nav{display:flex;gap:28px}
.nav a{font:600 11.5px 'Manrope';letter-spacing:.18em;text-transform:uppercase;color:var(--gray);text-decoration:none;transition:color .3s;position:relative}
.nav a::after{content:"";position:absolute;left:0;bottom:-6px;width:0;height:1px;background:var(--ink);transition:width .45s EASE}
.nav a:hover{color:var(--ink)}
.nav a:hover::after{width:100%}
.hright{display:flex;align-items:center;gap:16px}
.hphone{font:600 14px 'Manrope';color:var(--ink);text-decoration:none;transition:opacity .3s}
.hphone:hover{opacity:.65}
.burger{display:none;width:44px;height:44px;background:none;border:1px solid var(--line);cursor:pointer;position:relative;flex:0 0 auto;transition:border-color .4s,transform .4s}
.burger:hover{border-color:var(--ink);transform:translateY(-2px)}
.burger span{position:absolute;left:12px;right:12px;height:1.5px;background:var(--ink);transition:.4s EASE}
.burger span:nth-child(1){top:16px}.burger span:nth-child(2){top:24px}
.burger.open span:nth-child(1){top:20px;transform:rotate(45deg)}
.burger.open span:nth-child(2){top:20px;transform:rotate(-45deg)}
.mnav{position:fixed;inset:0;background:rgba(246,244,239,.98);backdrop-filter:blur(10px);z-index:49;display:flex;flex-direction:column;justify-content:center;padding:90px 8% 50px;gap:6px;overflow-y:auto}
.mnav a{font-family:'Cormorant Garamond';font-size:30px;color:var(--ink);text-decoration:none;padding:8px 0;border-bottom:1px solid var(--line);transition:padding-left .4s,color .4s}
.mnav a:hover{color:var(--gray);padding-left:10px}
.mnav .mphone{font:600 15px 'Manrope';border:none;margin-top:14px}
/* ---------- hero ---------- */
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
.dot{width:8px;height:8px;border-radius:50%;background:var(--ink);box-shadow:0 0 0 0 rgba(18,18,18,.35);animation:pulse 2.4s infinite}
@keyframes pulse{70%{box-shadow:0 0 0 10px transparent}100%{box-shadow:0 0 0 0 transparent}}
.shint{position:absolute;bottom:22px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--gray);font:700 9.5px 'Manrope';letter-spacing:.34em;text-transform:uppercase;z-index:1}
.shint svg{animation:bob 1.8s ease-in-out infinite}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(7px)}}
.ln{display:block;overflow:hidden;padding-bottom:.08em;margin-bottom:-.08em}
.ln-i{display:inline-block;will-change:transform}
/* ---------- маркизы ---------- */
.outline-mq{padding:26px 0;overflow:hidden;border-bottom:1px solid var(--line)}
.otrack{display:flex;width:max-content;animation:mq 60s linear infinite}
.otext{font-family:'Cormorant Garamond';font-weight:600;font-size:clamp(56px,8.6vw,132px);line-height:1;color:transparent;-webkit-text-stroke:1px rgba(18,18,18,.3);white-space:nowrap;padding-right:70px}
.otext b{color:var(--ink);-webkit-text-stroke:0;font-weight:600}
.otext i{font-style:normal;color:var(--ice);-webkit-text-stroke:0;font-size:.6em;vertical-align:middle;padding:0 10px}
.marquee{border-top:1px solid var(--line);border-bottom:1px solid var(--line);overflow:hidden;padding:20px 0;background:var(--bg2)}
.mtrack{display:flex;width:max-content;animation:mq 40s linear infinite}
.marquee:hover .mtrack{animation-play-state:paused}
.mgroup{display:flex;align-items:center;gap:52px;padding-right:52px}
.mgroup span{font-family:'Cormorant Garamond';font-style:italic;font-size:21px;color:var(--gray);white-space:nowrap}
.mgroup i{color:var(--ice);font-style:normal;font-size:14px}
@keyframes mq{to{transform:translateX(-50%)}}
/* ---------- сетки ---------- */
.cgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line)}
.ccard{background:var(--card);padding:36px 30px;transition:transform .6s EASE,box-shadow .6s EASE;position:relative;overflow:hidden}
.ccard::after{content:"";position:absolute;top:0;left:0;height:2px;width:0;background:var(--ink);transition:width .6s EASE}
.ccard:hover{transform:translateY(-6px);box-shadow:var(--shadow);z-index:1}
.ccard:hover::after{width:100%}
.ccard h3{font-size:24px;margin-bottom:10px}
.ccard p{color:var(--gray);font-size:14px;line-height:1.7;margin-bottom:16px}
.ccard ul{list-style:none}
.ccard ul li{position:relative;padding-left:16px;margin:7px 0;font-size:13.5px;color:#3c3a36}
.ccard ul li::before{content:"";position:absolute;left:0;top:10px;width:6px;height:1px;background:var(--ink)}
.sgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line)}
.scard{background:var(--card);padding:40px 34px;display:flex;flex-direction:column;transition:transform .6s EASE,box-shadow .6s EASE;position:relative;overflow:hidden}
.scard::after{content:"";position:absolute;top:0;left:0;height:2px;width:0;background:var(--ink);transition:width .6s EASE}
.scard:hover{transform:translateY(-6px);box-shadow:var(--shadow);z-index:1}
.scard:hover::after{width:100%}
.snum{font-family:'Cormorant Garamond';font-style:italic;font-size:18px;color:var(--gray);margin-bottom:22px}
.scard h3{font-size:27px;margin-bottom:12px}
.scard>p{color:var(--gray);font-size:14.5px;line-height:1.7;margin-bottom:18px}
.scard ul{list-style:none;margin-bottom:26px}
.scard ul li{position:relative;padding-left:16px;margin:7px 0;font-size:14px;color:#3c3a36}
.scard ul li::before{content:"";position:absolute;left:0;top:10px;width:6px;height:1px;background:var(--ink)}
.sfoot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding-top:18px}
.price{font:700 14px 'Manrope';letter-spacing:.02em}
.slink{background:none;border:none;cursor:pointer;font:700 11px 'Manrope';letter-spacing:.18em;text-transform:uppercase;color:var(--ink);padding:0;transition:letter-spacing .4s;position:relative}
.slink::after{content:"";position:absolute;left:0;bottom:-5px;width:100%;height:1px;background:var(--ink);transform:scaleX(0);transform-origin:right;transition:transform .45s EASE}
.slink:hover{letter-spacing:.22em}
.slink:hover::after{transform:scaleX(1);transform-origin:left}
.nums{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line)}
.num-card{background:var(--card);padding:38px 32px;transition:transform .6s EASE,box-shadow .6s EASE;position:relative;overflow:hidden}
.num-card:hover{transform:translateY(-6px);box-shadow:var(--shadow);z-index:1}
.num-card .big{font-family:'Cormorant Garamond';font-weight:600;font-size:clamp(48px,5vw,72px);line-height:1;color:var(--ink)}
.num-card .big i{font-style:normal;font-size:.45em;color:var(--ice)}
.num-card small{display:block;margin-top:12px;font:700 10.5px 'Manrope';letter-spacing:.16em;text-transform:uppercase;color:var(--gray);line-height:1.6}
.num-card::after{content:"❄";position:absolute;right:18px;top:16px;color:var(--ice);opacity:.55;font-size:14px}
/* ---------- калькулятор ---------- */
.calc{display:grid;grid-template-columns:1.1fr .9fr;gap:22px;align-items:stretch}
.calc-left{border:1px solid var(--line);background:var(--card);padding:38px 36px}
.calc-left h3{font-size:24px;margin-bottom:8px}
.calc-left .chint{color:var(--gray);font-size:13px;margin-bottom:24px}
.chips{display:flex;flex-wrap:wrap;gap:10px}
.chip{border:1px solid var(--line);background:none;padding:13px 18px;font:600 12px 'Manrope';letter-spacing:.06em;cursor:pointer;transition:all .4s EASE;color:var(--ink);-webkit-tap-highlight-color:transparent}
.chip:hover{border-color:var(--ink);transform:translateY(-2px)}
.chip.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.calc-right{background:var(--ink);color:var(--bg);padding:38px 36px;display:flex;flex-direction:column;position:relative;overflow:hidden}
.calc-right::after{content:"❄";position:absolute;right:26px;top:22px;color:var(--ice);opacity:.7;font-size:16px}
.calc-right .cl{font:700 10px 'Manrope';letter-spacing:.26em;text-transform:uppercase;color:rgba(246,244,239,.55)}
.cprice{font-family:'Cormorant Garamond';font-weight:600;font-size:clamp(44px,4.6vw,64px);line-height:1;margin:18px 0 4px;color:var(--bg)}
.cprice small{font:600 14px 'Manrope';color:rgba(246,244,239,.6);letter-spacing:.06em}
.cnote{font-size:12px;color:rgba(246,244,239,.55);margin-bottom:22px;line-height:1.6}
.cinc{list-style:none;margin-bottom:28px}
.cinc li{position:relative;padding-left:18px;margin:8px 0;font-size:13px;color:rgba(246,244,239,.8)}
.cinc li::before{content:"";position:absolute;left:0;top:9px;width:7px;height:1px;background:var(--ice)}
.calc-right .btn{margin-top:auto;border-color:var(--bg);color:var(--bg)}
.calc-right .btn::before{background:var(--bg)}
.calc-right .btn:hover{color:var(--ink)}
/* ---------- тарифы ---------- */
.pgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;align-items:stretch}
.pcard{border:1px solid var(--line);background:var(--card);padding:44px 36px;display:flex;flex-direction:column;position:relative;transition:transform .6s EASE,border-color .6s,box-shadow .6s EASE}
.pcard:hover{transform:translateY(-8px);border-color:var(--ink);box-shadow:var(--shadow)}
.pcard.hot{border-color:var(--ink);background:linear-gradient(180deg,rgba(18,18,18,.04),var(--card) 60%)}
.ptag{position:absolute;top:-13px;left:36px;background:var(--ink);color:var(--bg);font:700 10px 'Manrope';letter-spacing:.2em;text-transform:uppercase;padding:7px 14px}
.pname{font-family:'Cormorant Garamond';font-weight:600;font-size:29px}
.pdesc{color:var(--gray);font-size:14px;margin:8px 0 22px}
.psum{font-family:'Cormorant Garamond';font-weight:600;font-size:42px;line-height:1}
.psum small{font:600 12px 'Manrope';color:var(--gray);letter-spacing:.06em}
.pcard ul{list-style:none;margin:26px 0 32px;flex:1}
.pcard ul li{position:relative;padding-left:22px;margin:11px 0;font-size:14px;color:#3c3a36}
.pcard ul li::before{content:"✓";position:absolute;left:0;font-size:12px}
.pcard .btn{width:100%}
.pnote{margin-top:26px;color:var(--gray);font-size:14px;text-align:center}
.pnote a{color:var(--ink);text-decoration:underline;text-underline-offset:4px;transition:opacity .3s}
.pnote a:hover{opacity:.65}
/* ---------- команда ---------- */
.tgrid{display:grid;grid-template-columns:1fr 1fr;gap:22px}
.tcard{border:1px solid var(--line);background:var(--card);padding:46px 42px;display:flex;flex-direction:column;transition:border-color .6s,transform .6s EASE,box-shadow .6s EASE}
.tcard:hover{border-color:var(--ink);transform:translateY(-6px);box-shadow:var(--shadow)}
.tmono{font-family:'Cormorant Garamond';font-style:italic;font-size:58px;color:rgba(18,18,18,.15);line-height:1;margin-bottom:20px}
.trole{font:700 10.5px 'Manrope';letter-spacing:.24em;text-transform:uppercase;color:var(--gray);margin-bottom:12px}
.tcard h3{font-size:31px;margin-bottom:14px}
.tcard>p{color:var(--gray);font-size:14.5px;line-height:1.75;margin-bottom:20px}
.tcard ul{list-style:none;margin-bottom:26px}
.tcard ul li{position:relative;padding-left:16px;margin:8px 0;font-size:14px;color:#3c3a36}
.tcard ul li::before{content:"";position:absolute;left:0;top:10px;width:6px;height:1px;background:var(--ink)}
.tfacts{margin-top:auto;border-top:1px solid var(--line);padding-top:18px;display:flex;gap:10px;flex-wrap:wrap}
.tfacts span{font:700 10px 'Manrope';letter-spacing:.16em;text-transform:uppercase;color:var(--gray);border:1px solid var(--line);padding:7px 12px;transition:border-color .4s,color .4s}
.tcard:hover .tfacts span{border-color:var(--ink);color:var(--ink)}
.prins{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);margin-top:22px}
.prin{background:var(--card);padding:32px 28px;transition:transform .6s EASE,box-shadow .6s EASE}
.prin:hover{transform:translateY(-4px);box-shadow:var(--shadow);z-index:1}
.prin .pn2{font-family:'Cormorant Garamond';font-style:italic;font-size:22px;color:var(--ice);margin-bottom:10px}
.prin h4{font-family:'Cormorant Garamond';font-weight:600;font-size:22px;margin-bottom:8px}
.prin p{color:var(--gray);font-size:13.5px;line-height:1.7}
/* ---------- процесс ---------- */
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:34px;position:relative}
.pstep{border-top:1px solid var(--line);padding-top:34px;position:relative}
.pstep .pline{position:absolute;top:-1px;left:0;height:1px;background:var(--ink);transform-origin:left center;width:100%}
.pstep .pdot{position:absolute;top:-6px;left:-1px;width:11px;height:11px;border-radius:50%;background:var(--ink);box-shadow:0 0 0 4px var(--bg)}
.pstep .pn{font-family:'Cormorant Garamond';font-style:italic;font-size:46px;line-height:1;margin-bottom:18px;color:var(--ink)}
.pstep h3{font-size:23px;margin-bottom:10px}
.pstep p{color:var(--gray);font-size:14px;line-height:1.7}
.pstep .psub{margin-top:12px;font:700 10.5px 'Manrope';letter-spacing:.18em;text-transform:uppercase;color:var(--ice)}
.gbar{margin-top:56px;border:1px solid var(--line);background:var(--card);padding:32px 36px;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;transition:box-shadow .6s EASE,transform .6s EASE}
.gbar:hover{box-shadow:var(--shadow);transform:translateY(-3px)}
.gbar b{font-family:'Cormorant Garamond';font-weight:600;font-size:25px}
.gbar span{color:var(--gray);font-size:14px;max-width:580px}
/* ---------- faq ---------- */
.faqwrap{max-width:860px;margin:0 auto}
.qa{border-bottom:1px solid var(--line)}
.qa-q{width:100%;display:flex;justify-content:space-between;align-items:center;gap:24px;padding:26px 0;background:none;border:none;color:var(--ink);font:600 18px 'Manrope';cursor:pointer;text-align:left;transition:color .3s,padding-left .4s}
.qa-q:hover{color:var(--gray);padding-left:8px}
.qa-i{flex:0 0 14px;width:14px;height:14px;position:relative;transition:transform .5s EASE}
.qa-q:hover .qa-i{transform:rotate(90deg)}
.qa-i::before,.qa-i::after{content:"";position:absolute;background:var(--ink);transition:transform .4s EASE}
.qa-i::before{left:0;top:6px;width:14px;height:1.6px}
.qa-i::after{left:6px;top:0;width:1.6px;height:14px}
.qa.open .qa-i::after{transform:scaleY(0)}
.qa-a p{padding:0 40px 26px 0;color:var(--gray);font-size:15px;line-height:1.8}
/* ---------- заявка ---------- */
#request{background:linear-gradient(180deg,transparent,rgba(18,18,18,.04) 30%,transparent)}
.rgrid{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:start}
.rleft h2{margin:18px 0 20px}
.rleft>p{color:var(--gray);font-size:15.5px;line-height:1.8;max-width:500px}
.rlist{list-style:none;margin:30px 0 38px}
.rlist li{position:relative;padding-left:26px;margin:13px 0;font-size:15px;color:#2e2c29}
.rlist li::before{content:"✓";position:absolute;left:0}
.rcontacts{display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--line);padding-top:28px;max-width:440px}
.rcontacts a{text-decoration:none;font:600 16px 'Manrope';transition:opacity .3s,letter-spacing .4s;width:fit-content}
.rcontacts a:hover{opacity:.65;letter-spacing:.03em}
.rhours,.raddr{font-size:13px;color:var(--gray)}
.rmess{display:flex;gap:12px;margin-top:22px;flex-wrap:wrap}
.maxlogo{display:inline-flex;align-items:center;justify-content:center;font:800 10px 'Manrope';letter-spacing:.06em;border:1.5px solid currentColor;border-radius:6px;padding:3px 6px}
.fcard{background:var(--card);border:1px solid var(--line);padding:46px 44px;position:relative;box-shadow:0 30px 80px rgba(18,18,18,.07)}
.fcard h3{font-size:29px;margin-bottom:6px}
.fsub{color:var(--gray);font-size:13px;margin-bottom:30px}
.frow{margin-bottom:26px;position:relative}
.frow label{display:block;font:700 10.5px 'Manrope';letter-spacing:.22em;text-transform:uppercase;color:var(--gray);margin-bottom:8px}
.frow input,.frow select,.frow textarea{width:100%;background:transparent;border:none;border-bottom:1px solid rgba(18,18,18,.3);color:var(--ink);font:500 16px 'Manrope';padding:11px 0;outline:none;transition:border-color .4s;border-radius:0}
.frow select{appearance:none;-webkit-appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23121212' stroke-width='1.5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 4px center}
.frow select:invalid{color:var(--gray)}
.frow select option{background:#fff;color:var(--ink)}
.frow textarea{resize:vertical;min-height:88px;line-height:1.6}
.frow input:focus,.frow select:focus,.frow textarea:focus{border-color:var(--ink)}
.frow input::placeholder,.frow textarea::placeholder{color:#a5a19a}
.fmsg{position:absolute;left:0;bottom:-17px;font-size:11px;color:var(--err);opacity:0;transition:.3s;letter-spacing:.04em}
.frow.bad input,.frow.bad select{border-color:var(--err)}
.frow.bad .fmsg{opacity:1}
.hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}
.agree{display:flex;gap:12px;align-items:flex-start;cursor:pointer;font-size:12.5px;color:var(--gray);line-height:1.6;margin:6px 0 28px}
.agree input{position:absolute;opacity:0;width:0}
.box{flex:0 0 18px;width:18px;height:18px;border:1px solid rgba(18,18,18,.4);margin-top:1px;position:relative;transition:.3s}
.agree:hover .box{border-color:var(--ink)}
.agree input:checked + .box{background:var(--ink);border-color:var(--ink)}
.box::after{content:"";position:absolute;left:5px;top:2px;width:4px;height:9px;border:solid var(--bg);border-width:0 2px 2px 0;transform:rotate(45deg) scale(0);transition:.25s}
.agree input:checked + .box::after{transform:rotate(45deg) scale(1)}
.agree a{color:var(--ink);text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.fsubmit{width:100%}
.fsubmit.loading{pointer-events:none;opacity:.75}
.fsubmit.loading .btxt,.fsubmit.loading .arr{opacity:0}
.fsubmit.loading::after{content:"";position:absolute;width:18px;height:18px;border:2px solid var(--bg);border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.fnote{margin-top:16px;font-size:11px;color:var(--dgray);text-align:center;letter-spacing:.04em}
.fsuccess{text-align:center;padding:30px 10px}
.fsuccess h3{font-size:31px;margin-bottom:10px}
.fsuccess p{color:var(--gray);font-size:14.5px;max-width:380px;margin:0 auto 26px;line-height:1.75}
.fsuccess .btn{margin:6px auto 0}
footer{border-top:1px solid var(--line);padding:70px 0 0;background:var(--bg2)}
.fgrid{display:grid;grid-template-columns:1.4fr 1fr 1fr 1.2fr;gap:44px;padding-bottom:60px}
.fgrid h4{font:700 11px 'Manrope';letter-spacing:.24em;text-transform:uppercase;color:var(--gray);margin-bottom:20px}
.fgrid a{display:block;color:#4c4a46;text-decoration:none;font-size:14px;margin:10px 0;transition:color .3s,padding-left .4s}
.fgrid a:hover{color:var(--ink);padding-left:6px}
.fabout{color:var(--gray);font-size:14px;line-height:1.75;max-width:310px;margin-top:16px}
.fbrand .lmark{width:46px;height:55px}
.fbottom{border-top:1px solid var(--line);padding:22px 0;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--dgray)}
.fbottom a{color:#6e6a63;text-decoration:none;cursor:pointer;transition:color .3s}
.fbottom a:hover{color:var(--ink)}
.totop{position:fixed;right:26px;bottom:26px;width:50px;height:50px;border:1px solid var(--line);background:rgba(255,255,255,.9);backdrop-filter:blur(10px);color:var(--ink);cursor:pointer;z-index:55;display:grid;place-items:center;transition:background .4s,color .4s,border-color .4s,transform .4s}
.totop:hover{border-color:var(--ink);background:var(--ink);color:var(--bg);transform:translateY(-3px)}
.mbar{position:fixed;left:0;right:0;bottom:0;z-index:56;display:none;gap:10px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:rgba(246,244,239,.95);backdrop-filter:blur(14px);border-top:1px solid var(--line)}
.mbar a{flex:1;padding:15px 10px}
.mbar .mcall{flex:0 0 54px;padding:15px 0}
.modal{position:fixed;inset:0;background:rgba(18,18,18,.4);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:100}
.mcard{width:min(680px,92%);max-height:82vh;overflow:auto;background:var(--card);border:1px solid var(--line);padding:46px;position:relative;box-shadow:var(--shadow)}
.mcard h3{font-size:29px;margin-bottom:18px}
.mcard p{color:var(--gray);font-size:14px;line-height:1.8;margin-bottom:12px}
.mclose{position:absolute;top:18px;right:18px;width:40px;height:40px;background:none;border:1px solid var(--line);color:var(--ink);cursor:pointer;font-size:16px;transition:.3s}
.mclose:hover{border-color:var(--ink);background:var(--ink);color:var(--bg);transform:rotate(90deg)}
@media(max-width:1100px){
  .nav{display:none}.burger{display:block}.hphone{display:none}
  .hgrid{grid-template-columns:1fr;gap:60px}
  .hframe img{height:60vh}
  .cgrid,.sgrid,.nums{grid-template-columns:1fr 1fr}
  .steps{grid-template-columns:1fr 1fr;gap:40px}
  .rgrid{grid-template-columns:1fr;gap:60px}
  .fgrid{grid-template-columns:1fr 1fr}
  .calc{grid-template-columns:1fr}
}
@media(max-width:760px){
  html{scroll-padding-top:76px}
  body{padding-bottom:76px}
  .sec{padding:76px 0}
  .hero{padding:120px 0 80px}
  .hwrap{height:68px;gap:10px}
  #hd .btn-sm{display:none}
  .bname{font-size:17px}
  .bsub{letter-spacing:.18em}
  .lmark{width:28px;height:34px}
  .hgrid{gap:44px}
  .hframe img{height:50vh}
  .hbadge{left:0;bottom:14px;padding:10px 14px;font-size:10px}
  .hcta{flex-direction:column;align-items:stretch;gap:12px}
  .hcta .btn{width:100%}
  .btn{padding:16px 20px;font-size:11px;letter-spacing:.12em}
  .hstats{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  .hstats div{border-left:none;padding-left:0;border-top:1px solid var(--line);padding-top:12px}
  .geo{letter-spacing:.2em;font-size:10px}
  .shint{display:none}
  .otext{font-size:56px}
  .cgrid,.sgrid,.nums,.pgrid,.tgrid,.prins,.steps{grid-template-columns:1fr}
  .num-card{padding:28px 24px}
  .num-card .big{font-size:52px}
  .sfoot{flex-direction:column;align-items:flex-start;gap:12px}
  .slink{font-size:10px}
  .price{font-size:13px}
  .scard{padding:32px 24px}
  .scard h3{font-size:24px}
  .tcard{padding:32px 24px}
  .tcard h3{font-size:26px}
  .tmono{font-size:44px}
  .psum{font-size:34px}
  .ptag{left:24px}
  .pcard{padding:36px 26px}
  .gbar{padding:26px 22px}
  .gbar b{font-size:20px}
  .qa-q{font-size:16px;padding:22px 0;gap:14px}
  .qa-a p{padding-right:0}
  .fcard{padding:32px 20px}
  .frow select{font-size:15px}
  .rmess{flex-direction:column}
  .rmess .btn{width:100%}
  .rcontacts a{font-size:15px;word-break:break-word}
  .mnav a{font-size:26px}
  .fgrid{grid-template-columns:1fr;gap:30px}
  .mbar{display:flex}
  .totop{bottom:auto;top:14px;right:12px;width:44px;height:44px}
  .mcard{padding:34px 22px}
  .calc-left,.calc-right{padding:30px 22px}
  .cprice{font-size:44px}
}
@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{animation:none!important;transition:none!important}
  html{scroll-behavior:auto}
}
`;

const CLIENTS = [
  { t: "Малому и среднему бизнесу", d: "Когда штатный юрист не по карману, а вопросы есть каждый день.", l: ["Договоры и претензии", "Взыскание долгов", "Проверки и споры", "Кадровые вопросы"] },
  { t: "Поставщикам в закупках", d: "Участникам тендеров по 44-ФЗ и 223-ФЗ — от заявки до контракта.", l: ["Заявки под ключ", "Жалобы в ФАС", "Защита от РНП", "Споры по контрактам"] },
  { t: "УК, ТСЖ и подрядчикам ЖКХ", d: "Сфера ЖКХ — наша ежедневная практика: от предписаний ГЖИ до судов.", l: ["Споры с ГЖИ", "Работа с должниками", "Споры с собственниками", "Договоры с РСО"] },
  { t: "Частным лицам", d: "Гражданам, которым нужен юрист без лишних слов и переплат.", l: ["Договоры и сделки", "Споры с застройщиками", "Защита прав потребителей", "Претензии и иски"] }
];
const SERVICES = [
  { n: "01", t: "Тендеры и госзакупки", d: "44-ФЗ и 223-ФЗ под ключ: от анализа закупки до подписания контракта.", l: ["Подготовка и подача заявок", "Анализ закупки на скрытые риски", "Сопровождение контракта", "Обеспечение и банковские гарантии"], p: "от 7 700 ₽", base: 7700, per: "", svc: "Тендеры и госзакупки (44-ФЗ, 223-ФЗ)" },
  { n: "02", t: "ФАС и споры в закупках", d: "Защищаем участников закупок от необоснованных отказов и действий заказчиков.", l: ["Жалобы в ФАС", "Представительство на рассмотрениях", "Обжалование итогов тендеров", "Защита от включения в РНП"], p: "от 33 000 ₽", base: 33000, per: "", svc: "ФАС и споры в закупках" },
  { n: "03", t: "Юраутсорсинг бизнеса", d: "Штатный юрист не по карману? Мы закрываем правовые вопросы компании целиком.", l: ["Абонентское обслуживание", "Договоры и претензионная работа", "Кадровые документы", "Сопровождение проверок"], p: "от 24 200 ₽/мес", base: 24200, per: "/мес", svc: "Юридический аутсорсинг бизнеса" },
  { n: "04", t: "ЖКХ, УК и ТСЖ", d: "Сопровождаем управляющие организации и защищаем их в спорах с жителями и надзором.", l: ["Работа с ГЖИ и муниципалитетом", "Взыскание задолженности", "Споры с собственниками", "Договоры с ресурсоснабжающими организациями"], p: "от 13 200 ₽", base: 13200, per: "", svc: "ЖКХ, УК и ТСЖ" },
  { n: "05", t: "Арбитраж и суды", d: "Представляем интересы в арбитражных судах и судах общей юрисдикции.", l: ["Взыскание долгов и убытков", "Оспаривание сделок и решений", "Банкротство кредитора", "Возможна оплата за результат"], p: "от 49 500 ₽", base: 49500, per: "", svc: "Арбитраж и суды" },
  { n: "06", t: "Договоры и претензии", d: "Документы, которые работают на вас, а не против вас.", l: ["Разработка и аудит договоров", "Претензионная переписка", "Правовые заключения", "Сопровождение переговоров"], p: "от 4 400 ₽", base: 4400, per: "", svc: "Договоры и претензии" }
];
const NUMS = [
  { to: 6, suf: "", txt: "практик права — глубоко и ежедневно" },
  { to: 2, suf: "", txt: "основателя ведут каждое дело лично" },
  { to: 100, suf: " %", txt: "стоимость фиксируется в договоре" },
  { to: 2, suf: " ч", txt: "максимум — ответ на вашу заявку" },
  { to: 24, suf: "/7", txt: "приём заявок онлайн, без выходных" },
  { to: 0, suf: " ₽", txt: "первая консультация — бесплатно" }
];
const PLANS = [
  { name: "Старт", desc: "Разовая задача или консультация", sum: "от 4 400 ₽", small: "", hot: false, svc: "Другое / не знаю", l: ["Консультация юриста — 60 минут", "Разовый документ: договор, претензия", "Правовое заключение по вопросу", "Срок выполнения — от 1 рабочего дня", "Оплата по факту согласования объёма"] },
  { name: "Бизнес", desc: "Юридический отдел на аутсорсе", sum: "от 24 200 ₽", small: " / мес", hot: true, svc: "Юридический аутсорсинг бизнеса", l: ["Всё из тарифа «Старт»", "Безлимитные консультации", "Полный документооборот компании", "Кадровое сопровождение", "Персональный юрист на связи", "Скидка 20% на судебные дела"] },
  { name: "Тендер", desc: "Тендерный отдел под ключ", sum: "от 38 500 ₽", small: " / мес", hot: false, svc: "Тендеры и госзакупки (44-ФЗ, 223-ФЗ)", l: ["Всё из тарифа «Старт»", "Подбор и анализ закупок", "Заявки по 44-ФЗ и 223-ФЗ под ключ", "Жалобы в ФАС и представительство", "Контракты, обеспечение, сроки", "Ежемесячная отчётность по торгам"] }
];
const TEAM = [
  { n: "01", role: "Основатель · Начальник юридического отдела", t: "Суды, ЖКХ и сопровождение бизнеса", d: "Высшее юридическое образование. Руководит правовой практикой «ДоговорОфф»: арбитражные и гражданские споры, претензионная работа, абонентское обслуживание компаний и управляющих организаций.", l: ["Арбитраж и взыскание долгов", "Сопровождение УК, ТСЖ и подрядчиков ЖКХ", "Договорная работа и правовые заключения", "Споры с государственными органами"], f: ["Высшее юридическое", "Арбитраж и суды", "ЖКХ и УК", "Договоры"] },
  { n: "02", role: "Сооснователь · Начальник тендерного отдела", t: "Госзакупки, ФАС и контракты", d: "Высшее юридическое образование. Руководит закупочной практикой «ДоговорОфф»: полное сопровождение участия в торгах по 44-ФЗ и 223-ФЗ, жалобы и представительство в ФАС, финансовое моделирование заявок.", l: ["Заявки и тендерное сопровождение под ключ", "Жалобы в ФАС и обжалование итогов", "Защита от включения в РНП", "Контракты, обеспечение и банковские гарантии"], f: ["Высшее юридическое", "44-ФЗ / 223-ФЗ", "ФАС", "Контракты"] }
];
const STEPS = [
  { n: "01", t: "Заявка", d: "Вы оставляете заявку на сайте или звоните. В течение двух часов в рабочее время юрист связывается с вами.", s: "24/7 · бесплатно" },
  { n: "02", t: "Консультация", d: "Бесплатно разбираем ситуацию, оцениваем перспективы и честно говорим, есть ли смысл идти в спор.", s: "30 минут · очно или онлайн" },
  { n: "03", t: "Договор", d: "Фиксируем стоимость, сроки и состав работ. Никаких «допов» в процессе — цена не меняется.", s: "Цена фиксирована" },
  { n: "04", t: "Результат", d: "Работаем и держим вас в курсе на каждом шаге: отчёты, документы, статусы — в одном чате.", s: "Отчёт после каждого действия" }
];
const FAQ = [
  ["Сколько стоит консультацию?", "Первая консультация — бесплатно, до 30 минут, очно или онлайн. Дальнейшая работа оценивается по прайсу и фиксируется в договоре до начала оказания услуг."],
  ["Что происходит после отправки заявки?", "Заявка мгновенно приходит на почту компании, и в течение двух часов в рабочее время юрист связывается с вами: уточняет детали и назначает бесплатную консультацию. Данные заявки конфиденциальны."],
  ["Вы работаете с другими городами?", "Да. Офис находится в Нижневартовске, но тендерное сопровождение, договорная работа и консультации полностью ведутся онлайн по всей России. В судах ХМАО участвуем лично, в других регионах — совместно с партнёрами или по видеосвязи."],
  ["Гарантируете ли вы результат?", "Мы гарантируем честную оценку перспектив и качественную работу. Если дело бесперспективно — скажем об этом на первой консультации и не возьмём деньги за «борьбу ради борьбы». По ряду категорий возможна оплата за результат."],
  ["Как заключается договор и как платить?", "Договор подписываем электронно или очно. Оплата — по счёту или картой, для абонентов — ежемесячный платёж."],
  ["Можно ли оплатить в рассрочку?", "Да, по судебным делам возможна рассрочка: стоимость делится на этапы, оплата привязана к стадиям процесса. Условия фиксируем в договоре."],
  ["Сохранится ли конфиденциальность?", "Да. С первого обращения действует режим конфиденциальности, по запросу подписываем NDA. Документы хранятся в защищённом контуре, данные не передаются третьим лицам."]
];
const MARQUEE = ["Тендеры и госзакупки", "ФАС", "Арбитраж", "Юраутсорсинг", "ЖКХ и УК", "Договоры", "Претензии", "Банкротство"];

function Logo({ className }) {
  return (
    <svg className={className} viewBox="0 0 110 130" aria-hidden="true">
      <text x="55" y="116" textAnchor="middle" fontFamily="'Cormorant Garamond',Georgia,serif" fontWeight="600" fontSize="148" fill="currentColor">Д</text>
      <g fill="currentColor" stroke="var(--bg)" strokeWidth="6" strokeLinejoin="round">
        <g transform="rotate(-45 52 46)">
          <rect x="30" y="32" width="44" height="26" rx="7" />
          <rect x="22" y="36" width="8" height="18" rx="4" />
          <rect x="74" y="36" width="8" height="18" rx="4" />
          <rect x="47" y="56" width="9" height="54" rx="4.5" />
        </g>
        <rect x="24" y="88" width="30" height="7" rx="3.5" />
      </g>
    </svg>
  );
}
function Reveal({ children, delay = 0, x = 0, scale = 1, className = "", style }) {
  return (
    <motion.div className={className} style={style}
      initial={{ opacity: 0, y: 28, x, scale, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, x: 0, scale: 1, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: .9, ease: EASE, delay }}>
      {children}
    </motion.div>
  );
}
function Counter({ to, suf = "", duration = 1.8 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration, ease: EASE, onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref}>{v}<i>{suf}</i></span>;
}
function useAnimatedNumber(target) {
  const [val, setVal] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const c = animate(prev.current, target, { duration: .8, ease: EASE, onUpdate: (v) => setVal(Math.round(v)) });
    prev.current = target;
    return () => c.stop();
  }, [target]);
  return val;
}
function Magnetic({ href, className, children, onClick, type }) {
  const ref = useRef(null);
  const mx = useMotionValue(0), my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 120, damping: 16, mass: .5 });
  const sy = useSpring(my, { stiffness: 120, damping: 16, mass: .5 });
  const move = (e) => {
    if (window.matchMedia("(pointer:coarse)").matches) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left - r.width / 2) * .2);
    my.set((e.clientY - r.top - r.height / 2) * .28);
  };
  const leave = () => { mx.set(0); my.set(0); };
  const Tag = href ? motion.a : motion.button;
  return (
    <Tag ref={ref} href={href} type={type} onClick={onClick} className={className}
      style={{ x: sx, y: sy }} whileTap={{ scale: .97 }}
      onMouseMove={move} onMouseLeave={leave}>
      {children}
    </Tag>
  );
}
function maskPhone(raw) {
  let d = raw.replace(/\D/g, "");
  if (d.charAt(0) === "8") d = "7" + d.slice(1);
  if (d && d.charAt(0) !== "7") d = "7" + d;
  d = d.slice(0, 11);
  if (d === "7") return "";
  let r = "+7";
  if (d.length > 1) r += " (" + d.slice(1, 4);
  if (d.length >= 5) r += ") " + d.slice(4, 7);
  if (d.length >= 8) r += "-" + d.slice(7, 9);
  if (d.length >= 10) r += "-" + d.slice(9, 11);
  return r;
}
const fmt = (n) => n.toLocaleString("ru-RU");

export default function App() {
  const [intro, setIntro] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [barHide, setBarHide] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [svc, setSvc] = useState("");
  const [msg, setMsg] = useState("");
  const [agree, setAgree] = useState(false);
  const [bad, setBad] = useState({});
  const [agreeBad, setAgreeBad] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [fallbackHref, setFallbackHref] = useState(null);

  const [calcIdx, setCalcIdx] = useState(0);

  const heroRef = useRef(null);
  const reqRef = useRef(null);
  const reqInView = useInView(reqRef, { margin: "-15% 0px -15% 0px" });
  useEffect(() => setBarHide(reqInView), [reqInView]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setIntro(false); return; }
    const t = setTimeout(() => setIntro(false), 1500);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => { document.body.style.overflow = intro ? "hidden" : (menu || modal ? "hidden" : ""); }, [intro, menu, modal]);

  const { scrollYProgress } = useScroll();
  const barScale = useSpring(scrollYProgress, { stiffness: 120, damping: 22 });
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (v) => { setScrolled(v > 10); setShowTop(v > 600); });
  const heroScroll = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const imgY = useTransform(heroScroll.scrollYProgress, [0, 1], [0, 120]);

  const pickSvc = (v) => { setSvc(v); setBad((b) => ({ ...b, svc: false })); document.getElementById("request")?.scrollIntoView({ behavior: "smooth" }); };

  const calcSvc = SERVICES[calcIdx];
  const animPrice = useAnimatedNumber(calcSvc.base);

  const submit = (e) => {
    e.preventDefault();
    if (e.target.querySelector('input[name="company"]')?.value) return;
    const nb = { name: name.trim().length < 2, phone: phone.replace(/\D/g, "").length !== 11, svc: svc === "" };
    setBad(nb); setAgreeBad(!agree);
    if (nb.name || nb.phone || nb.svc || !agree) return;
    setLoading(true);
    const lead = { name: name.trim(), phone, service: svc, message: msg.trim() };
    fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: CONFIG.web3formsKey,
        subject: "Новая заявка с сайта ДоговорОфф",
        from_name: "Сайт ДоговорОфф",
        "Имя": lead.name, "Телефон": lead.phone, "Направление": lead.service, "Задача": lead.message || "—"
      })
    }).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then((j) => { if (j && j.success === false) throw new Error(); })
      .catch(() => {
        setFallbackHref("mailto:" + CONFIG.email + "?subject=" + encodeURIComponent("Заявка с сайта ДоговорОфф: " + lead.service) + "&body=" + encodeURIComponent("Имя: " + lead.name + "\nТелефон: " + lead.phone + "\nНаправление: " + lead.service + "\nЗадача: " + (lead.message || "—")));
      })
      .finally(() => { setLoading(false); setDone(true); });
  };
  const resetForm = () => { setDone(false); setFallbackHref(null); setName(""); setPhone(""); setSvc(""); setMsg(""); setAgree(false); };

  return (
    <>
      <style>{CSS}</style>

      <AnimatePresence>
        {intro && (
          <motion.div className="intro" key="intro" exit={{ y: "-100%" }} transition={{ duration: .8, ease: [0.7, 0, 0.3, 1] }}>
            <motion.div className="intro-in" initial={{ opacity: 0, scale: .92, filter: "blur(8px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} transition={{ duration: .8, ease: EASE }}>
              <Logo className="lmark intro-logo" />
              <div className="intro-name">ДоговорОфф</div>
              <div className="intro-sub">юридическая компания</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div className="progress" style={{ scaleX: barScale }} />

      <header id="hd" className={scrolled ? "scrolled" : ""}>
        <div className="hwrap">
          <a className="brand" href="#top">
            <Logo className="lmark" />
            <span className="bname">{CONFIG.brand}<span className="bsub">юридическая компания · Нижневартовск</span></span>
          </a>
          <nav className="nav">
            <a href="#clients">Клиенты</a><a href="#services">Услуги</a><a href="#calc">Калькулятор</a><a href="#pricing">Тарифы</a>
            <a href="#team">Команда</a><a href="#process">Процесс</a><a href="#faq">Вопросы</a>
          </nav>
          <div className="hright">
            <a className="hphone" href={CONFIG.phoneHref}>{CONFIG.phone}</a>
            <Magnetic href="#request" className="btn btn-g btn-sm"><span className="btxt">Оставить заявку</span></Magnetic>
            <button className={"burger" + (menu ? " open" : "")} aria-label="Меню" onClick={() => setMenu(!menu)}><span></span><span></span></button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menu && (
          <motion.nav className="mnav" initial={{ y: "-100%" }} animate={{ y: 0 }} exit={{ y: "-100%" }} transition={{ duration: .55, ease: [0.7, 0, 0.3, 1] }}>
            {[["#clients", "Клиенты"], ["#services", "Услуги"], ["#calc", "Калькулятор"], ["#pricing", "Тарифы"], ["#team", "Команда"], ["#process", "Процесс"], ["#faq", "Вопросы"], ["#request", "Оставить заявку"]].map(([h, t], i) => (
              <motion.a key={h} href={h} onClick={() => setMenu(false)} initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .15 + i * .05, duration: .5, ease: EASE }}>{t}</motion.a>
            ))}
            <a className="mphone" href={CONFIG.phoneHref}>{CONFIG.phone}</a>
          </motion.nav>
        )}
      </AnimatePresence>

      <main id="top">
        <section className="hero" ref={heroRef}>
          <div className="aurora" aria-hidden="true">
            <motion.span className="a1" animate={{ x: [0, 60, 0], y: [0, -40, 0] }} transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }} />
            <motion.span className="a2" animate={{ x: [0, -70, 0], y: [0, 30, 0] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }} />
            <motion.span className="a3" animate={{ x: [0, 40, 0], y: [0, 50, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }} />
          </div>
          <svg className="contours" viewBox="0 0 1200 220" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 160 C 150 110, 300 200, 460 150 S 760 90, 920 150 S 1120 190, 1200 140" fill="none" stroke="var(--ice)" strokeOpacity=".35" strokeWidth="1"/>
            <path d="M0 190 C 170 150, 320 220, 500 180 S 800 130, 980 180 S 1140 210, 1200 180" fill="none" stroke="var(--ice)" strokeOpacity=".22" strokeWidth="1"/>
            <path d="M0 120 C 140 80, 300 160, 470 115 S 780 60, 950 115 S 1130 150, 1200 105" fill="none" stroke="var(--ice)" strokeOpacity=".14" strokeWidth="1"/>
          </svg>
          <div className="wrap hgrid">
            <div className="hleft">
              <Reveal delay={.7}><span className="k">Юридическая компания · Нижневартовск · ХМАО</span></Reveal>
              <h1>
                <span className="ln"><motion.span className="ln-i" initial={{ y: "112%" }} animate={{ y: 0 }} transition={{ duration: 1.1, ease: EASE, delay: .85 }}>Защищаем бизнес.</motion.span></span>
                <span className="ln"><motion.span className="ln-i" initial={{ y: "112%" }} animate={{ y: 0 }} transition={{ duration: 1.1, ease: EASE, delay: 1 }}><em>Выигрываем</em> споры.</motion.span></span>
              </h1>
              <Reveal delay={1.1}><p className="lead">«ДоговорОфф» — тендеры и госзакупки, арбитраж, юридический аутсорсинг и сопровождение ЖКХ. Северный характер: спокойно, точно, надёжно.</p></Reveal>
              <Reveal delay={1.2} className="hcta">
                <Magnetic href="#request" className="btn btn-g"><span className="btxt">Получить консультацию</span><span className="arr">→</span></Magnetic>
                <Magnetic href="#calc" className="btn"><span className="btxt">Рассчитать стоимость</span></Magnetic>
              </Reveal>
              <Reveal delay={1.3} className="hstats">
                <div><b>0 ₽</b><span>первая консультация</span></div>
                <div><b>до 2 ч</b><span>ответ на заявку</span></div>
                <div><b>24/7</b><span>приём заявок онлайн</span></div>
              </Reveal>
              <Reveal delay={1.4}><div className="geo"><i>❄</i>{CONFIG.geo} · Нижневартовск</div></Reveal>
            </div>
            <Reveal delay={1.05} scale={.96} className="hright">
              <motion.div className="hclip" initial={{ clipPath: "inset(100% 0 0 0)" }} animate={{ clipPath: "inset(0 0 0 0)" }} transition={{ duration: 1.2, ease: EASE, delay: 1.05 }}>
                <div className="hframe">
                  <motion.img style={{ y: imgY }} src="https://image.qwenlm.ai/public_source/5a65b698-a4d8-42a4-a7fa-7b27fae0ed8f/11ef7ac18-ea4d-456c-b225-61a5d38b455e.png" alt="Офис юридической компании ДоговорОфф" />
                </div>
              </motion.div>
              <div className="hbadge"><span className="dot"></span>Приём заявок открыт</div>
            </Reveal>
          </div>
          <div className="shint" aria-hidden="true">
            <span>Листайте</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14m0 0l-6-6m6 6l6-6"/></svg>
          </div>
        </section>

        <div className="outline-mq" aria-hidden="true">
          <div className="otrack">
            {[0, 1].map((g) => (
              <div className="otext" key={g}>
                ДОГОВОР<b>ОФФ</b><i>❄</i>СЕВЕРНЫЙ ХАРАКТЕР<i>❄</i>НАДЁЖНОСТЬ В ДЕТАЛЯХ<i>❄</i>
              </div>
            ))}
          </div>
        </div>

        <section className="sec" id="clients">
          <div className="wrap">
            <Reveal className="shead">
              <div><span className="k">01 · Клиенты</span><h2>Кому мы помогаем</h2></div>
              <p>Мы работаем с теми, кому правовая ошибка стоит денег: от поставщика в тендере до управляющей компании.</p>
            </Reveal>
            <div className="cgrid">
              {CLIENTS.map((c, i) => (
                <Reveal key={c.t} delay={i * .08} className="ccard">
                  <h3>{c.t}</h3><p>{c.d}</p>
                  <ul>{c.l.map((x) => (<li key={x}>{x}</li>))}</ul>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <div className="marquee" aria-hidden="true">
          <div className="mtrack">
            {[0, 1].map((g) => (
              <div className="mgroup" key={g}>
                {MARQUEE.map((m) => (<React.Fragment key={m + g}><span>{m}</span><i>❄</i></React.Fragment>))}
              </div>
            ))}
          </div>
        </div>

        <section className="sec" id="services">
          <div className="wrap">
            <Reveal className="shead">
              <div><span className="k">02 · Услуги</span><h2>Практики компании</h2></div>
              <p>Шесть направлений, в которых мы работаем глубоко и ежедневно. Цена фиксируется в договоре до начала работы.</p>
            </Reveal>
            <div className="sgrid">
              {SERVICES.map((s, i) => (
                <Reveal key={s.n} delay={(i % 3) * .08} className="scard">
                  <div className="snum">/ {s.n}</div><h3>{s.t}</h3><p>{s.d}</p>
                  <ul>{s.l.map((x) => (<li key={x}>{x}</li>))}</ul>
                  <div className="sfoot"><span className="price">{s.p}</span><button className="slink" onClick={() => pickSvc(s.svc)}>Оставить заявку →</button></div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="sec" id="numbers">
          <div className="wrap">
            <Reveal className="shead">
              <div><span className="k">03 · Инфографика</span><h2>Компания в цифрах</h2></div>
              <p>Никаких «много лет опыта» — только факты, которые можно проверить.</p>
            </Reveal>
            <div className="nums">
              {NUMS.map((n, i) => (
                <Reveal key={n.txt} delay={(i % 3) * .08} className="num-card">
                  <div className="big"><Counter to={n.to} suf={n.suf} /></div>
                  <small>{n.txt}</small>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

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
                  {SERVICES.map((s, i) => (
                    <button key={s.n} className={"chip" + (calcIdx === i ? " on" : "")} onClick={() => setCalcIdx(i)}>{s.t}</button>
                  ))}
                </div>
              </div>
              <div className="calc-right">
                <span className="cl">Ориентировочная стоимость</span>
                <div className="cprice">от {fmt(animPrice)} ₽<small>{calcSvc.per ? " " + calcSvc.per : ""}</small></div>
                <p className="cnote">Расчёт предварительный. Точную сумму зафиксируем в договоре — и она не изменится.</p>
                <ul className="cinc">
                  {calcSvc.l.slice(0, 3).map((x) => (<li key={x}>{x}</li>))}
                </ul>
                <Magnetic className="btn" onClick={() => pickSvc(calcSvc.svc)}><span className="btxt">Получить точный расчёт</span><span className="arr">→</span></Magnetic>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="sec" id="pricing">
          <div className="wrap">
            <Reveal className="shead">
              <div><span className="k">05 · Тарифы</span><h2>Форматы работы</h2></div>
              <p>От разовой помощи до полноценного юридического отдела на аутсорсе. Стоимость фиксируется в договоре.</p>
            </Reveal>
            <div className="pgrid">
              {PLANS.map((p, i) => (
                <Reveal key={p.name} delay={i * .1} x={i === 0 ? -30 : i === 2 ? 30 : 0} scale={i === 1 ? .94 : 1} className={"pcard" + (p.hot ? " hot" : "")}>
                  {p.hot && <div className="ptag">Популярный выбор</div>}
                  <div className="pname">{p.name}</div>
                  <p className="pdesc">{p.desc}</p>
                  <div className="psum">{p.sum}<small>{p.small}</small></div>
                  <ul>{p.l.map((x) => (<li key={x}>{x}</li>))}</ul>
                  <Magnetic className={"btn " + (p.hot ? "btn-g" : "")} onClick={() => pickSvc(p.svc)}><span className="btxt">Выбрать формат</span>{p.hot && <span className="arr">→</span>}</Magnetic>
                </Reveal>
              ))}
            </div>
            <Reveal delay={.2}><p className="pnote">Нужен индивидуальный формат? Соберём пакет под вашу задачу — <a href="#request">опишите её в заявке</a>, и мы предложим условия.</p></Reveal>
          </div>
        </section>

        <section className="sec" id="team">
          <div className="wrap">
            <Reveal className="shead">
              <div><span className="k">06 · Команда</span><h2>Кто ведёт ваши дела</h2></div>
              <p>Без конвейера: вашу задачу ведут основатели компании лично. Каждый документ проходит через нас.</p>
            </Reveal>
            <div className="tgrid">
              {TEAM.map((t, i) => (
                <Reveal key={t.n} delay={i * .12} x={i === 0 ? -30 : 30} className="tcard">
                  <div className="tmono">{t.n}</div>
                  <div className="trole">{t.role}</div>
                  <h3>{t.t}</h3><p>{t.d}</p>
                  <ul>{t.l.map((x) => (<li key={x}>{x}</li>))}</ul>
                  <div className="tfacts">{t.f.map((x) => (<span key={x}>{x}</span>))}</div>
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

        <section className="sec" id="process">
          <div className="wrap">
            <Reveal className="shead">
              <div><span className="k">07 · Процесс</span><h2>Как мы работаем</h2></div>
              <p>Прозрачный маршрут от первого обращения до результата. Вы всегда знаете, что происходит с вашим делом.</p>
            </Reveal>
            <div className="steps">
              {STEPS.map((s, i) => (
                <Reveal key={s.n} delay={i * .1} className="pstep">
                  <motion.span className="pline" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1, ease: EASE, delay: i * .12 + .2 }} />
                  <motion.span className="pdot" initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 260, damping: 18, delay: i * .12 + .3 }} />
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

        <section className="sec" id="faq">
          <div className="wrap">
            <Reveal className="shead" style={{ justifyContent: "center", textAlign: "center" }}>
              <div style={{ margin: "0 auto" }}><span className="k" style={{ justifyContent: "center" }}>08 · Вопросы</span><h2>Частые вопросы</h2></div>
            </Reveal>
            <Reveal className="faqwrap">
              {FAQ.map(([q, a], i) => (
                <div className={"qa" + (openFaq === i ? " open" : "")} key={i}>
                  <button className="qa-q" aria-expanded={openFaq === i} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    <span>{q}</span><span className="qa-i"></span>
                  </button>
                  <AnimatePresence initial={false}>
                    {openFaq === i && (
                      <motion.div className="qa-a" key="a" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .5, ease: EASE }} style={{ overflow: "hidden" }}>
                        <p>{a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        <section className="sec" id="request" ref={reqRef}>
          <div className="wrap rgrid">
            <Reveal x={-30} className="rleft">
              <span className="k">09 · Заявка</span>
              <h2>Обсудим вашу задачу</h2>
              <p>Оставьте заявку — она придёт на почту компании, и юрист свяжется с вами, уточнит детали и предложит формат работы. Первая консультация бесплатна и ни к чему не обязывает.</p>
              <ul className="rlist">
                <li>Конфиденциально с первого сообщения</li>
                <li>Фиксированная стоимость в договоре</li>
                <li>Очно в Нижневартовске или онлайн по России</li>
                <li>Рассрочка на судебные дела</li>
              </ul>
              <div className="rcontacts">
                <a href={CONFIG.phoneHref}>{CONFIG.phone}</a>
                <a href={"mailto:" + CONFIG.email}>{CONFIG.email}</a>
                <span className="raddr">{CONFIG.address}</span>
                <span className="rhours">{CONFIG.hours}</span>
              </div>
              <div className="rmess">
                <Magnetic href={CONFIG.telegram} className="btn btn-sm">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.9 4.6c.3-1.4-.9-2.4-2.2-1.9L2.9 9.3c-1.5.6-1.4 2.7.1 3.2l4.2 1.3 1.6 4.9c.4 1.3 2 1.6 2.9.6l2.2-2.4 4.4 3.2c1.2.9 2.9.2 3.2-1.3l2.4-14.2zM9.4 13.2l8.1-5.1c.4-.2.7.3.4.6l-6.6 6.2-.3 3-1.6-4.7z"/></svg>
                  Telegram
                </Magnetic>
                <Magnetic href={CONFIG.max} className="btn btn-sm"><span className="maxlogo">MAX</span>MAX</Magnetic>
              </div>
            </Reveal>
            <Reveal x={30} delay={.1} className="rright">
              <div className="fcard">
                <AnimatePresence mode="wait" initial={false}>
                  {!done ? (
                    <motion.form key="f" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: .5, ease: EASE }} onSubmit={submit} noValidate>
                      <h3>Оставить заявку</h3>
                      <p className="fsub">Заполните форму — это займёт минуту. Заявка придёт на {CONFIG.email}</p>
                      <div className={"frow" + (bad.name ? " bad" : "")}>
                        <label>Ваше имя *</label>
                        <input value={name} onChange={(e) => { setName(e.target.value); setBad((b) => ({ ...b, name: false })); }} placeholder="Как к вам обращаться" autoComplete="name" />
                        <span className="fmsg">Укажите имя</span>
                      </div>
                      <div className={"frow" + (bad.phone ? " bad" : "")}>
                        <label>Телефон *</label>
                        <input value={phone} onChange={(e) => { setPhone(e.target.value.trim() === "" ? "" : maskPhone(e.target.value)); setBad((b) => ({ ...b, phone: false })); }} placeholder="+7 (___) ___-__-__" autoComplete="tel" />
                        <span className="fmsg">Введите номер полностью</span>
                      </div>
                      <div className={"frow" + (bad.svc ? " bad" : "")}>
                        <label>Направление *</label>
                        <select required value={svc} onChange={(e) => { setSvc(e.target.value); setBad((b) => ({ ...b, svc: false })); }}>
                          <option value="">Выберите направление</option>
                          {SERVICES.map((s) => (<option key={s.svc}>{s.svc}</option>))}
                          <option>Частный вопрос</option>
                          <option>Другое / не знаю</option>
                        </select>
                        <span className="fmsg">Выберите направление</span>
                      </div>
                      <div className="frow">
                        <label>Коротко о задаче</label>
                        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Пара предложений о ситуации — этого достаточно"></textarea>
                      </div>
                      <input className="hp" type="text" name="company" tabIndex="-1" autoComplete="off" />
                      <label className="agree">
                        <input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setAgreeBad(false); }} />
                        <span className="box"></span>
                        <span>Согласен на обработку персональных данных в соответствии с <a onClick={(e) => { e.preventDefault(); setModal(true); }}>политикой конфиденциальности</a> *</span>
                      </label>
                      {agreeBad && <span className="fmsg" style={{ position: "static", display: "block", margin: "-18px 0 18px", opacity: 1 }}>Необходимо согласие</span>}
                      <motion.button whileTap={{ scale: .98 }} type="submit" className={"btn btn-g fsubmit" + (loading ? " loading" : "")}><span className="btxt">Отправить заявку</span><span className="arr">→</span></motion.button>
                      <p className="fnote">Нажимая кнопку, вы получаете бесплатную консультацию юриста</p>
                    </motion.form>
                  ) : (
                    <motion.div key="s" className="fsuccess" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: .6, ease: EASE }}>
                      <svg viewBox="0 0 72 72" width="84" height="84" style={{ margin: "0 auto 26px", display: "block" }}>
                        <motion.circle cx="36" cy="36" r="34" fill="none" stroke="var(--ink)" strokeWidth="1.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: "easeOut" }} />
                        <motion.path d="M22 37l10 10 18-20" fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: .6, delay: .7 }} />
                      </svg>
                      <h3>Заявка принята</h3>
                      <p>Спасибо за доверие. Юрист свяжется с вами в течение двух часов в рабочее время.</p>
                      {fallbackHref && <a className="btn" href={fallbackHref} style={{ margin: "6px auto" }}>Продублировать письмом →</a>}
                      <motion.button whileTap={{ scale: .98 }} className="btn" onClick={resetForm} style={{ margin: "6px auto 0" }}>Отправить ещё одну</motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <div className="fgrid">
            <div>
              <a className="brand fbrand" href="#top">
                <Logo className="lmark" />
                <span className="bname">{CONFIG.brand}<span className="bsub">юридическая компания</span></span>
              </a>
              <p className="fabout">Юридическая компания «ДоговорОфф» для бизнеса и частных лиц: тендеры, арбитраж, аутсорсинг, ЖКХ. Северный характер: спокойно, точно, надёжно.</p>
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
              <a href={"mailto:" + CONFIG.email}>{CONFIG.email}</a>
              <a href="#request">{CONFIG.address}</a>
              <a href="#request">{CONFIG.hours}</a>
            </div>
          </div>
          <div className="fbottom">
            <span>© {new Date().getFullYear()} Юридическая компания «ДоговорОфф» · {CONFIG.geo}. Не является публичной офертой.</span>
            <a onClick={() => setModal(true)}>Политика конфиденциальности</a>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {showTop && (
          <motion.button className="totop" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} whileHover={{ y: -3 }} whileTap={{ scale: .94 }} aria-label="Наверх" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5m0 0l-6 6m6-6l6 6" /></svg>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!barHide && (
          <motion.div className="mbar" initial={{ y: "110%" }} animate={{ y: 0 }} exit={{ y: "110%" }} transition={{ duration: .45, ease: EASE }}>
            <a className="btn mcall" href={CONFIG.phoneHref} aria-label="Позвонить">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
            </a>
            <a href="#request" className="btn btn-g">Оставить заявку</a>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal && (
          <motion.div className="modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .35 }} onClick={(e) => { if (e.target === e.currentTarget) setModal(false); }}>
            <motion.div className="mcard" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} transition={{ duration: .4, ease: EASE }}>
              <button className="mclose" aria-label="Закрыть" onClick={() => setModal(false)}>✕</button>
              <h3>Политика конфиденциальности</h3>
              <p>1. Оставляя заявку на сайте, вы предоставляете согласие на обработку персональных данных: имя, номер телефона и текст обращения.</p>
              <p>2. Данные используются исключительно для связи с вами по вашему обращению и не передаются третьим лицам, за исключением случаев, предусмотренных законодательством РФ.</p>
              <p>3. Обработка данных осуществляется в соответствии с Федеральным законом № 152-ФЗ «О персональных данных».</p>
              <p>4. Вы можете отозвать согласие в любой момент, направив запрос на {CONFIG.email}.</p>
              <p>5. Сайт использует файлы cookie для корректной работы и аналитики посещаемости.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
