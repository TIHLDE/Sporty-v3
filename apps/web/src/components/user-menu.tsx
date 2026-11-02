import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@sporty/ui/components/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@sporty/ui/components/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@sporty/ui/components/sidebar";
import { useNavigate } from "@tanstack/react-router";
import {
	BellIcon,
	ChevronsUpDownIcon,
	LogOutIcon,
	ReceiptIcon,
	UserIcon,
} from "lucide-react";

import { initials } from "@/components/user-avatar";
import { authClient } from "@/lib/auth-client";

type User = { name: string; email: string; image?: string | null };

function UserAvatar({ user, className }: { user: User; className?: string }) {
	return (
		<Avatar className={className}>
			{user.image && <AvatarImage src={user.image} alt={user.name} />}
			<AvatarFallback className="rounded-[inherit]">
				{initials(user.name)}
			</AvatarFallback>
		</Avatar>
	);
}

function UserDetails({ user }: { user: User }) {
	return (
		<span className="grid min-w-0 flex-1 text-left leading-tight">
			<span className="truncate text-sm font-semibold">{user.name}</span>
			<span className="truncate text-xs text-muted-foreground">
				{user.email}
			</span>
		</span>
	);
}

/** Innholdet i menyen: hvem du er, snarveier og «Logg ut». */
function UserMenuContent({
	user,
	side,
	align,
}: {
	user: User;
	side: "right" | "bottom";
	align: "start" | "end";
}) {
	const navigate = useNavigate();
	return (
		<DropdownMenuContent
			className="w-(--anchor-width) min-w-60 rounded-xl p-1.5"
			side={side}
			align={align}
			sideOffset={side === "right" ? 8 : 6}
		>
			<DropdownMenuGroup>
				<DropdownMenuLabel className="flex items-center gap-3 px-2 py-2 font-normal text-foreground">
					<UserAvatar user={user} className="size-9 rounded-lg" />
					<UserDetails user={user} />
				</DropdownMenuLabel>
			</DropdownMenuGroup>
			<DropdownMenuSeparator className="-mx-1.5" />
			<DropdownMenuGroup>
				<DropdownMenuItem
					className="gap-3 py-2"
					onClick={() => navigate({ to: "/profil" })}
				>
					<UserIcon />
					Profil og innstillinger
				</DropdownMenuItem>
				<DropdownMenuItem
					className="gap-3 py-2"
					onClick={() => navigate({ to: "/varsler" })}
				>
					<BellIcon />
					Varsler
				</DropdownMenuItem>
				<DropdownMenuItem
					className="gap-3 py-2"
					onClick={() => navigate({ to: "/boter" })}
				>
					<ReceiptIcon />
					Bøter
				</DropdownMenuItem>
			</DropdownMenuGroup>
			<DropdownMenuSeparator className="-mx-1.5" />
			<DropdownMenuItem
				className="gap-3 py-2"
				onClick={() =>
					authClient.signOut({
						fetchOptions: { onSuccess: () => navigate({ to: "/login" }) },
					})
				}
			>
				<LogOutIcon />
				Logg ut
			</DropdownMenuItem>
		</DropdownMenuContent>
	);
}

/**
 * Brukermenyen. I sidemenyen er den en stor menyknapp med bilde, navn og e-post som åpner
 * menyen til høyre (og blir bare bildet når sidemenyen er felt sammen). Ellers et lite bilde.
 */
export function UserMenu({ inSidebar = false }: { inSidebar?: boolean }) {
	const { data: session } = authClient.useSession();
	if (!session) return null;
	const { user } = session;

	if (inSidebar) {
		return (
			<SidebarMenu>
				<SidebarMenuItem>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<SidebarMenuButton
									size="lg"
									aria-label="Brukermeny"
									className="gap-3 rounded-lg data-popup-open:bg-sidebar-accent"
								/>
							}
						>
							<UserAvatar user={user} className="size-8 rounded-lg" />
							<UserDetails user={user} />
							<ChevronsUpDownIcon className="ml-auto text-muted-foreground" />
						</DropdownMenuTrigger>
						<UserMenuContent user={user} side="right" align="end" />
					</DropdownMenu>
				</SidebarMenuItem>
			</SidebarMenu>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				aria-label="Brukermeny"
				className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<UserAvatar user={user} className="size-8" />
			</DropdownMenuTrigger>
			<UserMenuContent user={user} side="bottom" align="end" />
		</DropdownMenu>
	);
}
