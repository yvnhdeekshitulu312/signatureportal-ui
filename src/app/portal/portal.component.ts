import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { EsignService } from 'src/app/services/esign.service';

@Component({
  selector: 'app-portal',
  templateUrl: './portal.component.html',
  styleUrls: ['./portal.component.scss']
})
export class PortalComponent implements OnInit, OnDestroy {
  loginUserName = '';
  empDesignation = '';
  empId = '';
  avatarInitials = 'AH';
  photoUrl: string | null = null;
  currentDate = '';
  currentTime = '';

  // Utility-strip context. Static defaults for now — if the portal serves
  // several modules, drive these from the active route instead.
  portalTitle = 'Hammadi Sign';
  facilityName = 'Riyadh Central';
  sessionStatus = 'Session Active';

  // User dropdown (Profile / Log out)
  userMenuOpen = false;

  // Notifications = documents pending MY signature
  notifOpen = false;
  pendingNotifications: any[] = [];
  get notifCount(): number { return this.pendingNotifications.length; }
  private navSub?: Subscription;

  // ── "new since last seen" tracking, drives the bell blink ──
  // A doc is "new" if its Id isn't in the seen-id list persisted in
  // localStorage. The bell/badge blink while hasNewNotifications is true;
  // opening the panel snapshots which items were new for THIS view (so they
  // still show the "New" tag while open) and then marks everything seen, so
  // the blink stops until a genuinely new document shows up.
  private readonly seenKey = 'esignSeenNotifIds';
  newIds: Set<string> = new Set();
  hasNewNotifications = false;

  private timerId: any;

  constructor(private router: Router, private esignService: EsignService) {}

