import {
	BottomNavigation,
	BottomNavigationHighlight,
	BottomNavigationHighlightItem,
	BottomNavigationItem,
	BottomNavigationLabel,
} from "@animate-ui/react/primitives/bottom-navigation";
import { useIsMobile } from "@sporty/ui/hooks/use-mobile";
import { cn } from "@sporty/ui/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
	to: string;
	label: string;
	icon: LucideIcon;
	exact: boolean;
	count: number;
}

/** Hvilket menypunkt siden hører til, f.eks. «/grupper» for en gruppeside. */
export function activeItem(items: NavItem[], pathname: string) {
	return items.find((item) =>
		item.exact
			? pathname === item.to
			: pathname === item.to || pathname.startsWith(`${item.to}/`),
	)?.to;
}

/**
 * Menyen nederst på mobil: en flytende pille der markeringen glir til siden du er på, og bare
 * den aktive viser navnet. Krymper til ikonene når du ruller nedover, og kommer tilbake når du
 * ruller opp. Med «Reduser bevegelse» skjer alt uten animasjon.
 */
export function MobileNav({ items }: { items: NavItem[] }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const active = activeItem(items, pathname);
	// Rendres bare på mobil. Skjult med CSS ville menyen fortsatt animert ved hvert sidebytte, og
	// Motion kaster «commitStyles … Target element is not rendered» når en animasjon på et skjult
	// element avbrytes.
	const isMobile = useIsMobile();
	if (!isMobile) return null;

	return (
		<BottomNavigation
			value={active}
			scrollBehavior="minimize"
			aria-label="Hovedmeny"
			data-app-chrome="nav"
			className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 mx-auto w-fit max-w-[calc(100%-1.5rem)] rounded-full border bg-card/90 p-1.5 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.25)] backdrop-blur-md"
		>
			<BottomNavigationHighlight className="absolute inset-x-0 inset-y-0 rounded-full bg-primary">
				<ul className="flex items-center">
					{items.map((item) => (
						<li key={item.to}>
							<BottomNavigationHighlightItem value={item.to}>
								<BottomNavigationItem value={item.to} asChild>
									<Link
										to={item.to}
										aria-label={item.label}
										className={cn(
											"relative flex h-12 min-w-12 items-center justify-center rounded-full px-3.5 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring data-[minimized]:h-10 data-[minimized]:min-w-10 data-[minimized]:px-2.5",
											active === item.to && "text-primary-foreground",
										)}
									>
										<span className="relative">
											<item.icon className="size-[22px]" />
											{item.count > 0 && (
												<span className="absolute -top-1.5 left-3.5 min-w-4 rounded-full bg-signal px-1 text-center text-[10px] leading-4 font-bold text-signal-foreground">
													{item.count > 99 ? "99+" : item.count}
												</span>
											)}
										</span>
										<BottomNavigationLabel
											show="active"
											className="text-sm font-semibold whitespace-nowrap"
										>
											{/* Mellomrommet ligger i etiketten, så det forsvinner når den skjules. */}
											<span className="pl-2">{item.label}</span>
										</BottomNavigationLabel>
									</Link>
								</BottomNavigationItem>
							</BottomNavigationHighlightItem>
						</li>
					))}
				</ul>
			</BottomNavigationHighlight>
		</BottomNavigation>
	);
}
