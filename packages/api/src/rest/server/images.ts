// Gjør opplastede bilder små før de lagres: WebP, maks 2000 px på den lengste siden, riktig vei
// (EXIF-rotasjon) og uten metadata (f.eks. GPS-posisjon). Kun serverkode.

import sharp from "sharp";

const MAX_DIMENSION = 2000;
const QUALITY = 80;
/** Bildetyper vi gjør om. GIF beholdes så animasjon ikke forsvinner, SVG er tekst. */
const CONVERTIBLE = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/heic",
	"image/heif",
	"image/avif",
	"image/tiff",
]);

/**
 * WebP-versjonen av bildet, eller null hvis det ikke er et bilde vi gjør om (eller det ikke lot
 * seg lese, f.eks. HEIC uten støtte). Da lagres originalen.
 */
export async function optimizeImage(
	data: ArrayBuffer,
	mimeType: string,
	fileName: string,
) {
	if (!CONVERTIBLE.has(mimeType.toLowerCase())) return null;
	try {
		const output = await sharp(Buffer.from(data))
			.rotate()
			.resize(MAX_DIMENSION, MAX_DIMENSION, {
				fit: "inside",
				withoutEnlargement: true,
			})
			.webp({ quality: QUALITY })
			.toBuffer();
		return {
			data: output,
			mimeType: "image/webp",
			fileName: `${fileName.replace(/\.[^.]+$/, "") || "bilde"}.webp`,
		};
	} catch {
		return null;
	}
}
