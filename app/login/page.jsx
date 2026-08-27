import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSafeNextPath } from "../../features/auth/auth-domain.mjs";
import { createClient } from "../../lib/supabase/server";
import { requestLoginLink } from "./actions";
import styles from "./login.module.css";

export const metadata = {
  title: "Вход в личный кабинет",
  description: "Регистрация и вход в личный кабинет ДоговорОфф по подтверждённому email.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

const ERROR_MESSAGES = {
  "invalid-email": "Проверьте адрес электронной почты.",
  "send-failed": "Не удалось отправить письмо. Попробуйте ещё раз немного позже.",
  "confirm-failed": "Ссылка недействительна или уже истекла. Запросите новую.",
};

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const next = getSafeNextPath(params?.next);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims?.sub) {
    redirect(next);
  }

  const sent = params?.sent === "1";
  const errorMessage = ERROR_MESSAGES[params?.error] ?? "";

  return (
    <main className={styles.page}>
      <div className={styles.atmosphere} aria-hidden="true" />
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="ДоговорОфф — вернуться на сайт">
          <Image src="/media/dogovoroff-mark.png" alt="" width={64} height={64} priority />
          <span>ДоговорОфф</span>
        </Link>
        <Link className={styles.backLink} href="/">Вернуться на сайт</Link>
      </header>

      <section className={styles.card} aria-labelledby="login-title">
        <p className={styles.eyebrow}>Личный кабинет</p>
        <h1 id="login-title"><span>Войти или</span><span>зарегистрироваться</span></h1>
        <p className={styles.lead}>
          Укажите email. Мы отправим одноразовую ссылку — пароль придумывать не нужно.
        </p>

        {sent ? (
          <div className={styles.notice} role="status">
            <strong>Письмо отправлено</strong>
            <p>Откройте ссылку в письме. Если его нет, проверьте папку «Спам» или запросите ссылку повторно через минуту.</p>
            <Link href={`/login?next=${encodeURIComponent(next)}`}>Указать другой email</Link>
          </div>
        ) : (
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
            <button type="submit">Получить ссылку</button>
            <p className={styles.note} id="login-note">
              Если аккаунта ещё нет, он будет создан после подтверждения email. Доступ к делам назначается отдельно.
            </p>
          </form>
        )}

        <div className={styles.securityNote}>
          <span>Приватный доступ</span>
          <p>Регистрация не открывает чужие дела и документы. Каждый запрос дополнительно проверяется на уровне базы данных.</p>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Нижневартовск · Работаем по России</span>
        <Link href="/privacy">Конфиденциальность</Link>
      </footer>
    </main>
  );
}
