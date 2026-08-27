"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCaptchaToken } from "./captcha-domain.mjs";
import styles from "./captcha.module.css";

const SCRIPT_URLS = {
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
  hcaptcha: "https://js.hcaptcha.com/1/api.js?render=explicit",
};

function getProviderApi(provider) {
  if (typeof window === "undefined") {
    return null;
  }

  return provider === "turnstile" ? window.turnstile : window.hcaptcha;
}

export default function CaptchaWidget({ config }) {
  const provider = config?.enabled ? config.provider : "";
  const siteKey = config?.enabled ? config.siteKey : "";
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("Подтвердите, что вы человек.");

  const renderWidget = useCallback(() => {
    const api = getProviderApi(provider);
    if (!api?.render || !containerRef.current || widgetIdRef.current !== null) {
      return;
    }

    try {
      widgetIdRef.current = api.render(containerRef.current, {
        sitekey: siteKey,
        callback: (value) => {
          const nextToken = getCaptchaToken(value);
          setToken(nextToken);
          setStatus(nextToken ? "Проверка пройдена." : "Проверка не пройдена. Повторите её.");
        },
        "expired-callback": () => {
          setToken("");
          setStatus("Проверка истекла. Повторите её.");
        },
        "error-callback": () => {
          setToken("");
          setStatus("Проверка временно недоступна. Попробуйте ещё раз.");
        },
      });
      setStatus("Подтвердите, что вы человек.");
    } catch {
      setStatus("Проверка временно недоступна. Попробуйте ещё раз.");
    }
  }, [provider, siteKey]);

  useEffect(() => {
    if (!scriptReady) {
      return undefined;
    }

    renderWidget();
    return undefined;
  }, [renderWidget, scriptReady]);

  useEffect(() => {
    return () => {
      const api = getProviderApi(provider);
      if (api?.remove && widgetIdRef.current !== null) {
        api.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [provider]);

  if (!provider || !siteKey || !SCRIPT_URLS[provider]) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <Script
        src={SCRIPT_URLS[provider]}
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => setStatus("Проверка временно недоступна. Попробуйте ещё раз.")}
      />
      <div ref={containerRef} className={styles.container} aria-label="Проверка безопасности" />
      <input type="hidden" name="captchaToken" value={token} readOnly />
      <p className={styles.status} role="status" aria-live="polite">{status}</p>
    </div>
  );
}
