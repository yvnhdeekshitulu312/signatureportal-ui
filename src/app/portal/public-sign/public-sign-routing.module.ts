import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DocumentSignPublicComponent } from './document-sign-public.component';

// Deliberately no canActivate here -- this whole module exists to be
// reachable WITHOUT login (see the header comment in
// document-sign-public.component.ts). Nothing else in the app links to a
// ':token' URL under this path; the only way in is the accessToken-based
// link EsignService.cs's BuildSignUrl puts in the "Start Signing" email
// (now pointed at /pendingdocuments/sign/{accessToken} to match this
// module's mount point in app-routing.module.ts), so in practice this only
// ever gets opened from mail.
const routes: Routes = [
  { path: ':token', component: DocumentSignPublicComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PublicSignRoutingModule { }
