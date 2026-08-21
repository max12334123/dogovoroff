export function getNextTabIndex(key, currentIndex, itemCount) {
  if (!Number.isInteger(currentIndex) || !Number.isInteger(itemCount) || itemCount < 1) return null;

  if (key === "Home") return 0;
  if (key === "End") return itemCount - 1;
  if (key === "ArrowRight" || key === "ArrowDown") return (currentIndex + 1) % itemCount;
  if (key === "ArrowLeft" || key === "ArrowUp") return (currentIndex - 1 + itemCount) % itemCount;

  return null;
}
