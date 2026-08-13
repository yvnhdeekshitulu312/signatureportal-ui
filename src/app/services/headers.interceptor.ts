import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpContextToken
} from '@angular/common/http';
import { Observable } from 'rxjs';

export const BYPASS_LOG = new HttpContextToken(() => false);

@Injectable()
export class HeadersInterceptor implements HttpInterceptor {

  constructor() { }

  private getAuthHeader(): string {
    const username = localStorage.getItem('authUserName') || 'admin';
    const password = localStorage.getItem('authPassword') || '123456';
    return 'Basic ' + btoa(`${username}:${password}`);
  }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    console.log(`req to ${request.url}`);

    const isFormData = request.body instanceof FormData;
    const authHeader = this.getAuthHeader();

    if (isFormData) {
      request = request.clone({
        setHeaders: {
          'Access-Control-Allow-Origin': '*',
          'Accept': 'application/json',
          'Authorization': authHeader
        }
      });
      return next.handle(request);
    }
    else if (request.context.get(BYPASS_LOG) === true) {
      request = request.clone({
        setHeaders: {
          'Access-Control-Allow-Origin': '*'
        }
      });
      return next.handle(request);
    } else {
      request = request.clone({
        setHeaders: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Authorization': authHeader,
        }
      });
      return next.handle(request);
    }
  }
}