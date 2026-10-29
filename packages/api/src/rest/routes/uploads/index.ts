import { toUpload } from "../../server/dto";
import { HttpError, getUserId, handler } from "../../server/http";
import { optimizeImage } from "../../server/images";
import { prisma } from "../../server/prisma";
import { saveFile } from "../../server/storage";
import type { UploadedFile } from "../../types";

const MAX_BYTES = 100 * 1024 * 1024;

/**
 * Last opp én fil (multipart, feltet "file"). Knyttes til en kunngjøring, en bot eller et
 * forsidebilde etterpå. Bilder gjøres om til WebP og skaleres ned før de lagres.
 */
export const POST = handler(async (request): Promise<UploadedFile> => {
	const userId = await getUserId(request);
	// Serveren kjører i Node, der FormData har get(). Prosjektets typer er React Native sine.
	const form = (await request.formData().catch(() => {
		throw new HttpError(400, "Forventet multipart/form-data");
	})) as unknown as { get(name: string): unknown };
	const file = form.get("file");
	if (!(file instanceof File)) throw new HttpError(400, "Mangler fil");
	if (file.size > MAX_BYTES)
		throw new HttpError(413, "Filen er større enn 100 MB");

	const original = await file.arrayBuffer();
	const optimized = await optimizeImage(
		original,
		file.type,
		file.name || "bilde",
	);
	const data = optimized?.data ?? original;
	const mimeType =
		optimized?.mimeType ?? (file.type || "application/octet-stream");
	const kind = mimeType.startsWith("image/")
		? "image"
		: mimeType.startsWith("video/")
			? "video"
			: "file";

	const upload = await prisma.upload.create({
		data: {
			kind,
			fileName: optimized?.fileName ?? (file.name || "fil"),
			mimeType,
			sizeBytes: data.byteLength,
			uploadedById: userId,
		},
	});
	await saveFile(upload.id, data);
	return toUpload(upload);
});
