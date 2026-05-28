import { useState } from "react";

export function ChipInput(props: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}): JSX.Element {
  const [text, setText] = useState<string>("");
  const add = (): void => {
    const t = text.trim();
    if (!t) return;
    if (props.values.includes(t)) {
      setText("");
      return;
    }
    props.onChange([...props.values, t]);
    setText("");
  };
  return (
    <div>
      <div className="row">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={props.placeholder}
        />
        <button onClick={add} style={{ flex: "0 0 auto" }}>
          添加
        </button>
      </div>
      <div className="chip-list">
        {props.values.map((v) => (
          <span key={v} className="chip">
            {v}
            <span
              className="x"
              onClick={() =>
                props.onChange(props.values.filter((x) => x !== v))
              }
            >
              ×
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
