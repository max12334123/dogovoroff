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

export default function CaptchaWidget({ config, onTokenChange, onStatusChange }) {
  const provider = config?.enabled ? config.provider : "";
  const siteKey = config?.enabled ? config.siteKey : "";
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [renderAttempt, setRenderAttempt] = useState(0);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("Подтвердите, что вы человек.");
  const retryTimerRef = useRef(null);

  const updateToken = useCallback((value) => {
    const nextToken = getCaptchaToken(value);
    setToken(nextToken);
    onTokenChange?.(nextToken);
    const nextStatus = nextToken ? "Проверка пройдена." : "Проверка не пройдена. Повторите её.";
    setStatus(nextStatus);
    onStatusChange?.(nextStatus);
  }, [onStatusChange, onTokenChange]);

  const updateStatus = useCallback((nextStatus) => {
    setStatus(nextStatus);
    onStatusChange?.(nextStatus);
  }, [onStatusChange]);

  const renderWidget = useCallback(() => {
    const api = getProviderApi(provider);
    if (!api?.render || !containerRef.current || widgetIdRef.current !== null) {
      return false;
    }

    try {
      widgetIdRef.current = api.render(containerRef.current, {
        sitekey: siteKey,
        callback: (value) => {
          updateToken(value);
        },
        "expired-callback": () => {
          updateToken("");
          updateStatus("Проверка истекла. Повторите её.");
        },
        "error-callback": () => {
          updateToken("");
          updateStatus("Проверка временно недоступна. Попробуйте ещё раз.");
        },
      });
      updateStatus("Подтвердите, что вы человек.");
      return true;
    } catch {
      updateToken("");
      updateStatus("Проверка временно недоступна. Попробуйте ещё раз.");
      return false;
    }
  }, [provider, siteKey, updateStatus, updateToken]);

  useEffect(() => {
    if (!scriptReady) {
      return undefined;
    }

    let attempts = 0;
    const tryRender = () => {
      if (renderWidget() || attempts >= 30) {
        if (attempts >= 30 && widgetIdRef.current === null) {
          updateStatus("Проверка временно недоступна. Попробуйте ещё раз.");
        }
        retryTimerRef.current = null;
        return;
      }

      attempts += 1;
      retryTimerRef.current = window.setTimeout(tryRender, 100);
    };

    tryRender();
    return () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [renderAttempt, renderWidget, scriptReady, updateStatus]);

  useEffect(() => {
    return () => {
      const api = getProviderApi(provider);
      if (api?.remove && widgetIdRef.current !== null) {
        api.remove(widgetIdRef.current);
      }
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
      }
      widgetIdRef.current = null;
      onTokenChange?.("");
    };
  }, [onTokenChange, provider]);

  const resetWidget = () => {
    const api = getProviderApi(provider);
    if (api?.reset && widgetIdRef.current !== null) {
      api.reset(widgetIdRef.current);
    } else {
      // A failed script load leaves no widget id. Bump the attempt so the
      // effect retries rendering instead of leaving the form permanently
      // disabled after a transient provider/network error.
      setScriptReady(true);
      setRenderAttempt((current) => current + 1);
    }
    updateToken("");
    updateStatus("Подтвердите, что вы человек.");
  };

  if (!provider || !siteKey || !SCRIPT_URLS[provider]) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <Script
        src={SCRIPT_URLS[provider]}
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => {
          updateToken("");
          updateStatus("Проверка временно недоступна. Попробуйте ещё раз.");
        }}
      />
      <div ref={containerRef} className={styles.container} aria-label="Проверка безопасности" />
      <input type="hidden" name="captchaToken" value={token} readOnly />
      <p className={styles.status} role="status" aria-live="polite">{status}</p>
      <button className={styles.retry} type="button" onClick={resetWidget}>Повторить проверку</button>
    </div>
  );
}
