'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { ExcelUploadModal } from './excel-upload-modal';

export function UploadExcelButton({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2 text-sm">
        <Upload className="h-4 w-4" />
        Upload Excel
      </button>
      {open && (
        <ExcelUploadModal
          isAdmin={isAdmin}
          onClose={() => setOpen(false)}
          // Refresh the list behind the modal; the modal stays open to show the import summary
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  );
}
