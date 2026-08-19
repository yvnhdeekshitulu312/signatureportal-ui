import { Component, OnInit, HostListener } from '@angular/core';
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
EmpID:any;

  // From/To date range for "Recent documents" (passed to getMyDocuments).
  // Defaults to the last 30 days so the panel isn't empty on first load.
  fromDate: string;
  toDate: string;

  // hover tooltip (document name) — positioned via JS (fixed) so it never gets
  // clipped by the table's scroll container, unlike a plain CSS absolute tooltip.
  hoveredDoc: any = null;
  hoveredPos = { top: 0, left: 0 };

  // document-detail modal (opened by clicking a document name)
  selectedDoc: any = null;

  constructor(private router: Router, private esignService: EsignService) {
    try {
      const d = JSON.parse(localStorage.getItem('doctorDetails') || '{}');
      this.owner = d?.Name || d?.FullName || d?.EmployeeName || d?.DoctorName || d?.UserName || 'You';
      this.Email=d?.EmpEmail;
      this.EmpID=d?.EmpId;
    } catch { /* keep default */ }
    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - 30);
    this.toDate = this.formatDate(today);
    this.fromDate = this.formatDate(past);
  }

  ngOnInit(): void {
    this.loadRecent();
    this.loadPending();
  }

  /** yyyy-MM-dd for both the <input type="date"> bindings and the FromDate/ToDate API params. */
  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Re-run loadRecent() when either date input changes. */
  onDateFilterChange(): void {
    this.loadRecent();
  }

  /** Reset the date range back to the last 30 days and reload. */
  resetDateFilter(): void {
    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - 30);
    this.toDate = this.formatDate(today);
    this.fromDate = this.formatDate(past);
    this.loadRecent();
  }

  // Recent documents for the dashboard panel (from the same source as the list)
  loadRecent(): void {
    this.loading = true;
    this.esignService.getMyDocuments(this.Email,this.EmpID,this.fromDate,this.toDate).subscribe({
      next: (docs) => { this.recentDocs = docs || []; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  // Documents pending the logged-in user's signature (server decides "my turn"/order).
  loadPending(): void {
    this.esignService.getMyPending(this.Email,this.EmpID).subscribe({
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
    // land on the All-documents list with the "Pending my signature" tab pre-selected
    this.router.navigate(['dashboard/pendingdocuments'], { queryParams: { mode: 'pending' } });
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

  // ── hover tooltip (document name) ──
  // position:fixed + coordinates taken from the hovered element's own bounding
  // box, so the tooltip renders above everything (incl. the scrolling table
  // wrapper) instead of being clipped by an `overflow:auto` ancestor the way a
  // plain CSS `position:absolute` tooltip nested in that wrapper would be.
  showTooltip(d: any, ev: MouseEvent): void {
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    this.hoveredDoc = d;
    this.hoveredPos = { top: rect.bottom + 8, left: rect.left };
  }
  hideTooltip(): void {
    this.hoveredDoc = null;
  }

  /** Signer/Approver/Viewer label for a recipient, for the tooltip + modal. */
  tooltipRoleLabel(role: string): string {
    const r = (role || '').toLowerCase();
    if (r.includes('approve')) { return 'Approver'; }
    if (r.includes('view') || r.includes('cc') || r.includes('copy')) { return 'Viewer'; }
    return 'Signer';
  }

  /** Signed / Viewed / Rejected / Unopened / "-" for a recipient row. Viewers
   *  (who have nothing to sign) read as "-" rather than "Unopened" unless they
   *  actually opened the document, matching the reference design. */
  tooltipStatusLabel(r: any): string {
    const s = (r?.Status || '').toLowerCase();
    if (s.includes('sign')) { return 'Signed'; }
    if (s.includes('view')) { return 'Viewed'; }
    if (s.includes('reject')) { return 'Rejected'; }
    const role = (r?.Role || '').toLowerCase();
    if (role.includes('view') || role.includes('cc') || role.includes('copy')) { return '-'; }
    return 'Unopened';
  }

  // ── document-detail modal ──
  openDocModal(d: any, ev?: Event): void {
    ev?.stopPropagation(); // don't also trigger the row's openDocument() navigation
    this.hideTooltip();
    this.selectedDoc = d;
  }
  closeModal(): void {
    this.selectedDoc = null;
  }
  @HostListener('document:keydown.escape') onEscClose(): void {
    if (this.selectedDoc) { this.closeModal(); }
  }

  /** How far a recipient has progressed along Mailed -> Viewed -> Signed, for
   *  the modal's progress track. NOTE: this infers stage from Status alone —
   *  RecipientSummaryDto doesn't currently expose SentOn/ViewedOn/SignedOn or
   *  an IP address the way the reference design's per-recipient timestamp/IP
   *  line does. Once those are added to the DTO, swap this (and the template
   *  lines that read r.ViewedOn/r.SignedOn/r.IpAddress) for the real values. */
  recipStage(r: any): 1 | 2 | 3 {
    const s = (r?.Status || '').toLowerCase();
    if (s.includes('sign')) { return 3; }
    if (s.includes('view')) { return 2; }
    return 1;
  }

  /** Overall completion % shown in the modal header's progress ring. Each
   *  recipient contributes 0% (mailed/pending), 50% (viewed) or 100% (signed);
   *  the ring shows the average across all recipients on the document. This is
   *  a client-side approximation for the same reason recipStage() is — once
   *  the backend exposes real per-recipient timestamps this can be replaced
   *  with a server-computed percentage. */
  docProgressPct(d: any): number {
    const recips = this.recipients(d);
    if (!recips.length) { return 0; }
    const sum = recips.reduce((acc, r) => acc + (this.recipStage(r) - 1) * 50, 0);
    return Math.round(sum / recips.length);
  }

  /** SVG stroke-dashoffset for the header progress ring (r=18 → circumference ≈113.097). */
  ringOffset(d: any): number {
    const c = 113.097;
    return c - (c * this.docProgressPct(d) / 100);
  }

}
