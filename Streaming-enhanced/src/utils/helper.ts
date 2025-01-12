import { createPinia } from "pinia"
import { useOptionsStore } from "@/stores/options.store"
import { sendMessage } from "webext-bridge/content-script"
// Global Variables
// Use the store
export const date = new Date()
// export const isFirefox = typeof browser !== "undefined"
// default Options for the observer (which mutations to observe)
export const config = { attributes: true, childList: true, subtree: true }

const { data: settings, promise } = useBrowserSyncStorage<settingsType>("settings", defaultSettings)
const version = __VERSION__

// Functions
// custom log function
// export async function log(...args: any[]) {
// 	console.log(date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds() + date.getMilliseconds(), ...args)
// }

// increase the badge count
export async function increaseBadge() {
	settings.value.Statistics.SegmentsSkipped++
	sendMessage("increaseBadge", {}, "background")
}
type StatisticsKey =
	| "AmazonAdTimeSkipped"
	| "NetflixAdTimeSkipped"
	| "DisneyAdTimeSkipped"
	| "IntroTimeSkipped"
	| "RecapTimeSkipped"
	| "SegmentsSkipped"
export async function addSkippedTime(startTime: number, endTime: number, key: StatisticsKey) {
	if (typeof startTime === "number" && typeof endTime === "number" && endTime > startTime) {
		console.log(key, endTime - startTime)
		settings.value.Statistics[key] += endTime - startTime
		increaseBadge()
	}
}

export enum Platforms {
	Netflix = "netflix",
	Amazon = "amazon",
	StarPlus = "starplus",
	Disney = "disney",
	Hotstar = "hotstar",
	Crunchyroll = "crunchyroll",
	HBO = "hbo",
}
export async function logStartOfAddon(page: Platforms) {
	await promise
	console.log("%cStreaming enhanced", "color: #00aeef;font-size: 2em;")
	console.log("version:", version)
	console.log("Settings", settings.value)
	if (page == Platforms.Netflix) console.log("Page %cNetflix", "color: #e60010;")
	else if (page == Platforms.Amazon) console.log("Page %cAmazon", "color: #00aeef;")
	else if (page == Platforms.StarPlus) console.log("Page %cStarPlus", "color: #fe541c;")
	else if (page == Platforms.Disney) console.log("Page %cDisney", "color: #0682f0;")
	else if (page == Platforms.Hotstar) console.log("Page %cHotstar", "color: #0682f0;")
	else if (page == Platforms.Crunchyroll) console.log("Page %cCrunchyroll", "color: #e67a35;")
	else if (page == Platforms.HBO) console.log("Page %cHBO", "color: #0836f1;")
}
