import { Component, OnInit, OnDestroy } from '@angular/core';
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
  currentDate = '';
  currentTime = '';

  // Utility-strip context. Static defaults for now — if the portal serves
  // several modules, drive these from the active route instead.
  portalTitle = 'e-Signature Portal';
  facilityName = 'Riyadh Central';
  sessionStatus = 'Session Active';

  // Notification indicator — wire to a real count/service when available.
  hasNotifications = true;

  private timerId: any;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loginUserName = localStorage.getItem('loginUserName') || '';
    this.empDesignation = localStorage.getItem('empDesignation') || '';
    this.empId = localStorage.getItem('empId') || '';
    this.avatarInitials = this.getInitials(this.loginUserName);
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

  logout(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
