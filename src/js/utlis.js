function doLoadStuff() {
	updateFavicon();
}
function getTheme() {
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}
function updateFavicon() {
	const favicon = document.getElementById("favicon");
	favicon.href =
		getTheme() === "dark"
			? "src/assets/imgs/app/app-white-w64-hFavicon.png"
			: "src/assets/imgs/app/app-black-w64-hFavicon.png";
}

// PWA Helpers

function isPWAInstalled() {
	if (window.matchMedia("(display-mode: standalone)").matches) {
		return true;
	}
	if (window.navigator.standalone === true) {
		return true;
	}
	return false;
}
function isRunningInPWA() {
	return (
		window.matchMedia("(display-mode: standalone)").matches ||
		window.matchMedia("(display-mode: fullscreen)").matches ||
		window.navigator.standalone === true
	);
}
