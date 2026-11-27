const agentPlayer = document.querySelector("[data-agent]");
const agentTaskButtons = [...agentPlayer.querySelectorAll("[data-agent-task]")];
const agentTracks = [...agentPlayer.querySelectorAll("[data-agent-track]")].map(track => ({
  track,
  frames: [...track.querySelectorAll("[data-agent-frame]")]
}));
const agentPlay = agentPlayer.querySelector("[data-agent-play]");
const agentImage = agentPlayer.querySelector("[data-agent-image]");
const agentLink = agentImage.parentElement;
const agentTime = agentPlayer.querySelector("[data-agent-time]");
const agentAction = agentPlayer.querySelector("[data-agent-action]");
const agentNote = agentPlayer.querySelector("[data-agent-note]");
const agentOutcome = agentPlayer.querySelector("[data-agent-outcome]");
const agentMotion = matchMedia("(prefers-reduced-motion: reduce)");
let agentTaskIndex = 0;
let agentFrameIndex = 0;
let agentTimer;
let agentFrameRequest = 0;

async function showAgentFrame(index) {
  agentFrameIndex = index;
  const request = ++agentFrameRequest;
  const { frames } = agentTracks[agentTaskIndex];
  const button = frames[index];
  const thumbnail = button.querySelector("img");
  const url = thumbnail.getAttribute("src");
  if (agentImage.getAttribute("src") !== url) {
    thumbnail.loading = "eager";
    try {
      await thumbnail.decode();
    } catch {
      return;
    }
    if (request !== agentFrameRequest) return;
  }
  frames.forEach((frame, i) => frame.setAttribute("aria-pressed", String(i === index)));
  if (agentImage.getAttribute("src") !== url) {
    agentImage.src = url;
    if (!agentMotion.matches) agentImage.animate([{ opacity: .4 }, { opacity: 1 }], { duration: 250 });
  }
  agentImage.alt = button.dataset.action + " · head-camera recording";
  agentLink.href = url;
  agentLink.dataset.zoom = button.dataset.action;
  agentTime.textContent = `Head camera · ${button.dataset.time} elapsed`;
  agentAction.textContent = button.dataset.action;
  agentNote.textContent = button.dataset.note;
}

function stopAgentReplay() {
  clearInterval(agentTimer);
  agentTimer = undefined;
  agentPlay.removeAttribute("data-playing");
  agentPlay.querySelector("span").textContent = "Play keyframes";
}

function selectAgentTask(index) {
  stopAgentReplay();
  agentTaskIndex = index;
  agentTaskButtons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
  agentTracks.forEach(({ track }, i) => { track.hidden = i !== index; });
  agentOutcome.textContent = agentTracks[index].track.dataset.outcome;
  showAgentFrame(0);
}

agentPlay.hidden = false;
agentPlay.addEventListener("click", () => {
  if (agentTimer) {
    stopAgentReplay();
    return;
  }
  const last = agentTracks[agentTaskIndex].frames.length - 1;
  if (agentFrameIndex === last) showAgentFrame(0);
  agentPlay.setAttribute("data-playing", "");
  agentPlay.querySelector("span").textContent = "Pause keyframes";
  agentTimer = setInterval(() => {
    if (agentFrameIndex === last) stopAgentReplay();
    else showAgentFrame(agentFrameIndex + 1);
  }, 3400);
});
agentTaskButtons.forEach((button, index) => button.addEventListener("click", () => selectAgentTask(index)));
agentTracks.forEach(({ frames }) => frames.forEach((frame, index) => frame.addEventListener("click", () => {
  stopAgentReplay();
  showAgentFrame(index);
})));
new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) stopAgentReplay();
}).observe(agentPlayer);
selectAgentTask(0);
