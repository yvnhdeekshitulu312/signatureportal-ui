import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoaderService {
  isLoading = new Subject<boolean>();
  public defaultLangCode = new BehaviorSubject("");

  constructor() {
    if ("lang" in localStorage) {
      let langCode = localStorage.getItem('lang');
      this.setDefaultLangCode(langCode);
      console.log("Already lang code existed")
    } else {
      this.setDefaultLangCode("en");
    }
  }
  setDefaultLangCode(code: any) {
    this.defaultLangCode.next(code);
  }
  getDefaultLangCode() {
    return this.defaultLangCode.asObservable();
  }
  show() {
    this.isLoading.next(true);
  }

  hide() {
    this.isLoading.next(false);
  }
}
