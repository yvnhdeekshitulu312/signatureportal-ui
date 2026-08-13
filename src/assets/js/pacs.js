function openWindowWithPost() {
    // window.open('', 'TheWindow');
    document.getElementById('TheForm').submit();

    
    //var fileNumber = "0000343014";
    // document.getElementById("<%=Username.ClientID%>").value = "hisuser";
    // document.getElementById("<%=Password.ClientID%>").value = "hisuser";
    // document.getElementById("<%=PatientID.ClientID%>").value = fileNumber;           
    // document.getElementById("<%=form1.ClientID%>").action = "http://172.16.17.96/Launch_Viewer.asp";
    // document.getElementById("<%=form1.ClientID%>").target = "LaunchViewerAll";
    // var popup = window.open('', false, 'menubar=no,toolbar=no,dependent=yes');
    // if (window.focus) { popup.focus(); }
    // document.getElementById("<%=form1.ClientID%>").submit();
    // return false;

}
function openPACS(testoderitemid) {
    var form = document.createElement("form");
    form.target = "LaunchViewerAll";
    form.method = "POST";
    form.action = "http://172.16.17.96/Launch_Viewer.asp";
    var params = {
      "Username": "hisuser",
      "Password": "hisuser",
      "AccessionNumber": testoderitemid      
    };
    for (var i in params) {
        if (params.hasOwnProperty(i)) {
          var input = document.createElement('input');
          input.type = 'hidden';
          input.name = i;
          input.value = params[i];
          form.appendChild(input);
        }
    }

    document.body.appendChild(form);
    form.submit();
    //window.open('', false, 'menubar=no,toolbar=no,dependent=yes');
    }