const envStory = document.querySelector("[data-env-story]");
const envScroll = envStory.querySelector("[data-env-scroll]");
const envBoard = envStory.querySelector("[data-env-board]");
const envLayer = envStory.querySelector("[data-env-flight-layer]");
const envCanvas = envStory.querySelector("[data-env-paths]");
const envInk = envCanvas.getContext("2d");
const envArchive = envStory.querySelector(".env-archive");
const envApproval = envStory.querySelector("[data-env-approval]");
const envArrow = envApproval.querySelector("i");
const envWell = envStory.querySelector("[data-env-well]");
const envPlay = envStory.querySelector("[data-env-play]");
const envOverview = envStory.querySelector("[data-env-overview]");
const envMotion = matchMedia("(prefers-reduced-motion: reduce)");
const envDuration = 12400;
const envLanes = [...envStory.querySelectorAll("[data-env-lane]")].map(lane => ({
  lane,
  color: getComputedStyle(lane).getPropertyValue("--env-lane-color").trim(),
  card: envStory.querySelector(`[data-env-deck="${lane.dataset.envLane}"]`),
  selected: lane.querySelector(".env-selected"),
  title: lane.querySelector(".env-initial > strong"),
  spec: lane.querySelector(".env-spec"),
  draft: [...lane.querySelectorAll("[data-env-write]")].map(prepareEnvDraft),
  edit: [...lane.querySelectorAll("[data-env-variant]")],
  targets: [...envWell.querySelectorAll(`[data-env-pool="${lane.dataset.envLane}"]`)]
}));
let envLayout;
let envTime = 0;
let envLast;
let envFrame;
let envPlaying = false;
let envAutoplay = !envMotion.matches && !navigator.connection?.saveData;
let envFollow = true;
let envWide = false;

const envClamp = value => Math.max(0, Math.min(1, value));
const envEase = value => {
  const t = envClamp(value);
  return t * t * (3 - 2 * t);
};
const envAt = (time, start, length) => envClamp((time - start) / length);
const envMix = (start, end, amount) => start + (end - start) * amount;

function prepareEnvDraft(line) {
  const text = line.textContent.trim();
  const full = document.createElement("span");
  full.className = "env-writing-full";
  full.textContent = text;
  const ink = document.createElement("span");
  ink.className = "env-writing-ink";
  ink.setAttribute("aria-hidden", "true");
  line.replaceChildren(full, ink);
  return { line, ink, text };
}

function writeEnvDraft({ line, ink, text }, progress) {
  const excerpt = text.slice(0, Math.floor(text.length * progress));
  if (ink.textContent !== excerpt) ink.textContent = excerpt;
  line.toggleAttribute("data-env-writing", progress > 0 && progress < 1);
}

function makeEnvFlight(frame) {
  const flight = new Image();
  flight.src = frame.querySelector("img").getAttribute("src");
  flight.alt = "";
  flight.decoding = "async";
  flight.hidden = true;
  envLayer.append(flight);
  return flight;
}

for (const lane of envLanes) {
  lane.pickFlight = makeEnvFlight(lane.selected);
  lane.editFlights = lane.edit.map(makeEnvFlight);
  lane.poolFlights = lane.targets.map(makeEnvFlight);
}

function measureEnv() {
  const width = envBoard.offsetWidth;
  const height = envBoard.offsetHeight;
  if (!width || !height) return;
  const compact = width > envScroll.clientWidth + 1;
  envStory.toggleAttribute("data-env-compact", compact);
  envScroll.toggleAttribute("data-env-wide", compact && envWide);
  const scale = compact && envWide ? envScroll.clientWidth / width : 1;
  envScroll.style.setProperty("--env-scale", scale);
  envScroll.style.height = scale < 1 ? `${Math.ceil(height * scale)}px` : "";
  const board = envBoard.getBoundingClientRect();
  const box = element => {
    const rect = element.getBoundingClientRect();
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    return {
      x: (rect.left + rect.width / 2 - board.left) / scale - width / 2,
      y: (rect.top + rect.height / 2 - board.top) / scale - height / 2,
      width, height
    };
  };
  const dpr = Math.min(devicePixelRatio, 2);
  envCanvas.width = Math.round(width * dpr);
  envCanvas.height = Math.round(height * dpr);
  envInk?.setTransform(dpr, 0, 0, dpr, 0, 0);
  const approval = box(envApproval);
  const arrow = box(envArrow);
  envLayout = { width, height, compact, approval, gate: { ...arrow, x: approval.x, width: approval.width }, archiveHeight: envArchive.offsetHeight };
  for (const lane of envLanes) {
    lane.boxes = {
      card: box(lane.card), selected: box(lane.selected), spec: box(lane.spec),
      edit: lane.edit.map(box), targets: lane.targets.map(box)
    };
    lane.pickFlight.style.width = `${lane.boxes.selected.width}px`;
    lane.editFlights.forEach((flight, index) => { flight.style.width = `${lane.boxes.edit[index].width}px`; });
    lane.poolFlights.forEach((flight, index) => { flight.style.width = `${lane.boxes.targets[index].width}px`; });
  }
  renderEnv();
}

