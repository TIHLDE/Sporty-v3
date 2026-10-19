import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create({
	errorFormatter({ shape, error }) {
		// Show the first validation message instead of the raw list of Zod issues.
		if (error.cause instanceof ZodError) {
			return {
				...shape,
				message: error.cause.issues[0]?.message ?? shape.message,
			};
		}
		return shape;
	},
});

export const router = t.router;

// Everything in Sporty requires a TIHLDE login, so there is deliberately no
// publicProcedure: every procedure goes through this check.
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.session) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Du må være logget inn",
			cause: "No session",
		});
	}
	return next({
		ctx: {
			...ctx,
			session: ctx.session,
		},
	});
});
