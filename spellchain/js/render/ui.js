/** Shared screen-space drawing helpers for HUD and class hotbars. */

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function slotBackground(g, x, y, s, highlighted = false) {
  g.fillStyle = 'rgba(15,20,32,.8)';
  g.strokeStyle = highlighted ? 'rgba(165,180,252,.9)' : 'rgba(148,163,184,.3)';
  g.lineWidth = highlighted ? 2.5 : 1.5;
  roundRect(g, x, y, s, s, 10);
  g.fill();
  g.stroke();
}
