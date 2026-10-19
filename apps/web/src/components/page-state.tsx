import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

/** Lasting, feil eller innhold for en spørring, likt på alle sidene. */
export function PageState<T>({
	query,
	children,
}: {
	query: {
		isPending: boolean;
		isError: boolean;
		error: { message: string } | null;
		data: T | undefined;
	};
	children: (data: T) => ReactNode;
}) {
	if (query.isPending) {
		return (
			<div className="flex justify-center py-12">
				<Loader2 className="animate-spin text-muted-foreground" />
			</div>
		);
	}
	if (query.isError || query.data === undefined) {
		return (
			<p className="py-12 text-center text-sm text-muted-foreground">
				{query.error?.message ?? "Noe gikk galt"}
			</p>
		);
	}
	return <>{children(query.data)}</>;
}

export function EmptyText({ children }: { children: ReactNode }) {
	return (
		<p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
			{children}
		</p>
	);
}
