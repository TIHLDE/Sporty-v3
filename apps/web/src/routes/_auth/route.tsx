import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
} from "@tanstack/react-router";

import { UserMenu } from "@/components/user-menu";
import { getUser } from "@/functions/get-user";
import { useTRPC } from "@/utils/trpc";

// Every page lives under this layout, so none of them render without a session.
export const Route = createFileRoute("/_auth")({
	beforeLoad: async () => {
		const session = await getUser();
		if (!session) {
			throw redirect({ to: "/login" });
		}
		return { session };
	},
	component: AuthLayout,
});

const NAV = [
	{ to: "/", label: "Hjem", exact: true },
	{ to: "/grupper", label: "Grupper", exact: false },
	{ to: "/meldinger", label: "Meldinger", exact: false, count: "messages" },
	{ to: "/varsler", label: "Varsler", exact: false, count: "notifications" },
	{ to: "/boter", label: "Bøter", exact: false },
] as const;

/** Enkel toppmeny og én kolonne med innholdet i midten. */
function AuthLayout() {
	const trpc = useTRPC();
	const unread = useQuery({
		...trpc.notifications.unread.queryOptions(),
		refetchInterval: 30_000,
	});

	return (
		<div className="min-h-svh bg-background">
			<header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
				<div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4 sm:gap-6">
					<Link to="/" className="font-semibold">
						Sporty
					</Link>
					<nav className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 text-sm">
						{NAV.map((item) => {
							const count =
								"count" in item ? (unread.data?.[item.count] ?? 0) : 0;
							return (
								<Link
									key={item.to}
									to={item.to}
									activeOptions={{ exact: item.exact }}
									className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
									activeProps={{ className: "bg-muted text-foreground" }}
								>
									{item.label}
									{count > 0 && (
										<span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs font-semibold text-primary-foreground">
											{count > 99 ? "99+" : count}
										</span>
									)}
								</Link>
							);
						})}
					</nav>
					<div className="ml-auto shrink-0">
						<UserMenu />
					</div>
				</div>
			</header>
			<main className="mx-auto max-w-4xl px-4 py-6">
				<Outlet />
			</main>
		</div>
	);
}
