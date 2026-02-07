export const PROJECT_DIR = "inglorious-wars";
export const ASSETS = [
	"/src/assets/imgs/paper-bg-highRes.png",
	"/src/assets/imgs/arts/creative-art-1-black-w760.png",
];
export function getProjectBase() {
	if (!PROJECT_DIR) return "";
	return "/" + PROJECT_DIR.replace(/^\/|\/$/g, "");
}
export function getAssetURLs() {
	const base = getProjectBase();
	return ASSETS.map((p) => base + "/" + p.replace(/^\/+/g, ""));
}
