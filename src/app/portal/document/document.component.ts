import { Component, OnInit, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EsignService } from 'src/app/services/esign.service';

type StatusTone = 'draft' | 'progress' | 'done' | 'default';

@Component({
  selector: 'app-documents',
  templateUrl: './document.component.html',
  styleUrls: ['./document.component.scss']
})
export class DocumentComponent implements OnInit {

  allDocs: any[] = [];
  myPending: any[] = [];                 // documents pending MY signature (from getMyPending)
  mode: 'all' | 'pending' = 'all';       // which source the table shows
  loading = false;
  owner = 'You';
  Email:any;
    EmpID:any;
  // Admin toggle — when ON, EmpID is sent as 0 (all employees); when OFF,
  // the logged-in user's own EmpID is sent (their documents only).
  isAdmin = false;
  // ui state
  showFilters = false;
  compact = false;
  openMenuId: number | null = null;
  selected = new Set<number>();

  // hover tooltip (document name) — positioned via JS (fixed) so it never gets
  // clipped by the table's scroll container, unlike a plain CSS absolute tooltip.
  hoveredDoc: any = null;
  hoveredPos = { top: 0, left: 0 };

  // document-detail modal (opened by clicking a document name)
  selectedDoc: any = null;

  // filters
  fName = '';
  fOwner = '';
  fEmail = '';
  fStatus = '';

  // From/To date range for the "All documents" table (passed to getMyDocuments).
  // Defaults to the last 30 days so the table isn't empty on first load.
  fromDate: string;
  toDate: string;

  // paging
  page = 1;
  pageSize = 10;
  pageSizes = [10, 25, 50, 100, 200];

  constructor(private esignService: EsignService, private router: Router, private route: ActivatedRoute) {
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
    const st = this.route.snapshot.queryParamMap.get('status');
    if (st) { this.fStatus = st; }
    this.load();
    // ?mode=pending (e.g. from the dashboard "Pending my signature" card) opens
    // straight into the pending queue.
    if (this.route.snapshot.queryParamMap.get('mode') === 'pending') { this.setMode('pending'); }
  }

  /** yyyy-MM-dd for both the <input type="date"> bindings and the FromDate/ToDate API params. */
  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Re-run load() when either date input changes. */
  onDateFilterChange(): void {
    this.page = 1;
    this.load();
  }

