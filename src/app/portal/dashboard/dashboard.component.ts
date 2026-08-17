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
  myPending: DocumentDetailResponse[] = [];  // documents pending MY signature (order-aware, from getMyPending)
  loading = false;
  activeFilter: 'all' | 'pending' | 'signed' | 'progress' = 'all';
  owner = 'You';
  Email:any;

  constructor(private router: Router, private esignService: EsignService) {
    try {
      const d = JSON.parse(localStorage.getItem('doctorDetails') || '{}');
      this.owner = d?.Name || d?.FullName || d?.EmployeeName || d?.DoctorName || d?.UserName || 'You';
      this.Email=d?.EmpEmail;
    } catch { /* keep default */ }
  }

  ngOnInit(): void {
    this.loadRecent();
    this.loadPending();
  }

  // Recent documents for the dashboard panel (from the same source as the list)
  loadRecent(): void {
    this.loading = true;
    this.esignService.getMyDocuments(this.Email).subscribe({
      next: (docs) => { this.recentDocs = docs || []; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  // Documents pending the logged-in user's signature (server decides "my turn"/order).
  loadPending(): void {
    this.esignService.getMyPending(this.Email).subscribe({
      next: (docs) => { this.myPending = docs || []; },
      error: () => { this.myPending = []; }
    });
  }

  // ── stats (derived from real loaded documents, not hard-coded) ──
  private statusOf(d: DocumentDetailResponse): string { return (d.Status || '').toLowerCase(); }
  isSigned(d: DocumentDetailResponse): boolean { return this.statusOf(d).includes('complet') || this.statusOf(d).includes('sign'); }
  isProgress(d: DocumentDetailResponse): boolean { return this.statusOf(d).includes('progress'); }
  isPending(d: DocumentDetailResponse): boolean { return !this.isSigned(d) && !this.isProgress(d); }

  get totalCount(): number { return this.recentDocs.length; }
  get pendingCount(): number { return this.myPending.length; }
  get signedCount(): number { return this.recentDocs.filter(d => this.isSigned(d)).length; }
  pct(n: number): number { return this.totalCount ? Math.min(100, Math.round((n / this.totalCount) * 100)) : 0; }

  // ── table filter ──
  setFilter(f: 'all' | 'pending' | 'signed' | 'progress'): void { this.activeFilter = f; }
  get filteredDocs(): DocumentDetailResponse[] {
    if (this.activeFilter === 'pending') return this.myPending;
    if (this.activeFilter === 'signed') return this.recentDocs.filter(d => this.isSigned(d));
    if (this.activeFilter === 'progress') return this.recentDocs.filter(d => this.isProgress(d));
    return this.recentDocs;
  }

  // ── row helpers (match the All-documents table) ──
  recipients(d: DocumentDetailResponse): any[] { return (d as any).Recipients || []; }
  visibleRecipients(d: DocumentDetailResponse): any[] { return this.recipients(d).slice(0, 2); }
  moreCount(d: DocumentDetailResponse): number { return Math.max(0, this.recipients(d).length - 2); }

  roleTone(role: string): 'sign' | 'view' | 'approve' {
    const r = (role || '').toLowerCase();
    if (r.includes('approve')) return 'approve';
    if (r.includes('view') || r.includes('cc') || r.includes('copy')) return 'view';
    return 'sign';
  }

  /** Created On derived from the date in ViewerGcsUrl (…/Documents/YYYY-MM-DD/…). */
  // createdOn(d: DocumentDetailResponse): string {
  //   const url = (d as any).ViewerGcsUrl || '';
  //   const m = /Documents(?:%2F|\/)(\d{4}-\d{2}-\d{2})/.exec(url);
  //   if (!m) { return '—'; }
  //   const dt = new Date(m[1]);
  //   return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  // }
createdOn(d: DocumentDetailResponse): string {
  const url = (d as any).ViewerGcsUrl || '';
  
  const m = /Documents(?:%2F|\/)(\d{4}-\d{2}-\d{2}(?:[T%20_]\d{2}[:\-]\d{2}(?:[:\-]\d{2})?)?)/i.exec(url);
  if (!m) { return '—'; }

  const rawDateStr = decodeURIComponent(m[1]).replace('_', 'T');
  const dt = new Date(rawDateStr);

  if (isNaN(dt.getTime())) { return '—'; }

  const day = dt.toLocaleDateString('en-GB', { day: '2-digit' });
  const month = dt.toLocaleDateString('en-GB', { month: 'short' });
  const year = dt.getFullYear();
  const hours = String(dt.getHours()).padStart(2, '0');
  const minutes = String(dt.getMinutes()).padStart(2, '0');

  return `${day}-${month}-${year} ${hours}:${minutes}`;
}
  initials(name: string): string {
    return (name || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
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
  statusClass(d: DocumentDetailResponse): 'signed' | 'progress' | 'pending' | 'draft' {
    if (this.isSigned(d)) return 'signed';
    if (this.isProgress(d)) return 'progress';
    if (this.statusOf(d).includes('draft')) return 'draft';
    return 'pending';
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
    const mine = this.myPending.some(x => (x as any).Id === (d as any).Id);
    if (mine) {
      this.router.navigate(['/dashboard/pendingdocuments/sign', (d as any).Id]);
    } else {
      this.router.navigate(['/dashboard/pendingdocuments/view', (d as any).Id]);
    }
  }

  // ── DRAFT actions (edit / delete) ──
  isDraft(d: DocumentDetailResponse): boolean { return this.statusOf(d).includes('draft'); }

  /** Resume a draft in the editor (editor keys off documentId). */
  editDraft(d: DocumentDetailResponse, ev?: Event): void {
    ev?.stopPropagation();
    this.router.navigate(['/dashboard/document'], { queryParams: { documentId: (d as any).Id } });
  }

  deleteDoc(d: DocumentDetailResponse, ev?: Event): void {
    ev?.stopPropagation();
    if (!confirm(`Delete "${d.Name}"? This can't be undone.`)) { return; }
    // TODO: call your delete endpoint before removing locally, e.g.
    // this.esignService.deleteDocument((d as any).Id).subscribe(() => ...);
    this.recentDocs = this.recentDocs.filter(x => x !== d);
  }

}
