import { PortalComponent } from './portal.component';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomepageComponent } from './homepage/homepage.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { SendForSignatureComponent } from './send-for-signature/send-for-signature.component';
import { DocumentComponent } from './document/document.component';
import { ApprovalformComponent } from './approvalform/approvalform.component';
import { DocumentEditorComponent } from './document/document-editor.component';
import { DocumentSignComponent } from './document/document-sign.component';
import { DocumentViewComponent } from './document/document-view.component';

const routes: Routes = [
  {
    path: '', component: PortalComponent, children: [
      { path: '', component: DashboardComponent },
      { path: 'sendforsignature', component: SendForSignatureComponent },
      { path: 'document', component: DocumentEditorComponent },
      { path: 'approval', component: ApprovalformComponent },

      {
        path: 'pendingdocuments',
        children: [
          { path: '', component: DocumentComponent },
          { path: 'sign/:id', component: DocumentSignComponent },
          { path: 'view/:id', component: DocumentViewComponent },
        ]
      },
    ]
  },

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PortalRoutingModule { }
