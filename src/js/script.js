let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
	e.preventDefault();
	deferredInstallPrompt = e;
});
async function tryInstallPWA() {
	const result = await installPWA();
	let statusElem = document.querySelector("#installStatus");
	if (result === "installed") {
		statusElem.innerHTML = "Done..!";
	} else if (result === "unavailable") {
		statusElem.innerHTML =
			"Failed to install the app.. Maybe you are using iOS.. OR it\'s already installed..";
	} else if (result === "dismissed") {
		statusElem.innerHTML = "You rejected to install..!";
	} else {
		statusElem.innerHTML = "Failed due to unknown reason..";
	}
}
async function installPWA() {
	if (!deferredInstallPrompt) {
		console.log("Install prompt not available");
		return "unavailable";
	}
	deferredInstallPrompt.prompt();
	const choice = await deferredInstallPrompt.userChoice;
	deferredInstallPrompt = null;
	if (choice.outcome === "accepted") {
		return "installed";
	} else {
		console.log("User dismissed PWA install");
		return "dismissed";
	}
}
