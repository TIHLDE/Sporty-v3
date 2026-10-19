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
import { useNavigate } from "@tanstack/react-router";
import { LogOutIcon, UserIcon } from "lucide-react";

import { initials } from "@/components/user-avatar";
import { authClient } from "@/lib/auth-client";

export function UserMenu() {
	const navigate = useNavigate();
	const { data: session } = authClient.useSession();
	if (!session) return null;
	const { user } = session;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				aria-label="Brukermeny"
				className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<Avatar className="size-8">
					{user.image && <AvatarImage src={user.image} alt={user.name} />}
					<AvatarFallback>{initials(user.name)}</AvatarFallback>
				</Avatar>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="min-w-56" align="end" sideOffset={4}>
				<DropdownMenuGroup>
					<DropdownMenuLabel className="grid font-normal">
						<span className="truncate font-medium">{user.name}</span>
						<span className="truncate text-xs text-muted-foreground">
							{user.email}
						</span>
					</DropdownMenuLabel>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={() => navigate({ to: "/profil" })}>
					<UserIcon />
					Profil og innstillinger
				</DropdownMenuItem>
				<DropdownMenuItem
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
		</DropdownMenu>
	);
}
