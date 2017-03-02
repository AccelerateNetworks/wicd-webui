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

function mkbar(element, q) {
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
  element.removeClass("progress-bar-success progress-bar-info progress-bar-warning progress-bar-danger progress-bar-disabled");
  element.addClass("progress-bar-" + color).css('width', q + "%").text(q + "%");
  return element;
}

function qualityBar(q) {
  var bar = mkbar($("<div>").addClass('progress-bar'), q);
  return $("<div>").addClass('progress').append(bar);
}

function actionButtons(id) {
  var group = $("<div>").addClass('btn-group');
  var connect = $("<a>").data('id', id).click(network_status_precheck).text("Connect ").addClass('btn btn-success btn-sm').append($("<span>").addClass('glyphicon glyphicon-log-in'));
  var configure = $("<a>").data('id', id).click(configure_network).text("Configure ").addClass('btn btn-info btn-sm').append($("<span>").addClass('glyphicon glyphicon-cog'));
  return group.append(connect).append(configure);
}

function refresh_networks(data) {

  $('#network-table>tbody').remove();
  var tbody = $('<tbody/>');
  var known;
  $.each(data.data, function(key, val) {
    var row = $("<tr />");
    var info = [];
    if(val.connected) {
      row.addClass("success");
      info.push("Connected");
    }
    if(val.known) {
      if(!val.connected) {
        row.addClass('info');
      }
      info.push("Known");
    }
    row.append($("<td>" + val.essid + "</td>"));
    row.append($("<td>" + val.encryption + "</td>"));
    row.append($("<td>").append(qualityBar(val.quality)));
    row.append($("<td>").text(info.join(", ")));
    row.append($("<td>").append(actionButtons(val.network_id)));
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

function network_status_precheck(){
  $.getJSON("current", connect_to_network($(this).data('id')));
}

function connect_to_network(network_id) {
  return function(current) {
    console.log("Preparing to connect to network...", network_id, current);
    if(current.data.network === undefined) {
      showAlert('Connecting...', 'info');
      $.getJSON("connect/" + network_id, function(data) {
        showAlert('Connecting to ' + data.data, 'info');
        watch_connection_status();
      });
    } else {
      $("#confirmDisconnectText").text('Are you sure you want to disconnect from ' + current.data.network);
      $("#confirmDisconnectModal").modal("show");
      $('#confirmDisconnectModal').submit(function(event) {
        event.preventDefault();
        $(".disconnectNetworkButton").addClass("disabled");
        $(".disconnectNetworkButton").text('Connecting...');
        showAlert('Connecting...', 'info');
        $.getJSON("connect/" + network_id, function(data) {
          showAlert('Connecting to ' + data.data, 'info');
          watch_connection_status();
          $("#confirmDisconnectModal").modal("hide");
          $(".disconnectNetworkButton").removeClass("disabled");
          });
      });
    }
  };
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
      if (status == 'done') {
        setTimeout(hideAlert, 5000);
      }
      current_network();
    }
  });
}

function disconnect_network() {
  showAlert('Disconnecting...', 'warning');
  $.getJSON( "disconnect", function(data) {
    $("#current-essid").text("");
    $("#current-ip").text("");
    $("#disconnect-button").addClass("disabled");
    hideAlert();
  } );
}

function current_network() {
  $.getJSON("current", function(data) {
    if ($.isEmptyObject(data.data)) {
      $("#current-essid").text("");
      $("#current-ip").text("");
      $("#disconnect-button").addClass("disabled");
      $("#current-quality").addClass("progress-bar-disabled").removeClass("progress-bar-success progress-bar-info progress-bar-warning progress-bar-danger");
    } else {
      $("#current-essid").text(data.data.network);
      $("#current-ip").text(data.data.ip);
      mkbar($("#current-quality"), data.data.quality);
      $("#disconnect-button").removeClass("disabled");
    }
  });
}

function configure_network() {
  var network_id = $(this).data('id');
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
  $("#disconnect-button").click(disconnect_network);
  $("#scan-button").click(scan_networks);
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
  setInterval(current_network, 5000);
});
