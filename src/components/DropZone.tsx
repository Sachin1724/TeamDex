import React, { useState } from 'react';
import { FileText, UploadCloud } from 'lucide-react';

interface DropZoneProps {
  onFileDrop: (file: { name: string; size: number; path?: string }) => void;
}

export const DropZone: React.FC<DropZoneProps> = ({ onFileDrop }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const path = (file as any).path || undefined;
      onFileDrop({ name: file.name, size: file.size, path });
    } else {
      onFileDrop({ name: 'project_archive.zip', size: 16 * 1024 * 1024 });
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-xl py-7 px-4 flex flex-col items-center justify-center transition-all cursor-pointer select-none ${
        isDragOver
          ? 'border-electric bg-surface-elevated scale-[1.005]'
          : 'border-border/80 bg-surface/50 hover:bg-surface/80 hover:border-electric/50'
      }`}
    >
      <div className="w-10 h-10 rounded-full bg-surface-elevated border border-border flex items-center justify-center mb-2.5 text-electric">
        {isDragOver ? (
          <UploadCloud className="w-5 h-5 animate-bounce" />
        ) : (
          <FileText className="w-5 h-5 text-electric" />
        )}
      </div>

      <div className="text-sm font-semibold text-text-primary tracking-tight">
        Drop a file to share
      </div>
      <div className="text-xs text-text-muted mt-1 font-sans">
        or drag it to a member from the edge dock
      </div>
    </div>
  );
};
