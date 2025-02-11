import { Button } from "@/components/ui/button";
import { Upload, File, Loader2 } from "lucide-react";
import { useRef, useState } from "react";

interface PdfUploadProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
}

export default function PdfUpload({ onFileSelect, isUploading }: PdfUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file?.type === "application/pdf") {
      onFileSelect(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div
      className={`
        border-2 border-dashed rounded-lg p-8
        flex flex-col items-center justify-center gap-4
        ${dragActive ? "border-primary bg-primary/5" : "border-border"}
      `}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      {isUploading ? (
        <>
          <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Analyzing your resume...</p>
        </>
      ) : (
        <>
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            accept=".pdf"
            onChange={handleChange}
          />
          <File className="h-10 w-10 text-primary mb-2" />
          <h3 className="font-semibold">Upload your resume</h3>
          <p className="text-sm text-muted-foreground text-center mb-2">
            Drag and drop your PDF resume here, or click to select
          </p>
          <Button
            onClick={() => inputRef.current?.click()}
            className="bg-primary/10 text-primary hover:bg-primary/20"
          >
            <Upload className="h-4 w-4 mr-2" />
            Select PDF
          </Button>
        </>
      )}
    </div>
  );
}