import { NgModule } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { PortalRoutingModule } from './portal-routing.module';
import { HomepageComponent } from './homepage/homepage.component';
import { SafePipe } from '../safe.pipe';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { MatLegacyAutocompleteModule as MatAutocompleteModule } from '@angular/material/legacy-autocomplete';
import { MatNativeDateModule } from '@angular/material/core';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyTableModule as MatTableModule } from '@angular/material/legacy-table';
import { MatLegacyDialogModule as MatDialogModule } from '@angular/material/legacy-dialog';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMomentDateModule } from "@angular/material-moment-adapter";
import { TwoDigitDecimaNumberDirective } from '../two-digit-decima-number.directive';
import { FormsModule } from '@angular/forms';
import {CdkAccordionModule} from '@angular/cdk/accordion';
import { MatLegacyTooltipModule as MatTooltipModule } from '@angular/material/legacy-tooltip';
import { DashboardComponent } from './dashboard/dashboard.component';
import { SendForSignatureComponent } from './send-for-signature/send-for-signature.component';
import { DocumentComponent } from './document/document.component';
import { PdfViewerModule } from 'ng2-pdf-viewer';
import { HttpClientModule } from '@angular/common/http';
import {DragDropModule} from '@angular/cdk/drag-drop';
import { ApprovalformComponent } from './approvalform/approvalform.component';
import { DocumentEditorComponent } from './document/document-editor.component';
import { DocumentSignComponent } from './document/document-sign.component';
import { DocumentViewComponent } from './document/document-view.component';

@NgModule({
  declarations: [
    SafePipe,
    TwoDigitDecimaNumberDirective, DashboardComponent, SendForSignatureComponent, DocumentComponent, DocumentEditorComponent, ApprovalformComponent, DocumentSignComponent, DocumentViewComponent
  ],
  providers: [MatDatepickerModule, DatePipe],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDatepickerModule,
    MatInputModule,
    MatAutocompleteModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatIconModule,
    MatTableModule,
    MatDialogModule,
    MatToolbarModule,
    MatMomentDateModule,
    CdkAccordionModule,
	MatTooltipModule,
    PortalRoutingModule,
    FormsModule,
    PdfViewerModule,
    HttpClientModule,
    DragDropModule
  ],
  exports: [
    MatDatepickerModule,
    MatInputModule,
    MatAutocompleteModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatIconModule,
    MatTableModule,
    MatDialogModule,
    MatToolbarModule,
    MatMomentDateModule,
    CdkAccordionModule,
    MatTooltipModule
  ],
})
export class PortalModule { }
