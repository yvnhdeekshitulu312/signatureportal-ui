import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpContextToken,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';

export const BYPASS_LOG = new HttpContextToken(() => false);

const NO_AUTH_URL_PATTERNS = [
  'ValidateLoginUserHIS',
  'FetchHospitalLocations'
];

@Injectable()
export class HeadersInterceptor implements HttpInterceptor {

  constructor(private router: Router) { }

  private getAuthHeader(): string | null {
    const token = sessionStorage.getItem('token');
    return token ? 'Bearer ' + token : null;
  }

  private isNoAuthUrl(url: string): boolean {
    return NO_AUTH_URL_PATTERNS.some(pattern => url.includes(pattern));
  }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const isFormData = request.body instanceof FormData;
    const isNoAuth = this.isNoAuthUrl(request.url);

    if (request.context.get(BYPASS_LOG) === true) {
      return next.handle(request).pipe(
        catchError((error: HttpErrorResponse) => throwError(() => error))
      );
    }

    const headers: { [key: string]: string } = {
      Authorization: isNoAuth ? 'No Auth' : (this.getAuthHeader() ?? '')
    };

    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    headers['Accept'] = 'application/json';

    request = request.clone({ setHeaders: headers });

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && !isNoAuth) {
          sessionStorage.clear();
          this.router.navigate(['/login']);
        }
        return throwError(() => error);
      })
    );
  }
}