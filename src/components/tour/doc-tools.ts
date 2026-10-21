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
    const h = parseInt(img.style.height || '', 10) || parseInt(img.getAttribute('height') || '', 10);
    if (h && !isNaN(h)) {
      img.setAttribute('height', String(h));
    }
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

/** Loads an external script dynamically if not already present. */
function loadExternalScript(src: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      return resolve();
    }
    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

/** Inlines images inside a container into base64 data URLs to avoid any CORS/canvas taint issues during PDF generation. */
async function inlineImagesAsDataUrls(container: HTMLElement) {
  const imgs = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    imgs.map(async (img) => {
      try {
        const src = img.getAttribute('src') || img.src;
        if (!src || src.startsWith('data:')) return;
        const res = await fetch(src);
        if (!res.ok) return;
        const blob = await res.blob();
        await new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              img.src = reader.result;
              img.setAttribute('src', reader.result);
            }
            resolve();
          };
          reader.readAsDataURL(blob);
        });
      } catch (err) {
        console.warn('Could not inline image for PDF export:', img.src, err);
      }
    })
  );
}

/** Downloads the document directly as a PDF file, stamping the footer logos onto every page for quotations. */
export async function downloadPdf(id: string, fileName: string) {
  const el = document.getElementById(id);
  if (!el) return;

  try {
    // 1. Ensure BOTH html2canvas and html2pdf.js are loaded and ready
    await Promise.all([
      loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'),
      loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'),
    ]);

    const html2pdf = (window as unknown as { html2pdf: () => any }).html2pdf;
    const html2canvas = (window as any).html2canvas;
    const cleanName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;

    // 2. Locate footer logos element (only when downloading quote documents)
    const isQuoteDoc = id === 'quote-doc';
    const footerEl = isQuoteDoc
      ? ((el.querySelector('#quote-footer-logos') || document.getElementById('quote-footer-logos')) as HTMLElement | null)
      : null;

    let footerImgData: string | null = null;
    let footerCanvasWidth = 0;
    let footerCanvasHeight = 0;

    // 3. Inline images in both the document and footer element to ensure 100% clean canvas exports
    await Promise.all([
      inlineImagesAsDataUrls(el),
      footerEl ? inlineImagesAsDataUrls(footerEl) : Promise.resolve(),
    ]);

    // 4. Capture the quotation footer logos into a sharp, non-tainted canvas
    if (footerEl && html2canvas) {
      try {
        const fCanvas = await html2canvas(footerEl, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          logging: false,
        });
        footerImgData = fCanvas.toDataURL('image/png');
        footerCanvasWidth = fCanvas.width;
        footerCanvasHeight = fCanvas.height;
      } catch (err) {
        console.warn('Could not generate footer canvas for PDF:', err);
      }
    }

    // 5. Temporarily hide the in-flow footer in the document so it does not double-render inside the body on the last page
    const originalDisplay = footerEl ? footerEl.style.display : '';
    if (footerEl && footerImgData) {
      footerEl.style.display = 'none';
    }

    const marginX = 10;
    const marginTop = 8;
    const pdfWidthMm = 210;
    const pdfHeightMm = 297;
    const contentWidthMm = pdfWidthMm - marginX * 2; // 190 mm
    const footerHeightMm =
      footerCanvasWidth > 0 ? (footerCanvasHeight * contentWidthMm) / footerCanvasWidth : 20;
    const bottomMargin = footerImgData ? Math.ceil(footerHeightMm + 6) : 10;

    const opt = {
      margin: [marginTop, marginX, bottomMargin, marginX],
      filename: cleanName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    try {
      const worker = html2pdf().set(opt).from(el);

      if (footerImgData && footerCanvasWidth > 0) {
        await worker
          .toPdf()
          .get('pdf')
          .then((pdf: any) => {
            const totalPages =
              typeof pdf.internal?.getNumberOfPages === 'function'
                ? pdf.internal.getNumberOfPages()
                : pdf.internal?.pages ? pdf.internal.pages.length - 1 : 1;
            const pWidth =
              typeof pdf.internal?.pageSize?.getWidth === 'function'
                ? pdf.internal.pageSize.getWidth()
                : pdf.internal?.pageSize?.width || 210;
            const pHeight =
              typeof pdf.internal?.pageSize?.getHeight === 'function'
                ? pdf.internal.pageSize.getHeight()
                : pdf.internal?.pageSize?.height || 297;
            const fWidth = pWidth - marginX * 2;
            const fHeight = (footerCanvasHeight * fWidth) / footerCanvasWidth;
            const fY = pHeight - fHeight - 3;

            for (let i = 1; i <= totalPages; i++) {
              pdf.setPage(i);
              pdf.addImage(footerImgData, 'PNG', marginX, fY, fWidth, fHeight, undefined, 'FAST');
            }
          })
          .save();
      } else {
        await worker.save();
      }
    } finally {
      // 6. Restore the in-flow footer so on-screen preview remains intact
      if (footerEl) {
        footerEl.style.display = originalDisplay;
      }
    }
  } catch (err) {
    console.warn('Direct PDF download fallback to print dialog:', err);
    printAsPdf(fileName);
  }
}

export { waLink } from '@/lib/tour/wa';
