const defaultSettings = {
  settings: {
    Amazon: { skipIntro: true, skipCredits: true, watchCredits: false, skipAd: true, blockFreevee: true, speedSlider: true, filterPaid: false, showRating: true, streamLinks: true },
    Netflix: { skipIntro: true, skipRecap: true, skipCredits: true, watchCredits: false, skipBlocked: true, NetflixAds: true, speedSlider: true, profile: true, showRating: true },
    Disney: { skipIntro: true, skipCredits: true, watchCredits: false, speedSlider: true, showRating: true },
    Crunchyroll: { skipIntro: true, skipCredits: true, watchCredits: false, speedSlider: true, releaseCalendar: true },
    Video: { playOnFullScreen: true },
    Statistics: { AmazonAdTimeSkipped: 0, NetflixAdTimeSkipped: 0, IntroTimeSkipped: 0, RecapTimeSkipped: 0, SegmentsSkipped: 0 },
    General: { profileName: null, profilePicture: null, sliderSteps: 1, sliderMin: 5, sliderMax: 20, filterDub: true, filterQueued: true },
  },
};
let settings = defaultSettings.settings;
const version = "1.0.64";
browser.storage.sync.get("settings", function (result) {
  console.log("%cNetflix%c/%cPrime%c Auto-Skip", "color: #e60010;font-size: 2em;", "color: white;font-size: 2em;", "color: #00aeef;font-size: 2em;", "color: white;font-size: 2em;");
  console.log("version:", version);
  settings = result.settings;
  if (typeof settings !== "object") {
    browser.storage.sync.set(defaultSettings);
  } else {
    CrunchyrollObserver.observe(document, config);

    let changedSettings = false;
    for (const key in defaultSettings.settings) {
      if (typeof settings[key] === "undefined") {
        log("undefined Setting:", key);
        changedSettings = true;
        settings[key] = defaultSettings.settings[key];
      } else {
        for (const subkey in defaultSettings.settings[key]) {
          if (typeof settings[key][subkey] === "undefined") {
            log("undefined Setting:", key, subkey);
            changedSettings = true;
            settings[key][subkey] = defaultSettings.settings[key][subkey];
          }
        }
      }
    }
    if (changedSettings) {
      browser.storage.sync.set({ settings });
    }
  }
});
const config = { attributes: true, childList: true, subtree: true };
const CrunchyrollObserver = new MutationObserver(Crunchyroll);
function Crunchyroll() {
  if (settings.Crunchyroll?.skipIntro) Crunchyroll_Intro();
  // if (settings.Crunchyroll?.skipCredits) Crunchyroll_Credits();
  // if (settings.Crunchyroll?.watchCredits) Crunchyroll_Watch_Credits();
  if (settings.Crunchyroll?.speedSlider) Crunchyroll_SpeedSlider();
}
async function Crunchyroll_Intro() {
  const button = document.querySelector('[data-testid="skipIntroText"]');
  if (button) {
    let video = document.querySelector("video");
    const time = video?.currentTime;
    button?.click();
    log("Intro skipped", button);
    setTimeout(function () {
      addSkippedTime(time, video?.currentTime, "IntroTimeSkipped");
    }, 600);
  }
}
let videoSpeed;
async function setVideoSpeed(speed) {
  videoSpeed = speed;
}
async function Crunchyroll_SpeedSlider() {
  let alreadySlider = document.querySelector("#videoSpeedSlider");
  let video = document.querySelector("video");
  if (video && !alreadySlider) {
    // infobar position for the slider to be added
    // console.log(document.querySelector("#settingsControl"));
    const position = document.querySelector("#settingsControl")?.parentElement;
    if (position) {
      videoSpeed = videoSpeed ? videoSpeed : video.playbackRate;
      let slider = document.createElement("input");
      slider.id = "videoSpeedSlider";
      slider.type = "range";
      slider.min = settings.General.sliderMin;
      slider.max = settings.General.sliderMax;
      slider.value = videoSpeed * 10;
      slider.step = settings.General.sliderSteps;
      slider.style = "display: none;width:200px;";

      let speed = document.createElement("p");
      speed.id = "videoSpeed";
      speed.textContent = videoSpeed ? videoSpeed + "x" : "1x";
      // makes the button clickable
      // speed.setAttribute("class", "control-icon-btn");
      speed.style = "color:white;margin: auto;padding: 0 5px;";
      position.insertBefore(speed, position.firstChild);
      position.insertBefore(slider, position.firstChild);

      if (videoSpeed) video.playbackRate = videoSpeed;
      speed.onclick = function (event) {
        event.stopPropagation();
        if (slider.style.display === "block") slider.style.display = "none";
        else slider.style.display = "block";
      };
      slider.onclick = function (event) {
        event.stopPropagation();
      };
      slider.oninput = function (event) {
        event.stopPropagation();
        speed.textContent = (this.value / 10).toFixed(1) + "x";
        video.playbackRate = this.value / 10;
        setVideoSpeed(this.value / 10);
      };
    }
  }
}
