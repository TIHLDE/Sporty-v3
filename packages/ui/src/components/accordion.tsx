import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { cn } from "@sporty/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";

// Samme bevegelse som Animate UI sin accordion (350 ms, ease-out-cubic), men med Base UI sin
// --accordion-panel-height og CSS-overganger, så det ikke trengs motion.
const EASE = "ease-[cubic-bezier(0.215,0.61,0.355,1)]";

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
	return (
		<AccordionPrimitive.Root
			data-slot="accordion"
			className={cn("flex w-full flex-col", className)}
			{...props}
		/>
	);
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
	return (
		<AccordionPrimitive.Item
			data-slot="accordion-item"
			className={cn(className)}
			{...props}
		/>
	);
}

function AccordionHeader({
	className,
	...props
}: AccordionPrimitive.Header.Props) {
	return (
		<AccordionPrimitive.Header
			data-slot="accordion-header"
			className={cn("flex", className)}
			{...props}
		/>
	);
}

function AccordionTrigger({
	className,
	children,
	...props
}: AccordionPrimitive.Trigger.Props) {
	return (
		<AccordionPrimitive.Trigger
			data-slot="accordion-trigger"
			className={cn(
				"group/accordion-trigger flex flex-1 items-start justify-between gap-4 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
				className,
			)}
			{...props}
		>
			{children}
			<ChevronDownIcon
				aria-hidden
				className={cn(
					"mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-350 group-data-panel-open/accordion-trigger:rotate-180 motion-reduce:transition-none",
					EASE,
				)}
			/>
		</AccordionPrimitive.Trigger>
	);
}

/** `className` gjelder innholdet, så padding ikke blir med i høydeanimasjonen. */
function AccordionPanel({
	className,
	children,
	...props
}: Omit<AccordionPrimitive.Panel.Props, "className"> & { className?: string }) {
	return (
		<AccordionPrimitive.Panel
			data-slot="accordion-panel"
			className={cn(
				"h-(--accordion-panel-height) overflow-hidden transition-[height,opacity] duration-350 data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none",
				EASE,
			)}
			{...props}
		>
			<div className={className}>{children}</div>
		</AccordionPrimitive.Panel>
	);
}

export {
	Accordion,
	AccordionHeader,
	AccordionItem,
	AccordionPanel,
	AccordionTrigger,
};
