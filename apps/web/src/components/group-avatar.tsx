import { cn } from "@sporty/ui/lib/utils";
import { ShieldIcon } from "lucide-react";

/** Rund gruppelogo: logoen fra tihlde.org hvis gruppen har en, ellers gruppefargen med et skjold. */
export function GroupAvatar({
	group,
	size = 40,
	className,
}: {
	group: { name: string; color: string; logoUrl: string | null };
	size?: number;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
				className,
			)}
			style={{ width: size, height: size, backgroundColor: group.color }}
		>
			{group.logoUrl ? (
				<img src={group.logoUrl} alt="" className="size-full object-cover" />
			) : (
				<ShieldIcon
					className="text-white"
					style={{ width: size / 2, height: size / 2 }}
				/>
			)}
		</span>
	);
}
