import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ToastData, ToastService, ToastType } from './toast.service';

interface ActiveToast extends ToastData {
  leaving: boolean;
  paused: boolean;
  remaining: number;
  startedAt: number;
  timer: any;
}

@Component({
  selector: 'app-toast-container',
  templateUrl: './toast-container.component.html',
  styleUrls: ['./toast-container.component.scss']
})
export class ToastContainerComponent implements OnInit, OnDestroy {
  toasts: ActiveToast[] = [];

  private readonly EXIT_MS = 260; // keep in sync with the leave animation
  private subs: Subscription[] = [];

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.subs.push(this.toastService.show$.subscribe((t) => this.add(t)));
    this.subs.push(this.toastService.dismiss$.subscribe((id) => this.remove(id)));
    this.subs.push(this.toastService.clear$.subscribe(() => this.clearAll()));
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.toasts.forEach((t) => clearTimeout(t.timer));
  }

  role(type: ToastType): 'alert' | 'status' {
    return type === 'error' ? 'alert' : 'status';
  }

  trackById(_: number, t: ActiveToast): number {
    return t.id;
  }

  /** Pause auto-dismiss while the pointer is over a toast. */
  pause(t: ActiveToast): void {
    if (t.duration <= 0 || t.leaving || t.paused) { return; }
    clearTimeout(t.timer);
    t.remaining -= Date.now() - t.startedAt;
    t.paused = true;
  }

  resume(t: ActiveToast): void {
    if (t.duration <= 0 || t.leaving || !t.paused) { return; }
    t.paused = false;
    this.startTimer(t);
  }

  remove(id: number): void {
    const t = this.toasts.find((x) => x.id === id);
    if (!t || t.leaving) { return; }
    clearTimeout(t.timer);
    t.leaving = true;
    setTimeout(() => {
      this.toasts = this.toasts.filter((x) => x.id !== id);
    }, this.EXIT_MS);
  }

  private add(data: ToastData): void {
    const toast: ActiveToast = {
      ...data,
      leaving: false,
      paused: false,
      remaining: data.duration,
      startedAt: Date.now(),
      timer: null
    };
    this.toasts.push(toast);
    if (toast.duration > 0) { this.startTimer(toast); }
  }

  private startTimer(t: ActiveToast): void {
    t.startedAt = Date.now();
    t.timer = setTimeout(() => this.remove(t.id), t.remaining);
  }

  private clearAll(): void {
    [...this.toasts].forEach((t) => this.remove(t.id));
  }
}
