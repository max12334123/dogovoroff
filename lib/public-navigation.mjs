export const AI_PRECHECK_HREF = "/?mode=precheck#lead-form";
export const LEAD_FORM_HREF = "/#lead-form";

export function getRequestModeFromSearch(search = "") {
  const params = new URLSearchParams(search);
  return params.get("mode") === "precheck" ? "precheck" : "quick";
}
