import { getCaptchaConfig, getCaptchaCspOrigins } from "./features/auth/captcha-domain.mjs";

/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV === "development";

function getAllowedConnectOrigins() {
  const values = [process.env.NEXT_PUBLIC_SUPABASE_URL];
  return values.flatMap((value) => {
    if (!value) return [];
    try {
      return [new URL(value).origin];
    } catch {
      return [];
    }
  });
}

const captchaOrigins = getCaptchaCspOrigins(getCaptchaConfig());
const connectOrigins = [...new Set([...getAllowedConnectOrigins(), ...captchaOrigins.connect])];
const scriptOrigins = captchaOrigins.script;
const frameOrigins = captchaOrigins.frame;

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}${scriptOrigins.length ? ` ${scriptOrigins.join(" ")}` : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${connectOrigins.length ? ` ${connectOrigins.join(" ")}` : ""}`,
  `frame-src 'self'${frameOrigins.length ? ` ${frameOrigins.join(" ")}` : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
