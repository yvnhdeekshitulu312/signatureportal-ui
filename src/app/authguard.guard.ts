import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthguardService } from './authguard.service';

@Injectable({
  providedIn: 'root'
})
export class AuthguardGuard implements CanActivate {
  constructor(private authService: AuthguardService, private router: Router) {

  }
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    var isAuthenticated = this.authService.getAuthStatus();
    if (!isAuthenticated) {
      // Not logged in -- send to /login, remembering exactly where the
      // user was headed (state.url includes the full path, e.g.
      // '/dashboard/pendingdocuments/sign/182') as a returnUrl query
      // param. LoginComponent reads this back (see its `returnUrl`
      // property) and navigates there after a successful sign-in, so an
      // emailed "Start Signing" link still lands the signer on the exact
      // document instead of the default dashboard.
      //
      // Returning a UrlTree (rather than calling this.router.navigate()
      // and returning false) is the Angular-recommended way to redirect
      // from a guard -- it replaces the blocked navigation in one step
      // instead of racing a separate navigate() call against it.
      return this.router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
    }
    return true;
  }

}
