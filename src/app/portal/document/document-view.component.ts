import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EsignService } from '../../services/esign.service';
import { DocumentDetailResponse, FieldSummaryDto, RecipientSummaryDto } from '../../models/esign.models';
import { jsPDF } from 'jspdf';

@Component({
  selector: 'app-document-view',
  templateUrl: './document-view.component.html',
  styleUrls: ['./document-view.component.scss']   // ← added (was template-only)
})
export class DocumentViewComponent implements OnInit {
  doc!: DocumentDetailResponse;
  currentPage = 1;
  loading = true;

  constructor(private route: ActivatedRoute, private router: Router, private esignService: EsignService) { }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.esignService.getDocument(id).subscribe({
      next: (doc) => { this.doc = doc; this.loading = false; },
      error: () => { this.loading = false; alert('Unable to load this document.'); this.router.navigate(['/dashboard/document']); }
    });
  }

  get pageImages(): string[] {
    return (this.doc?.PageImages || []).map(b64 =>
      b64.startsWith('data:') ? b64 : 'data:image/jpeg;base64,' + b64
    );
  }

  fieldsOnPage(page: number): FieldSummaryDto[] {
    return this.doc.Fields.filter(f => f.PageNumber === page);
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

  // Returns an approved-palette chip class (was Bootstrap bg-success/info/warning/danger/secondary,
  // which aren't in the approved palette). Same status → tone mapping.
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
    const path = this.doc.ViewerGcsUrl.split('path=')[1]; // extract the raw GCS object key
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
  let pdf: jsPDF | null = null;

  for (let i = 0; i < images.length; i++) {
    const img = await this.loadImage(images[i]);
    const W = img.naturalWidth, H = img.naturalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, W, H);

    // SAME top-left % math as boxStyle() → guaranteed to match the screen
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
    if (!pdf) pdf = new jsPDF({ orientation, unit: 'px', format: [W, H] });
    else pdf.addPage([W, H], orientation);
    pdf.addImage(data, 'JPEG', 0, 0, W, H);
  }
  pdf!.save(this.doc.Name + '.pdf');
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
