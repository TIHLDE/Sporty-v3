"use client";

// Animate UI sin utgave av Base UI-fanene: markeringen glir mellom fanene, og innholdet
// animeres ved bytte. Samme API som @base-ui/react/tabs.
import { Tabs as TabsPrimitive } from "@animate-ui/react/primitives/base-ui/tabs";
import { cn } from "@sporty/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { useRef } from "react";

function Tabs({
	className,
	orientation = "horizontal",
	preserveScroll = false,
	value,
	defaultValue,
	onValueChange,
	ref,
	...props
}: TabsPrimitive.Root.Props & {
	/** Husker scrollen per fane, så siden ikke rykker opp når du bytter mellom høye faner. */
	preserveScroll?: boolean;
}) {
	const rootRef = useRef<HTMLDivElement | null>(null);
	// Hvilken fane som er åpen nå, så vi vet hvor vi ruller fra når den byttes ut.
	const activeRef = useRef(value ?? defaultValue);
	const positions = useRef(new Map<unknown, number>());

	const handleValueChange = (
		next: unknown,
		details: TabsPrimitive.Root.ChangeEventDetails,
	) => {
		const previous = activeRef.current;
		activeRef.current = next;
		if (preserveScroll && typeof window !== "undefined" && previous !== next) {
			positions.current.set(previous, window.scrollY);
			// Lagret posisjon = følg glidningen tilbake dit. Første besøk i fanen = ingen å
			// gå til, da skal scrollen bare få være i ro mens høyden glider og innholdet
			// popper inn (jakt etter en bevegelig målposisjon ser rykkete ut).
			holdViewport(rootRef.current, positions.current.get(next) ?? null);
		}
		onValueChange?.(next, details);
	};

	return (
		<TabsPrimitive.Root
			ref={(node) => {
				rootRef.current = node;
				if (typeof ref === "function") ref(node);
				else if (ref) ref.current = node;
			}}
			data-slot="tabs"
			data-orientation={orientation}
			value={value}
			defaultValue={defaultValue}
			onValueChange={handleValueChange}
			className={cn(
				"group/tabs flex gap-2 data-horizontal:flex-col",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * Holder vinduet på ett sted mens panelhøyden glider (150 ms ut + 450 ms høyde) ved faneskifte.
 * Med en lagret posisjon følges glidningen dit, så du havner akkurat der du var da du forlot
 * fanen. Første gang en fane åpnes (top === null) er det ingen posisjon å gå til — da er det
 * bare scroll-anchoring som holdes i sjakk (se data-scroll-hold i globals.css), og innholdet
 * som popper inn når dataene kommer, får vokse uten at scrollen jages rundt.
 */
let holdToken: symbol | null = null;

function holdViewport(
	root: HTMLElement | null,
	top: number | null,
	duration = 600,
) {
	const token = Symbol();
	holdToken = token; // avbryter et hold som evt. pågår fra forrige bytte
	root?.setAttribute("data-scroll-hold", "");
	const stop = () => {
		if (holdToken !== token) return;
		holdToken = null;
		root?.removeAttribute("data-scroll-hold");
	};
	// Gi slipp så snart brukeren ruller selv.
	window.addEventListener("wheel", stop, { once: true, passive: true });
	window.addEventListener("touchmove", stop, { once: true, passive: true });
	const start = performance.now();
	function frame() {
		if (holdToken !== token) return;
		if (top !== null) {
			const max = document.documentElement.scrollHeight - window.innerHeight;
			const target = Math.min(Math.max(top, 0), Math.max(max, 0));
			if (Math.abs(window.scrollY - target) > 1) {
				// «Instant», ikke «auto»: arver scroll-behavior smooth hvis den settes globalt,
				// og en myk animasjon per ramme blir seig i stedet for å holde vinduet i ro.
				window.scrollTo({ top: target, behavior: "instant" });
			}
		}
		if (performance.now() - start < duration) {
			requestAnimationFrame(frame);
		} else {
			stop();
		}
	}
	requestAnimationFrame(frame);
}

const tabsListVariants = cva(
	"group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-9 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
	{
		variants: {
			variant: {
				default: "bg-muted",
				line: "gap-1 bg-transparent",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function TabsList({
	className,
	variant = "default",
	...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
	return (
		<TabsPrimitive.List
			data-slot="tabs-list"
			data-variant={variant}
			className={cn(tabsListVariants({ variant }), className)}
			{...props}
		/>
	);
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
	return (
		<TabsPrimitive.Tab
			data-slot="tabs-trigger"
			className={cn(
				"relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				"group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
				"data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
				"after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
				className,
			)}
			{...props}
		/>
	);
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
	return (
		<TabsPrimitive.Panel
			data-slot="tabs-content"
			className={cn("flex-1 text-sm outline-none", className)}
			{...props}
		/>
	);
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
