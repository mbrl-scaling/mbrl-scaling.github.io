const envStory = document.querySelector("[data-env-story]");
const envFlow = envStory.querySelector(".env-flow");
const envCanvas = envStory.querySelector("canvas");
const envInk = envCanvas.getContext("2d");
const envSample = envStory.querySelector(".env-sample");
const envBase = envStory.querySelector("[data-env-base]");
const envOverlay = envStory.querySelector("[data-env-overlay]");
const envVideo = envStory.querySelector("[data-env-preview]");
const envMediaLabel = envStory.querySelector("[data-env-media-label]");
const envCaption = envStory.querySelector("[data-env-caption]");
const envStatus = envStory.querySelector("[data-env-status]");
const envPlay = envStory.querySelector("[data-env-play]");
const envSteps = [...envStory.querySelectorAll("[data-env-step]")];
const envSmall = matchMedia("(max-width: 700px)");
const envMotion = matchMedia("(prefers-reduced-motion: reduce)");
const envImages = {
  source: "method-source-head.webp",
  appearance: "env-appearance-color.webp",
  background: "env-background.webp",
  position: "method-position-head.webp",
  early: "method-rollout-016-head.webp",
  late: "method-rollout-048-head.webp"
};
const envPhases = [
  { at: 0, caption: "The construction agent selects a usable starting observation from recorded robot videos." },
  { at: 3280, caption: "The PE asks the left gripper to grasp the middle of the basket’s long rim. The rubric checks for a grasp on that rim segment." },
  { at: 6480, caption: "The image editor varies the basket’s appearance, background, or position. The agent updates the PE and rubric to match the new scene." },
  { at: 10180, caption: "The review agent checks scene consistency and rollout dynamics, then assesses task completion against the rubric." },
  { at: 13880, caption: "Accepted environments enter the pool with their initial observation, PE, and rubric. The basket illustrates the workflow." }
];
const envDuration = 16500;
let envLayout;
let envElapsed = 0;
let envIndex = -1;
let envTick;
let envFrame;
let envPlaying = false;
let envResumeOnView = !envMotion.matches && !navigator.connection?.saveData;
let envShowPreview = false;
let envAssetsLoaded = false;

const envSmooth = n => {
  const t = Math.min(1, Math.max(0, n));
  return t * t * (3 - 2 * t);
};
const envMix = (from, to, weight) => from + (to - from) * weight;

function measureEnv() {
  const { x, y, width, height } = envFlow.getBoundingClientRect();
  if (!width || !height) return;
  const points = envSteps.map(button => {
    const dot = button.querySelector("i").getBoundingClientRect();
    return { x: dot.x - x + dot.width / 2, y: dot.y - y + dot.height / 2 };
  });
  const dpr = Math.min(devicePixelRatio, 2);
  envCanvas.width = Math.round(width * dpr);
  envCanvas.height = Math.round(height * dpr);
  envInk?.setTransform(dpr, 0, 0, dpr, 0, 0);
  envLayout = { width, height, points, vertical: envSmall.matches, sampleWidth: envSample.offsetWidth };
  renderEnv();
}

