/* eslint-disable no-console */
import { sendMessage } from "webext-bridge/content-script"
logStartOfAddon(Platforms.Amazon)
// Global Variables

const { data: settings, promise } = useBrowserSyncStorage<settingsType>("settings", defaultSettings)
const today = date.toISOString().split("T")[0]

const ua = navigator.userAgent
const isMobile = /mobile|streamingEnhanced/i.test(ua)
let url = window.location.href
const hostname = window.location.hostname
const title = document.title
const isPrimeVideo = /amazon|primevideo/i.test(hostname) && (/video/i.test(title) || /video/i.test(url))
let isNetflix = /netflix/i.test(hostname)
let isDisney = /disneyplus|starplus/i.test(hostname)
const isHotstar = /hotstar/i.test(hostname)
let isHBO = /max.com/i.test(hostname)
const htmlLang = document.documentElement.lang

const AmazonVideoClass = ".dv-player-fullscreen video"
let DBCache: DBCache = {}

export async function startSharedFunctions(platform: Platforms) {
	// if(platform == Platforms.Amazon) isPrimeVideo = true, because should only be called on amazon prime video
	if (platform == Platforms.Netflix) isNetflix = true
	if (platform == Platforms.Disney) isDisney = true
	if (platform == Platforms.HBO) isHBO = true

	await promise
	if (settings.value.Video.playOnFullScreen) startPlayOnFullScreen()
	getDBCache()
}

type MovieInfo = {
	id: number
	title: string
	score: number
	vote_count: number
	release_date: string
	media_type: string
	date: string
	db: string
}
type DBCache = {
	[title: string]: MovieInfo
}
async function getDBCache() {
	chrome.storage.local.get("DBCache", function (result) {
		DBCache = result?.DBCache
		if (typeof DBCache !== "object") {
			console.log("DBCache not found, creating new one", DBCache)
			try {
				chrome.storage.local.set({ DBCache: {} })
			} catch (error) {
				console.log(error)
			}
			DBCache = {}
		}
		if (isNetflix && settings.value.Netflix?.showRating) startShowRatingInterval()
		else if (isDisney || isHotstar) {
			if (settings.value.Disney?.showRating) startShowRatingInterval()
		} else if (isPrimeVideo && settings.value.Amazon?.showRating) startShowRatingInterval()
		else if (isHBO && settings.value.HBO?.showRating) startShowRatingInterval()
		if (getDiffInDays(settings.value.General.GCdate, date) >= GCdiff) garbageCollection()
	})
	chrome.storage.local.onChanged.addListener(function (changes) {
		if (changes?.DBCache) DBCache = changes.DBCache.newValue
	})
}
// set DB Cache if cache size under 5MB
async function setDBCache() {
	const size = new TextEncoder().encode(JSON.stringify(DBCache)).length
	const kiloBytes = size / 1024
	const megaBytes = kiloBytes / 1024
	if (megaBytes < 5) {
		console.log("updateDBCache size:", megaBytes.toFixed(4) + " MB")
		chrome.storage.local.set({ DBCache })
	} else {
		console.log("DBCache cleared", megaBytes)
		DBCache = {}
		chrome.storage.local.set({ DBCache })
	}
}

// how long a record should be kept in the cache
const GCdiff = 30
async function garbageCollection() {
	// clear every rating older than 30 days
	// clear every rating where db != tmdb
	console.log("garbageCollection started, deleting old ratings:")
	const keys = Object.keys(DBCache)
	for (const key of keys) {
		if (getDiffInDays(DBCache[key].date, date) >= GCdiff || DBCache[key].db != "tmdb") {
			console.log(DBCache[key].date, key)
			delete DBCache[key]
		}
	}
	settings.value.General.GCdate = today
	setDBCache()
}
// #region exported functions
// parse string time to seconds e.g. 1:30 -> 90
export function parseAdTime(adTimeText: string | null) {
	if (!adTimeText) return false
	const adTime: number =
		parseInt(/:\d+/.exec(adTimeText ?? "")?.[0].substring(1) ?? "") +
		parseInt(/\d+/.exec(adTimeText ?? "")?.[0] ?? "") * 60
	if (isNaN(adTime)) return false
	return adTime
}

