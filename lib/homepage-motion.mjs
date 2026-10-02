// Each composition holds for reading before a short eased transition.
// No scroll interception: the final chapter also owns a full scroll interval.
export function chapterPosition(progress, count) {
  if (count < 2) return 0;
  const raw = Math.max(0, Math.min(1, Number(progress) || 0)) * count;
  const current = Math.min(count - 1, Math.floor(raw));
  if (current === count - 1) return current;
  const t = Math.max(0, Math.min(1, (raw - current - .62) / .38));
  return current + t * t * (3 - 2 * t);
}

export function chapterIndex(progress, count) {
  return Math.round(chapterPosition(progress, count));
}

export function chapterProgress(sectionTop, sectionHeight, viewportHeight, scrollTop) {
  const distance = sectionHeight - viewportHeight;
  if (distance <= 0) return 0;
  return Math.max(0, Math.min(1, (scrollTop - sectionTop) / distance));
}

export function chapterScrollTop(sectionTop, sectionHeight, viewportHeight, index, count) {
  const fraction = count > 1 ? Math.max(0, Math.min(count - 1, index)) / count : 0;
  return sectionTop + Math.max(0, sectionHeight - viewportHeight) * fraction;
}
