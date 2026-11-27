const envStory = document.querySelector("[data-env-story]");
const envStage = envStory.querySelector(".env-stage");
const envVideo = envStory.querySelector("video");
const envRole = envStory.querySelector("[data-env-role]");
const envTitle = envStory.querySelector("[data-env-title]");
const envCaption = envStory.querySelector("[data-env-caption]");
const envStatus = envStory.querySelector("[data-env-status]");
const envCandidateLabel = envStory.querySelector("[data-env-candidate-label]");
const envPlay = envStory.querySelector("[data-env-play]");
const envSteps = [...envStory.querySelectorAll("[data-env-step]")];
const envMotion = matchMedia("(prefers-reduced-motion: reduce)");
const envCompact = matchMedia("(max-width: 640px)");
const envDesktop = { source: envVideo.getAttribute("src"), poster: envVideo.getAttribute("poster") };
const envDuration = 16600;
const envScenes = [
  { at: 0, phase: "library", step: "library", role: "Construction agent", title: "Select an initial state",
    caption: "The agent searches recorded robot demonstrations for an identifiable target and a plausible starting configuration." },
  { at: 2150, phase: "select", step: "library", role: "Construction agent", title: "Select an initial state",
    caption: "One recorded head-camera frame becomes the starting observation for the basket task." },
  { at: 3420, phase: "specify", step: "specify", role: "Construction agent", title: "Specify the task and rubric",
    caption: "The PE gives the policy an instruction. The rubric states the observable evidence of a successful grasp." },
  { at: 6480, phase: "edit", step: "edit", role: "Construction agent + image editor", title: "Generate scene variants",
    caption: "The agent sends the recorded head view and planned edits to an image editor, then aligns the instruction and rubric with the edited scene." },
  { at: 10300, phase: "review", step: "review", role: "Review agent", title: "Review the scene and rollout",
    caption: "The reviewer checks the initial observation and rollout dynamics. It evaluates task completion separately against the rubric and returns inconsistent candidates for revision." },
  { at: 14200, phase: "pool", step: "pool", role: "Admission example", title: "Training environment pool",
    caption: "Accepted candidates enter the pool with their initial observation, PE, and rubric. The basket illustrates the admission flow." }
];
let envElapsed = 0;
let envIndex = -1;
let envFrame;
let envTick;
let envPlaying = false;
let envResumeOnView = !envMotion.matches && !navigator.connection?.saveData;

function syncEnvVideo() {
  if (envPlaying && envStory.dataset.phase === "library") envVideo.play().catch(() => {});
  else envVideo.pause();
}

function syncEnvMedia() {
  const source = envCompact.matches ? envVideo.dataset.mobileSource : envDesktop.source;
  if (source === envVideo.getAttribute("src")) return;
  envVideo.poster = envCompact.matches ? envVideo.dataset.mobilePoster : envDesktop.poster;
  envVideo.src = source;
  syncEnvVideo();
}

function renderEnv() {
  const index = envScenes.findLastIndex(scene => scene.at <= envElapsed);
  const scene = envScenes[index];
  if (index !== envIndex) {
    envIndex = index;
    envStory.dataset.phase = scene.phase;
    envRole.textContent = scene.role;
    envTitle.textContent = scene.title;
    envCaption.textContent = scene.caption;
    envCandidateLabel.textContent = scene.phase === "pool" ? "Position example" : "Position variant";
    envSteps.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.envStep === scene.step)));
    syncEnvVideo();
  }
  const stepIndex = envScenes.findIndex(item => item.step === scene.step);
  const nextStep = envScenes.find(item => item.at > scene.at && item.step !== scene.step);
  const start = envScenes[stepIndex].at;
  const progress = (envElapsed - start) / ((nextStep?.at ?? envDuration) - start);
  envStory.style.setProperty("--env-progress", progress);
  const reveal = scene.phase === "edit" && envPlaying && !envMotion.matches
    ? Math.max(0, Math.min(1, (progress - .12) * 2.8)) : 1;
  envStory.style.setProperty("--env-edit-reveal", reveal);
  envStory.toggleAttribute("data-edit-revealing", reveal > 0 && reveal < 1);
  if (scene.phase === "review") {
    envStory.style.setProperty("--env-evidence", envMotion.matches ? 1 : Math.max(0, Math.min(1, progress * 2.25 - .45)));
  }
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
  updateEnvPlay();
  syncEnvVideo();
}

function advanceEnv(now) {
  if (envTick !== undefined) envElapsed = Math.min(envElapsed + Math.min(now - envTick, 100), envDuration);
  envTick = now;
  renderEnv();
  if (envElapsed === envDuration) {
    envResumeOnView = false;
    pauseEnv();
    return;
  }
  envFrame = requestAnimationFrame(advanceEnv);
}

function playEnv() {
  if (envPlaying) return;
  if (envElapsed >= envDuration) {
    envElapsed = 0;
    if (envVideo.readyState >= HTMLMediaElement.HAVE_METADATA) envVideo.currentTime = 0;
  }
  envPlaying = true;
  renderEnv();
  updateEnvPlay();
  syncEnvVideo();
  envFrame = requestAnimationFrame(advanceEnv);
}

function revealEnvStage() {
  const headerHeight = document.querySelector(".site-header").offsetHeight;
  if (envStage.getBoundingClientRect().top < headerHeight) {
    envStory.scrollIntoView({ block: "start", behavior: envMotion.matches ? "instant" : "smooth" });
  }
}

envPlay.addEventListener("click", () => {
  envResumeOnView = !envPlaying;
  if (envPlaying) pauseEnv();
  else {
    revealEnvStage();
    playEnv();
  }
});
envSteps.forEach(button => button.addEventListener("click", () => {
  envResumeOnView = false;
  const scene = envScenes.find(item => item.phase === button.dataset.envStep);
  envElapsed = scene.phase === "pool" ? envDuration : scene.at;
  pauseEnv();
  renderEnv();
  revealEnvStage();
  envStatus.textContent = `${scene.title}. ${scene.caption}`;
}));
envCompact.addEventListener("change", syncEnvMedia);
envMotion.addEventListener("change", event => {
  if (event.matches) {
    envResumeOnView = false;
    pauseEnv();
    renderEnv();
  }
});
syncEnvMedia();
renderEnv();
updateEnvPlay();
envStory.querySelector("[data-env-transport]").hidden = false;
new IntersectionObserver(([entry]) => {
  if (entry.intersectionRatio >= .5) {
    if (envResumeOnView) playEnv();
  } else if (envPlaying) {
    pauseEnv();
  }
}, { threshold: .5 }).observe(envStage);
