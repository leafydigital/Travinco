'use client';

/** Browser helpers for the quotation / invoice documents. */

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Copies a rendered element as rich text (pastes formatted into Word / Gmail). */
export async function copyElement(id: string): Promise<boolean> {
  const el = document.getElementById(id);
  if (!el) return false;
  try {
    const html = `<div style="font-family:Calibri,Arial,sans-serif">${el.innerHTML}</div>`;
    if ('ClipboardItem' in window) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([el.innerText], { type: 'text/plain' }),
        }),
      ]);
    } else await navigator.clipboard.writeText(el.innerText);
    return true;
  } catch {
    return false;
  }
}

/** Saves a rendered element as a Word document (.doc, HTML-based – opens in Word / Google Docs). */
export function downloadWord(id: string, fileName: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('img').forEach((img) => {
    img.setAttribute('src', new URL(img.getAttribute('src') || '', window.location.origin).toString());
    img.setAttribute('height', '44');
  });
  const html =
    '﻿<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">' +
    '<head><meta charset="utf-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt}table{border-collapse:collapse;width:100%}</style></head><body>' +
    clone.innerHTML +
    '</body></html>';
  const blob = new Blob([html], { type: 'application/msword' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName.endsWith('.doc') ? fileName : `${fileName}.doc`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

/** Opens the print dialog with a file-friendly title ("Save as PDF"). */
export function printAsPdf(fileName: string) {
  const t = document.title;
  document.title = fileName;
  window.print();
  setTimeout(() => (document.title = t), 1000);
}

/** Downloads the document directly as a PDF file. */
export async function downloadPdf(id: string, fileName: string) {
  const el = document.getElementById(id);
  if (!el) return;

  try {
    // Dynamically load html2pdf.js if not already present
    if (!(window as unknown as { html2pdf?: unknown }).html2pdf) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load html2pdf engine'));
        document.head.appendChild(script);
      });
    }

    const html2pdf = (window as unknown as { html2pdf: () => any }).html2pdf;
    const cleanName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    const opt = {
      margin: [10, 10, 10, 10],
      filename: cleanName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    await html2pdf().set(opt).from(el).save();
  } catch (err) {
    console.warn('Direct PDF download fallback to print dialog:', err);
    printAsPdf(fileName);
  }
}

export { waLink } from '@/lib/tour/wa';