function drawEnvRoute(position, sample, phaseProgress) {
  if (!envInk) return;
  const { width, height, points, vertical, sampleWidth } = envLayout;
  const { x, y } = position;
  const start = points[0];
  const end = points[points.length - 1];
  const line = (from, to, color, size) => {
    envInk.strokeStyle = color;
    envInk.lineWidth = size;
    envInk.beginPath();
    envInk.moveTo(from.x, from.y);
    envInk.lineTo(to.x, to.y);
    envInk.stroke();
  };
  envInk.clearRect(0, 0, width, height);
  envInk.lineCap = "round";
  line(start, end, "#bdcce1", 1.5);
  line(start, position, "#4777ca", 2.25);

  if (!vertical) {
    const photoBottom = sample.y + sampleWidth * .28125 * sample.scale;
    envInk.beginPath();
    envInk.moveTo(sample.x, photoBottom - 1);
    envInk.bezierCurveTo(sample.x, photoBottom + 20, x, y - 35, x, y);
    envInk.lineWidth = 1.5;
    envInk.strokeStyle = "#8aaad5";
    envInk.stroke();
    if (envIndex === 0) {
      const inputRight = sample.x - sampleWidth / 2 - 4;
      for (let i = 0; i < 5; i++) {
        const sy = sample.y + (i - 2) * 19;
        envInk.beginPath();
        envInk.moveTo(width * .035, sy);
        envInk.bezierCurveTo(inputRight * .57, sy, inputRight * .82, sample.y, inputRight, sample.y);
        envInk.strokeStyle = "#8ca9d780";
        envInk.lineWidth = 1;
        envInk.stroke();
        const signal = ((phaseProgress * 2.15 + i * .15) % 1) * .82;
        const px = envMix(width * .035, inputRight, signal);
        const py = envMix(sy, sample.y, envSmooth(signal));
        envInk.beginPath();
        envInk.arc(px, py, 1.65, 0, 2 * Math.PI);
        envInk.fillStyle = "#5f83bd";
        envInk.fill();
      }
    }
  }

  if (envIndex === 3 && !vertical) {
    const editor = points[2];
    const reviewer = points[3];
    envInk.beginPath();
    envInk.moveTo(reviewer.x - 14, reviewer.y - 10);
    envInk.quadraticCurveTo((editor.x + reviewer.x) / 2, reviewer.y - 66, editor.x + 14, editor.y - 10);
    envInk.setLineDash([4, 5]);
    envInk.strokeStyle = "#af8454";
    envInk.lineWidth = 1.3;
    envInk.stroke();
    envInk.setLineDash([]);
  }

  if (envIndex === 4) {
    envInk.beginPath();
    envInk.arc(end.x, end.y, 16 + 4 * envSmooth(phaseProgress), 0, 2 * Math.PI);
    envInk.lineWidth = 1;
    envInk.strokeStyle = "#8dadde";
    envInk.stroke();
  }
}

function loadEnvImages() {
  if (envAssetsLoaded) return;
  envAssetsLoaded = true;
  Object.values(envImages).forEach(file => { new Image().src = `assets/${file}`; });
}

function showEnvPreview(show) {
  if (show === envShowPreview) return;
  envShowPreview = show;
  envStory.toggleAttribute("data-show-video", show);
  if (show) envVideo.play().catch(() => {});
  else envVideo.pause();
}

function showEnvImage(initial, final, fade, label) {
  const set = (image, name) => {
    const url = `assets/${envImages[name]}`;
    if (image.getAttribute("src") !== url) image.src = url;
  };
  set(envBase, initial);
  envOverlay.hidden = !final;
  if (final) set(envOverlay, final);
  envSample.style.setProperty("--env-image-fade", fade);
  if (envMediaLabel.textContent !== label) envMediaLabel.textContent = label;
}

function showEnvMedia(index, progress) {
  if (index === 0) {
    showEnvPreview((envPlaying || envShowPreview) && envElapsed < 2750);
    showEnvImage("source", null, 0, envShowPreview ? "Recorded robot videos" : "Selected head-camera frame");
    return;
  }
  showEnvPreview(false);
  if (index === 1) {
    showEnvImage("source", null, 0, "Initial state · contact region");
  } else if (index === 2) {
    const names = ["source", "appearance", "background", "position"];
    const labels = ["Appearance edit", "Background edit", "Position edit"];
    const amount = Math.min(progress * 3.65, 3);
    const beat = Math.min(2, Math.floor(amount));
    showEnvImage(names[beat], names[beat + 1], envSmooth((amount - beat) * 2.35), labels[beat]);
  } else if (index === 3) {
    const late = progress >= .59;
    const fade = envSmooth((progress - (late ? .59 : .23)) * 5.2);
    showEnvImage(late ? "early" : "position", late ? "late" : "early", fade, fade > 0 || late ? "Sampled rollout evidence" : "Edited initial state");
  } else {
    showEnvImage("position", null, 0, "Initial observation + PE + rubric");
  }
}

