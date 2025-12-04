import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Circle, Slash, CheckCircle, XCircle } from 'lucide-react';
import {
  CHECKBOX_PATTERN_ALL,
  getNextCheckboxStatus,
  type CheckboxStatus
} from '@/utils/checkboxUtils';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
  onContentUpdate?: (newContent: string) => void;
}

// チェックボックス状態のコンテキスト
interface CheckboxInfo {
  line: number;
  isDoing: boolean;
  isCancelled: boolean;
  isCompleted: boolean;
  hasCheckbox: boolean;
}
const CheckboxInfoContext = createContext<CheckboxInfo | null>(null);

// ステータスメニューの定義
const STATUS_OPTIONS: { status: CheckboxStatus; label: string; icon: React.ReactNode }[] = [
  { status: ' ', label: '未完了', icon: <Circle size={14} /> },
  { status: '/', label: 'DOING', icon: <Slash size={14} /> },
  { status: 'x', label: '完了', icon: <CheckCircle size={14} /> },
  { status: '-', label: 'キャンセル', icon: <XCircle size={14} /> },
];

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, className, onContentUpdate }) => {
  // コンテキストメニューの状態（コンポーネントレベルで管理）
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [menuTargetLine, setMenuTargetLine] = useState<number | null>(null);
  const [menuTargetInfo, setMenuTargetInfo] = useState<CheckboxInfo | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  // - [/] と - [-] を一時的に - [ ] に変換してGFMで解析可能にし、後でスタイルを適用
  const doingLines = new Set<number>();
  const cancelledLines = new Set<number>();
  const completedLines = new Set<number>();
  const checkboxLines = new Set<number>();

  const processedContent = content.split('\n').map((line, index) => {
    const match = line.match(CHECKBOX_PATTERN_ALL);
    if (match) {
      const status = match[2];
      checkboxLines.add(index + 1);
      if (status === '/') {
        doingLines.add(index + 1);
        return `${match[1]}[ ]${match[3]}`;
      }
      if (status === '-') {
        cancelledLines.add(index + 1);
        return `${match[1]}[ ]${match[3]}`;
      }
      if (status === 'x' || status === 'X') {
        completedLines.add(index + 1);
      }
    }
    return line;
  }).join('\n');

  const handleCheckboxChange = (lineIndex: number) => {
    if (!onContentUpdate) return;

    const lines = content.split('\n');
    const index = lineIndex - 1;

    if (index >= 0 && index < lines.length) {
      const line = lines[index];
      const match = line.match(CHECKBOX_PATTERN_ALL);

      if (match) {
        const prefix = match[1];
        const currentStatus = match[2] as CheckboxStatus;
        const suffix = match[3];

        const newStatus = getNextCheckboxStatus(currentStatus);
        const newLine = `${prefix}[${newStatus}]${suffix}`;

        lines[index] = newLine;
        const newContent = lines.join('\n');

        onContentUpdate(newContent);
      }
    }
  };

  // 直接ステータスを設定する関数
  const handleStatusSet = (lineIndex: number, newStatus: CheckboxStatus) => {
    if (!onContentUpdate) return;

    const lines = content.split('\n');
    const index = lineIndex - 1;

    if (index >= 0 && index < lines.length) {
      const line = lines[index];
      const match = line.match(CHECKBOX_PATTERN_ALL);

      if (match) {
        const prefix = match[1];
        const suffix = match[3];
        const newLine = `${prefix}[${newStatus}]${suffix}`;

        lines[index] = newLine;
        const newContent = lines.join('\n');

        onContentUpdate(newContent);
      }
    }
  };

  // 行の右クリックハンドラ
  const handleLineContextMenu = (e: React.MouseEvent, info: CheckboxInfo) => {
    if (!onContentUpdate || !info.hasCheckbox) return;
    e.preventDefault();
    setMenuPosition({ x: e.clientX + 8, y: e.clientY + 8 });
    setMenuTargetLine(info.line);
    setMenuTargetInfo(info);
    setMenuOpen(true);
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
            const isCancelled = cancelledLines.has(line);
            const isCompleted = completedLines.has(line);
            const hasCheckbox = checkboxLines.has(line);
            const itemClassName = isDoing ? 'doing-item' : isCancelled ? 'cancelled-item' : undefined;

            const info: CheckboxInfo = {
              line,
              isDoing,
              isCancelled,
              isCompleted,
              hasCheckbox,
            };

            return (
              <CheckboxInfoContext.Provider value={info}>
                <li
                  {...props}
                  className={`${itemClassName || ''} ${hasCheckbox ? 'checkbox-item' : ''}`.trim() || undefined}
                  onContextMenu={(e: React.MouseEvent) => handleLineContextMenu(e, info)}
                >
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
              const isCancelled = info?.isCancelled ?? false;
              const checkboxClassName = isDoing ? 'checkbox-doing' : isCancelled ? 'checkbox-cancelled' : undefined;

              return (
                <input
                  {...props}
                  type="checkbox"
                  className={checkboxClassName}
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

      {/* コンテキストメニュー（React Portalでbody直下に表示） */}
      {menuOpen && menuTargetLine !== null && createPortal(
        <div
          ref={menuRef}
          className="checkbox-status-menu"
          style={{
            position: 'fixed',
            left: menuPosition.x,
            top: menuPosition.y,
          }}
        >
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.status}
              className={`checkbox-status-option ${
                (option.status === ' ' && !menuTargetInfo?.isDoing && !menuTargetInfo?.isCancelled && !menuTargetInfo?.isCompleted) ||
                (option.status === '/' && menuTargetInfo?.isDoing) ||
                (option.status === 'x' && menuTargetInfo?.isCompleted) ||
                (option.status === '-' && menuTargetInfo?.isCancelled)
                  ? 'active'
                  : ''
              }`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (menuTargetLine !== null) {
                  handleStatusSet(menuTargetLine, option.status);
                }
                setMenuOpen(false);
              }}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export default MarkdownPreview;
