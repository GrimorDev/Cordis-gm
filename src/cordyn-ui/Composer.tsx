import React from "react";
import { Plus, Smile, Gift, Send } from "lucide-react";

interface ComposerProps {
  channel: string;
  onSend: (text: string) => void;
  onTyping?: () => void;
  placeholder?: string;
}

export const Composer: React.FC<ComposerProps> = ({
  channel,
  onSend,
  onTyping,
  placeholder,
}) => {
  const [val, setVal] = React.useState("");
  const taRef = React.useRef<HTMLTextAreaElement>(null);

  const resize = React.useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "24px";
    if (ta.value) {
      ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }
  }, []);

  React.useEffect(resize, [val, resize]);

  const submit = () => {
    if (!val.trim()) return;
    onSend(val.trim());
    setVal("");
  };

  return (
    <div className="composer">
      <div className="left-actions">
        <button className="icon-btn" title="Załącz"><Plus size={18} /></button>
      </div>
      <textarea
        ref={taRef}
        value={val}
        placeholder={placeholder || `Wiadomość w #${channel}…`}
        onChange={(e) => {
          setVal(e.target.value);
          onTyping?.();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={1}
      />
      <div className="right-actions">
        <button className="icon-btn" title="GIF">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700 }}>
            GIF
          </span>
        </button>
        <button className="icon-btn" title="Emoji"><Smile size={18} /></button>
        <button className="icon-btn" title="Prezent"><Gift size={18} /></button>
        <button className="send" onClick={submit} disabled={!val.trim()}>
          <Send size={15} />
        </button>
      </div>
    </div>
  );
};
