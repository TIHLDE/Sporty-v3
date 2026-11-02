import { Collapsible } from "@animate-ui/react/primitives/base-ui/collapsible";
import type { Group } from "@sporty/api/rest/types";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarProvider,
	SidebarTrigger,
} from "@sporty/ui/components/sidebar";
import { cn } from "@sporty/ui/lib/utils";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
	useRouterState,
} from "@tanstack/react-router";
import {
	BellIcon,
	ChevronDownIcon,
	HomeIcon,
	MessageCircleIcon,
	ReceiptIcon,
	UsersIcon,
	type LucideIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import { GroupBadge } from "@/components/group-badge";
import { activeItem, MobileNav, type NavItem } from "@/components/mobile-nav";
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

const NAV: {
	to: string;
	label: string;
	icon: LucideIcon;
	exact: boolean;
	unread?: "messages" | "notifications";
}[] = [
	{ to: "/", label: "Hjem", icon: HomeIcon, exact: true },
	{ to: "/grupper", label: "Grupper", icon: UsersIcon, exact: false },
	{
		to: "/meldinger",
		label: "Meldinger",
		icon: MessageCircleIcon,
		exact: false,
		unread: "messages",
	},
	{
		to: "/varsler",
		label: "Varsler",
		icon: BellIcon,
		exact: false,
		unread: "notifications",
	},
	{ to: "/boter", label: "Bøter", icon: ReceiptIcon, exact: false },
];

/**
 * Sidemeny fra md og oppover (kan felles sammen til ikoner med Cmd/Ctrl+B), og toppfelt pluss
 * fanemeny nederst på mobil.
 */
function AuthLayout() {
	const trpc = useTRPC();
	const unread = useQuery({
		...trpc.notifications.unread.queryOptions(),
		refetchInterval: 30_000,
	});
	const items = NAV.map((item) => ({
		...item,
		count: item.unread ? (unread.data?.[item.unread] ?? 0) : 0,
	}));

	return (
		<SidebarProvider>
			<AppSidebar items={items} />
			<div className="min-w-0 flex-1 bg-background">
				<header
					data-app-chrome="header"
					className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur md:hidden"
				>
					<Link to="/" className="text-xl font-extrabold tracking-tight">
						Sporty
					</Link>
					<UserMenu />
				</header>
				<main
					data-page-transition
					className="mx-auto flex max-w-full justify-center px-4 pt-6 pb-28 md:px-8 md:pt-8 md:pb-12 lg:px-10"
				>
					<Outlet />
				</main>
				<MobileNav items={items} />
			</div>
		</SidebarProvider>
	);
}

function AppSidebar({ items }: { items: NavItem[] }) {
	const trpc = useTRPC();
	const groups = useQuery(trpc.groups.list.queryOptions());
	// Listen har bare hovedgruppene. Undergruppene du er med i (myRole er satt) står i
	// gruppedetaljene, som også brukes på gruppesiden, så de er ofte allerede hentet.
	const details = useQueries({
		queries: (groups.data ?? []).map((group) =>
			trpc.groups.get.queryOptions({ groupId: group.id }),
		),
	});
	const mySubgroups = new Map(
		details.flatMap((d) =>
			d.data
				? [[d.data.id, d.data.subgroups.filter((s) => s.myRole !== null)]]
				: [],
		),
	);
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const active = activeItem(items, pathname);

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader className="flex-row items-center justify-between px-3 pt-5 pb-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
				<Link
					to="/"
					className="truncate px-2 text-2xl font-extrabold tracking-tight group-data-[collapsible=icon]:hidden"
				>
					Sporty
				</Link>
				<SidebarTrigger className="text-muted-foreground" />
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarMenu aria-label="Hovedmeny">
						{items.map((item) => {
							const button = (
								<SidebarMenuButton
									isActive={active === item.to}
									tooltip={item.label}
									className="h-9 font-medium text-muted-foreground data-active:font-semibold data-active:text-foreground [&_svg]:size-[18px]"
									render={<Link to={item.to} />}
								>
									<item.icon />
									<span>{item.label}</span>
								</SidebarMenuButton>
							);
							if (item.to === "/grupper") {
								return (
									<GroupsMenuItem
										key={item.to}
										groups={groups.data ?? []}
										pathname={pathname}
									>
										{button}
									</GroupsMenuItem>
								);
							}
							return (
								<SidebarMenuItem key={item.to}>
									{button}
									{item.count > 0 && (
										<SidebarMenuBadge className="top-2! right-2">
											<span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] leading-5 font-bold text-primary-foreground">
												{item.count > 99 ? "99+" : item.count}
											</span>
										</SidebarMenuBadge>
									)}
								</SidebarMenuItem>
							);
						})}
					</SidebarMenu>
				</SidebarGroup>
				{groups.data && groups.data.length > 0 && (
					<SidebarGroup>
						<SidebarGroupLabel className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
							Dine lag
						</SidebarGroupLabel>
						<SidebarMenu aria-label="Dine lag">
							{groups.data.map((group) => {
								const mine = mySubgroups.get(group.id) ?? [];
								return (
									<SidebarMenuItem key={group.id}>
										<SidebarMenuButton
											isActive={isGroupPage(pathname, group.id)}
											tooltip={group.name}
											className="h-9 font-medium group-data-[collapsible=icon]:justify-center data-active:font-semibold"
											render={
												<Link
													to="/grupper/$groupId"
													params={{ groupId: group.id }}
												/>
											}
										>
											<GroupBadge group={group} className="shrink-0" />
											<span>{group.name}</span>
										</SidebarMenuButton>
										{mine.length > 0 && (
											<SidebarMenuSub
												aria-label={`Undergrupper i ${group.name}`}
												className="mt-0.5"
											>
												{mine.map((sub) => (
													<SidebarMenuSubItem key={sub.id}>
														<SidebarMenuSubButton
															isActive={isGroupPage(pathname, sub.id)}
															className="h-8 font-medium data-active:font-semibold"
															render={
																<Link
																	to="/grupper/$groupId"
																	params={{ groupId: sub.id }}
																/>
															}
														>
															<GroupBadge group={sub} className="shrink-0" />
															<span className="truncate">{sub.name}</span>
														</SidebarMenuSubButton>
													</SidebarMenuSubItem>
												))}
											</SidebarMenuSub>
										)}
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroup>
				)}
			</SidebarContent>
			<SidebarFooter className="p-3 group-data-[collapsible=icon]:p-2">
				<UserMenu inSidebar />
			</SidebarFooter>
		</Sidebar>
	);
}

/**
 * «Grupper» med lagene dine som undermeny. Navnet går til gruppesiden, pilen folder lagene ut og
 * inn. Undermenyen er åpen når du er på en gruppeside, og skjules når sidemenyen er felt sammen.
 */
function GroupsMenuItem({
	groups,
	pathname,
	children,
}: {
	groups: Group[];
	pathname: string;
	children: ReactNode;
}) {
	const inGroups = pathname.startsWith("/grupper");
	const [open, setOpen] = useState(inGroups);
	// Åpner seg når du går inn på en gruppeside (justeres under render, ikke i en effekt).
	const [wasInGroups, setWasInGroups] = useState(inGroups);
	if (inGroups !== wasInGroups) {
		setWasInGroups(inGroups);
		if (inGroups) setOpen(true);
	}

	return (
		<Collapsible.Root
			open={open}
			onOpenChange={setOpen}
			render={<SidebarMenuItem />}
		>
			{children}
			{groups.length > 0 && (
				<>
					<SidebarMenuAction
						aria-label={open ? "Skjul lagene" : "Vis lagene"}
						className="top-2! text-muted-foreground"
						render={<Collapsible.Trigger />}
					>
						<ChevronDownIcon
							className={cn(
								"transition-transform duration-300",
								open && "rotate-180",
							)}
						/>
					</SidebarMenuAction>
					<Collapsible.Panel>
						<SidebarMenuSub aria-label="Dine lag" className="mt-1">
							{groups.map((group) => {
								const isActive =
									pathname === `/grupper/${group.id}` ||
									pathname.startsWith(`/grupper/${group.id}/`);
								return (
									<SidebarMenuSubItem key={group.id}>
										<SidebarMenuSubButton
											isActive={isActive}
											className="h-8 font-medium data-active:font-semibold"
											render={
												<Link
													to="/grupper/$groupId"
													params={{ groupId: group.id }}
												/>
											}
										>
											<GroupBadge group={group} className="shrink-0" />
											<span className="truncate">{group.name}</span>
										</SidebarMenuSubButton>
									</SidebarMenuSubItem>
								);
							})}
						</SidebarMenuSub>
					</Collapsible.Panel>
				</>
			)}
		</Collapsible.Root>
	);
}

/** Om siden er gruppen eller en side under den (f.eks. innstillingene). */
function isGroupPage(pathname: string, groupId: string) {
	return (
		pathname === `/grupper/${groupId}` ||
		pathname.startsWith(`/grupper/${groupId}/`)
	);
}
