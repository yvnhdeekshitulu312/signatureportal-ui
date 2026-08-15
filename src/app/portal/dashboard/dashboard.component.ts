import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EsignService } from 'src/app/services/esign.service';
import { DocumentDetailResponse } from 'src/app/models/esign.models';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {

  recentDocs: DocumentDetailResponse[] = [];
  loading = false;
  activeFilter: 'all' | 'pending' | 'signed' | 'progress' = 'all';

  constructor(private router: Router, private esignService: EsignService) { }

  ngOnInit(): void {
    this.loadRecent();
  }

  // Recent documents for the dashboard panel (from the same source as the list)
  loadRecent(): void {
    this.loading = true;
    this.esignService.getMyDocuments().subscribe({
      next: (docs) => { this.recentDocs = docs || []; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  // ── stats (derived from real loaded documents, not hard-coded) ──
  private statusOf(d: DocumentDetailResponse): string { return (d.Status || '').toLowerCase(); }
  isSigned(d: DocumentDetailResponse): boolean { return this.statusOf(d).includes('complet') || this.statusOf(d).includes('sign'); }
  isProgress(d: DocumentDetailResponse): boolean { return this.statusOf(d).includes('progress'); }
  isPending(d: DocumentDetailResponse): boolean { return !this.isSigned(d) && !this.isProgress(d); }

  get totalCount(): number { return this.recentDocs.length; }
  get pendingCount(): number { return this.recentDocs.filter(d => this.isPending(d)).length; }
  get signedCount(): number { return this.recentDocs.filter(d => this.isSigned(d)).length; }
  pct(n: number): number { return this.totalCount ? Math.round((n / this.totalCount) * 100) : 0; }

  // ── table filter ──
  setFilter(f: 'all' | 'pending' | 'signed' | 'progress'): void { this.activeFilter = f; }
  get filteredDocs(): DocumentDetailResponse[] {
    if (this.activeFilter === 'pending') return this.recentDocs.filter(d => this.isPending(d));
    if (this.activeFilter === 'signed') return this.recentDocs.filter(d => this.isSigned(d));
    if (this.activeFilter === 'progress') return this.recentDocs.filter(d => this.isProgress(d));
    return this.recentDocs;
  }

  signerName(d: DocumentDetailResponse): string {
    const r: any = (d as any).Recipients?.[0];
    return r?.Name || '—';
  }
  signerInitials(d: DocumentDetailResponse): string {
    const r: any = (d as any).Recipients?.[0];
    const n: string = r?.Name || '';
    return n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '—';
  }
  statusClass(d: DocumentDetailResponse): 'signed' | 'progress' | 'pending' {
    return this.isSigned(d) ? 'signed' : this.isProgress(d) ? 'progress' : 'pending';
  }

  // ── navigation ──
  gotoSignature() {
    this.router.navigate(['dashboard/sendforsignature'])
  }

  gotoDocuments(): void {
    this.router.navigate(['dashboard/pendingdocuments'], { queryParams: { tab: 'sent' } });
  }

  gotoPending(): void {
    this.router.navigate(['dashboard/pendingdocuments'], { queryParams: { tab: 'pending' } });
  }

  // ── VIEW: open a document in the read-only viewer ──
  openDocument(d: DocumentDetailResponse): void {
    this.router.navigate(['/dashboard/pendingdocuments/view', (d as any).Id]);
  }

}
