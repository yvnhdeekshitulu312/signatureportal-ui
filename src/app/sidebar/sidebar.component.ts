import { Component, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ConfigService } from '../services/config.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {
  pageUrl!: any;
  langData: any;
  doctorDetails: any;
  constructor(private config: ConfigService, private router: Router) {
    this.langData = this.config.getLangData();
    console.log("langConfig===>", this.config.getLangData())
  }

  ngOnInit(): void {
    this.doctorDetails = JSON.parse(localStorage.getItem("doctorDetails") || '{}');

    this.pageUrl = this.router.url; // ← set initial URL so active-state highlights on first load

    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(event => {
      this.pageUrl = this.router.url;
      console.log("Page Url", this.pageUrl)
    });
  }
 

  gotoPendingDocs() {
    this.router.navigate(['dashboard/pendingdocuments'])
  }

  gotoSendForSignature(): void {
    //this.router.navigate(['/dashboard/sendforsignature']);
    this.router.navigate(['/dashboard']);
  }
}
