"use client";

import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  disabled?: boolean;
  className?: string;
}

export function FileUpload({
  onFileSelect,
  accept = ".xlsx",
  disabled,
  className,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file?.name.endsWith(".xlsx")) onFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
  };

  return (
    <Card className={cn("w-full rounded-2xl border border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold tracking-tight">Importer un fichier</CardTitle>
      </CardHeader>
      <CardContent>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
          disabled={disabled}
        />
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className={cn(
            "flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-border bg-muted/30 px-8 py-12 transition-all duration-200",
            !disabled && "hover:border-primary/40 hover:bg-muted/50 cursor-pointer"
          )}
          onClick={() => !disabled && inputRef.current?.click()}
        >
          <p className="text-muted-foreground text-center text-sm">
            Glissez un fichier .xlsx ici ou
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="rounded-lg"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            Parcourir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
