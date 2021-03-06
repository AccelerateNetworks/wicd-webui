#!/usr/bin/python

from flask import Flask, render_template, jsonify, abort, request

import dbus
import dbus.service
import sys

app = Flask(__name__)


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/list')
def list():
    current = None

    if wireless.GetWirelessIP(""):
        if daemon.NeedsExternalCalls():
            iwconfig = wireless.GetIwconfig()
        else:
            iwconfig = ''
        current = wireless.GetCurrentNetworkID(iwconfig)

    results = []
    for network_id in range(wireless.GetNumberOfNetworks()):
        result = {}
        result['encryption'] = 'Off'
        if wireless.GetWirelessProperty(network_id, 'encryption'):
            result['encryption'] = wireless.GetWirelessProperty(network_id, 'encryption_method')
        result['network_id'] = network_id
        result['bssid'] = wireless.GetWirelessProperty(network_id, 'bssid')
        result['channel'] = wireless.GetWirelessProperty(network_id, 'channel')
        result['quality'] = wireless.GetWirelessProperty(network_id, 'quality')
        result['essid'] = wireless.GetWirelessProperty(network_id, 'essid')
        result['connected'] = network_id == current

        # check if there's key/passphrase stored (WPA1/2 and WEP only, sorry)
        result['known'] = (wireless.GetWirelessProperty(network_id, 'key') or
                           wireless.GetWirelessProperty(network_id, 'apsk') or
                           wireless.GetWirelessProperty(network_id, 'passphrase'))
        results.append(result)

    return jsonify(data=results)


@app.route('/scan')
def scan():
    wireless.Scan(True)
    return list()


@app.route('/connect/<int:network_id>')
def connect(network_id):
    is_valid_wireless_network_id(network_id)

    wireless.ConnectWireless(network_id)

    return jsonify(data=wireless.GetWirelessProperty(network_id, 'essid'))


@app.route('/details/<int:network_id>')
def details(network_id):
    is_valid_wireless_network_id(network_id)

    result = {}
    result['encryption'] = 'Off'
    if wireless.GetWirelessProperty(network_id, 'encryption'):
        result['encryption'] = wireless.GetWirelessProperty(network_id, 'encryption_method')

    result['network_id'] = network_id
    result['bssid'] = wireless.GetWirelessProperty(network_id, 'bssid')
    result['channel'] = wireless.GetWirelessProperty(network_id, 'channel')
    result['quality'] = wireless.GetWirelessProperty(network_id, 'quality')
    result['essid'] = wireless.GetWirelessProperty(network_id, 'essid')
    if result['essid'] == '<hidden>':
        result['essid'] = ''

    # check if there's key/passphrase stored (WPA1/2 and WEP only, sorry)
    result['known'] = (wireless.GetWirelessProperty(network_id, 'key') or
                       wireless.GetWirelessProperty(network_id, 'apsk') or
                       wireless.GetWirelessProperty(network_id, 'passphrase'))

    return jsonify(data=result)


@app.route('/config', methods=['POST'])
def config():
    '''
    0    wpa                     WPA 1/2 (Hex [0-9/A-F])
      Req: key (Key)
    ---
    2    wpa-psk                 WPA 1/2 (Passphrase)
      Req: apsk (Preshared Key)
    ---
    5    wep-hex                 WEP (Hex [0-9/A-F])
      Req: key (Key)
    ---
    6    wep-passphrase          WEP (Passphrase)
      Req: passphrase (Passphrase)
    '''
    if not request.json:
        abort(400)

    try:
        network_id = int(request.json.get('networkid', None))
    except:
        network_id = -1

    is_valid_wireless_network_id(network_id)

    for property, value in request.json.iteritems():
        if property.startswith('wicd-'):
            pp = property[5:]
            wireless.SetWirelessProperty(network_id, pp, value)

    passkey = request.json.get('passkey', None)

    if passkey:
        enctype = request.json.get('wicd-enctype', None)
        enckey = None

        if enctype in ['wpa', 'wep-hex']:
            enckey = 'key'
        elif enctype == 'wpa-psk':
            enckey = 'apsk'
        elif enctype == 'wep-passphrase':
            enckey = 'passphrase'

        if enckey:
            wireless.SetWirelessProperty(network_id, enckey, passkey)

    result = {}
    return jsonify(data=result)


@app.route('/status')
def status():
    check = wireless.CheckIfWirelessConnecting()
    status = wireless.CheckWirelessConnectingStatus()
    message = wireless.CheckWirelessConnectingMessage()
    return jsonify(data=(check, status, message))


@app.route('/disconnect')
def disconnect():
    daemon.Disconnect()

    return jsonify(data=None)


@app.route('/current')
def current():

    ip = wireless.GetWirelessIP("")
    result = {}

    if ip:
        result['ip'] = ip
        if daemon.NeedsExternalCalls():
            iwconfig = wireless.GetIwconfig()
        else:
            iwconfig = ''
        result['network'] = wireless.GetCurrentNetwork(iwconfig)

        if daemon.GetSignalDisplayType() == 0:
            result['quality'] = wireless.GetCurrentSignalStrength(iwconfig)
        else:
            result['quality'] = wireless.GetCurrentDBMStrength(iwconfig)

    return jsonify(data=result)


# functions
def is_valid_wireless_network_id(network_id):
    if not (network_id >= 0 and network_id < wireless.GetNumberOfNetworks()):
        abort(400)


if getattr(dbus, 'version', (0, 0, 0)) < (0, 80, 0):
    import dbus.glib
else:
    from dbus.mainloop.glib import DBusGMainLoop
    DBusGMainLoop(set_as_default=True)

bus = dbus.SystemBus()
try:
    daemon = dbus.Interface(bus.get_object('org.wicd.daemon', '/org/wicd/daemon'), 'org.wicd.daemon')
    wireless = dbus.Interface(bus.get_object('org.wicd.daemon', '/org/wicd/daemon/wireless'),
                              'org.wicd.daemon.wireless')
    dbus.Interface(bus.get_object('org.wicd.daemon', '/org/wicd/daemon/config'), 'org.wicd.daemon.config')
except dbus.DBusException:
    print 'Error: Could not connect to the daemon. Please make sure it is running.'
    sys.exit(3)

if not daemon:
    print 'Error connecting to wicd via D-Bus.  Please make sure the wicd service is running.'
    sys.exit(3)

if __name__ == "__main__":
    app.run(host='0.0.0.0')
