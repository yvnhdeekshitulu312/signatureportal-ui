import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EsignService } from '../../services/esign.service';
import { DocumentDetailResponse, FieldSummaryDto, RecipientSummaryDto } from '../../models/esign.models';

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
}
