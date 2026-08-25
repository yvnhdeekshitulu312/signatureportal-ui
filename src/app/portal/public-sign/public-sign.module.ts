import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PublicSignRoutingModule } from './public-sign-routing.module';
import { DocumentSignPublicComponent } from './document-sign-public.component';

// Everything this route needs to render (*ngIf/*ngFor/[ngClass]/[ngStyle]
// from CommonModule, [(ngModel)] from FormsModule) -- deliberately minimal
// and standalone, importing nothing from PortalModule. See the header
// comment in document-sign-public.component.ts for why this stays a
// separate module rather than reusing/extending PortalModule's version.
@NgModule({
  declarations: [DocumentSignPublicComponent],
  imports: [CommonModule, FormsModule, PublicSignRoutingModule]
})
export class PublicSignModule { }
