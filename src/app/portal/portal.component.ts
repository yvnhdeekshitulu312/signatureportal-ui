import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';

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
  portalTitle = 'e-Signature Portal';
  facilityName = 'Riyadh Central';
  sessionStatus = 'Session Active';

  // Notification indicator — wire to a real count/service when available.
  hasNotifications = true;

  // User dropdown (Profile / Log out)
  userMenuOpen = false;

  private timerId: any;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loginUserName = localStorage.getItem('loginUserName') || '';
    this.empDesignation = localStorage.getItem('empDesignation') || '';
    this.empId = localStorage.getItem('empId') || '';
    this.avatarInitials = this.getInitials(this.loginUserName);
    this.photoUrl = this.getUser().EmpPhotoPath || null;
    this.updateTime();
    this.timerId = setInterval(() => this.updateTime(), 1000);
  }

  ngOnDestroy(): void {
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

  openNotifications(): void {
    // TODO: open notifications panel / navigate to notifications.
  }

  toggleUserMenu(ev?: Event): void { ev?.stopPropagation(); this.userMenuOpen = !this.userMenuOpen; }

  @HostListener('document:click') closeUserMenu(): void { this.userMenuOpen = false; }

  goToProfile(): void {
    this.userMenuOpen = false;
    this.router.navigate(['/dashboard/profile']);
  }

  logout(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
