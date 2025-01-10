// Sample code if using extensionpay.com
// import { extPay } from '@/utils/payment/extPay'
// extPay.startBackground()

chrome.runtime.onInstalled.addListener(async (opt) => {
	// Check if reason is install or update. Eg: opt.reason === 'install' // If extension is installed.
	// opt.reason === 'update' // If extension is updated.
	if (opt.reason === "install") {
		// TODO: add back
		// await chrome.storage.local.clear()

		chrome.tabs.create({
			active: true,
			// Open the setup page and append `?type=install` to the URL so frontend
			// can know if we need to show the install page or update page.
			// url: chrome.runtime.getURL("src/ui/setup/index.html#/setup/install"),
			// url: chrome.runtime.getURL("src/ui/setup/index.html#/action-popup/"),
			url: chrome.runtime.getURL("src/ui/options-page/index.html#/options-page"),
		})
	}

	if (opt.reason === "update") {
		chrome.tabs.create({
			active: true,
			// url: chrome.runtime.getURL("src/ui/setup/index.html#/setup/update"),
			url: chrome.runtime.getURL("src/ui/options-page/index.html#/options-page"),
		})
	}
})

self.onerror = function (message, source, lineno, colno, error) {
	console.info("Error: " + message)
	console.info("Source: " + source)
	console.info("Line: " + lineno)
	console.info("Column: " + colno)
	console.info("Error object: " + error)
}

console.info("hello world from background")
import { onMessage, sendMessage } from "webext-bridge/background"
import { log, optionsStore, checkStoreReady } from "@/utils/helper"
log("background loaded")
const { settings } = storeToRefs(optionsStore)
const Badges: { [key: string]: string | number } = {}
const isMobile = /Android/i.test(navigator.userAgent)
// Increases Badge by 1
async function increaseBadge(tabId: number) {
	if (Badges?.[tabId] === undefined || typeof Badges[tabId] !== "number") {
		Badges[tabId] = 0
	}
	Badges[tabId]++
	browser.browserAction.setBadgeText({ text: Badges[tabId].toString(), tabId })
}
// Set Badge to a specific value
async function setBadgeText(text: string, tabId: number) {
	Badges[tabId] = text
	browser.browserAction.setBadgeText({ text, tabId })
}

// onMessage
onMessage("fetch", async (message: { sender: any; data: { url: string } }) => {
	const { sender, data } = message
	fetch(data.url, {
		method: "GET",
		headers: {
			accept: "application/json",
			Authorization:
				"Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI5OWQyMWUxMmYzNjU1MjM4NzdhNTAwODVhMmVjYThiZiIsInN1YiI6IjY1M2E3Mjg3MjgxMWExMDBlYTA4NjI5OCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.x_EaVXQkg1_plk0NVSBnoNUl4QlGytdeO613nXIsP3w",
		},
	})
		.then((response) => response.json())
		.then((data) => sendMessage("fetch", data, "content-script"))
		.catch((error) => console.error(error))
	return true // Indicates that sendResponse will be called asynchronously
})
onMessage("fullscreen", async (message: { sender: any }) => {
	const { sender } = message
	browser.windows.update(sender.tab.windowId, { state: "fullscreen" })
})
onMessage("exitFullscreen", async (message: { sender: any }) => {
	const { sender } = message
	browser.windows.update(sender.tab.windowId, { state: "normal" })
})
onMessage("setBadgeText", async (message: { sender: any; data: { text: string } }) => {
	const { sender, data } = message
	setBadgeText(data.text, sender.tab.id)
})
onMessage("increaseBadge", async (message: { sender: any }) => {
	const { sender } = message
	increaseBadge(sender.tab.id)
})
onMessage("resetBadge", async (message: { sender: any }) => {
	const { sender } = message
	if (Badges[sender.tab.id]) delete Badges[sender.tab.id]
	browser.browserAction.setBadgeText({ text: "", tabId: sender.tab.id })
})

async function startMobile() {
	await checkStoreReady(settings)
	ChangeUserAgent()
}

if (isMobile) {
	startMobile()
}
const newUa = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0 streamingEnhanced"
function ReplaceUserAgent(details: any) {
	if (settings.value.Video.userAgent) {
		for (const header of details.requestHeaders) {
			if (header.name === "User-Agent") {
				header.value = newUa
				break
			}
		}
	}
	return { requestHeaders: details.requestHeaders }
}

function ChangeUserAgent() {
	browser.webRequest.onBeforeSendHeaders.addListener(
		ReplaceUserAgent,
		{
			urls: [
				"*://*.disneyplus.com/*",
				"*://*.starplus.com/*",
				"*://*.max.com/*",
				"*://*.hbomax.com/*",
				// these are only the prime video urls
				"*://*.primevideo.com/*",
				"*://*.amazon.com/gp/video/*",
				"*://*.amazon.co.jp/gp/video/*",
				"*://*.amazon.de/gp/video/*",
				"*://*.amazon.co.uk/gp/video/*",
			],
		},
		["blocking", "requestHeaders"],
	)
}
