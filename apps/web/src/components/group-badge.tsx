import { cn } from "@sporty/ui/lib/utils";

/**
 * Kort merke laget fra navnet: forbokstavene («Pythons Fotball Herrer» → «PFH»), eller tallet
 * først i navnet («11'er» → «11»). Gruppene har ingen egen forkortelse.
 */
export function groupCode(name: string) {
	const words = name.split(/\s+/).filter(Boolean);
	if (words.length > 1) {
		return words
			.map((word) => word.match(/[\p{L}\p{N}]/u)?.[0] ?? "")
			.join("")
			.slice(0, 3)
			.toUpperCase();
	}
	const word = words[0] ?? "";
	const digits = word.match(/^\d+/)?.[0];
	if (digits) return digits.slice(0, 3);
	return word
		.replace(/[^\p{L}\p{N}]/gu, "")
		.slice(0, 3)
		.toUpperCase();
}

const channel = (value: number) => {
	const c = value / 255;
	return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** Svart eller hvit, det som har best kontrast mot gruppefargen (som admin velger fritt). */
export function inkOn(hex: string) {
	const match = hex
		.replace("#", "")
		.match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
	if (!match) return "#ffffff";
	const [r, g, b] = match
		.slice(1)
		.map((part) => channel(Number.parseInt(part, 16)));
	const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
	return (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05)
		? "#0c0e12"
		: "#ffffff";
}

/** Gruppens merke i gruppefargen, f.eks. foran et arrangement fra en annen gruppe. */
export function GroupBadge({
	group,
	className,
}: {
	group: { name: string; color: string };
	className?: string;
}) {
	return (
		<span
			title={group.name}
			className={cn(
				"inline-flex h-5 shrink-0 items-center rounded px-1.5 text-[11px] leading-none font-extrabold tracking-wide",
				className,
			)}
			style={{ backgroundColor: group.color, color: inkOn(group.color) }}
		>
			{groupCode(group.name)}
		</span>
	);
}