export function createSlider(
	video: HTMLVideoElement,
	videoSpeed: Ref<number>,
	position: HTMLElement,
	sliderStyle: string,
	speedStyle: string,
	divStyle = "",
) {
	videoSpeed.value = videoSpeed.value || video.playbackRate

	const slider = document.createElement("input")
	slider.id = "videoSpeedSlider"
	slider.type = "range"
	slider.min = settings.value.General.sliderMin.toString()
	slider.max = settings.value.General.sliderMax.toString()
	slider.value = (videoSpeed.value * 10).toString()
	slider.step = settings.value.General.sliderSteps.toString()
	slider.style.cssText = sliderStyle

	const speed = document.createElement("p")
	speed.id = "videoSpeed"
	speed.textContent = videoSpeed.value ? videoSpeed.value.toFixed(1) + "x" : "1.0x"
	speed.style.cssText = speedStyle
	if (divStyle) {
		const div = document.createElement("div")
		div.style.cssText = divStyle
		div.appendChild(slider)
		div.appendChild(speed)
		position.prepend(div)
	} else position.prepend(slider, speed)

	if (videoSpeed.value) video.playbackRate = videoSpeed.value
	speed.onclick = function () {
		slider.style.display = slider.style.display === "block" ? "none" : "block"
	}
	slider.oninput = function () {
		const sliderValue = parseFloat(slider.value)
		speed.textContent = (sliderValue / 10).toFixed(1) + "x"
		video.playbackRate = sliderValue / 10
		videoSpeed.value = sliderValue / 10
	}

	return { slider, speed }
}
// #endregion

// #region startSharedFuncs
type TMDBMovie = {
	adult: boolean
	backdrop_path: string
	genre_ids: Array<number>
	id: number
	original_language: string
	original_title: string
	original_name: string
	overview: string
	popularity: number
	poster_path: string
	release_date: string
	first_air_date: string
	title: string
	name: string
	video: boolean
	vote_average: number
	vote_count: number
	media_type: string
}
type TMDBResponse = {
	page: number
	results: Array<TMDBMovie>
	total_pages: number
	total_results: number
}

async function getMovieInfo(
	title: string,
	card: HTMLElement,
	media_type: string | null = null,
	year: string | null = null,
) {
	const locale = htmlLang || navigator?.language || "en-US"
	const queryType = media_type ?? "multi"
	let url = `https://api.themoviedb.org/3/search/${queryType}?query=${encodeURI(title)}&include_adult=false&language=${locale}&page=1`
	if (year) url += `&year=${year}`
	const data: TMDBResponse = await sendMessage("fetch", { url }, "background")
	if (data != undefined) {
		// themoviedb
		const movie = data?.results?.[0]
		const compiledData: MovieInfo = {
			id: movie?.id,
			media_type: queryType == "multi" ? movie?.media_type : queryType,
			score: movie?.vote_average,
			vote_count: movie?.vote_count,
			release_date: movie?.release_date || movie?.first_air_date,
			title: movie?.title || movie?.original_title || movie?.name || movie?.original_name,
			date: today,
			db: "tmdb",
		}
		DBCache[title] = compiledData
		setRatingOnCard(card, compiledData, title)
	}
}

