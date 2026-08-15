export function maskPhone(raw) {
  let digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (digits && !digits.startsWith("7")) digits = `7${digits}`;
  digits = digits.slice(0, 11);
  if (digits === "7") return "";

  let result = "+7";
  if (digits.length > 1) result += ` (${digits.slice(1, 4)}`;
  if (digits.length >= 5) result += `) ${digits.slice(4, 7)}`;
  if (digits.length >= 8) result += `-${digits.slice(7, 9)}`;
  if (digits.length >= 10) result += `-${digits.slice(9, 11)}`;
  return result;
}

export function validateLead({ name, phone, service, agree }) {
  return {
    name: String(name).trim().length < 2,
    phone: String(phone).replace(/\D/g, "").length !== 11,
    service: String(service).trim().length === 0,
    agree: agree !== true,
  };
}