function setEnvAlpha(element, opacity) {
  element.style.setProperty("--env-alpha", envEase(opacity).toFixed(3));
}

function flyEnv(flight, from, to, progress, arc, rotation, via) {
  const active = progress > 0 && progress < 1;
  if (flight.hidden === active) flight.hidden = !active;
  if (!active) return;
  const eased = envEase(progress);
  const width = envMix(from.width, to.width, eased);
  const fromCenter = from.x + from.width / 2;
  const toCenter = to.x + to.width / 2;
  const center = envMix(fromCenter, toCenter, eased);
  const x = center - width / 2;
  let y = envMix(from.y, to.y, eased) - Math.sin(Math.PI * eased) * arc;
  if (via) {
    const gate = via.x + via.width / 2;
    const top = via.y + via.height - width * 9 / 32;
    y = center < gate
      ? envMix(from.y, top, envEase(envAt(center, fromCenter, gate - fromCenter)))
      : envMix(top, to.y, envEase(envAt(center, gate, toCenter - gate)));
  }
  const angle = rotation * Math.sin(Math.PI * progress);
  flight.style.transform = `translate3d(${x}px,${y}px,0) scale(${width / to.width}) rotate(${angle}deg)`;
}

function routeEnv(from, to, color, progress) {
  if (!envInk || progress <= 0) return;
  const x = from.x + from.width;
  const y = from.y + from.height / 2;
  const tx = to.x;
  const ty = to.y + to.height / 2;
  const dx = (tx - x) * .48;
  const length = Math.hypot(tx - x, ty - y) * 1.24;
  envInk.beginPath();
  envInk.moveTo(x, y);
  envInk.bezierCurveTo(x + dx, y, tx - dx, ty, tx, ty);
  envInk.strokeStyle = color;
  envInk.lineWidth = 1.05;
  envInk.globalAlpha = .22 + .17 * Math.sin(Math.PI * progress);
  if (progress < 1) envInk.setLineDash([length * progress, length]);
  envInk.stroke();
  envInk.setLineDash([]);
  envInk.globalAlpha = 1;
}

function followEnvBoard() {
  if (!envLayout.compact || !envFollow || envWide || !envPlaying) return;
  const viewport = envScroll.clientWidth;
  const { selected, spec, edit } = envLanes[0].boxes;
  const extent = envLayout.width - viewport;
  const center = box => Math.min(extent, Math.max(0, box.x + box.width / 2 - viewport * .48));
  const keys = [
    [0, 0], [950, 0], [2590, center(selected)], [3200, center(spec)],
    [4870, center(spec)], [6570, center(edit[1])], [8290, center(envLayout.approval)], [10150, extent]
  ];
  const index = keys.findLastIndex(([at]) => at <= envTime);
  const [at, x] = keys[index];
  const next = keys[index + 1];
  const scroll = next ? envMix(x, next[1], envEase(envAt(envTime, at, next[0] - at))) : x;
  if (Math.abs(envScroll.scrollLeft - scroll) >= 1) envScroll.scrollLeft = scroll;
}

