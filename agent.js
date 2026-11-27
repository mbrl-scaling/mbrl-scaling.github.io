const agentPlayer = document.querySelector("[data-agent]");
const agentTrials = JSON.parse(agentPlayer.querySelector("[data-agent-trials]").textContent);
const agentVideo = agentPlayer.querySelector("[data-agent-video]");
const agentTabs = [...agentPlayer.querySelectorAll("[data-agent-task]")];
const agentTransport = agentPlayer.querySelector("[data-agent-transport]");
const agentPlay = agentTransport.querySelector("[data-agent-play]");
const agentFullscreen = agentTransport.querySelector("[data-agent-fullscreen]");
const agentScrubber = agentTransport.querySelector("input");
const agentPosition = agentTransport.querySelector("[data-agent-position]");
const agentPhase = agentPlayer.querySelector("[data-agent-phase]");
const agentAction = agentPlayer.querySelector("[data-agent-action]");
const agentNote = agentPlayer.querySelector("[data-agent-note]");
const agentTime = agentPlayer.querySelector("[data-agent-time]");
const agentChapters = agentPlayer.querySelector("[data-agent-chapters]");
const agentOutcome = agentPlayer.querySelector("[data-agent-outcome]");
let agentTrial = agentTrials[0];
let agentCue;
let agentChapter;

function agentClock(seconds) {
  const elapsed = Math.floor(seconds);
  return `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
}

function updateAgentReplay() {
  const time = agentVideo.currentTime;
  const duration = agentVideo.duration;
  const playing = !agentVideo.paused && !agentVideo.ended;
  agentPlay.toggleAttribute("data-playing", playing);
  agentPlay.setAttribute("aria-label", playing ? "Pause replay" : "Play replay");
  agentPosition.textContent = agentClock(time);
  agentScrubber.value = time;
  agentScrubber.style.setProperty("--played", `${duration ? time / duration * 100 : 0}%`);

  const cue = agentTrial.cues.findLast(item => item.time <= time) || agentTrial.cues[0];
  if (cue !== agentCue) {
    agentCue = cue;
    agentPlayer.dataset.phase = cue.phase.toLowerCase();
    agentPhase.textContent = cue.phase;
    agentAction.textContent = cue.title;
    agentNote.textContent = cue.detail;
  }
  const elapsed = time >= agentTrial.terminalReplay ? agentTrial.terminalElapsed : Math.min(time * agentTrial.speed, agentTrial.lastCapture);
  agentTime.textContent = agentClock(elapsed);

  const chapter = [...agentChapters.children].findLast(item => Number(item.firstElementChild.dataset.time) <= time);
  if (chapter !== agentChapter) {
    agentChapter?.firstElementChild.removeAttribute("aria-current");
    chapter?.firstElementChild.setAttribute("aria-current", "step");
    agentChapter = chapter;
  }
}

function renderAgentChapters() {
  agentChapters.replaceChildren(...agentTrial.chapters.map(cue => {
    const row = document.createElement("li");
    const button = document.createElement("button");
    const title = document.createElement("span");
    const time = document.createElement("time");
    button.type = "button";
    button.dataset.time = cue.time;
    title.textContent = cue.chapter;
    time.textContent = agentClock(cue.elapsed);
    button.append(title, time);
    row.append(button);
    return row;
  }));
}

function selectAgentTrial(index) {
  if (agentTrial === agentTrials[index]) {
    playPreviewVideo(agentVideo);
    return;
  }
  agentVideo.pause();
  agentTrial = agentTrials[index];
  agentTabs.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
  agentVideo.dataset.poster = agentTrial.poster;
  agentVideo.dataset.fullSource = agentTrial.full;
  agentVideo.poster = agentTrial.poster;
  agentVideo.setAttribute("aria-label", `${agentTrial.title} head-camera replay`);
  agentVideo.src = agentTrial.preview;
  agentOutcome.textContent = agentTrial.result;
  agentOutcome.dataset.tone = agentTrial.tone;
  agentScrubber.disabled = true;
  renderAgentChapters();
  updateAgentReplay();
  playPreviewVideo(agentVideo);
}

function toggleAgentPlayback() {
  if (agentVideo.paused) playPreviewVideo(agentVideo);
  else agentVideo.pause();
}

agentTabs.forEach((button, index) => button.addEventListener("click", () => selectAgentTrial(index)));
agentPlay.addEventListener("click", toggleAgentPlayback);
agentVideo.addEventListener("click", () => { if (!agentVideo.controls) toggleAgentPlayback(); });
agentScrubber.addEventListener("input", () => { agentVideo.currentTime = Number(agentScrubber.value); });
agentChapters.addEventListener("click", event => {
  const button = event.target.closest("button[data-time]");
  if (!button) return;
  agentVideo.currentTime = Number(button.dataset.time);
  playPreviewVideo(agentVideo);
});
agentVideo.addEventListener("loadedmetadata", () => {
  agentScrubber.disabled = false;
  agentScrubber.max = agentVideo.duration;
  updateAgentReplay();
});
["timeupdate", "seeking", "play", "pause", "ended"].forEach(event => agentVideo.addEventListener(event, updateAgentReplay));

if (policyHD.showModal) {
  agentFullscreen.hidden = false;
  agentFullscreen.addEventListener("click", () => openFullscreenVideo(agentVideo));
} else {
  agentTransport.setAttribute("data-no-fullscreen", "");
}
agentVideo.controls = false;
agentTransport.hidden = false;
agentChapters.hidden = false;
renderAgentChapters();
updateAgentReplay();

const agentPosterObserver = new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) {
    showVideoPoster(agentVideo);
    agentPosterObserver.disconnect();
  }
}, {rootMargin: "360px 0px"});
agentPosterObserver.observe(agentVideo);
new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) agentVideo.pause();
}).observe(agentVideo);
