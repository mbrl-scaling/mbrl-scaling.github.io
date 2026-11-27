const hero = document.querySelector("#hero-video");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const compactHero = matchMedia("(max-aspect-ratio: 4/5)");
const heroSource = hero.querySelector("source");
const heroScreen = hero.parentElement;
const carousel = document.querySelector("#hero-carousel");
const carouselContext = carousel.getContext("2d", { alpha: false });
const carouselPoster = new Image();
const carouselFrame = document.createElement("canvas");
const carouselFrameContext = carouselFrame.getContext("2d", { alpha: false });
const desktopHero = { poster: hero.getAttribute("poster"), video: heroSource.getAttribute("src") };
const heroFrameRate = 12;
// Row bounds in the two encoded 36-rollout videos, including caption strips.
const landscapeRows = { width: 3840, height: 2376, count: 6, top: 16, inset: 12, rowHeight: 384, pitch: 392, speed: 32 };
const portraitRows = { width: 1440, height: 3464, count: 12, top: 12, inset: 6, rowHeight: 283, pitch: 287, speed: 19 };
let heroVisible = false;
let cachedCarouselFrame;
let carouselAnimation = 0;
let carouselTime = 0;
let previousCarouselTick;

function paintCarousel() {
  if (!carouselContext || !carouselFrameContext) return;
  const rows = compactHero.matches ? portraitRows : landscapeRows;
  const { width, height } = hero.getBoundingClientRect();
  if (!width || !height) return;

  const density = Math.min(devicePixelRatio, 2, 2560 / width, 1800 / height);
  const pixelWidth = Math.round(width * density);
  const pixelHeight = Math.round(height * density);
  if (carousel.width !== pixelWidth || carousel.height !== pixelHeight) {
    carousel.width = carouselFrame.width = pixelWidth;
    carousel.height = carouselFrame.height = pixelHeight;
    cachedCarouselFrame = undefined;
  }
  const hasVideoFrame = !hero.seeking && hero.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
  // Keep the last painted frame while the video seeks back to the start.
  if (hasVideoFrame || cachedCarouselFrame === undefined) {
    const sourceWidth = hasVideoFrame ? hero.videoWidth : carouselPoster.naturalWidth;
    if (sourceWidth !== rows.width) return;
    const frameKey = hasVideoFrame ? Math.floor(hero.currentTime * heroFrameRate) : carouselPoster.src;
    if (frameKey !== cachedCarouselFrame) {
      carouselFrameContext.drawImage(hasVideoFrame ? hero : carouselPoster, 0, 0, pixelWidth, pixelHeight);
      cachedCarouselFrame = frameKey;
    }
  }

  carouselContext.fillStyle = "#0d1017";
  carouselContext.fillRect(0, 0, pixelWidth, pixelHeight);
  const x = Math.round(rows.inset * pixelWidth / rows.width);
  const stripWidth = pixelWidth - 2 * x;
  const scaleY = pixelHeight / rows.height;
  for (let row = 0; row < rows.count; row++) {
    const top = rows.top + row * rows.pitch;
    const y = Math.round(top * scaleY);
    const h = Math.round((top + rows.rowHeight) * scaleY) - y;
    const distance = Math.floor(carouselTime * (rows.speed + row % 3 * 3) * density) % stripWidth;
    const split = row % 2 === 0 ? distance : (stripWidth - distance) % stripWidth;
    const tail = stripWidth - split;
    carouselContext.drawImage(carouselFrame, x + split, y, tail, h, x, y, tail, h);
    if (split) carouselContext.drawImage(carouselFrame, x, y, split, h, x + tail, y, split, h);
  }
  carousel.hidden = false;
}

function animateCarousel(now) {
  carouselAnimation = 0;
  if (hero.paused || reducedMotion.matches) return;
  const elapsed = previousCarouselTick === undefined ? 0 : now - previousCarouselTick;
  if (!elapsed || elapsed >= 1000 / 30 - 1) {
    carouselTime += Math.min(elapsed, 100) / 1000;
    previousCarouselTick = now;
    paintCarousel();
  }
  carouselAnimation = requestAnimationFrame(animateCarousel);
}

function startCarousel() {
  if (!carouselContext || carouselAnimation || hero.paused || reducedMotion.matches) return;
  previousCarouselTick = undefined;
  carouselAnimation = requestAnimationFrame(animateCarousel);
}

function stopCarousel() {
  cancelAnimationFrame(carouselAnimation);
  carouselAnimation = 0;
  previousCarouselTick = undefined;
}

function syncHeroPlayback() {
  if (heroVisible && !reducedMotion.matches && !navigator.connection?.saveData) {
    hero.play().catch(() => {});
  } else {
    hero.pause();
  }
}

function syncHeroMedia() {
  const poster = compactHero.matches ? hero.dataset.mobilePoster : desktopHero.poster;
  const video = compactHero.matches ? hero.dataset.mobileSource : desktopHero.video;
  if (video === heroSource.getAttribute("src")) return;
  carousel.hidden = true;
  cachedCarouselFrame = undefined;
  hero.poster = poster;
  carouselPoster.src = poster;
  heroSource.src = video;
  hero.load();
  syncHeroPlayback();
}

