import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EsignService } from '../../services/esign.service';
import { DocumentDetailResponse, FieldSummaryDto, RecipientSummaryDto } from '../../models/esign.models';
import { ToastService } from 'src/app/toast.service';
// NOTE: no `import ... from 'jspdf'` — jsPDF is loaded at runtime below,
// so this file compiles WITHOUT installing the npm package.

@Component({
  selector: 'app-document-view',
  templateUrl: './document-view.component.html',
  styleUrls: ['./document-view.component.scss']
})
export class DocumentViewComponent implements OnInit {
  doc!: DocumentDetailResponse;
  currentPage = 1;
  loading = true;

  constructor(private route: ActivatedRoute, private router: Router, private esignService: EsignService, private toast: ToastService) { }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.esignService.getDocument(id).subscribe({
      next: (doc) => { this.doc = doc; this.loading = false; this.logFieldsDiagnostic(doc); },
      error: () => { this.loading = false; this.toast.error('Unable to load this document.'); this.router.navigate(['/dashboard/document']); }
    });
  }

  /** TEMP diagnostic for the duplicate-signature investigation -- open the
   *  browser console after opening a signed document. If any row repeats
   *  under the same RecipientId+FieldType+PageNumber, that's a genuine
   *  duplicate EsignField row (the dedupe below is dropping it). If nothing
   *  repeats here but a duplicate is still visible, the duplicate is baked
   *  into the page IMAGE itself, not in this array -- see the fix in
   *  EsignService.cs (BuildDetailResponseAsync / RenderAndCacheFallbackAsync)
   *  for that root cause. Safe to delete once the bug is confirmed gone. */
  private logFieldsDiagnostic(doc: DocumentDetailResponse): void {
    // eslint-disable-next-line no-console
    console.log('[DocumentView] doc.Fields for "' + doc.Name + '" (Status: ' + doc.Status + '):');
    // eslint-disable-next-line no-console
    console.table((doc.Fields || []).map(f => ({
      Id: (f as any).Id,
      RecipientId: f.RecipientId,
      FieldType: f.FieldType,
      Page: f.PageNumber,
      X: f.XPct, Y: f.YPct,
      HasValue: !!f.Value,
      ValuePreview: f.Value ? f.Value.substring(0, 30) : ''
    })));
  }

  get pageImages(): string[] {
    return (this.doc?.PageImages || []).map(b64 =>
      b64.startsWith('data:') ? b64 : 'data:image/jpeg;base64,' + b64
    );
  }

  fieldsOnPage(page: number): FieldSummaryDto[] {
    const onPage = this.doc.Fields.filter(f => f.PageNumber === page);
    return this.dedupeFilledFields(onPage);
  }

  /** Front-end safety net for the "signature shows twice / in the wrong
   *  place" bug. ROOT CAUSE (now fixed server-side, see EsignService.cs):
   *  the page image itself was, for some documents, getting cached AFTER
   *  being rendered from the STAMPED final pdf instead of the original --
   *  so the signature was baked into the background image (at the PDF
   *  stamper's coordinates) *and* drawn again by this component's live
   *  field overlay (at XPct/YPct coordinates), i.e. two independent
   *  renderers drawing the same value in two different spots. That's fixed
   *  at the source now. This filter stays as a second line of defence in
   *  case doc.Fields itself ever legitimately contains duplicate rows (e.g.
   *  a past double-submit) for the same recipient/field/page -- regardless
   *  of position or value, only the first such row renders, since a signer
   *  never has two DIFFERENT fields of the same type on the same page.
   *  Unfilled fields are never touched. */
  private dedupeFilledFields(fields: FieldSummaryDto[]): FieldSummaryDto[] {
    const seen = new Set<string>();
    return fields.filter(f => {
      if (!f.Value) { return true; }
      const key = f.RecipientId + '|' + f.FieldType + '|' + f.PageNumber;
      if (seen.has(key)) {
        // eslint-disable-next-line no-console
        console.warn('[DocumentView] Dropped a duplicate field render (same recipient/type/page) -- check EsignField rows for this document:', f);
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  boxStyle(f: FieldSummaryDto) {
    return { left: f.XPct + '%', top: f.YPct + '%', width: f.WidthPct + '%', height: f.HeightPct + '%' };
  }

  isImageValue(value: string | undefined): boolean {
    return !!value && value.startsWith('data:image');
  }

  recipientFor(recipientId: number): RecipientSummaryDto | undefined {
    return this.doc.Recipients.find(r => r.Id === recipientId);
  }

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'Signed': return 'chip-signed';
      case 'Viewed': return 'chip-viewed';
      case 'Sent': return 'chip-sent';
      case 'Rejected': return 'chip-rejected';
      default: return 'chip-default';
    }
  }

  goBack(): void {
    this.router.navigate(['/dashboard/document']);
  }

  download(): void {
    const path = this.doc.ViewerGcsUrl.split('path=')[1];
    this.esignService.downloadFile(decodeURIComponent(path)).subscribe(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this.doc.Name + '.pdf';
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  async downloadAsShown(): Promise<void> {
    const images = this.pageImages;
    if (!images.length) { this.download(); return; }

    const JsPDF = await this.ensureJsPdf();   // loaded at runtime
    let pdf: any = null;

    for (let i = 0; i < images.length; i++) {
      const img = await this.loadImage(images[i]);
      const W = img.naturalWidth, H = img.naturalHeight;

      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, W, H);

      for (const f of this.fieldsOnPage(i + 1)) {
        if (!f.Value) continue;
        const x = (f.XPct / 100) * W, y = (f.YPct / 100) * H;
        const w = (f.WidthPct / 100) * W, h = (f.HeightPct / 100) * H;
        if (this.isImageValue(f.Value)) {
          const fi = await this.loadImage(f.Value);
          const s = Math.min(w / fi.naturalWidth, h / fi.naturalHeight);
          const dw = fi.naturalWidth * s, dh = fi.naturalHeight * s;
          ctx.drawImage(fi, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
        } else {
          ctx.fillStyle = '#002654';
          ctx.font = `${Math.floor(h * 0.5)}px 'Noto Kufi Arabic', sans-serif`;
          ctx.textBaseline = 'middle';
          ctx.fillText(f.Value, x + 6, y + h / 2);
        }
      }

      const orientation = W >= H ? 'l' : 'p';
      const data = canvas.toDataURL('image/jpeg', 0.92);
      if (!pdf) pdf = new JsPDF({ orientation, unit: 'px', format: [W, H] });
      else pdf.addPage([W, H], orientation);
      pdf.addImage(data, 'JPEG', 0, 0, W, H);
    }
    pdf.save(this.doc.Name + '.pdf');
  }

  private jsPdfPromise?: Promise<any>;
  /** Resolves the jsPDF constructor, loading the UMD bundle at runtime if needed.
      Point `src` at a self-hosted copy (assets/js/jspdf.umd.min.js) for offline use. */
  private ensureJsPdf(): Promise<any> {
    const w = window as any;
    if (w.jspdf?.jsPDF) { return Promise.resolve(w.jspdf.jsPDF); }
    if (this.jsPdfPromise) { return this.jsPdfPromise; }
    this.jsPdfPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      // For an internal/offline app, host this file yourself and use:
      //   s.src = 'assets/js/jspdf.umd.min.js';
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = () => {
        const ctor = (window as any).jspdf?.jsPDF;
        ctor ? resolve(ctor) : reject(new Error('jsPDF loaded but constructor not found'));
      };
      s.onerror = () => reject(new Error('Failed to load jsPDF'));
      document.body.appendChild(s);
    });
    return this.jsPdfPromise;
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = src;
    });
  }
}
