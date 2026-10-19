export type Theme = "system" | "light" | "dark";

export const THEME_OPTIONS: {
	value: Theme;
	label: string;
	description: string;
}[] = [
	{
		value: "system",
		label: "Automatisk",
		description: "Følger innstillingen på enheten",
	},
	{ value: "light", label: "Lys", description: "Alltid lyst" },
	{ value: "dark", label: "Mørk", description: "Alltid mørkt" },
];

const STORAGE_KEY = "sporty-theme";

/**
 * Kjøres i <head> før siden tegnes, så det ikke blinker feil tema. Samme logikk som applyTheme.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

/** Valget lagres bare i nettleseren, som i appen (der lagres det på telefonen). */
export function getTheme(): Theme {
	try {
		const value = localStorage.getItem(STORAGE_KEY);
		return value === "light" || value === "dark" ? value : "system";
	} catch {
		return "system";
	}
}

export function setTheme(theme: Theme) {
	try {
		localStorage.setItem(STORAGE_KEY, theme);
	} catch {
		// Privat modus o.l.: temaet gjelder bare til siden lastes på nytt.
	}
	applyTheme(theme);
}

export function applyTheme(theme: Theme) {
	const dark =
		theme === "dark" ||
		(theme === "system" &&
			window.matchMedia("(prefers-color-scheme: dark)").matches);
	document.documentElement.classList.toggle("dark", dark);
}

/** Til useSyncExternalStore: varsler når valget endres i en annen fane. */
export function subscribeTheme(onChange: () => void) {
	window.addEventListener("storage", onChange);
	return () => window.removeEventListener("storage", onChange);
}
