import type { UploadedFile } from "@sporty/api/rest/types";

/** Laster opp én fil via det samme API-et appen bruker, og gir id-en tilbake. */
export async function uploadFile(file: File): Promise<UploadedFile> {
	const form = new FormData();
	form.append("file", file);
	const response = await fetch("/api/uploads", { method: "POST", body: form });
	const data = (await response.json().catch(() => null)) as
		| (UploadedFile & { error?: string })
		| null;
	if (!response.ok || !data)
		throw new Error(data?.error ?? `Opplastingen feilet (${response.status})`);
	return data;
}