function renderEnv() {
  if (!envLayout) return;
  const reduced = envMotion.matches;
  const timeline = reduced ? envDuration : envTime;
  envInk?.clearRect(0, 0, envLayout.width, envLayout.height);
  const scan = envAt(timeline, 170, 1630);
  envArchive.style.setProperty("--env-scan-y", envMix(-58, envLayout.archiveHeight, envEase(scan)));
  envArchive.style.setProperty("--env-scan-alpha", Math.sin(Math.PI * scan).toFixed(3));
  const approval = envAt(timeline, 7710, 620);
  setEnvAlpha(envApproval, approval);
  envApproval.style.setProperty("--env-approval", envEase(approval));
  envWell.style.setProperty("--env-well", envEase(envAt(timeline, 8650, 1760)));
  envLanes.forEach((lane, index) => {
    const time = timeline - index * 235;
    const { card, selected, spec, edit, targets } = lane.boxes;
    const pick = envAt(time, 1080, 1220);
    lane.card.style.setProperty("--env-sheet", 1 - envEase(pick) * .86);
    flyEnv(lane.pickFlight, card, selected, pick, 24 + index * 4, 10 - index * 5);
    setEnvAlpha(lane.selected, (pick - .79) * 5);
    setEnvAlpha(lane.title, (pick - .79) * 5);
    const draft = envAt(time, 2300, 420);
    setEnvAlpha(lane.spec, draft);
    writeEnvDraft(lane.draft[0], envAt(time, 2640, 1210));
    writeEnvDraft(lane.draft[1], envAt(time, 3860, 950));
    routeEnv(card, selected, lane.color, envEase(pick));
    routeEnv(selected, spec, lane.color, envEase(draft));

    lane.edit.forEach((frame, variant) => {
      const spread = envAt(time, 4890 + variant * 260, 1070);
      flyEnv(lane.editFlights[variant], spec, edit[variant], spread, 20 - variant * 5, (variant - 1.5) * 7);
      setEnvAlpha(frame, (spread - .83) * 5.9);
      routeEnv(spec, edit[variant], lane.color, envEase(spread));
    });

    routeEnv(edit[3], envLayout.gate, lane.color, envEase(approval));
    lane.targets.forEach((frame, variant) => {
      const deposit = envAt(timeline, 8460 + (variant * envLanes.length + index) * 175, 1000);
      flyEnv(lane.poolFlights[variant], edit[variant], targets[variant], deposit, 0, -12 + variant * 4, envLayout.gate);
      setEnvAlpha(frame, (deposit - .84) * 6.3);
    });
  });
  followEnvBoard();
}

function updateEnvPlay() {
  const label = envPlaying ? "Pause" : envTime >= envDuration ? "Replay" : "Play";
  envPlay.toggleAttribute("data-playing", envPlaying);
  envPlay.querySelector("span").textContent = label;
  envPlay.setAttribute("aria-label", `${label} environment construction animation`);
}

function pauseEnv() {
  envPlaying = false;
  cancelAnimationFrame(envFrame);
  envLast = undefined;
  updateEnvPlay();
}

function stepEnv(now) {
  if (envLast !== undefined) envTime = Math.min(envTime + Math.min(now - envLast, 100), envDuration);
  envLast = now;
  renderEnv();
  if (envTime < envDuration) envFrame = requestAnimationFrame(stepEnv);
  else {
    envAutoplay = false;
    pauseEnv();
  }
}

function startEnv() {
  if (envPlaying || envMotion.matches) return;
  if (envTime >= envDuration) {
    envTime = 0;
    if (!envWide && envFollow) envScroll.scrollLeft = 0;
  }
  envPlaying = true;
  updateEnvPlay();
  envFrame = requestAnimationFrame(stepEnv);
}

function showEnvBoard() {
  if (envScroll.getBoundingClientRect().top < document.querySelector(".site-header").offsetHeight) {
    envStory.scrollIntoView({ block: "start", behavior: envMotion.matches ? "instant" : "smooth" });
  }
}

envPlay.addEventListener("click", () => {
  envAutoplay = !envPlaying;
  if (envPlaying) {
    pauseEnv();
  } else {
    envFollow = true;
    showEnvBoard();
    startEnv();
  }
});
envOverview.addEventListener("click", () => {
  envWide = !envWide;
  envFollow = false;
  envScroll.scrollLeft = 0;
  envOverview.textContent = envWide ? "Full size" : "Overview";
  envOverview.setAttribute("aria-pressed", String(envWide));
  measureEnv();
  showEnvBoard();
});
envScroll.addEventListener("pointerdown", () => { envFollow = false; }, { passive: true });
envScroll.addEventListener("wheel", event => {
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) envFollow = false;
}, { passive: true });
envMotion.addEventListener("change", event => {
  envPlay.hidden = event.matches;
  if (event.matches) {
    envAutoplay = false;
    envTime = envDuration;
    pauseEnv();
    renderEnv();
  }
});
envStory.setAttribute("data-env-enhanced", "");
envPlay.hidden = envMotion.matches;
envOverview.hidden = false;
measureEnv();
updateEnvPlay();
new ResizeObserver(measureEnv).observe(envBoard);
new ResizeObserver(measureEnv).observe(envScroll);
new IntersectionObserver(([entry]) => {
  if (entry.intersectionRatio >= .26) {
    if (envAutoplay) startEnv();
  } else if (envPlaying) {
    pauseEnv();
  }
}, { threshold: .26 }).observe(envScroll);
