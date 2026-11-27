// Paper Figure 6(b), 242 held-out tasks, five trials per task.
const scalingPoints = [
  { label: "SFT", success: 38.01652892561984, color: "#8194a9" },
  { label: "16", success: 45.70247933884298, interval: [40.82644628099173, 50.66115702479339], color: "#4b918b" },
  { label: "64", success: 53.71900826446281, interval: [48.760330578512395, 58.84297520661157], color: "#557faf" },
  { label: "256", success: 62.231404958677686, interval: [57.27272727272727, 67.27272727272727], color: "#ce8545" }
];
const scalingCanvas = document.querySelector("#scaling-curve");
const replayScaling = document.querySelector(".chart-replay");
const scalingContext = scalingCanvas.getContext("2d");
const scalingMotion = matchMedia("(prefers-reduced-motion: reduce)");
let scalingFrame;
let scalingProgress = 1;

function drawScaling(progress) {
  const width = scalingCanvas.clientWidth;
  const height = scalingCanvas.clientHeight;
  if (!width || !height || !scalingContext) return;

  const ctx = scalingContext;
  const ratio = Math.min(devicePixelRatio, 3);
  const pixelsWide = Math.round(width * ratio);
  const pixelsHigh = Math.round(height * ratio);
  if (scalingCanvas.width !== pixelsWide || scalingCanvas.height !== pixelsHigh) {
    scalingCanvas.width = pixelsWide;
    scalingCanvas.height = pixelsHigh;
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);

  const compact = width < 420;
  const left = compact ? 36 : 51;
  const right = width - (compact ? 15 : 22);
  const top = 27;
  const bottom = height - 48;
  const plotWidth = right - left;
  const plotX = fraction => left + plotWidth * fraction;
  const plotY = value => bottom - (value - 20) * (bottom - top) / 60;
  const points = scalingPoints.map((point, index) => ({
    ...point,
    x: plotX(index === 0 ? .095 : .34 + (index - 1) * .275),
    y: plotY(point.success)
  }));
  const dividingX = plotX(.2175);
  const last = points.at(-1);
  const revealedX = points[0].x + (last.x - points[0].x) * progress;

  function text(value, x, y, { align = "left", color = "#526175", size = compact ? 11 : 13, weight = 500 } = {}) {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px system-ui, sans-serif`;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  }
  function rule(x1, y1, x2, y2, color) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  for (let rate = 20; rate <= 80; rate += 10) {
    const y = plotY(rate);
    rule(left, y, right, y, rate === 20 ? "#91a1b1" : "#e0e6ec");
    text(`${rate}%`, left - 7, y + 4, { align: "right" });
  }
  ctx.setLineDash([3, 4]);
  rule(dividingX, top, dividingX, bottom, "#aebfce");
  ctx.setLineDash([]);
  text("Success rate", left, 16, { color: "#33475d", size: compact ? 11 : 12, weight: 650 });
  text("RL", dividingX + 7, top + 14, { size: compact ? 9 : 11 });
  points.forEach(point => text(point.label, point.x, bottom + 17, { align: "center", weight: 600 }));
  text("RL training tasks (log scale)", (points[1].x + last.x) / 2, height - 8, { align: "center" });

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top - 5, Math.max(0, revealedX - left + 1), bottom - top + 10);
  ctx.clip();
  const rl = points.slice(1);
  ctx.beginPath();
  rl.forEach(({ x, interval }, i) => {
    if (i === 0) ctx.moveTo(x, plotY(interval[1]));
    else ctx.lineTo(x, plotY(interval[1]));
  });
  rl.slice().reverse().forEach(({ x, interval }) => ctx.lineTo(x, plotY(interval[0])));
  ctx.closePath();
  ctx.fillStyle = "#dce9f5";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
  ctx.strokeStyle = "#456681";
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();

  points.filter(point => point.x <= revealedX + .5).forEach((point, index) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, compact ? 4 : 5, 0, Math.PI * 2);
    ctx.fillStyle = index === 0 ? "#fff" : point.color;
    ctx.strokeStyle = point.color;
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    text(`${point.success.toFixed(2)}%`, point.x, point.y - (compact ? 10 : 13), {
      align: "center", color: "#213a55", weight: 680, size: compact ? 11 : 14
    });
  });
}

function animateScaling() {
  cancelAnimationFrame(scalingFrame);
  scalingCanvas.dataset.animation = "playing";
  const start = performance.now();
  const duration = 1900;
  function tick(now) {
    const elapsed = Math.min((now - start) / duration, 1);
    scalingProgress = elapsed * elapsed * (3 - 2 * elapsed);
    drawScaling(scalingProgress);
    if (elapsed < 1) scalingFrame = requestAnimationFrame(tick);
    else scalingCanvas.dataset.animation = "complete";
  }
  scalingFrame = requestAnimationFrame(tick);
}

if (scalingContext) {
  scalingCanvas.hidden = false;
  document.querySelector("#scaling-still").hidden = true;
  replayScaling.hidden = false;
  drawScaling(1);
  new ResizeObserver(() => drawScaling(scalingProgress)).observe(scalingCanvas);
  replayScaling.addEventListener("click", animateScaling);
  scalingMotion.addEventListener("change", event => {
    if (!event.matches) return;
    cancelAnimationFrame(scalingFrame);
    scalingProgress = 1;
    drawScaling(1);
    scalingCanvas.dataset.animation = "complete";
  });
  const firstReveal = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    firstReveal.disconnect();
    if (!scalingMotion.matches) animateScaling();
  }, { threshold: .55 });
  firstReveal.observe(scalingCanvas);
}