// show rating depending on page
const uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/g
function showRating() {
	if (isDisney) {
		url = window.location.href
		// disable search and suggested movies
		if (url.includes("search")) return false
		if (url.includes("entity")) {
			const SelectedTab = document.querySelector('[aria-selected="true"]')
			return (
				uuidRegex.test(SelectedTab?.id?.split("_control")?.[0] ?? "") &&
				SelectedTab?.getAttribute("aria-label") != "EXTRAS"
			)
		}
		return true
	} else if (isPrimeVideo) {
		// suggested movies
		if (window.location.href.includes("detail")) {
			return document.querySelector('[data-testid="btf-related-tab"]')?.getAttribute("tabIndex") == "0"
		}
		return true
	} else return true
}
async function startShowRatingInterval() {
	if (showRating()) addRating()
	const RatingInterval = setInterval(function () {
		if (
			(isNetflix && !settings.value.Netflix?.showRating) ||
			(isPrimeVideo && !settings.value.Amazon?.showRating) ||
			((isDisney || isHotstar) && !settings.value.Disney?.showRating) ||
			(isHBO && !settings.value.HBO?.showRating)
		) {
			console.log("stopped adding Rating")
			clearInterval(RatingInterval)
			return
		}
		if (showRating()) addRating()
	}, 1000)
}
function getDiffInDays(firstDate: string, secondDate: Date) {
	if (!firstDate || !secondDate) return 31
	return Math.round(Math.abs(new Date(secondDate).getTime() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24))
}
function useDBCache(title: string, card: HTMLElement, media_type: string | null) {
	if (!DBCache[title]?.date) DBCache[title].date = today
	const vote_count = DBCache[title]?.vote_count || 100
	const diffInReleaseDate =
		// vote count is under 80 inaccurate rating
		vote_count < 100 &&
		// did not refresh rating in the last 0 days
		getDiffInDays(DBCache[title].date, date) > 0 &&
		// release date is in the last 50 days after not many people will
		getDiffInDays(DBCache[title]?.release_date, date) <= 50

	// refresh rating if older than 30 days or release date is in last month and vote count is under 100
	if (getDiffInDays(DBCache[title].date, date) >= GCdiff || diffInReleaseDate) {
		if (diffInReleaseDate)
			console.log(
				"update recent movie:",
				title,
				",Age:",
				getDiffInDays(DBCache[title]?.release_date, date),
				"Vote count:",
				vote_count,
			)
		else console.log("update old rating:", title, ",Age:", getDiffInDays(DBCache[title].date, date))
		getMovieInfo(title, card, media_type)
	} else {
		setRatingOnCard(card, DBCache[title], title)
	}
}
function getMediaType(type: string) {
	if (!type) return null
	if (type.toLowerCase().includes("tv")) return "tv"
	if (type.toLowerCase().includes("movie")) return "movie"
	return null
}
async function addRating() {
	url = window.location.href
	let AllTitleCardsTypes: Array<NodeListOf<Element>> = []
	if (isNetflix) AllTitleCardsTypes = [document.querySelectorAll(".title-card .boxart-container:not(.imdb)")]
	else if (isDisney) AllTitleCardsTypes = [document.querySelectorAll("a[data-testid='set-item']:not(.imdb)")]
	else if (isHotstar) AllTitleCardsTypes = [document.querySelectorAll(".swiper-slide img:not(.imdb)")]
	else if (isHBO)
		AllTitleCardsTypes = [document.querySelectorAll("a[class*='StyledTileLinkNormal-Beam-Web-Ent']:not(.imdb)")]
	else if (isPrimeVideo)
		AllTitleCardsTypes = [
			document.querySelectorAll(
				"li:not(.imdb) article[data-card-title]:not([data-card-entity-type='EVENT']):not([data-card-title='Live-TV'])",
			),
			document.querySelectorAll("article[data-testid*='-card']:not(.imdb):not(:has(a#rating))"),
		]
	// on disney there are multiple images for the same title so only use the first one
	let lastTitle = ""
	// for each is not going in order on chrome
	let updateDBCache = false
	for (let type = 0; type < AllTitleCardsTypes.length; type++) {
		const titleCards = AllTitleCardsTypes[type]
		let media_type = null
		for (let i = 0; i < titleCards.length; i++) {
			const card = titleCards[i] as HTMLElement
			// add seen class
			if (isNetflix || isDisney || isHotstar || isHBO) card.classList.add("imdb")
			else if (isPrimeVideo) {
				if (type == 0) card?.closest("li")?.classList.add("imdb")
				else if (type == 1) card?.classList.add("imdb")
			}
			let title: string | undefined
			if (isNetflix) {
				title = card?.parentElement?.getAttribute("aria-label")?.split(" (")[0]
				if (url.includes("genre/83")) media_type = "tv"
				else if (url.includes("genre/34399")) media_type = "movie"
			} else if (isDisney) {
				title = card?.getAttribute("aria-label")?.replace(" Disney+ Original", "")?.replace(" STAR Original", "")
				// no section Extras on disney shows
				if (url.includes("entity")) {
					const SelectedTabId = document.querySelector('[aria-selected="true"]')?.id.split("_control")[0]
					if (SelectedTabId != card.closest('div[role="tabpanel"]')?.id) title = ""
				}
				if (url.includes("browse/series")) media_type = "tv"
				else if (url.includes("browse/movies")) media_type = "movie"
				else if (/(Staffel)|(Nummer)|(Season)|(Episod)|(Number)/g.test(title ?? "")) media_type = "tv"
				// german translation
				if (htmlLang == "de") {
					title = title
						?.replace(/Nummer \d* /, "")
						.split(" Für Details")[0]
						.split(" Staffel")[0]
						.split("Staffel")[0]
						.split(" Neue")[0]
						.split(" Alle")[0]
						.split(" Demnächst")[0]
						.split(" Altersfreigabe")[0]
						.split(" Mach dich bereit")[0] // deadpool
						//did not find translation
						.split(" Jeden")[0]
						.split(" Noch")[0]
						.split(" Premiere")[0]
				} else if (htmlLang == "en") {
					title = title
						?.replace(/Number \d* /, "")
						.replace(" Select for details on this title.", "")
						.split(" Season")[0]
						.split("Season")[0]
						.split(" New ")[0]
						.split(" All Episodes")[0]
						.split(" Coming")[0]
						.split(" Two-Episode")[0]
						.split(" Rated")[0]
						.split(" Prepare for")[0] // deadpool
						//did not find translation
						.split(" Streaming ")[0]
						//did not find translation
						.replace(/ \d+ minutes remaining/g, "")
				}
			} else if (isHotstar) title = card?.getAttribute("alt")?.replace(/(S\d+\sE\d+)/g, "")
			else if (isPrimeVideo) {
				function fixTitle(title: string | undefined) {
					return (
						title
							?.split(" - ")[0]
							?.split(" – ")[0]
							?.replace(/(S\d+)/g, "")
							?.replace(/ \[.*\]/g, "")
							?.replace(/\s\(.*\)/g, "")
							?.replace(/:?\sStaffel-?\s\d+/g, "")
							?.replace(/:?\sSeason-?\s\d+/g, "")
							?.replace(/ \/ \d/g, "")
							?.split(": Die komplette")[0]
							// nicht sicher
							?.split(": The complete")[0]
					)
				}
				// detail means not live shows
				if (card.querySelector("a")?.href?.includes("detail")) {
					if (type == 0) title = fixTitle(card.getAttribute("data-card-title") ?? "")
					else if (type == 1) title = fixTitle(card.querySelector("a")?.getAttribute("aria-label") ?? "")
				}
				if (url.includes("video/tv")) media_type = "tv"
				else if (url.includes("video/movie")) media_type = "movie"
				else media_type = getMediaType(card.getAttribute("data-card-entity-type") ?? "")
			} else if (isHBO) title = card.querySelector("p[class*='md_strong-Beam-Web-Ent']")?.textContent ?? ""
			// for the static Pixar Disney, Starplus etc. cards
			if (!isDisney || !card?.classList.contains("_1p76x1y4")) {
				// sometimes more than one image is loaded for the same title
				if (title && lastTitle != title && !title.includes("Netflix") && !title.includes("Prime Video")) {
					lastTitle = title
					if (
						(DBCache[title]?.score || getDiffInDays(DBCache[title]?.date, date) <= 7) &&
						(!media_type || DBCache[title]?.media_type == media_type)
					) {
						useDBCache(title, card, media_type)
					} else {
						getMovieInfo(title, card, media_type)
						updateDBCache = true
					}
				}
			}
		}
	}
	if (updateDBCache) {
		setTimeout(function () {
			setDBCache()
		}, 5000)
	}
}
function getColorForRating(rating: number, lowVoteCount: boolean) {
	// I want a color gradient from red to green with yellow in the middle
	// the ratings are between 0 and 10
	// the average rating is 6.5
	// https://distributionofthings.com/imdb-movie-ratings/
	if (!rating || lowVoteCount) return "grey"
	if (rating <= 5.5) return "red"
	if (rating <= 7) return "rgb(245, 197, 24)" //#f5c518
	return "rgb(0, 166, 0)"
}
function getTMDBUrl(id: string | number, media_type: string) {
	return `https://www.themoviedb.org/${media_type}/${id}`
}

