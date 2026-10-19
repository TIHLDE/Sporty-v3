import ReactMarkdown from "react-markdown";

export function Markdown({
	children,
	className,
}: {
	children: string;
	className?: string;
}) {
	return (
		<div className={className}>
			<ReactMarkdown
				components={{
					p: ({ children }) => (
						<p className="whitespace-pre-wrap">{children}</p>
					),
					a: ({ children, href }) => (
						<a
							href={href}
							target="_blank"
							rel="noopener noreferrer"
							className="underline"
						>
							{children}
						</a>
					),
				}}
			>
				{children}
			</ReactMarkdown>
		</div>
	);
}
