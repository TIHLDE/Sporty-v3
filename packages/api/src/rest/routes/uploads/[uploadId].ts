import { prisma } from "../../server/prisma";
import { readStoredFile } from "../../server/storage";

/**
 * Henter en opplastet fil. Krever ikke innlogging, slik at bilde-, video- og nettleservisning
 * kan bruke URL-en direkte. Id-ene er tilfeldige og umulige å gjette, men dette må strammes inn
 * (f.eks. signerte URL-er) før ekte bruk.
 *
 * Støtter Range-forespørsler, som iOS krever for å spille av video.
 */
export async function GET(
	request: Request,
	{ uploadId }: { uploadId: string },
) {
	const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
	if (!upload) return new Response("Fant ikke filen", { status: 404 });

	let data: Buffer;
	try {
		data = await readStoredFile(upload.id);
	} catch {
		return new Response("Filen mangler på disk", { status: 404 });
	}

	const headers: Record<string, string> = {
		"content-type": upload.mimeType,
		"accept-ranges": "bytes",
		"content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(upload.fileName)}`,
		"cache-control": "private, max-age=31536000, immutable",
	};

	const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
	if (range) {
		const size = data.byteLength;
		const start = range[1] ? Number(range[1]) : size - Number(range[2]);
		const end =
			range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
		if (start > end || start >= size) {
			return new Response(null, {
				status: 416,
				headers: { "content-range": `bytes */${size}` },
			});
		}
		return new Response(new Uint8Array(data.subarray(start, end + 1)), {
			status: 206,
			headers: {
				...headers,
				"content-range": `bytes ${start}-${end}/${size}`,
				"content-length": String(end - start + 1),
			},
		});
	}

	return new Response(new Uint8Array(data), {
		headers: { ...headers, "content-length": String(data.byteLength) },
	});
}
