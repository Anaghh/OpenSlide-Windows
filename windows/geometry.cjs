'use strict';
function inCorner(point, bounds, corner, size = 14) {
  if (corner === 'top-center') return point.y >= bounds.y && point.y < bounds.y + size && Math.abs(point.x - (bounds.x + bounds.width / 2)) < 70;
  const right = corner.endsWith('right'), bottom = corner.startsWith('bottom');
  return point.x >= (right ? bounds.x + bounds.width - size : bounds.x) && point.x < (right ? bounds.x + bounds.width : bounds.x + size)
    && point.y >= (bottom ? bounds.y + bounds.height - size : bounds.y) && point.y < (bottom ? bounds.y + bounds.height : bounds.y + size);
}
function panelBounds(workArea, preferences) {
  const top = preferences.corner.startsWith('top');
  const width = Math.round(Math.min(top ? 640 : Math.min(preferences.width, 380), workArea.width - 24));
  const height = Math.round(Math.min(top ? (preferences.compact ? 320 : 380) : (preferences.compact ? 460 : 540), workArea.height * (top ? .5 : .72), workArea.height - 24));
  return { x: preferences.corner === 'top-center' ? Math.round(workArea.x + (workArea.width - width) / 2) : preferences.corner.endsWith('right') ? workArea.x + workArea.width - width - 12 : workArea.x + 12,
    y: preferences.corner.startsWith('bottom') ? workArea.y + workArea.height - height - 12 : workArea.y + 12, width, height };
}
module.exports = { inCorner, panelBounds };
