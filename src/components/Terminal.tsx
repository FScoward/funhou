import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface TerminalProps {
  className?: string;
  initialCommand?: string;
  initialContent?: string;
  onOutput?: (output: string) => void;
  readOnly?: boolean;
}

export const Terminal: React.FC<TerminalProps> = ({
  className,
  initialCommand,
  initialContent,
  onOutput,
  readOnly = false
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const outputBufferRef = useRef<string>(initialContent || '');

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: !readOnly,
      disableStdin: readOnly,
      theme: {
        background: "#1e1e1e",
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    if (initialContent) {
      term.write(initialContent);
    }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    if (readOnly) {
      return () => {
        term.dispose();
      };
    }

    // Initialize PTY
    const initPty = async () => {
      try {
        await invoke("spawn_pty", {
          cols: term.cols,
          rows: term.rows,
          initialCommand,
        });

        // Listen for PTY output
        const unlisten = await listen<string>("pty-output", (event) => {
          term.write(event.payload);
          if (onOutput) {
            outputBufferRef.current += event.payload;
            onOutput(outputBufferRef.current);
          }
        });

        // Handle user input
        term.onData((data) => {
          invoke("write_pty", { data });
        });

        // Handle resize
        const handleResize = () => {
          fitAddon.fit();
          invoke("resize_pty", {
            cols: term.cols,
            rows: term.rows,
          });
        };

        window.addEventListener("resize", handleResize);

        return () => {
          unlisten();
          window.removeEventListener("resize", handleResize);
          term.dispose();
          invoke("kill_pty");
        };
      } catch (e) {
        console.error("Failed to initialize PTY:", e);
      }
    };

    const cleanupPromise = initPty();

    return () => {
      cleanupPromise.then((cleanup) => cleanup && cleanup());
    };
  }, []);

  return <div ref={terminalRef} className={`w-full h-full ${className}`} />;
};
