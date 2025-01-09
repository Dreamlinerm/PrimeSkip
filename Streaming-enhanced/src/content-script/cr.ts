// import { createPinia, defineStore } from "pinia"
// import { useOptionsStore } from "@/stores/options.store"
import { log, increaseBadge, optionsStore } from "@/utils/helper"
const { settings } = optionsStore
// const pinia = createPinia()

// // Global Variables

// // Use the store
// const optionsStore = useOptionsStore(pinia)
// const { settings } = optionsStore

// default Options for the observer (which mutations to observe)
const config = { attributes: true, childList: true, subtree: true }
const url = window.location.href

function startCrunchyroll() {
	if (settings.Crunchyroll.releaseCalendar) Crunchyroll_ReleaseCalendar()
	if (settings.Crunchyroll.profile) {
		const pickInterval = setInterval(function () {
			Crunchyroll_AutoPickProfile()
		}, 100)
		setTimeout(function () {
			if (settings.Crunchyroll?.bigPlayer) Crunchyroll_bigPlayerStyle()
		}, 1000)
		// only click on profile on page load not when switching profiles
		setTimeout(function () {
			clearInterval(pickInterval)
		}, 2000)
		CrunchyrollObserver.observe(document, config)
	}
}
// #region Crunchyroll
// Crunchyroll functions

type displayType = "block" | "none"
function filterQueued(display: displayType) {
	document.querySelectorAll("div.queue-flag:not(.queued)").forEach((element) => {
		// if not on premiere
		if (element?.parentElement?.parentElement?.parentElement) {
			element.parentElement.parentElement.parentElement.style.display = element.parentElement.parentElement
				.querySelector(".premiere-flag")
				?.checkVisibility()
				? "block"
				: display
		}
	})
	if (display == "block" && settings.General.filterDub) filterDub("none")
}

