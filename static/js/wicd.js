$.fn.serializeObject = function() {
  var o = {};
  var a = this.serializeArray();
  $.each(a, function() {
    if (o[this.name] !== undefined) {
      if (!o[this.name].push) {
        o[this.name] = [o[this.name]];
      }
      o[this.name].push(this.value || '');
    } else {
      o[this.name] = this.value || '';
    }
  });
  return o;
};

var statusModal = (function () {
  var mainDiv = $('<div class="modal fade" id="statusModal" tabindex="-1" role="dialog" aria-labelledby="statusModalLabel" aria-hidden="true" data-keyboard="false" data-backdrop="static"><div class="modal-dialog"><div class="modal-content"><div class="modal-header"><button type="button" class="close" data-dismiss="modal"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button><h4 class="modal-title" id="statusModalLabel"></h4></div><div class="modal-body" id="statusModalText"></div></div></div></div>');
  var textDiv = $('#statusModalText', mainDiv);
  var labelDiv = $('#statusModalLabel', mainDiv);
  var closeButton = $('.close', mainDiv);
  return {
    show: function() {
      textDiv.text('Processing...');
      labelDiv.text('Please wait');
      closeButton.hide();
      mainDiv.modal();
    },
    hide: function () {
      mainDiv.modal('hide');
    },
    text: function (text) {
      textDiv.text(text);
    },
    label: function (text) {
      labelDiv.text(text);
    },
    closeable: function() {
      closeButton.show();
    },
  };
})();

function showAlert(text, color) {
  var alertBox = $(".wicd-top-alert");
  alertBox.text(text).removeClass('alert-success alert-info alert-warning alert-danger').addClass("alert-" + color).removeClass('hidden');
}

function hideAlert() {

  var alertBox = $(".wicd-top-alert");
  alertBox.addClass("hidden");
}

function qualityBar(q) {
  var color = "default";
  if(q >= 90) {
    color = "success";
  } else if(q >= 80) {
    color = "info";
  } else if(q >= 70) {
    color = "warning";
  } else {
    color = "danger";
  }
  var bar = $("<div>").addClass('progress-bar').addClass('progress-bar-' + color).attr('role', 'progressbar').css('width', q + "%").text(q + "%");
  return $("<div>").addClass('progress').append(bar);
}

function actionButtons(id) {
  var connect = $("<a>").data('id', id).click(connect_to_network).append($("<span>").addClass('glyphicon glyphicon-log-in'));
  var configure = $("<a>").data('id', id).click(configure_network).append($("<span>").addClass('glyphicon glyphicon-cog'));
  return $("<td>").append(connect).append(configure);
}

function refresh_networks(data) {

  $('#network-table>tbody').remove();
  var tbody = $('<tbody/>');
  var known;
  $.each(data.data, function(key, val) {
    var row = $("<tr />");
    if(val.connected) {
      row.addClass("success");
    } else if(val.known) {
      row.addClass('info');
    }
    row.append($("<td>" + val.essid + "</td>"));
    row.append($("<td>" + val.encryption + "</td>"));
    row.append($("<td>").append(qualityBar(val.quality)));
    row.append(actionButtons(val.network_id));
    row.appendTo(tbody);
  });
  tbody.appendTo("#network-table");
  hideAlert();
}

function list_networks() {
  showAlert('Scanning for networks...', 'info');
  $.getJSON("list", refresh_networks);
}

function scan_networks() {
  showAlert('Scanning networks...', 'info');
  $.getJSON( "scan", refresh_networks );
}

function connect_to_network(network_id) {
  showAlert('Connecting...', 'info');
  $.getJSON( "connect/" + network_id, function(data) {
    showAlert('Please wait (' + data.data + ')', 'info');
    showAlert('Connecting to ' + data.data, 'info');
    watch_connection_status();
  } );
}

function watch_connection_status() {
  $.getJSON( "status", function(data) {
    connecting = data.data[0];
    status = data.data[1];
    message = data.data[2];
    if (connecting) {
      showAlert(message, 'info');
      setTimeout(watch_connection_status, 1000);
    } else {
      showAlert(message, status == 'done' ? 'success' : 'danger');
      current_network();
    }
  });
}

function disconnect_network() {
  showAlert('Disconnecting...', 'warning');
  $.getJSON( "disconnect", function(data) {
    $('#current_network>p').text("Currently not connected to any network");
    hideAlert();
  } );
}

function current_network() {
  $.getJSON("current", function(data) {
    $('#current_network>p').remove();
    var newp = $('<p/>');
    if ($.isEmptyObject(data.data))
      newp.text("Currently not connected to any network");
    else {
      newp.text('Connected to ');
      newp.append($('<i/>').text('"' + data.data.network + '"'));
      newp.append(document.createTextNode(' at '));
      newp.append($('<i/>').text(data.data.quality + '%'));
      newp.append(document.createTextNode(' (IP: '));
        newp.append($('<i/>').text(data.data.ip));
        newp.append(document.createTextNode(')'));
        newp.append('<a href=\"javascript:disconnect_network();\"><span class=\"glyphicon glyphicon-log-out\"></a>');
      }
      newp.appendTo("#current_network");
    });
}

function configure_network(network_id) {
  statusModal.show();
  statusModal.text('Listing networks...');
  $.getJSON( "details/" + network_id, function(data) {
    statusModal.hide();
    var info = data.data;
    var modal = $('#configModal');
    $('#configModalLabel', modal).text('Configure ' + info.bssid);
    $('#configModalESSID', modal).val(info.essid);
    $('#configModalEncryptionMethod', modal).text('Encryption is ' + info.encryption);
    $('#configModalNetworkId', modal).val(network_id);

    if (info.encryption == 'Off') {
      $('#configModalPassword', modal).prop('disabled', true);
      $('#configModalEncryption', modal).prop('disabled', true);
    }
    else {
      $('#configModalPassword',modal).prop('disabled', false);
      $('#configModalEncryption',modal).prop('disabled', false);
    }
    $('.selectpicker').selectpicker('refresh');

    if (info.essid === '') {
      $('#configModalESSID',modal).prop('disabled', false);
    }
    else {
      $('#configModalESSID',modal).prop('disabled', true);
    }
    modal.modal();
  } );
}

$( document ).ready(function() {
  current_network();
  list_networks();
  if( /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent) ) {
    $('.selectpicker').selectpicker('mobile');
  }
  else {
    $('.selectpicker').selectpicker();
  }
  $('#configModalForm').submit(function(event) {
    event.preventDefault();
    $.ajax({
        type: 'POST',
        url: 'config',
        data: $.toJSON($(this).serializeObject()),
        contentType: "application/json",
        dataType: 'json'
      });
  });
});
