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
  var mainDiv = $('<div class="modal fade" id="statusModal" tabindex="-1" role="dialog" aria-labelledby="statusModalLabel" aria-hidden="true" data-keyboard="false" data-backdrop="static"><div class="modal-dialog"><div class="modal-content"><div class="modal-header"><button type="button" class="close" data-dismiss="modal"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button><h4 class="modal-title" id="statusModalLabel"></h4></div><div class="modal-body" id="statusModalText"></div></div></div></div>')
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

function refresh_networks(data) {

  $('#network-table>tbody').remove();
  var tbody = $('<tbody/>');
  var known
  $.each( data['data'], function( key, val ) {
    if (val["known"]) known = "<span class=\"glyphicon glyphicon-ok\">";
    else known = "";
    $("<tr/>", { html: "\
      <td>" + val["essid"] + "</td>\
      <td>" + val["encryption"] + known + "</td>\
      <td>" + val["quality"] + "%</td>\
      <td>\
      <a href=\"javascript:connect_to_network(" + val["network_id"] + ");\">\
      <span class=\"glyphicon glyphicon-log-in\">\
      </a>\
      &nbsp;\
      <a href=\"javascript:configure_network(" + val["network_id"] + ");\">\
      <span class=\"glyphicon glyphicon-cog\">\
      </a>\
      </td>\
      "}).appendTo(tbody);
  });
  tbody.appendTo("#network-table");
  statusModal.hide();
};

function list_networks() {
  statusModal.show();
  statusModal.text('Listing networks...')
  $.getJSON( "list", refresh_networks );
};

function scan_networks() {
  statusModal.show();
  statusModal.text('Scanning networks...')
  $.getJSON( "scan", refresh_networks );
};

function connect_to_network(network_id) {
  statusModal.show();
  statusModal.text('Connecting...')
  $.getJSON( "connect/" + network_id, function(data) {
    statusModal.label('Please wait (' + data['data'] + ')');
    statusModal.text('Connecting to ' + data['data'] + '...');
    watch_connection_status();
  } );
};

function watch_connection_status() {
  $.getJSON( "status", function(data) {
    connecting = data['data'][0];
    message = data['data'][2];
    statusModal.text(message);
    if (connecting) setTimeout(watch_connection_status, 1000);
    else {
      statusModal.closeable();
      current_network();
    };
  });
}

function disconnect_network() {
  statusModal.show();
  statusModal.text('Disconnecting...')
  $.getJSON( "disconnect", function(data) {
    $('#current_network>p').text("Currently not connected to any network");
    statusModal.hide();
  } );
};

function current_network() {
  $.getJSON( "current", function(data) {
    $('#current_network>p').remove();
    var newp = $('<p/>');
    if ($.isEmptyObject(data['data']))
      newp.text("Currently not connected to any network");
    else {
      newp.text('Connected to ')
      newp.append($('<i/>').text('"' + data['data']['network'] + '"'));
      newp.append(document.createTextNode(' at '));
      newp.append($('<i/>').text(data['data']['quality'] + '%'));
      newp.append(document.createTextNode(' (IP: '));
        newp.append($('<i/>').text(data['data']['ip']));
        newp.append(document.createTextNode(')'));
        newp.append('\
          <a href=\"javascript:disconnect_network();\">\
          <span class=\"glyphicon glyphicon-log-out\">\
          </a>');
      }
      newp.appendTo("#current_network");
    });
};

function configure_network(network_id) {
  statusModal.show();
  statusModal.text('Listing networks...')
  $.getJSON( "details/" + network_id, function(data) {
    statusModal.hide();
    var info = data['data'];
    var modal = $('#configModal');
    $('#configModalLabel',modal).text('Configure ' + info['bssid']);
    $('#configModalESSID',modal).val(info['essid']);
    $('#configModalEncryptionMethod',modal).text('Encryption is ' + info['encryption']);
    $('#configModalNetworkId',modal).val(network_id);

    if (info['encryption'] == 'Off') {
      $('#configModalPassword',modal).prop('disabled', true);
      $('#configModalEncryption',modal).prop('disabled', true);
    }
    else {
      $('#configModalPassword',modal).prop('disabled', false);
      $('#configModalEncryption',modal).prop('disabled', false);
    }
    $('.selectpicker').selectpicker('refresh');

    if (info['essid'] === '') {
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
