import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Link } from 'react-router-dom';
import './MarkdownDocument.css';

function markdownLink(
  props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children?: React.ReactNode }
) {
  const { href, children, ...rest } = props;
  if (typeof href === 'string' && href.startsWith('/')) {
    return (
      <Link to={href} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  );
}

const markdownComponents = { a: markdownLink };

type MarkdownBodyProps = {
  markdown: string;
  className?: string;
};

/** Только разметка Markdown (без обёртки страницы); для модалок и встраивания. */
export const MarkdownBody: React.FC<MarkdownBodyProps> = ({ markdown, className }) => {
  return (
    <div className={className ?? 'markdown-document__body'}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={markdownComponents}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
};

type Props = {
  title: string;
  markdown: string;
};

export const MarkdownDocument: React.FC<Props> = ({ title, markdown }) => {
  return (
    <article className="markdown-document">
      <h1 className="markdown-document__title">{title}</h1>
      <MarkdownBody markdown={markdown} />
    </article>
  );
};