function renderEnv() {
  if (!envLayout) return;
  const index = envPhases.findLastIndex(phase => phase.at <= envElapsed);
  const scene = envPhases[index];
  const duration = (envPhases[index + 1]?.at ?? envDuration) - scene.at;
  const progress = (envElapsed - scene.at) / duration;
  if (index !== envIndex) {
    envIndex = index;
    envStory.dataset.phase = index;
    envCaption.textContent = scene.caption;
    envSteps.forEach((button, i) => {
      if (i === index) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
      button.toggleAttribute("data-passed", i < index);
    });
  }

  const { width, height, points, vertical } = envLayout;
  const from = points[Math.max(0, index - 1)];
  const to = points[index];
  const weight = envMotion.matches ? 1 : envSmooth((envElapsed - scene.at) / 920);
  const position = { x: envMix(from.x, to.x, weight), y: envMix(from.y, to.y, weight) };
  const poolScale = index === 4 ? envMix(1, .78, weight) : 1;
  const sample = {
    x: vertical ? width * .732 : Math.min(width * .79, Math.max(width * .21, position.x)),
    y: vertical ? Math.min(height - 58, Math.max(62, position.y)) : height * (index === 4 ? envMix(.36, .43, weight) : .36),
    scale: poolScale
  };
  envSample.style.setProperty("--env-photo-x", `${sample.x}px`);
  envSample.style.setProperty("--env-photo-y", `${sample.y}px`);
  envSample.style.setProperty("--env-photo-scale", sample.scale);
  drawEnvRoute(position, sample, progress);
  showEnvMedia(index, progress);
}

function updateEnvPlay() {
  envPlay.toggleAttribute("data-playing", envPlaying);
  const label = envPlaying ? "Pause" : envElapsed >= envDuration ? "Replay" : "Play";
  envPlay.querySelector("span").textContent = label;
  envPlay.setAttribute("aria-label", `${label} environment construction animation`);
}

function pauseEnv() {
  envPlaying = false;
  cancelAnimationFrame(envFrame);
  envTick = undefined;
  envVideo.pause();
  updateEnvPlay();
}

function advanceEnv(now) {
  if (envTick !== undefined) envElapsed = Math.min(envElapsed + Math.min(now - envTick, 100), envDuration);
  envTick = now;
  renderEnv();
  if (envElapsed >= envDuration) {
    envResumeOnView = false;
    pauseEnv();
    return;
  }
  envFrame = requestAnimationFrame(advanceEnv);
}

function playEnv() {
  if (envPlaying) return;
  if (envElapsed >= envDuration) envElapsed = 0;
  if (envElapsed === 0 && envVideo.readyState >= HTMLMediaElement.HAVE_METADATA) envVideo.currentTime = 0;
  loadEnvImages();
  envPlaying = true;
  updateEnvPlay();
  renderEnv();
  if (envShowPreview && envVideo.paused) envVideo.play().catch(() => {});
  envFrame = requestAnimationFrame(advanceEnv);
}

function selectEnv(index) {
  envResumeOnView = false;
  pauseEnv();
  loadEnvImages();
  envElapsed = index === envPhases.length - 1 ? envDuration : (envPhases[index + 1].at - 1);
  renderEnv();
  envStatus.textContent = envPhases[index].caption;
  updateEnvPlay();
}

envPlay.addEventListener("click", () => {
  envResumeOnView = !envPlaying;
  if (envPlaying) pauseEnv();
  else {
    if (envFlow.getBoundingClientRect().top < document.querySelector(".site-header").offsetHeight) {
      envStory.scrollIntoView({ block: "start", behavior: envMotion.matches ? "instant" : "smooth" });
    }
    playEnv();
  }
});
envSteps.forEach((button, index) => {
  button.addEventListener("click", () => selectEnv(index));
  button.addEventListener("keydown", event => {
    const direction = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
    if (!direction) return;
    event.preventDefault();
    const next = (index + direction + envSteps.length) % envSteps.length;
    envSteps[next].focus();
    selectEnv(next);
  });
});
envMotion.addEventListener("change", event => {
  if (event.matches) {
    envResumeOnView = false;
    pauseEnv();
    renderEnv();
  }
});
envSmall.addEventListener("change", measureEnv);
new ResizeObserver(measureEnv).observe(envFlow);
measureEnv();
updateEnvPlay();
envPlay.hidden = false;
new IntersectionObserver(([entry]) => {
  if (entry.intersectionRatio >= .5) {
    loadEnvImages();
    if (envResumeOnView) playEnv();
  } else if (envPlaying) {
    pauseEnv();
  }
}, { threshold: .5 }).observe(envFlow);
