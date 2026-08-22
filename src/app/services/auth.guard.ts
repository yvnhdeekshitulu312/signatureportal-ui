import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';

// Protects a route so it can only be entered while logged in. Uses the same
// 'isLoggedIn' localStorage flag LoginComponent already sets on a successful
// login (see login.component.ts's onSubmit()) -- no new auth state to keep
// in sync.
//
// The key behaviour: on a blocked visit, it redirects to /login carrying the
// URL that was actually requested as a `returnUrl` query param. LoginComponent
// reads that back (see its `returnUrl` property) and, on successful sign-in,
// navigates there instead of the normal dashboard home. This is what makes
// an emailed "Start Signing" link -- which should point straight at
// /dashboard/pendingdocuments/sign/<documentId> -- land the signer on that
// exact document after they log in, while an ordinary visit to /login (no
// returnUrl) still goes to /dashboard as before.
//
// Place this file under src/app/guards/auth.guard.ts (or wherever this
// project keeps route guards) and register it on the routes that should
// require login -- most simply, on the top-level 'dashboard' route in
// app-routing.module.ts, since canActivate on a parent route also protects
// every child route beneath it (including pendingdocuments/sign/:id):
//
//   { path: 'dashboard', component: DashboardShellComponent, canActivate: [AuthGuard], children: [...] }
//
// If 'dashboard' isn't guarded as a single parent route today, add
// `canActivate: [AuthGuard]` directly to the pendingdocuments/sign/:id route
// instead (and to any other route that should require login).
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (isLoggedIn) {
      return true;
    }

    // Not logged in -- send to /login, remembering exactly where they were
    // headed (state.url includes the full path, e.g.
    // '/dashboard/pendingdocuments/sign/179') so login can return them there.
    this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
}