async function setRatingOnCard(card: HTMLElement, data: MovieInfo, title: string) {
	let div
	if (data?.id) {
		div = document.createElement("a")
		div.href = getTMDBUrl(data.id, data.media_type)
		div.target = "_blank"
	} else div = document.createElement("div")
	const vote_count = data?.vote_count || 100
	// right: 1.5vw;
	div.id = "rating"
	Object.assign(div.style, {
		position: "absolute",
		bottom: "0",
		color: "black",
		textDecoration: "none",
		background: getColorForRating(data?.score, vote_count < 50),
		borderRadius: "5px",
		padding: "0 2px 0 2px",
		right: isNetflix ? "0.2vw" : "0",
		zIndex: isDisney ? "" : "9999",
		fontSize: isMobile ? "4vw" : "1vw",
	})

	if (data?.score >= 0) {
		let releaseDate = ""
		if (settings.value.Video?.showYear && data?.release_date) {
			releaseDate = new Date(data?.release_date)?.getFullYear() + "-"
			// const year = new Date(data?.release_date)?.getYear();
			// releaseDate = year >= 100 ? (year + " ").substring(1) : year + " ";
		}
		div.textContent = releaseDate + data.score?.toFixed(1)
		div.setAttribute("alt", data?.title + ", OG title: " + title + ", Vote count: " + vote_count)
	} else {
		div.textContent = "?"
		div.setAttribute("alt", title)
		console.log("no score found:", title, data)
	}
	if (isNetflix) {
		card.closest(".title-card-container")?.appendChild(div)
	} else if (isHBO) card.appendChild(div)
	else if (isDisney) {
		const parentDiv = card?.closest("div")
		if (parentDiv) {
			if (card.nextElementSibling) {
				div.style.top = card.offsetHeight + "px"
				div.style.bottom = ""
			}
			parentDiv.style.position = "relative"
			parentDiv.appendChild(div)
		}
	} else if (isHotstar) card?.parentElement?.appendChild(div)
	else if (isPrimeVideo) {
		if (card.getAttribute("data-card-title")) card?.firstChild?.firstChild?.appendChild(div)
		else if (card.querySelector('div[data-testid="title-metadata-main"]')) {
			card.querySelector('div[data-testid="title-metadata-main"]')?.appendChild(div)
		} else card.appendChild(div)
	}
}
function OnFullScreenChange() {
	let video: HTMLVideoElement
	if (isDisney)
		video = Array.from(document.querySelectorAll("video")).find((v) => v.checkVisibility()) as HTMLVideoElement
	else if (isNetflix || isHotstar || isHBO) video = document.querySelector("video") as HTMLVideoElement
	else video = document.querySelector(AmazonVideoClass) as HTMLVideoElement
	//TODO: window.fullScreen
	if (document.fullscreenElement && video) {
		video.play()
		console.log("auto-played on fullscreen")
		increaseBadge()
	}
}
async function startPlayOnFullScreen() {
	if (settings.value.Video?.playOnFullScreen) {
		addEventListener("fullscreenchange", OnFullScreenChange)
	} else {
		removeEventListener("fullscreenchange", OnFullScreenChange)
	}
}
// #endregion