hero.addEventListener("playing", startCarousel);
hero.addEventListener("pause", () => {
  stopCarousel();
  paintCarousel();
});
["loadeddata", "seeked"].forEach(event => hero.addEventListener(event, paintCarousel));
carouselPoster.addEventListener("load", paintCarousel);
new ResizeObserver(paintCarousel).observe(heroScreen);
compactHero.addEventListener("change", syncHeroMedia);
syncHeroMedia();
if (!carouselPoster.src) carouselPoster.src = hero.poster;

const header = document.querySelector(".site-header");
new IntersectionObserver(([entry]) => {
  header.toggleAttribute("data-on-hero", entry.isIntersecting);
}, { rootMargin: `-${header.offsetHeight}px 0px 0px 0px` }).observe(heroScreen);

reducedMotion.addEventListener("change", syncHeroPlayback);
navigator.connection?.addEventListener("change", syncHeroPlayback);
new IntersectionObserver(([entry]) => {
  heroVisible = entry.intersectionRatio >= .25;
  syncHeroPlayback();
}, { threshold: .25 }).observe(heroScreen);

const policyBatch = document.querySelector("[data-policy-all]");
const policyVideos = [...document.querySelectorAll(".policy-case video")];

function playPolicyVideo(video) {
  return video.play().catch(() => {});
}

const policyObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.intersectionRatio < .6) continue;
    const video = entry.target;
    policyObserver.unobserve(video);
    if (!reducedMotion.matches && !navigator.connection?.saveData && video.paused && video.currentTime === 0) {
      playPolicyVideo(video);
    }
  }
}, { threshold: .6 });

function updatePolicyBatch() {
  const playing = policyVideos.some(video => !video.paused && !video.ended);
  policyBatch.querySelector("span").textContent = playing ? "Pause all" : "Play all";
  policyBatch.toggleAttribute("data-playing", playing);
}

policyBatch.hidden = false;
policyBatch.addEventListener("click", () => {
  policyObserver.disconnect();
  const shouldPlay = !policyBatch.hasAttribute("data-playing");
  policyVideos.forEach(video => {
    if (shouldPlay) playPolicyVideo(video);
    else video.pause();
  });
  updatePolicyBatch();
});

document.querySelectorAll(".policy-case").forEach(card => {
  const video = card.querySelector("video");
  const transport = card.querySelector("[data-policy-transport]");
  const play = transport.querySelector(".policy-play");
  const expand = transport.querySelector(".policy-fullscreen");
  const seek = transport.querySelector("input");
  const time = transport.querySelector("output");

  function togglePolicyVideo() {
    policyObserver.unobserve(video);
    if (video.paused) playPolicyVideo(video);
    else video.pause();
  }

  function updatePolicyControls() {
    play.toggleAttribute("data-playing", !video.paused && !video.ended);
    play.setAttribute("aria-label", video.paused || video.ended ? "Play comparison" : "Pause comparison");
    const seconds = Math.floor(video.currentTime);
    time.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    seek.value = video.currentTime;
    seek.style.setProperty("--played", `${video.duration ? video.currentTime / video.duration * 100 : 0}%`);
  }

  video.addEventListener("loadedmetadata", () => {
    seek.max = video.duration;
    seek.disabled = false;
  });
  ["play", "pause", "ended", "seeking", "timeupdate"].forEach(event => video.addEventListener(event, updatePolicyControls));
  ["play", "pause", "ended", "error"].forEach(event => video.addEventListener(event, updatePolicyBatch));

  play.addEventListener("click", togglePolicyVideo);
  video.addEventListener("click", () => { if (!video.controls) togglePolicyVideo(); });
  seek.addEventListener("input", () => { video.currentTime = Number(seek.value); });
  if (document.fullscreenEnabled || video.webkitEnterFullscreen) {
    expand.hidden = false;
    expand.addEventListener("click", async () => {
      try {
        if (document.fullscreenEnabled) await video.requestFullscreen();
        else video.webkitEnterFullscreen();
        video.controls = true;
      } catch {
        video.controls = false;
      }
    });
    document.addEventListener("fullscreenchange", () => { video.controls = document.fullscreenElement === video; });
    video.addEventListener("webkitendfullscreen", () => { video.controls = false; });
  } else {
    transport.setAttribute("data-no-fullscreen", "");
  }
  video.controls = false;
  transport.hidden = false;
  policyObserver.observe(video);
});

const dialog = document.querySelector("#figure-dialog");
const dialogImage = dialog.querySelector("img");
const figureTitle = dialog.querySelector("#figure-title");
const closeFigure = dialog.querySelector("button");
let figureTrigger;

document.querySelectorAll("[data-zoom]").forEach(link => {
  link.addEventListener("click", event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !dialog.showModal) return;
    event.preventDefault();
    figureTrigger = link;
    figureTitle.textContent = link.dataset.zoom;
    dialogImage.alt = link.querySelector("img").alt;
    dialogImage.src = link.href;
    dialog.showModal();
  });
});

closeFigure.addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});
dialog.addEventListener("close", () => figureTrigger?.focus());

const copyButton = document.querySelector("#copy-citation");
const citation = document.querySelector("#citation-text");
const copyStatus = document.querySelector("#copy-status");
let copyTimer;

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(citation.textContent);
    copyButton.textContent = "Copied";
    copyStatus.textContent = "BibTeX copied to the clipboard.";
  } catch {
    const selection = window.getSelection();
    selection.selectAllChildren(citation);
    copyButton.textContent = "Selected";
    copyStatus.textContent = "BibTeX selected. Use your copy shortcut.";
  }
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => { copyButton.textContent = "Copy BibTeX"; }, 3000);
});
