const envStory = document.querySelector("[data-env-story]");
const envLanes = [...envStory.querySelectorAll("[data-env-lane]")];
const envPlay = envStory.querySelector("[data-env-play]");
const envMotion = matchMedia("(prefers-reduced-motion: reduce)");
const envStageLength = 2220;
const envLaneDelay = 190;
const envTimeline = 5 * envStageLength + (envLanes.length - 1) * envLaneDelay;
let envElapsed = 0;
let envTick;
let envFrame;
let envPlaying = false;
let envAutoplay = !envMotion.matches && !navigator.connection?.saveData;

function renderEnv() {
  const reduced = envMotion.matches;
  envLanes.forEach((lane, index) => {
    const time = Math.max(0, envElapsed - index * envLaneDelay) / envStageLength;
    const stage = Math.min(Math.floor(time), 5);
    const part = time - stage;
    if (lane.dataset.stage !== String(stage)) lane.dataset.stage = stage;
    lane.style.setProperty("--env-progress", Math.min(time / 5, 1));
    lane.style.setProperty("--env-rollout", stage === 3 && !reduced ? Math.max(1 - part * 2, 0) : 0);
    lane.style.setProperty("--env-sweep", reduced ? 1 : part);
  });
}

function setEnvButton() {
  const label = envPlaying ? "Pause" : envElapsed >= envTimeline ? "Replay" : "Play";
  envPlay.toggleAttribute("data-playing", envPlaying);
  envPlay.querySelector("span").textContent = label;
  envPlay.setAttribute("aria-label", `${label} parallel environment construction`);
}

function pauseEnv() {
  envPlaying = false;
  cancelAnimationFrame(envFrame);
  envTick = undefined;
  setEnvButton();
}

function animateEnv(now) {
  if (envTick !== undefined) envElapsed = Math.min(envElapsed + Math.min(now - envTick, 100), envTimeline);
  envTick = now;
  renderEnv();
  if (envElapsed < envTimeline) {
    envFrame = requestAnimationFrame(animateEnv);
  } else {
    envAutoplay = false;
    pauseEnv();
  }
}

function startEnv() {
  if (envPlaying) return;
  if (envElapsed >= envTimeline) envElapsed = 0;
  envPlaying = true;
  setEnvButton();
  envFrame = requestAnimationFrame(animateEnv);
}

envPlay.addEventListener("click", () => {
  envAutoplay = !envPlaying;
  if (envPlaying) pauseEnv();
  else startEnv();
});
envMotion.addEventListener("change", event => {
  if (!event.matches) return;
  envAutoplay = false;
  pauseEnv();
  renderEnv();
});
new IntersectionObserver(([entry]) => {
  if (entry.intersectionRatio >= .3) {
    if (envAutoplay) startEnv();
  } else if (envPlaying) {
    pauseEnv();
  }
}, { threshold: .3 }).observe(envStory);
envPlay.hidden = false;
setEnvButton();
