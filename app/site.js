const FALLBACK_SITE_URL = "https://dogovoroff.vercel.app";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE_URL).replace(/\/$/, "");
export const SITE_NAME = "ДоговорОфф";
export const SITE_TITLE = "ДоговорОфф — юридическая компания в Нижневартовске";
export const SITE_DESCRIPTION =
  "Юридическая помощь бизнесу и частным лицам: тендеры, ФАС, арбитраж, аутсорсинг, ЖКХ, договоры и претензии.";