function filterDub(display: displayType) {
	const list = document.querySelectorAll("cite[itemprop='name']")
	list.forEach((element) => {
		if (
			(element?.textContent?.includes("Dub") || element?.textContent?.includes("Audio")) &&
			element?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement
		)
			element.parentElement.parentElement.parentElement.parentElement.parentElement.style.display = display
	})
	if (display == "block" && settings.General.filterQueued) filterQueued("none")
}
function createFilterElement(filterType, filterText, settingsValue, filterFunction) {
	const label = document.createElement("label")
	const span = document.createElement("span")
	span.style = "display: flex;align-items: center;"
	const input = document.createElement("input")
	input.type = "checkbox"
	input.checked = settingsValue
	input.id = filterType
	input.onclick = function () {
		settings.General[filterType] = this.checked
		filterFunction(this.checked ? "none" : "block")
		//setStorage()
	}
	const p = document.createElement("p")
	p.style = "width: 100px;"
	p.textContent = filterText
	label.appendChild(span)
	span.appendChild(input)
	span.appendChild(p)
	return label
}
function addButtons() {
	const toggleForm = document.querySelector("#filter_toggle_form")
	toggleForm.style.display = "flex"
	toggleForm.firstElementChild.appendChild(
		createFilterElement("filterQueued", "Show Playlist only", settings.General.filterQueued, filterQueued),
	)
	toggleForm.firstElementChild.appendChild(
		createFilterElement("filterDub", "Filter Dub", settings.General.filterDub, filterDub),
	)
}
// start of add CrunchyList to Crunchyroll
function addShowsToList(position, list) {
	list.forEach((element) => {
		const article = document.createElement("article")
		article.className = "release js-release"

		let time = document.createElement("time")
		time.className = "available-time"
		time.textContent = new Date(element.time).toLocaleString([], { hour: "2-digit", minute: "2-digit" })

		let div1 = document.createElement("div")
		let div2 = document.createElement("div")
		div2.className = "queue-flag queued enhanced"

		let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
		svg.setAttribute("viewBox", "0 0 48 48")

		let use = document.createElementNS("http://www.w3.org/2000/svg", "use")
		use.setAttributeNS(
			"http://www.w3.org/1999/xlink",
			"xlink:href",
			"/i/svg/simulcastcalendar/calendar_icons.svg#cr_bookmark",
		)

		svg.appendChild(use)
		div2.appendChild(svg)

		let h1 = document.createElement("h1")
		h1.className = "season-name"

		let a = document.createElement("a")
		a.className = "js-season-name-link"
		a.href = element.href
		a.setAttribute("itemprop", "url")

		let cite = document.createElement("cite")
		cite.setAttribute("itemprop", "name")
		cite.textContent = element.name

		a.appendChild(cite)
		h1.appendChild(a)

		div1.appendChild(div2)
		div1.appendChild(h1)

		article.appendChild(time)
		article.appendChild(div1)
		position.appendChild(article)
	})
}
function clickOnCurrentDay() {
	let days = document.querySelectorAll(".specific-date [datetime]")
	for (const day of days) {
		const dateOnPage = new Date(day.getAttribute("datetime"))
		// if the day of the week is the same as today click on it, like if its Monday click on Monday
		if (date.getDay() == dateOnPage.getDay()) {
			// need timeout because the page is not fully loaded
			setTimeout(() => {
				day.click()
			}, 100)
			// isCurrentWeek
			return date.toLocaleDateString() == dateOnPage.toLocaleDateString()
		}
	}
	return false
}
type Nullable<T> = T | null | undefined
type CrunchyListElement = { href: Nullable<string>; name: Nullable<string>; time: Nullable<string> }
type CrunchyList = Array<CrunchyListElement>
function createLocalList() {
	const localList: CrunchyList = []
	document.querySelectorAll("div.queue-flag.queued:not(.enhanced)").forEach((element) => {
		const h1 = element.nextElementSibling?.firstChild?.nextSibling as HTMLAnchorElement
		const name = h1?.firstChild?.nextSibling?.textContent
		if (!name?.includes("Dub")) {
			const href = h1?.href
			const time = element.parentElement?.parentElement?.firstElementChild?.getAttribute("datetime")
			localList.push({ href, name, time })
		}
	})
	return localList
}
function filterOldList(isCurrentWeek: boolean, localList: CrunchyList) {
	let oldList = settings.General.savedCrunchyList || []
	const lastElement = localList[localList.length - 1]
	const lastTime = new Date(lastElement.time)
	const [lastDay, lastHr, lastMin] = [lastTime.getDay(), lastTime.getHours(), lastTime.getMinutes()]
	// delete all previous weekdays from oldList
	if (!isCurrentWeek) {
		oldList = []
	} else {
		oldList = oldList
			.filter((item) => {
				return shiftSunday(date.getDay()) - shiftSunday(new Date(item.time).getDay()) <= 0
			})
			// delete all items from same weekday before lastElement time
			.filter((item) => {
				const itemTime = new Date(item.time)
				const itemHr = itemTime.getHours()
				// no shows today yet
				const itemDay = itemTime.getDay()
				return (
					lastDay != itemDay ||
					itemDay != date.getDay() ||
					itemHr > lastHr ||
					(itemHr == lastHr && itemTime.getMinutes() > lastMin)
				)
			})
	}
	return oldList
}
const shiftSunday = (a: number) => (a + 6) % 7
function addSavedCrunchyList() {
	const localList = createLocalList()
	const isCurrentWeek = clickOnCurrentDay()
	const oldList =
		localList.length > 0 ? filterOldList(isCurrentWeek, localList) : settings.General.savedCrunchyList || []
	settings.General.savedCrunchyList = localList.concat(oldList)
	//setStorage()
	if (isCurrentWeek && !document.querySelector("div.queue-flag.queued.enhanced")) {
		// now add the old list to the website list
		document.querySelectorAll("section.calendar-day").forEach((element) => {
			const weekday = new Date(element.querySelector("time")?.getAttribute("datetime")).getDay()
			// remove Schedule Coming Soon text
			if (shiftSunday(date.getDay()) - shiftSunday(weekday) < 0)
				element?.children?.[1]?.firstChild?.nextSibling?.remove()
			addShowsToList(
				element.children[1],
				oldList.filter((item) => new Date(item.time).getDay() == weekday),
			)
		})
	}
}
async function Crunchyroll_ReleaseCalendar() {
	if (url.includes("simulcastcalendar")) {
		// Show playlist only
		filterQueued(settings.General.filterQueued ? "none" : "block")
		filterDub(settings.General.filterDub ? "none" : "block")
		if (!document.querySelector("#filterQueued")) addButtons()
		// add saved CrunchyList and click on current day
		addSavedCrunchyList()
	}
}
const CrunchyrollObserver = new MutationObserver(Crunchyroll)
async function Crunchyroll() {
	if (settings.Crunchyroll?.profile) Crunchyroll_profile()
}
async function Crunchyroll_profile() {
	// save profile
	const img = document.querySelector(".erc-authenticated-user-menu img") as HTMLImageElement
	if (img && img.src !== settings.General.Crunchyroll_profilePicture) {
		settings.General.Crunchyroll_profilePicture = img.src
		//setStorage()
		log("Profile switched to", img.src)
	}
}
async function Crunchyroll_AutoPickProfile() {
	// click on profile picture
	if (document.querySelector(".profile-item-name")) {
		document.querySelectorAll(".erc-profile-item img")?.forEach((element) => {
			const img = element as HTMLImageElement
			if (img.src === settings.General.Crunchyroll_profilePicture) {
				img.click()
				log("Profile automatically chosen:", img.src)
				increaseBadge()
			}
		})
	}
}
async function Crunchyroll_bigPlayerStyle() {
	if (document.querySelector(".video-player-wrapper")) {
		// show header on hover
		const style = document.createElement("style")
		style.innerHTML = `
      .video-player-wrapper{
          max-Height: calc(100vw / 1.7777);
          height: 100vh;
      }
      .erc-large-header {
          position: absolute;
          top: 0;
          width: 100%;
          height: 3.75rem;
          z-index: 999;
      }
      .erc-large-header .header-content {
          position: absolute;
          top: -3.75rem;
          transition: top 0.4s, top 0.4s;
      }
      .erc-large-header:hover .header-content {
          top: 0;
      }
    `
		document.head.appendChild(style)
	}
}
// #endregion

startCrunchyroll()
