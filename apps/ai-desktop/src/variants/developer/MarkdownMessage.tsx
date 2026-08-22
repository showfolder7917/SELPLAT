import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownMessageProps {
  text: string;
}

/** 把 Harness 的 Markdown 回答安全渲染为可读正文，原始 HTML 永远不进入桌面页面。 */
export function MarkdownMessage({ text }: MarkdownMessageProps) {
  const openLink = (href: string | undefined) => {
    if (href) void window.desktop?.openExternalUrl(href);
  };

  return <div className="markdown-message">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      components={{
        a: ({ href, children }) => <a
          role="link"
          tabIndex={0}
          title={href}
          onClick={(event) => {
            event.preventDefault();
            openLink(href);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            openLink(href);
          }}
        >{children}</a>,
      }}
    >{text}</ReactMarkdown>
  </div>;
}
