import { Component, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { BnNgIdleService } from 'bn-ng-idle';
import { sessionTime } from '../assets/config-constants';
import { ConfigService } from './services/config.service';
declare var $: any;
import { DOCUMENT } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { LoaderService } from './services/loader.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'self-service';
  showSideBar: boolean = false;
  selectedLang: any;
  langData: any;
  noClick: any = 0;
  constructor(private router: Router, private bnIdle: BnNgIdleService, private config: ConfigService,
    @Inject(DOCUMENT) private document: Document, private loader: LoaderService) {
    this.langData = this.config.getLangData();
  }
  ngOnInit() {
    this.loader.getDefaultLangCode().subscribe((res) => {
      console.log(res)
      this.loadStyle(res);
    })
    this.bnIdle.startWatching(sessionTime.sessionTime).subscribe((isTimedOut: boolean) => {
      if (isTimedOut) {
        this.langData = this.config.getLangData();
        // console.log('session expired');
        let isLoggedIn = "isLoggedIn";
        if (isLoggedIn in localStorage) {
          let isUserLoggedIn = JSON.parse(localStorage.getItem('isLoggedIn') || '');
          console.log(isUserLoggedIn)
          if (isUserLoggedIn === true) {
            this.showConfirmModal();
          }
        }
      }
    });
  }
  ngAfterContentInit() {
    // this.checkPath();
  }
  checkPath() {
    console.log(this.router.url)
    if (this.router.url == '/login') {
      this.showSideBar = false;
    } else {
      this.showSideBar = true;
    }
  }
  confirmCancelApp(Status: string) {
    if (Status === "Yes") {
      this.hideConfirmModal();
      this.config.onLogout();
    } else {
      this.noClick = 1;
      this.hideConfirmModal();
    }
  }
  showConfirmModal() {
    $("#confirmIdle").modal('show');

    var doctorDetails = JSON.parse(localStorage.getItem("doctorDetails") || '{}');
    var timer = doctorDetails[0].UIUserTimeOut ? parseInt(doctorDetails[0].UIUserTimeOut) * 1000 : 20000;
    setTimeout(()=>{
      if (this.noClick == 0) {
        this.confirmCancelApp('Yes');
      }
      this.noClick = 0;
    },timer);
  }
  hideConfirmModal(): void {
    $("#confirmIdle").modal('hide');
  }
  // selectedLanguage(lang: any) {
  //   this.selectedLang = lang;
  //   console.log(this.selectedLang.value);
  //   if (this.selectedLang.value === "English") {
  //     this.loadStyle('style-EN.css');
  //   } else if (this.selectedLang.value === "Arabic") {
  //     this.loadStyle('style-EN.scss');
  //   }
  // }
  loadStyle(code: string) {
    let enStyle = './assets/styles/style-EN.css';
    let arStyle = './assets/styles/style-AR.css';
    let enBootstrap = './assets/styles/bootstrap.min.css';
    let arBootstrap = './assets/styles/bootstrap.rtl.min.css';
    let loadStyle = ""
    let loadBootstrap = ""
    if (code === 'en') {
      loadStyle = enStyle;
      loadBootstrap = enBootstrap
    } else if (code === 'ar') {
      loadStyle = arStyle;
      loadBootstrap = arBootstrap
    }
    const head = this.document.getElementsByTagName('head')[0];
    let linkElement = document.getElementById("client-theme");
    let bootstrapLinkElement = document.getElementById("bt-file");
    if (bootstrapLinkElement === null) {
      const style = this.document.createElement('link');
      style.id = 'bt-file';
      style.rel = 'stylesheet';
      style.href = `${loadBootstrap}`;
      head.appendChild(style);
    } else {
      bootstrapLinkElement.setAttribute('href', `${loadBootstrap}`)
    }
    if (linkElement === null) {
      const style = this.document.createElement('link');
      style.id = 'client-theme';
      style.rel = 'stylesheet';
      style.href = `${loadStyle}`;
      head.appendChild(style);
    } else {
      linkElement.setAttribute('href', `${loadStyle}`)
    }

  }
}
