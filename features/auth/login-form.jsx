"use client";

import { useCallback, useState } from "react";
import { useFormStatus } from "react-dom";
import { requestLoginLink } from "../../app/login/actions";
import CaptchaWidget from "./captcha-widget";
import styles from "../../app/login/login.module.css";

function SubmitButton({ captchaEnabled, hasCaptchaToken }) {
  const { pending } = useFormStatus();
  const disabled = pending || (captchaEnabled && !hasCaptchaToken);

  return (
    <button type="submit" disabled={disabled}>
      {pending ? "Отправляем…" : "Получить ссылку"}
    </button>
  );
}

export default function LoginForm({ next, errorMessage, captchaConfig }) {
  const [captchaToken, setCaptchaToken] = useState("");
  const handleTokenChange = useCallback((value) => setCaptchaToken(value), []);

  return (
    <form className={styles.form} action={requestLoginLink}>
      <input type="hidden" name="next" value={next} />
      <label htmlFor="login-email">Email</label>
      <input
        id="login-email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        maxLength={254}
        placeholder="name@example.ru"
        required
        aria-describedby={errorMessage ? "login-error login-note" : "login-note"}
      />
      {errorMessage && <p className={styles.error} id="login-error" role="alert">{errorMessage}</p>}
      <CaptchaWidget config={captchaConfig} onTokenChange={handleTokenChange} />
      <SubmitButton captchaEnabled={captchaConfig?.enabled === true} hasCaptchaToken={Boolean(captchaToken)} />
      <p className={styles.note} id="login-note">
        Если аккаунта ещё нет, он будет создан после подтверждения email. Доступ к делам назначается отдельно.
      </p>
    </form>
  );
}
