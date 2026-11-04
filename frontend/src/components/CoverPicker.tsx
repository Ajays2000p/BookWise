import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Link as LinkIcon } from "lucide-react";
import { CoverChoice, validateCoverFile, isHttpUrl } from "@/lib/coverChoice";

interface CoverPickerProps {
  idPrefix: string;
  value: CoverChoice;
  onChange: (choice: CoverChoice) => void;
}

export function CoverPicker({ idPrefix, value, onChange }: CoverPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [urlPreviewFailed, setUrlPreviewFailed] = useState(false);

  // Local preview of the chosen file, released when it changes
  useEffect(() => {
    if (!value.file) {
      setFilePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const objectUrl = URL.createObjectURL(value.file);
    setFilePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [value.file]);

  useEffect(() => setUrlPreviewFailed(false), [value.url]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    const problem = file ? validateCoverFile(file) : null;
    setFileError(problem);
    if (problem) e.target.value = "";
    onChange({ ...value, file: problem ? null : file });
  };

  const url = value.url.trim();
  const urlInvalid = url !== "" && !isHttpUrl(url);

  // The preview appears only once a file is chosen or an image URL is entered
  let preview: string | undefined;
  let caption = "";
  if (value.mode === "upload" && filePreview) {
    preview = filePreview;
    caption = `New cover: ${value.file?.name}. It is uploaded when you save.`;
  } else if (value.mode === "url" && url && !urlInvalid && !urlPreviewFailed) {
    preview = url;
    caption = "New cover. It is downloaded and stored on the server when you save.";
  }

  return (
    <div className="grid gap-2">
      <Label>Cover image</Label>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={value.mode === "upload" ? "secondary" : "outline"}
          onClick={() => onChange({ ...value, mode: "upload" })}
          className="gap-1.5"
        >
          <Upload className="w-3.5 h-3.5" /> Upload image
        </Button>
        <Button
          type="button"
          size="sm"
          variant={value.mode === "url" ? "secondary" : "outline"}
          onClick={() => onChange({ ...value, mode: "url" })}
          className="gap-1.5"
        >
          <LinkIcon className="w-3.5 h-3.5" /> Image URL
        </Button>
      </div>

      {value.mode === "upload" ? (
        <>
          <Input
            ref={fileInputRef}
            id={`${idPrefix}-cover-file`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
          />
          <p className={`text-xs ${fileError ? "text-destructive" : "text-muted-foreground"}`}>
            {fileError || "JPG, PNG or WebP, up to 5 MB."}
          </p>
        </>
      ) : (
        <>
          <Input
            id={`${idPrefix}-cover-url`}
            value={value.url}
            onChange={(e) => onChange({ ...value, url: e.target.value })}
            placeholder="https://example.com/cover.jpg"
          />
          <p className={`text-xs ${urlInvalid || urlPreviewFailed ? "text-destructive" : "text-muted-foreground"}`}>
            {urlInvalid
              ? "The URL must start with http:// or https://"
              : urlPreviewFailed
                ? "This URL did not load as an image."
                : "The image is downloaded once and stored on the server, so it also shows offline."}
          </p>
        </>
      )}

      {preview && (
        <div className="flex items-center gap-3 rounded-md border p-2">
          <img
            src={preview}
            alt="Cover preview"
            className="w-14 h-20 object-cover rounded shadow-sm shrink-0"
            onError={() => value.mode === "url" && preview === url && setUrlPreviewFailed(true)}
          />
          <p className="text-xs text-muted-foreground">{caption}</p>
        </div>
      )}
    </div>
  );
}
