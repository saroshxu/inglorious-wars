import rough from "https://cdn.skypack.dev/roughjs@4.6.6/bundled/rough.esm.js";

function initRoughButtons({
	roughness = 4,
	bowing = 0,
	strokeWidth = 2,
	padding = 6,
} = {}) {
	document.querySelectorAll(".rough-btn").forEach((btn) => {
		const svg = btn.querySelector(".rough-btn-svg");
		if (!svg) return;

		const rc = rough.svg(svg);

		const draw = () => {
			const { width, height } = btn.getBoundingClientRect();

			if (width === 0 || height === 0) return;

			svg.innerHTML = "";
			svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

			const shape = rc.rectangle(
				padding,
				padding,
				width - padding * 2,
				height - padding * 2,
				{
					roughness,
					bowing,
					strokeWidth,
					stroke: "currentColor",
					fill: "none",
				},
			);

			svg.appendChild(shape);
		};
		draw();
		const ro = new ResizeObserver(draw);
		ro.observe(btn);
	});
}

initRoughButtons();
