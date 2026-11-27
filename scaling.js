// Frozen real-robot evaluation on 242 held-out tasks, five trials per policy and task.
const scalingPoints = [
  { label: "SFT", success: 38.01652892561984, color: "#8194a9" },
  { label: "16", success: 45.70247933884298, interval: [40.82644628099173, 50.66115702479339], color: "#4b918b" },
  { label: "64", success: 53.71900826446281, interval: [48.760330578512395, 58.84297520661157], color: "#557faf" },
  { label: "256", success: 62.231404958677686, interval: [57.27272727272727, 67.27272727272727], color: "#ce8545" }
];
// Arithmetic means of recorded durations among the 460, 553, 650, and 753 successful trials.
const executionMeans = [12.779565217391305, 9.324773960216998, 8.441230769230769, 7.5406374501992035];
const scalingMotion = matchMedia("(prefers-reduced-motion: reduce)");

function drawScaling(canvas, ctx, chart, progress) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;

  const ratio = Math.min(devicePixelRatio, 3);
  const pixelsWide = Math.round(width * ratio);
  const pixelsHigh = Math.round(height * ratio);
  if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
    canvas.width = pixelsWide;
    canvas.height = pixelsHigh;
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
  const plotY = value => bottom - (value - chart.min) * (bottom - top) / (chart.max - chart.min);
  const points = chart.points.map((point, index) => ({
    ...point,
    x: plotX(index === 0 ? .095 : .34 + (index - 1) * .275),
    y: plotY(point.value)
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

  for (let value = chart.min; value <= chart.max; value += chart.tick) {
    const y = plotY(value);
    rule(left, y, right, y, value === chart.min ? "#91a1b1" : "#e0e6ec");
    text(chart.tickLabel(value), left - 7, y + 4, { align: "right" });
  }
  ctx.setLineDash([3, 4]);
  rule(dividingX, top, dividingX, bottom, "#aebfce");
  ctx.setLineDash([]);
  text(chart.axisLabel, left, 16, { color: "#33475d", size: compact ? 11 : 12, weight: 650 });
  text("RL", dividingX + 7, top + 14, { size: compact ? 9 : 11 });
  points.forEach(point => text(point.label, point.x, bottom + 17, { align: "center", weight: 600 }));
  text("RL training tasks (log scale)", (points[1].x + last.x) / 2, height - 8, { align: "center" });

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top - 5, Math.max(0, revealedX - left + 1), bottom - top + 10);
  ctx.clip();

  const intervals = points.filter(point => point.interval);
  if (intervals.length) {
    ctx.beginPath();
    ctx.moveTo(intervals[0].x, plotY(intervals[0].interval[1]));
    intervals.slice(1).forEach(({ x, interval }) => ctx.lineTo(x, plotY(interval[1])));
    intervals.reverse().forEach(({ x, interval }) => ctx.lineTo(x, plotY(interval[0])));
    ctx.closePath();
    ctx.fillStyle = "#dce9f5";
    ctx.fill();
  }

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
    text(chart.pointLabel(point.value), point.x, point.y - (compact ? 10 : 13), {
      align: "center", color: "#213a55", weight: 680, size: compact ? 11 : 14
    });
  });
}

function mountScalingChart(canvasId, stillId, chart) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas?.getContext("2d");
  if (!ctx) return;
  const replay = canvas.closest(".chart").querySelector(".chart-replay");
  let frame;
  let progress = 1;
  const draw = () => drawScaling(canvas, ctx, chart, progress);

  function animate() {
    if (scalingMotion.matches) return;
    cancelAnimationFrame(frame);
    canvas.dataset.animation = "playing";
    const start = performance.now();
    const duration = 1900;
    function tick(now) {
      const elapsed = Math.min((now - start) / duration, 1);
      progress = elapsed * elapsed * (3 - 2 * elapsed);
      draw();
      if (elapsed < 1) frame = requestAnimationFrame(tick);
      else canvas.dataset.animation = "complete";
    }
    frame = requestAnimationFrame(tick);
  }

  canvas.hidden = false;
  document.getElementById(stillId).hidden = true;
  replay.hidden = scalingMotion.matches;
  draw();
  new ResizeObserver(draw).observe(canvas);
  replay.addEventListener("click", animate);
  scalingMotion.addEventListener("change", event => {
    replay.hidden = event.matches;
    if (!event.matches) return;
    cancelAnimationFrame(frame);
    progress = 1;
    draw();
    canvas.dataset.animation = "complete";
  });
  const firstReveal = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    firstReveal.disconnect();
    animate();
  }, { threshold: .55 });
  firstReveal.observe(canvas);
}

mountScalingChart("scaling-curve", "scaling-still", {
  points: scalingPoints.map(point => ({ ...point, value: point.success })),
  axisLabel: "Success rate",
  min: 20, max: 80, tick: 10,
  tickLabel: value => `${value}%`,
  pointLabel: value => `${value.toFixed(2)}%`
});

mountScalingChart("execution-time-curve", "execution-time-still", {
  points: scalingPoints.map(({ label, color }, index) => ({ label, color, value: executionMeans[index] })),
  axisLabel: "Mean time (s)",
  min: 0, max: 16, tick: 4,
  tickLabel: String,
  pointLabel: value => `${value.toFixed(2)} s`
});
