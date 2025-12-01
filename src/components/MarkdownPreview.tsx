import React, { createContext, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
  onContentUpdate?: (newContent: string) => void;
}

// Doing状態のコンテキスト（行番号とDoing状態を保持）
interface CheckboxInfo {
  line: number;
  isDoing: boolean;
}
const CheckboxInfoContext = createContext<CheckboxInfo | null>(null);

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, className, onContentUpdate }) => {
  // - [/] を一時的に - [ ] に変換してGFMで解析可能にし、後でスタイルを適用
  const doingLines = new Set<number>();
  const processedContent = content.split('\n').map((line, index) => {
    const doingMatch = line.match(/^(\s*[-*+]\s+)\[\/\](.*)$/);
    if (doingMatch) {
      doingLines.add(index + 1); // 1始まり
      return `${doingMatch[1]}[ ]${doingMatch[2]}`;
    }
    return line;
  }).join('\n');

  const handleCheckboxChange = (lineIndex: number) => {
    if (!onContentUpdate) return;

    const lines = content.split('\n');
    // lineIndexは1始まりなので0始まりに変換
    const index = lineIndex - 1;

    if (index >= 0 && index < lines.length) {
      const line = lines[index];
      // チェックボックスのパターンを探す: - [ ] または - [x] または - [/]
      // 注意: リストマーカーは - だけでなく * や + の場合もある
      const checkboxRegex = /^(\s*[-*+]\s+)\[([ \/xX])\](.*)$/;
      const match = line.match(checkboxRegex);

      if (match) {
        const prefix = match[1];
        const currentStatus = match[2];
        const suffix = match[3];

        // ステータスを遷移: [ ] → [/] → [x] → [ ]
        let newStatus: string;
        if (currentStatus === ' ') {
          newStatus = '/';
        } else if (currentStatus === '/') {
          newStatus = 'x';
        } else {
          newStatus = ' ';
        }
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
            const isDoing = doingLines.has(line);
            return (
              <CheckboxInfoContext.Provider value={{ line, isDoing }}>
                <li {...props} className={isDoing ? 'doing-item' : undefined}>
                  {children}
                </li>
              </CheckboxInfoContext.Provider>
            );
          },
          // チェックボックスのインタラクション
          input: ({ node, ...props }: any) => {
            const info = useContext(CheckboxInfoContext);

            if (props.type === 'checkbox') {
              const isDoing = info?.isDoing ?? false;
              return (
                <input
                  {...props}
                  type="checkbox"
                  className={isDoing ? 'checkbox-doing' : undefined}
                  onChange={() => {
                    if (info?.line !== null && info?.line !== undefined) {
                      handleCheckboxChange(info.line);
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
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownPreview;
