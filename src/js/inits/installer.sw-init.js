import { getAssetURLs } from "../manifests/assets.manifests.js";
const ASSETS = getAssetURLs();

function log(s) {
	console.log(s);
	document.getElementById("installStatus").innerText = s;
}

if ("serviceWorker" in navigator) {
	navigator.serviceWorker
		.register("/disclegends/service-worker.js")
		.catch((e) => console.error("sw reg failed", e));
}

document.getElementById("installBtn").addEventListener("click", async () => {
	document.querySelector("#retryBtn").style.display = "none";
	document.querySelector(".install-screen-txt-cont").style.paddingBottom =
		"12%";
	document.querySelector("#installBtn").style.display = "none";
	document.querySelector("#installStatus").style.display = "flex";
	log("Waiting for service worker...");
	const reg = await navigator.serviceWorker.ready;
	const sw = reg.active || reg.waiting || reg.installing;
	if (!sw) {
		log("No active service worker found");
		return;
	}

	// Listen to the single final message
	function onMessage(evt) {
		const m = evt.data || {};
		if (m.type === "CACHE_DONE") {
			log(`Downloading.. ${m.successCount}/${m.total} assets.`);
			navigator.serviceWorker.removeEventListener("message", onMessage);
			if (!m.failed || m.failed.length === 0) {
				// All cached — navigate to app.php (your PWA entry)
				// location.href = "/app.php";
				log(`Installing App..`);
				tryInstallPWA();
				// console.log("redirecting phase..");
			} else {
				log(`There was a problem while downloading some assets..`);
				document.querySelector(
					".install-screen-txt-cont",
				).style.paddingBottom = "3%";
				document.querySelector("#retryBtn").style.display = "flex";
			}
		}
		if (m.type === "CACHE_ERROR") {
			log("Cache error: " + m.error);
			navigator.serviceWorker.removeEventListener("message", onMessage);
		}
	}

	navigator.serviceWorker.addEventListener("message", onMessage);

	// Kick off caching (no progress messages - final only)
	sw.postMessage({ type: "CACHE_ASSETS", payload: { assets: ASSETS } });
});
