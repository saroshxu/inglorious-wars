import { getAssetURLs } from "../manifests/assets.manifests.js";
const ASSETS = getAssetURLs();
function log(s) {
	console.log(s);
	document.getElementById("installStatus").innerText = s;
}
if ("serviceWorker" in navigator) {
	navigator.serviceWorker
		.register("/inglorious-wars/service-worker.js")
		.catch((e) => console.error("sw reg failed", e));
}
document.getElementById("installBtn").addEventListener("click", async () => {
	document.querySelector("#retryBtn").style.display = "none";
	document.querySelector(".install-screen-txt-cont").style.paddingBottom =
		"12%";
	document.querySelector("#installBtn").style.display = "none";
	document.querySelector("#installStatus").style.display = "flex";
	log("Waiting for service worker..");
	const reg = await navigator.serviceWorker.ready;
	const sw = reg.active || reg.waiting || reg.installing;
	if (!sw) {
		log("No active service worker found");
		return;
	}
	let totalAssets = 0;
	let completedAssets = 0;
	function onMessage(evt) {
		const m = evt.data || {};
		if (m.type === "CACHE_PROGRESS") {
			totalAssets = m.total;
			completedAssets = m.processed;

			log(`Downloading.. ${completedAssets}/${totalAssets} assets..`);
			return;
		}
		if (m.type === "CACHE_DONE") {
			log(`Downloaded ${m.successCount}/${m.total} assets..`);
			navigator.serviceWorker.removeEventListener("message", onMessage);
			if (!m.failed || m.failed.length === 0) {
				// log("Installing App..");
				document.querySelector("#PWAInstallBtn").style.display = "flex";
			} else {
				log("There was a problem while downloading some assets..");
				document.querySelector(
					".install-screen-txt-cont",
				).style.paddingBottom = "3%";
				document.querySelector("#retryBtn").style.display = "flex";
			}
			return;
		}
		if (m.type === "CACHE_ERROR") {
			log("Cache error: " + m.error);
			navigator.serviceWorker.removeEventListener("message", onMessage);
			return;
		}
	}
	navigator.serviceWorker.addEventListener("message", onMessage);
	sw.postMessage({
		type: "CACHE_ASSETS",
		payload: { assets: ASSETS },
	});
});
