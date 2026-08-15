const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function getIceMotion(clientX, clientY, rect) {
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return { rotateX: 0, rotateY: 0, x: 0, y: 0, lightX: 0, lightY: 0 };
  }

  const normalizedX = clamp(((clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
  const normalizedY = clamp(((clientY - rect.top) / rect.height) * 2 - 1, -1, 1);

  return {
    rotateX: normalizedY === 0 ? 0 : normalizedY * -1.25,
    rotateY: normalizedX * 1.7,
    x: normalizedX * 4.5,
    y: normalizedY * 3,
    lightX: normalizedX * 2.5,
    lightY: normalizedY * 1.8,
  };
}
