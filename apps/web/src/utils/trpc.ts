import type { AppRouter } from "@sporty/api/routers/index";
import type { inferRouterOutputs } from "@trpc/server";
import { createTRPCContext } from "@trpc/tanstack-react-query";

export const { TRPCProvider, useTRPC, useTRPCClient } =
	createTRPCContext<AppRouter>();

export type RouterOutputs = inferRouterOutputs<AppRouter>;
