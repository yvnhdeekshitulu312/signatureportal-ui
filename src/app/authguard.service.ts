import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthguardService {
  isLoggedIn: boolean = false;
  constructor() {
    this.isLoggedIn = JSON.parse(localStorage.getItem("isLoggedIn") || '');
  }
  getAuthStatus() {
    return this.isLoggedIn;
  }
}
