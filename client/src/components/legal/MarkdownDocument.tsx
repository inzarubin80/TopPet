import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Link } from 'react-router-dom';
import './MarkdownDocument.css';

type Props = {
  title: string;
  markdown: string;
};

export const MarkdownDocument: React.FC<Props> = ({ title, markdown }) => {
  return (
    <article className="markdown-document">
      <h1 className="markdown-document__title">{title}</h1>
      <div className="markdown-document__body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          components={{
            a: ({ href, children, ...rest }) => {
              if (href?.startsWith('/')) {
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
            },
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </article>
  );
};
