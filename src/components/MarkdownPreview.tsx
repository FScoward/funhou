import React, { createContext, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
  onContentUpdate?: (newContent: string) => void;
}

// Checkboxの行番号を渡すためのコンテキスト
const CheckboxContext = createContext<number | null>(null);

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, className, onContentUpdate }) => {
  const handleCheckboxChange = (lineIndex: number) => {
    if (!onContentUpdate) return;

    const lines = content.split('\n');
    // lineIndexは1始まりなので0始まりに変換
    const index = lineIndex - 1;

    if (index >= 0 && index < lines.length) {
      const line = lines[index];
      // チェックボックスのパターンを探す: - [ ] または - [x]
      // 注意: リストマーカーは - だけでなく * や + の場合もある
      const checkboxRegex = /^(\s*[-*+]\s+)\[([ xX])\](.*)$/;
      const match = line.match(checkboxRegex);

      if (match) {
        const prefix = match[1];
        const currentStatus = match[2];
        const suffix = match[3];

        // ステータスを反転
        const newStatus = currentStatus === ' ' ? 'x' : ' ';
        const newLine = `${prefix}[${newStatus}]${suffix}`;

        lines[index] = newLine;
        const newContent = lines.join('\n');

        onContentUpdate(newContent);
      }
    }
  };

  return (
    <div className={`markdown-preview ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // リンクは新しいタブで開く
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
          // コードブロックのスタイリング
          code: ({ node, className, ...props }: any) => {
            const isInline = !className || !className.startsWith('language-');
            return isInline ? (
              <code className="inline-code" {...props} />
            ) : (
              <code className="code-block" {...props} />
            );
          },
          // リストアイテムのカスタマイズ
          li: ({ node, children, ...props }: any) => {
            const line = node?.position?.start?.line;
            return (
              <CheckboxContext.Provider value={line}>
                <li {...props}>{children}</li>
              </CheckboxContext.Provider>
            );
          },
          // チェックボックスのインタラクション
          input: ({ node, ...props }: any) => {
            const line = useContext(CheckboxContext);

            if (props.type === 'checkbox') {
              return (
                <input
                  {...props}
                  type="checkbox"
                  onChange={() => {
                    if (line !== null) {
                      handleCheckboxChange(line);
                    }
                  }}
                  style={{ cursor: onContentUpdate ? 'pointer' : 'default' }}
                  disabled={!onContentUpdate}
                />
              );
            }
            return <input {...props} />;
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownPreview;