  ngOnInit(): void {
    this.loginUserName = localStorage.getItem('loginUserName') || '';
    this.empDesignation = localStorage.getItem('empDesignation') || '';
    this.empId = localStorage.getItem('empId') || '';
    this.avatarInitials = this.getInitials(this.loginUserName);
    this.photoUrl = this.getUser().EmpPhotoPath || null;
    // autoOpenIfPending: true — this is the first load after login/portal
    // mount, so if the user has anything pending, pop the panel open
    // immediately instead of waiting for them to click the bell.
    this.loadNotifications(false, true);
    // Re-fetch the pending-signature count after each navigation so the badge
    // reflects the latest state once a document is signed/sent. (No auto-open
    // here — only the very first load above should pop the panel.)
    this.navSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.loadNotifications());
    this.updateTime();
    this.timerId = setInterval(() => this.updateTime(), 1000);
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
    if (this.timerId) clearInterval(this.timerId);
  }

  private updateTime(): void {
    const now = new Date();
    this.currentDate = now.toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
    this.currentTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  /** Resolve the cached user record from doctorDetails (array | SmartDataList wrapper | object). */
  private getUser(): any {
    try {
      const raw = JSON.parse(localStorage.getItem('doctorDetails') || '{}');
      if (Array.isArray(raw)) { return raw[0] || {}; }
      if (raw && Array.isArray(raw.SmartDataList)) { return raw.SmartDataList[0] || {}; }
      return raw || {};
    } catch { return {}; }
  }

  private getInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'AH';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  onSearch(term: string): void {
    const q = (term || '').trim();
    if (!q) { return; }
    // TODO: wire to your search route / service, e.g.
    // this.router.navigate(['/search'], { queryParams: { q } });
  }

  /** Read the persisted "already seen" notification ids. */
  private getSeenIds(): Set<string> {
    try {
      const raw = JSON.parse(localStorage.getItem(this.seenKey) || '[]');
      return new Set(Array.isArray(raw) ? raw.map(String) : []);
    } catch { return new Set(); }
  }

  /** Persist the given ids as "seen" (merged with whatever was already there). */
  private markSeen(ids: string[]): void {
    const merged = new Set([...this.getSeenIds(), ...ids]);
    // Cap what we store so this can't grow forever across a long session.
    const trimmed = Array.from(merged).slice(-200);
    localStorage.setItem(this.seenKey, JSON.stringify(trimmed));
  }

  /**
   * @param markAsSeenAfter pass true when the user is actually opening the
   * panel — the "new" flags below are computed first (so the panel can still
   * highlight what's new for this viewing), then persisted as seen so the
   * bell stops blinking afterwards.
   * @param autoOpenIfPending pass true only for the initial load right after
   * login/portal mount — if the user has any documents pending their
   * signature, the panel pops open on its own instead of waiting for a bell
   * click. Treated the same as markAsSeenAfter for the seen-tracking below.
   */
  loadNotifications(markAsSeenAfter = false, autoOpenIfPending = false): void {
    const email = this.getUser().EmpEmail;
    const EmpID = this.getUser().EmpId;
    if (!email) { return; }
    this.esignService.getMyPending(email, EmpID).subscribe({
      next: (docs: any[]) => {
        this.pendingNotifications = docs || [];
        const seen = this.getSeenIds();
        const ids = this.pendingNotifications.map(d => String(d.Id));
        this.newIds = new Set(ids.filter(id => !seen.has(id)));
        this.hasNewNotifications = this.newIds.size > 0;

        if (autoOpenIfPending && this.pendingNotifications.length > 0) {
          this.notifOpen = true;
        }

        if ((markAsSeenAfter || autoOpenIfPending) && ids.length) {
          this.markSeen(ids);
          this.hasNewNotifications = false;
        }
      },
      error: () => { this.pendingNotifications = []; this.newIds = new Set(); this.hasNewNotifications = false; }
    });
  }

  /** Human label for how long a document has been pending signature. */
  pendingDaysLabel(createdOn: string): string {
    if (!createdOn) { return ''; }
    const created = new Date(createdOn);
    if (isNaN(created.getTime())) { return ''; }
    const startOfCreated = new Date(created.getFullYear(), created.getMonth(), created.getDate()).getTime();
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    const days = Math.max(0, Math.round((startOfToday - startOfCreated) / 86400000));
    if (days === 0) { return 'Today'; }
    if (days === 1) { return '1 day ago'; }
    return `${days} days ago`;
  }

  /** Was this notification still unseen the last time the list was loaded? */
  isNew(n: any): boolean {
    return this.newIds.has(String(n?.Id));
  }

  /** True if this document was created today — distinct from isNew() above,
   *  which tracks "hasn't been seen by me yet" and clears once the panel is
   *  opened. isToday() stays true all day regardless of seen state, so a
   *  document created this morning still reads as today's even after the
   *  user has already opened the panel once. */
  isToday(n: any): boolean {
    return this.pendingDaysLabel(n?.CreatedOn) === 'Today';
  }

  /** pendingNotifications with today's documents surfaced first (order
   *  otherwise preserved within each group), so the newest activity is the
   *  first thing the user sees when the panel opens. */
  get sortedPendingNotifications(): any[] {
    const today = this.pendingNotifications.filter(n => this.isToday(n));
    const earlier = this.pendingNotifications.filter(n => !this.isToday(n));
    return [...today, ...earlier];
  }

  toggleNotifications(ev?: Event): void {
    ev?.stopPropagation();
    this.userMenuOpen = false;
    this.notifOpen = !this.notifOpen;
    if (this.notifOpen) { this.loadNotifications(true); }
  }

  /** Explicit close (X button / backdrop). The panel stops click
   *  propagation to the document so the global closeMenus() listener below
   *  never sees clicks inside it — this handler is what actually closes it. */
  closeNotifications(ev?: Event): void {
    ev?.stopPropagation();
    this.notifOpen = false;
  }

  /** Open a pending doc straight into the signer view. */
  openNotification(d: any): void {
    this.notifOpen = false;
    this.router.navigate(['/dashboard/pendingdocuments/sign', d.Id]);
  }

  /** Jump to the All-documents list with the "Pending my signature" tab selected. */
  viewAllPending(): void {
    this.notifOpen = false;
    this.router.navigate(['/dashboard/pendingdocuments'], { queryParams: { mode: 'pending' } });
  }

  toggleUserMenu(ev?: Event): void { ev?.stopPropagation(); this.userMenuOpen = !this.userMenuOpen; }

  @HostListener('document:click') closeMenus(): void { this.userMenuOpen = false; this.notifOpen = false; }

  goToProfile(): void {
    this.userMenuOpen = false;
    this.router.navigate(['/dashboard/profile']);
  }

  logout(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