  /** Reset the date range back to the last 30 days and reload. */
  resetDateFilter(): void {
    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - 30);
    this.toDate = this.formatDate(today);
    this.fromDate = this.formatDate(past);
    this.onDateFilterChange();
  }

  /** Admin toggle changed — reload with EmpID=0 (all) or the user's own EmpID. */
  onAdminToggle(): void {
    this.page = 1;
    this.load();
  }

  load(): void {
    this.loading = true;
    const empId = this.isAdmin ? 0 : this.EmpID;
    this.esignService.getMyDocuments(this.Email,empId,this.fromDate,this.toDate).subscribe({
      next: (docs: any[]) => {
        this.allDocs = this.sortByDateDesc(docs || []);
        this.loading = false;
        this.clampPage();
      },
      error: () => { this.loading = false; }
    });
  }

  // Documents pending the logged-in user's signature (server decides "my turn"/order).
  loadPending(): void {
    this.loading = true;
    this.esignService.getMyPending(this.Email,this.EmpID).subscribe({
      next: (docs: any[]) => {
        this.myPending = this.sortByDateDesc(docs || []);
        this.loading = false;
        this.clampPage();
      },
      error: () => { this.myPending = []; this.loading = false; }
    });
  }

  /** Keeps `page` inside [1, totalPages] after data loads or a filter shrinks
   *  the result set — called explicitly (rather than as a side effect inside
   *  the pageDocs getter, which Angular can re-run mid change-detection and
   *  is not a safe place to mutate component state). */
  private clampPage(): void {
    this.page = Math.max(1, Math.min(this.page, this.totalPages));
  }

  /** Newest-first by CreatedOn. Falls back to the date segment parsed out of
   *  ViewerGcsUrl (same source createdOn() uses) when CreatedOn is missing,
   *  and anything still unparsable sinks to the bottom instead of throwing
   *  the whole sort off. Applied once at load time so every consumer
   *  (filtered/pageDocs/the modal/tooltip) sees documents newest-first. */
  private sortByDateDesc(list: any[]): any[] {
    const toTime = (d: any): number => {
      if (d?.CreatedOn) {
        const t = new Date(d.CreatedOn).getTime();
        if (!isNaN(t)) { return t; }
      }
      const url = d?.ViewerGcsUrl || '';
      const m = /Documents(?:%2F|\/)(\d{4}-\d{2}-\d{2}(?:[T%20_]\d{2}[:\-]\d{2}(?:[:\-]\d{2})?)?)/i.exec(url);
      if (m) {
        const t = new Date(decodeURIComponent(m[1]).replace('_', 'T')).getTime();
        if (!isNaN(t)) { return t; }
      }
      return -Infinity;
    };
    return [...list].sort((a, b) => toTime(b) - toTime(a));
  }

  setMode(m: 'all' | 'pending'): void {
    this.mode = m;
    this.page = 1;
    this.openMenuId = null;
    if (m === 'pending') { this.loadPending(); }
  }

  /** Open a doc that is pending my signature straight into the signer view. */
  openPending(d: any): void {
    this.openMenuId = null;
    this.router.navigate(['/dashboard/pendingdocuments/sign', d.Id]);
  }

  /** Row click: sign when in the pending queue, otherwise open the viewer. */
  openRow(d: any): void { this.mode === 'pending' ? this.openPending(d) : this.viewDoc(d); }

  // ── derived ──
  get filtered(): any[] {
    let list = this.mode === 'pending' ? this.myPending : this.allDocs;
    const n = this.fName.trim().toLowerCase();
    const o = this.fOwner.trim().toLowerCase();
    const e = this.fEmail.trim().toLowerCase();
    const s = this.fStatus.trim().toLowerCase();
    if (n) list = list.filter(d => (d.Name || '').toLowerCase().includes(n));
    if (o) list = list.filter(() => this.owner.toLowerCase().includes(o));
    if (e) list = list.filter(d => (d.Recipients || []).some((r: any) => (r.Email || '').toLowerCase().includes(e)));
    if (s) list = list.filter(d => (d.Status || '').toLowerCase() === s);
    return list;
  }
  get total(): number { return this.filtered.length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  get pageDocs(): any[] {
    // Read-only here on purpose — do NOT mutate this.page inside a getter
    // (Angular can re-evaluate getters mid change-detection, which made
    // `page`, and the range shown in the footer, drift/flicker). Clamping
    // itself happens explicitly via clampPage(), called after anything that
    // can shrink the result set (data reload, filters, page size change).
    const clampedPage = Math.min(this.page, this.totalPages);
    const start = (clampedPage - 1) * this.pageSize;
    return this.filtered.slice(start, start + this.pageSize);
  }
  get rangeStart(): number { return this.total === 0 ? 0 : (this.page - 1) * this.pageSize + 1; }
  get rangeEnd(): number { return Math.min(this.page * this.pageSize, this.total); }

  // ── filters / paging handlers ──
  onFilterChange(): void { this.page = 1; }
  clearFilters(): void { this.fName = this.fOwner = this.fEmail = this.fStatus = ''; this.page = 1; }
  toggleFilters(): void { this.showFilters = !this.showFilters; }
  setPageSize(n: number): void { this.pageSize = Number(n); this.page = 1; }
  first(): void { this.page = 1; }
  prev(): void { if (this.page > 1) { this.page--; } }
  next(): void { if (this.page < this.totalPages) { this.page++; } }
  last(): void { this.page = this.totalPages; }

  // ── selection ──
  isSelected(d: any): boolean { return this.selected.has(d.Id); }
  toggleSelect(d: any): void { this.selected.has(d.Id) ? this.selected.delete(d.Id) : this.selected.add(d.Id); }
  get allOnPageSelected(): boolean { const p = this.pageDocs; return p.length > 0 && p.every(d => this.selected.has(d.Id)); }
  toggleSelectAll(): void {
    const p = this.pageDocs;
    if (this.allOnPageSelected) { p.forEach(d => this.selected.delete(d.Id)); }
    else { p.forEach(d => this.selected.add(d.Id)); }
  }

  // ── row helpers ──
  recipients(d: any): any[] { return d?.Recipients || []; }
  visibleRecipients(d: any): any[] { return this.recipients(d).slice(0, 2); }
  moreCount(d: any): number { return Math.max(0, this.recipients(d).length - 2); }

  roleTone(role: string): 'sign' | 'view' | 'approve' {
    const r = (role || '').toLowerCase();
    if (r.includes('approve')) return 'approve';
    if (r.includes('view') || r.includes('cc') || r.includes('copy')) return 'view';
    return 'sign';
  }

  statusTone(status: string): StatusTone {
    const s = (status || '').toLowerCase();
    if (s.includes('complet') || s.includes('signed')) return 'done';
    if (s.includes('draft')) return 'draft';
    if (s.includes('progress') || s.includes('sent') || s.includes('pending')) return 'progress';
    return 'default';
  }

  /** Created On is derived from the date segment in ViewerGcsUrl
      (…/Documents/YYYY-MM-DD/…), since MyDocuments doesn't return a date. */
  // createdOn(d: any): string {
  //   const url = d?.ViewerGcsUrl || '';
  //   const m = /Documents(?:%2F|\/)(\d{4}-\d{2}-\d{2})/.exec(url);
  //   if (!m) { return '—'; }
  //   const dt = new Date(m[1]);
  //   if (isNaN(dt.getTime())) { return '—'; }
  //   return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  // }
  createdOn(d: any): string {
  const url = d?.ViewerGcsUrl || '';
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

  // ── actions menu ──
  toggleMenu(d: any, ev: Event): void {
    ev.stopPropagation();
    this.openMenuId = this.openMenuId === d.Id ? null : d.Id;
  }
  @HostListener('document:click') closeMenu(): void { this.openMenuId = null; }

  isDraft(d: any): boolean { return this.statusTone(d.Status) === 'draft'; }

  continueDoc(d: any): void {
    this.openMenuId = null;
    // Resume a draft in the editor (editor keys off documentId).
    this.router.navigate(['/dashboard/document'], { queryParams: { documentId: d.Id } });
  }
  viewDoc(d: any): void {
    this.openMenuId = null;
    this.router.navigate(['/dashboard/pendingdocuments/view', d.Id]);
  }
  deleteDoc(d: any): void {
    this.openMenuId = null;
    if (!confirm(`Delete "${d.Name}"? This can't be undone.`)) { return; }
    // TODO: call your delete endpoint, e.g. this.esignService.deleteDocument(d.Id).subscribe(...)
    this.allDocs = this.allDocs.filter(x => x !== d);
    this.selected.delete(d.Id);
  }

  // ── toolbar / bulk actions (Variant B) ──
  newDocument(): void { this.router.navigate(['/dashboard/sendforsignature']); }

  clearSelection(): void { this.selected.clear(); }

  bulkDelete(): void {
    if (!this.selected.size) { return; }
    if (!confirm(`Delete ${this.selected.size} document(s)? This can't be undone.`)) { return; }
    // TODO: call your bulk delete endpoint for the selected ids before removing locally
    this.allDocs = this.allDocs.filter(d => !this.selected.has(d.Id));
    this.selected.clear();
  }

  // Placeholder bulk actions shown in the selection bar — wire to real endpoints when ready.
  bulkTodo(_action: string): void { /* no-op placeholder */ }

  // Map statusTone() to the pill class names used in the template.
  statusPill(status: string): 'draft' | 'progress' | 'completed' | 'default' {
    const t = this.statusTone(status);
    return t === 'done' ? 'completed' : t;
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
    ev?.stopPropagation(); // don't also trigger the row's openRow() navigation
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

  /** Maps this page's own statusTone() to the dashboard modal's colour-class
   *  names, so the same dm-statusicon styling (signed/progress/pending/draft)
   *  used on the dashboard applies here too. */
  statusClass(d: any): 'signed' | 'progress' | 'pending' | 'draft' {
    const t = this.statusTone(d?.Status);
    if (t === 'done') { return 'signed'; }
    if (t === 'progress') { return 'progress'; }
    if (t === 'draft') { return 'draft'; }
    return 'pending';
  }

  /** Signed / Viewed / Mailed / Rejected label for the modal's per-recipient
   *  status pill (see .dm-recip-pill in the template/SCSS). */
  dmStageLabel(r: any): string {
    const s = (r?.Status || '').toLowerCase();
    if (s.includes('reject')) { return 'Rejected'; }
    if (s.includes('sign')) { return 'Signed'; }
    if (s.includes('view')) { return 'Viewed'; }
    return 'Mailed';
  }

  /** "N of M signed" summary shown beside the modal's "Recipient status" heading. */
  signedRecipCount(d: any): number {
    return this.recipients(d).filter(r => this.recipStage(r) === 3).length;
  }

  /** Mailed timestamp shown under the track's first node for every recipient —
   *  all recipients are mailed together when the document is sent, so the
   *  document's own CreatedOn covers that stage. Per-recipient Viewed/Signed
   *  timestamps aren't on RecipientSummaryDto yet (see recipStage() above), so
   *  those two stages show "Awaiting" until reached and an em dash once
   *  reached, rather than a fabricated date. */
  documentSentLabel(d: any): string {
    const raw = d?.CreatedOn;
    if (!raw) { return '—'; }
    const dt = new Date(raw);
    if (isNaN(dt.getTime())) { return '—'; }
    const day = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const hours = String(dt.getHours()).padStart(2, '0');
    const minutes = String(dt.getMinutes()).padStart(2, '0');
    return `${day} ${hours}:${minutes}`;
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

  trackId = (_: number, d: any) => d.Id;
}
