export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

export function GET() {
  return Response.json({ status: "ok", service: "dogovoroff" }, { headers });
}

export function HEAD() {
  return new Response(null, { status: 200, headers });
}
