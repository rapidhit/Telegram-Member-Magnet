import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { CloudUpload, File, X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onFileRemove?: () => void;
  selectedFile?: File | null;
  accept?: Record<string, string[]>;
  maxSize?: number;
  className?: string;
}

export function FileUpload({
  onFileSelect,
  onFileRemove,
  selectedFile,
  accept = { "text/plain": [".txt"] },
  maxSize = 10 * 1024 * 1024, // 10MB
  className,
}: FileUploadProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false,
  });

  if (selectedFile) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <File className="text-[hsl(207,90%,54%)] h-5 w-5" />
            <div>
              <p className="font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-sm text-gray-500">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          {onFileRemove && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onFileRemove}
              className="text-red-600 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[hsl(207,90%,54%)] hover:bg-blue-50 transition-colors cursor-pointer",
        isDragActive && "border-[hsl(207,90%,54%)] bg-blue-50",
        className
      )}
    >
      <input {...getInputProps()} />
      <div className="space-y-4">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
          <CloudUpload className="h-8 w-8 text-gray-400" />
        </div>
        <div>
          <p className="text-lg font-medium text-gray-700">
            {isDragActive
              ? "Drop your file here"
              : "Drop your file here or click to browse"}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Supports .txt files with user IDs (one per line)
          </p>
        </div>
        <Button
          type="button"
          className="bg-[hsl(207,90%,54%)] hover:bg-[hsl(207,90%,44%)]"
        >
          Select File
        </Button>
      </div>
    </div>
  );
}
