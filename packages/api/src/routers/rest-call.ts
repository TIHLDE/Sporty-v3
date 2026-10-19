import { TRPCError } from "@trpc/server";

import type { Context } from "../context";
import { handleRestRequest } from "../rest/index";

const ERROR_CODES = {
	400: "BAD_REQUEST",
	401: "UNAUTHORIZED",
	403: "FORBIDDEN",
	404: "NOT_FOUND",
	409: "CONFLICT",
} as const;

/**
 * Kaller samme logikk som REST-API-et appen bruker, i samme prosess og med nettsidens cookie.
 * Da finnes forretningslogikken (tilgang, synk med tihlde.org, bøter …) bare ett sted, og
 * nettsiden og appen oppfører seg likt. Feil blir TRPCError med meldingen fra API-et.
 */
export async function restCall<T>(
	ctx: Context,
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
	path: string,
	body?: unknown,
): Promise<T> {
	const headers = new Headers();
	const cookie = ctx.headers.get("cookie");
	if (cookie) headers.set("cookie", cookie);
	if (body !== undefined) headers.set("content-type", "application/json");

	const request = new Request(`http://sporty.internal/api${path}`, {
		method,
		headers,
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
	const response = await handleRestRequest(request, path.split("?")[0] ?? path);
	const data = (await response.json().catch(() => null)) as {
		error?: string;
	} | null;
	if (!response.ok) {
		throw new TRPCError({
			code:
				ERROR_CODES[response.status as keyof typeof ERROR_CODES] ??
				"INTERNAL_SERVER_ERROR",
			message: data?.error ?? `Forespørselen feilet (${response.status})`,
		});
	}
	return data as T;
}
