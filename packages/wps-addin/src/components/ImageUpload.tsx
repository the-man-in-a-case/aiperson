import { useRef, useState } from "react";

export interface UploadedImage {
  base64: string;
  mime: string;
  dataUrl: string;
}

export function ImageUpload(props: {
  value: UploadedImage | null;
  onChange: (v: UploadedImage | null) => void;
}): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hint, setHint] = useState<string>("");

  const onFile = (file: File): void => {
    if (!file.type.startsWith("image/")) {
      setHint("仅支持图片文件");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setHint("图片不能超过 8MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1] ?? "";
      props.onChange({ base64, mime: file.type, dataUrl });
      setHint("");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div
        className={`upload-area ${props.value ? "has-image" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
      >
        {props.value ? (
          <img src={props.value.dataUrl} alt="角色图片" />
        ) : (
          <div>
            <div>点击或拖入角色图片</div>
            <div className="field-hint">建议正面半身像，PNG/JPG，≤ 8MB</div>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      {hint && <div className="field-hint" style={{ color: "#cf222e" }}>{hint}</div>}
      {props.value && (
        <button
          style={{ marginTop: 4 }}
          onClick={() => props.onChange(null)}
        >
          清除
        </button>
      )}
    </div>
  );
}
