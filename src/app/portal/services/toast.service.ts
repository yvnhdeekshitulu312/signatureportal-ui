import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: number;
  type: ToastType;
  message: string;
  title?: string;
  /** Auto-dismiss delay in ms. 0 = sticky (manual close only). */
  duration: number;
}

export interface ToastOptions {
  /** Optional bold heading above the message. Pass your own for Arabic. */
  title?: string;
  /** Override the auto-dismiss delay (ms). Use 0 to keep it until closed. */
  duration?: number;
}

/**
 * App-wide toast notifications.
 *
 *   constructor(private toast: ToastService) {}
 *   this.toast.success('Document sent for signature');
 *   this.toast.error('Failed to send. Please try again', { title: 'Send failed' });
 *   this.toast.warning('Select a recipient first');
 *   this.toast.info('Document discarded');
 *
 * Render <app-toast-container> once at the app root so toasts survive
 * route changes (e.g. the success toast still shows after send() navigates).
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  private readonly _show = new Subject<ToastData>();
  private readonly _dismiss = new Subject<number>();
  private readonly _clear = new Subject<void>();

  readonly show$ = this._show.asObservable();
  readonly dismiss$ = this._dismiss.asObservable();
  readonly clear$ = this._clear.asObservable();

  success(message: string, opts: ToastOptions = {}): number {
    return this.push('success', message, opts);
  }

  error(message: string, opts: ToastOptions = {}): number {
    // Errors linger a little longer by default.
    return this.push('error', message, { duration: 6000, ...opts });
  }

  warning(message: string, opts: ToastOptions = {}): number {
    return this.push('warning', message, opts);
  }

  info(message: string, opts: ToastOptions = {}): number {
    return this.push('info', message, opts);
  }

  /** Dismiss one toast early by the id returned from success/error/etc. */
  dismiss(id: number): void {
    this._dismiss.next(id);
  }

  /** Clear every visible toast (e.g. on logout or hard navigation). */
  clear(): void {
    this._clear.next();
  }

  private push(type: ToastType, message: string, opts: ToastOptions): number {
    const id = ++this.counter;
    this._show.next({
      id,
      type,
      message,
      title: opts.title,
      duration: opts.duration ?? 4000
    });
    return id;
  }
}
