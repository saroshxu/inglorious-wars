import { getAssetURLs } from "../manifests/assets.manifests.js";
const ASSETS = getAssetURLs();

// ensure SW is registered somewhere earlier
if ("serviceWorker" in navigator) {
	navigator.serviceWorker.register("/service-wroker.js").catch(() => {});
}

/* ---------- helpers ---------- */

async function getActiveSW() {
	const reg = await navigator.serviceWorker.ready;
	return reg.active || reg.waiting || reg.installing || null;
}

// safe one-time listener wrapper
function onceMessage(filterFn, timeoutMs = 30000) {
	return new Promise((resolve, reject) => {
		let timer = null;
		function handler(evt) {
			try {
				const m = evt.data || {};
				if (filterFn(m)) {
					cleanup();
					resolve(m);
				}
			} catch (err) {
				cleanup();
				reject(err);
			}
		}
		function cleanup() {
			navigator.serviceWorker.removeEventListener("message", handler);
			if (timer) clearTimeout(timer);
			timer = null;
		}
		navigator.serviceWorker.addEventListener("message", handler);
		if (timeoutMs > 0) {
			timer = setTimeout(() => {
				cleanup();
				reject(
					new Error("Timed out waiting for service worker response"),
				);
			}, timeoutMs);
		}
	});
}

/* ---------- Public functions ---------- */

/**
 * Ask SW which assets are missing or outdated.
 * @param {string[]} assets - list of asset URLs
 * @param {boolean} checkFresh - whether to do freshness checks (HEAD) for outdated
 * @returns {Promise<{missing: string[], outdated: string[]}>}
 */
async function checkAssets(assets, checkFresh = true) {
	const sw = await getActiveSW();
	if (!sw) throw new Error("No active service worker");

	// Wait for MISSING_ASSETS or CACHE_ERROR
	const promise = onceMessage(
		(m) => m.type === "MISSING_ASSETS" || m.type === "CACHE_ERROR",
	);

	// send request
	sw.postMessage({ type: "CHECK_MISSING", payload: { assets, checkFresh } });

	const res = await promise;
	if (res.type === "CACHE_ERROR")
		throw new Error(res.error || "Service worker error");
	return { missing: res.missing || [], outdated: res.outdated || [] };
}

/**
 * Ask SW to cache (repair) a list of assets. Resolves when SW replies with CACHE_DONE.
 * @param {string[]} assets
 * @returns {Promise<{total:number, successCount:number, failed:Array<{url:string, error:string}>}>}
 */
async function repairAssets(assets) {
	const sw = await getActiveSW();
	if (!sw) throw new Error("No active service worker");

	// Wait for CACHE_DONE or CACHE_ERROR
	const promise = onceMessage(
		(m) => m.type === "CACHE_DONE" || m.type === "CACHE_ERROR",
	);

	// send request
	sw.postMessage({ type: "CACHE_ASSETS", payload: { assets } });

	const res = await promise;
	if (res.type === "CACHE_ERROR")
		throw new Error(res.error || "Service worker error");
	// res is expected to be { type: 'CACHE_DONE', total, successCount, failed }
	return {
		total: res.total || 0,
		successCount: res.successCount || 0,
		failed: res.failed || [],
	};
}

/* ---------- Example UI wiring ---------- */

const checkBtn = document.getElementById("checkBtn");
const updateBtn = document.getElementById("updateBtn");
const out = document.getElementById("out");

let lastMissing = [];

checkBtn.addEventListener("click", async () => {
	out.innerText = "Checking for missing/outdated assets...";
	updateBtn.disabled = true;
	try {
		const { missing, outdated } = await checkAssets(ASSETS, true);
		lastMissing = Array.from(
			new Set([...(missing || []), ...(outdated || [])]),
		);
		if (lastMissing.length === 0) {
			out.innerText = "All assets present and fresh.";
		} else {
			out.innerText = `Missing: ${JSON.stringify(missing, null, 2)}\nOutdated: ${JSON.stringify(outdated, null, 2)}`;
			updateBtn.disabled = false;
		}
	} catch (err) {
		out.innerText =
			"Check failed: " + (err && err.message ? err.message : String(err));
	}
});

updateBtn.addEventListener("click", async () => {
	if (!lastMissing || lastMissing.length === 0) {
		out.innerText = "Nothing to update.";
		return;
	}
	out.innerText = "Updating missing assets...";
	updateBtn.disabled = true;
	try {
		const result = await repairAssets(lastMissing);
		out.innerText = `Update done: ${result.successCount}/${result.total} succeeded.\nFailed: ${JSON.stringify(result.failed, null, 2)}`;
		// optionally re-run check to confirm
		// const after = await checkAssets(ASSETS, true);
		// console.log('after check', after);
	} catch (err) {
		out.innerText =
			"Update failed: " +
			(err && err.message ? err.message : String(err));
		updateBtn.disabled = false;
	}
});
