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
  loading = false;
  owner = 'You';

  // ui state
  showFilters = false;
  compact = false;
  openMenuId: number | null = null;
  selected = new Set<number>();

  // filters
  fName = '';
  fOwner = '';
  fEmail = '';
  fStatus = '';

  // paging
  page = 1;
  pageSize = 100;
  pageSizes = [25, 50, 100, 200];

  constructor(private esignService: EsignService, private router: Router, private route: ActivatedRoute) {
    try {
      const d = JSON.parse(localStorage.getItem('doctorDetails') || '{}');
      this.owner = d?.Name || d?.FullName || d?.EmployeeName || d?.DoctorName || d?.UserName || 'You';
    } catch { /* keep default */ }
  }

  ngOnInit(): void {
    const st = this.route.snapshot.queryParamMap.get('status');
    if (st) { this.fStatus = st; }
    this.load();
  }

  load(): void {
    this.loading = true;
    this.esignService.getMyDocuments().subscribe({
      next: (docs: any[]) => { this.allDocs = docs || []; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  // ── derived ──
  get filtered(): any[] {
    let list = this.allDocs;
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
    if (this.page > this.totalPages) { this.page = this.totalPages; }
    const start = (this.page - 1) * this.pageSize;
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
  createdOn(d: any): string {
    const url = d?.ViewerGcsUrl || '';
    const m = /Documents(?:%2F|\/)(\d{4}-\d{2}-\d{2})/.exec(url);
    if (!m) { return '—'; }
    const dt = new Date(m[1]);
    if (isNaN(dt.getTime())) { return '—'; }
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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

  trackId = (_: number, d: any) => d.Id;
}
