import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EsignService } from '../../services/esign.service';
import { DocumentDetailResponse, FieldSummaryDto, RecipientSummaryDto } from '../../models/esign.models';

@Component({ selector: 'app-document-view', templateUrl: './document-view.component.html' })
export class DocumentViewComponent implements OnInit {
  doc!: DocumentDetailResponse;
  currentPage = 1;
  loading = true;

  constructor(private route: ActivatedRoute, private router: Router, private esignService: EsignService) {}

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

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'Signed': return 'bg-success';
      case 'Viewed': return 'bg-info';
      case 'Sent': return 'bg-warning text-dark';
      case 'Rejected': return 'bg-danger';
      default: return 'bg-secondary';
    }
  }

  goBack(): void {
    this.router.navigate(['/dashboard/document']);
  }
}