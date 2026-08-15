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
  currentTime = '';
  private timerId: any;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loginUserName = localStorage.getItem('loginUserName') || '';
    this.empDesignation = localStorage.getItem('empDesignation') || '';
    this.updateTime();
    this.timerId = setInterval(() => this.updateTime(), 1000);
  }

  ngOnDestroy(): void {
    if (this.timerId) clearInterval(this.timerId);
  }

  private updateTime(): void {
    this.currentTime = new Date().toLocaleString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  logout(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}