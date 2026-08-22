import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthguardService {
  // Deliberately NOT cached on a field set once in the constructor.
  // AuthguardService is providedIn: 'root', so Angular creates exactly one
  // instance for the whole app session -- if a guard check ever runs
  // *before* login (e.g. an email "Start Signing" link straight to a
  // protected document while logged out), that single instance would be
  // created right then, permanently caching isLoggedIn = false. Logging in
  // afterwards updates localStorage but never re-runs this constructor, so
  // the very next guard check (the post-login redirect back to the
  // originally-requested page) would still see the stale cached `false`
  // and bounce back to /login -- which looks exactly like "login doesn't
  // work" even though the credentials were accepted. Reading localStorage
  // fresh on every call avoids that entirely.
  //
  // LoginComponent stores this as the plain string 'true' (see its
  // onSubmit()), not JSON, so a plain comparison is all that's needed --
  // and unlike JSON.parse(), it can never throw on a missing/empty value.
  getAuthStatus(): boolean {
    return localStorage.getItem("isLoggedIn") === 'true';
  }
}
