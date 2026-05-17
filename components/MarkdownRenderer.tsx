import React from 'react';

const escapeRegExp = (string: string): string => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const renderInlineFormatting = (text: string, query?: string): React.ReactNode => {
    if (!text) return '';
    const tokenizer = /(\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_|~~.*?~~|`.*?`|\+\+.*?\+\+)/g;
    return text.split(tokenizer).filter(Boolean).map((part, index) => {
        const key = `inline-${index}`;
        if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) return <strong key={key} className="font-semibold text-white">{renderInlineFormatting(part.slice(2, -2), query)}</strong>;
        if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) return <em key={key} className="italic text-gray-200">{renderInlineFormatting(part.slice(1, -1), query)}</em>;
        if (part.startsWith('++') && part.endsWith('++')) return <u key={key}>{renderInlineFormatting(part.slice(2, -2), query)}</u>;
        if (part.startsWith('~~') && part.endsWith('~~')) return <s key={key} className="text-gray-400">{renderInlineFormatting(part.slice(2, -2), query)}</s>;
        if (part.startsWith('`') && part.endsWith('`')) return <code key={key} className="font-mono bg-black/20 text-amber-300 text-[0.9em] rounded-md px-1.5 py-0.5">{part.slice(1, -1)}</code>;
        if (query) {
            const escapedQuery = escapeRegExp(query);
            const queryRegex = new RegExp(`(${escapedQuery})`, 'gi');
            return part.split(queryRegex).map((subPart, subIndex) =>
                subPart.toLowerCase() === query.toLowerCase()
                ? <mark key={`${key}-${subIndex}`} className="bg-yellow-400 text-black rounded px-0.5">{subPart}</mark>
                : subPart
            );
        }
        return part;
    });
};

const MarkdownRenderer: React.FC<{ content: string; highlightQuery?: string }> = React.memo(({ content, highlightQuery }) => {
    
    // The content can be either raw Markdown (from AI) or HTML (from the content editor).
    // This check determines if the content is likely HTML and should be rendered directly,
    // as the previous implementation would incorrectly display HTML tags as plain text.
    const isHtml = /<[a-z][\s\S]*>/i.test(content);

    if (isHtml) {
        // Render the HTML directly. Highlighting is skipped for HTML content for simplicity.
        // The parent container should have Tailwind's `prose` classes to style this HTML.
        return <div className="prose" dangerouslySetInnerHTML={{ __html: content }} />;
    }

    const renderCodeBlock = (block: string, key: string | number) => {
        const match = block.match(/```(\w*?)\n([\s\S]*?)```/);
        const lang = match?.[1] || 'text';
        const code = match?.[2]?.trim() || '';
        return (
            <div key={key} className="bg-black/25 my-4 rounded-lg overflow-hidden border border-gray-600/50">
                <div className="text-xs text-gray-400 bg-gray-900/50 px-4 py-1.5 flex justify-between items-center">
                    <span>{lang}</span>
                </div>
                <pre className="p-4 overflow-x-auto text-sm font-mono"><code>{code}</code></pre>
            </div>
        );
    };

    const renderTextBlock = (block: string): React.ReactNode[] => {
        const lines = block.trim().split('\n');
        const elements: React.ReactNode[] = [];
        let listType: 'ul' | 'ol' | null = null;
        let listItems: React.ReactNode[] = [];

        const flushList = () => {
            if (listItems.length > 0) {
                if (listType === 'ul') {
                    elements.push(<ul key={`ul-${elements.length}`} className="list-disc space-y-2 pl-6 my-4 text-gray-300">{listItems}</ul>);
                } else if (listType === 'ol') {
                    elements.push(<ol key={`ol-${elements.length}`} className="list-decimal space-y-2 pl-6 my-4 text-gray-300">{listItems}</ol>);
                }
                listItems = [];
                listType = null;
            }
        };

        lines.forEach((line, i) => {
            const ulMatch = line.match(/^(\s*)(?:\*|-)\s+(.*)/);
            const olMatch = line.match(/^(\s*)\d+\.\s+(.*)/);
            const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)/);

            if (ulMatch) {
                if (listType !== 'ul') flushList();
                listType = 'ul';
                listItems.push(<li key={`li-${i}`}>{renderInlineFormatting(ulMatch[2], highlightQuery)}</li>);
            } else if (olMatch) {
                if (listType !== 'ol') flushList();
                listType = 'ol';
                listItems.push(<li key={`li-${i}`}>{renderInlineFormatting(olMatch[2], highlightQuery)}</li>);
            } else {
                flushList();
                if (line.startsWith('# ')) elements.push(<h1 key={`h1-${i}`} className="text-3xl font-bold mt-8 mb-4 text-white">{renderInlineFormatting(line.substring(2), highlightQuery)}</h1>);
                else if (line.startsWith('## ')) elements.push(<h2 key={`h2-${i}`} className="text-2xl font-semibold mt-6 mb-3 text-gray-100 border-b border-gray-700 pb-2">{renderInlineFormatting(line.substring(3), highlightQuery)}</h2>);
                else if (line.startsWith('### ')) elements.push(<h3 key={`h3-${i}`} className="text-xl font-semibold mt-4 mb-2 text-gray-200">{renderInlineFormatting(line.substring(4), highlightQuery)}</h3>);
                else if (imgMatch) elements.push(<img key={`img-${i}`} src={imgMatch[2]} alt={imgMatch[1]} className="my-4 rounded-lg max-w-full" />);
                else if (line.trim()) elements.push(<p key={`p-${i}`} className="my-4 leading-relaxed text-gray-300">{renderInlineFormatting(line, highlightQuery)}</p>);
            }
        });
        
        flushList();
        
        return elements;
    }

    const blocks = content.split(/(```[\s\S]*?```|---)/g).filter(Boolean);

    return (
        <div className="prose w-full max-w-none">
            {blocks.flatMap((block, index) => {
                const key = `block-${index}`;
                if (block.startsWith('```')) return renderCodeBlock(block, key);
                if (block.trim() === '---') return <hr key={key} className="my-6 border-gray-600" />;
                return renderTextBlock(block);
            })}
        </div>
    );
});

export default MarkdownRenderer;
