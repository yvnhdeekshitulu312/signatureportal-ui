import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ToastData, ToastService, ToastType } from '../toast.service';

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

  /** How many toast cards can be on screen at once before the rest collapse
   *  into a "+N more" badge on the newest card. */
  readonly MAX_VISIBLE = 3;
  /** True while the user has expanded the badge to see every queued toast. */
  showAll = false;

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

  /** The newest N toasts (or all of them once the user has expanded). */
  get visibleToasts(): ActiveToast[] {
    if (this.showAll || this.toasts.length <= this.MAX_VISIBLE) {
      return this.toasts;
    }
    return this.toasts.slice(this.toasts.length - this.MAX_VISIBLE);
  }

  /** How many toasts are hidden behind the "+N more" badge right now. */
  get overflowCount(): number {
    return Math.max(0, this.toasts.length - this.MAX_VISIBLE);
  }

  toggleShowAll(): void {
    this.showAll = !this.showAll;
  }

  /** Short caption shown under the message when the caller didn't pass a title. */
  typeLabel(type: ToastType): string {
    switch (type) {
      case 'success': return 'All set';
      case 'error': return 'Action required';
      case 'warning': return 'Please review';
      default: return 'Notice';
    }
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
      if (this.toasts.length <= this.MAX_VISIBLE) { this.showAll = false; }
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
