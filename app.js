"use strict";

var Net              = require('net'),
    split            = require('split'),
    RoonApi          = require("node-roon-api"),
    RoonApiSettings  = require('node-roon-api-settings'),
    RoonApiStatus    = require('node-roon-api-status'),
    RoonApiTransport = require('node-roon-api-transport');

var SM_BUTTONS_PORT = 10001;
var core;
var zones = {};
var roon = new RoonApi({
    extension_id:        'com.roonlabs.iport.smbuttons_controller',
    display_name:        'iPort Surface Mount with Buttons controller',
    display_version:     "1.0.0",
    publisher:           'Roon Labs, LLC',
    email:               'contact@roonlabs.com',
    website:             'https://github.com/RoonLabs/roon-extension-iport-sm-buttons',
    required_services:   [ RoonApiTransport ],
    optional_services:   [ ],
    provided_services:   [ svc_settings, svc_status ],

    core_paired: function(core_) {
        core = core_;
        core.services.RoonApiTransport.subscribe_zones((response, msg) => {
            for (var ip in sms) update_led(ip, sms[ip].idx);
        });
    },
    core_unpaired: function(core_) {
	core  = undefined;
        zones = {};
    }
});
var sms = { };

var mysettings = roon.load_config("settings") || {
    devices:          0,
    longpresstimeout: 500,
    seekamount:       5,
    volumesteps:      5
};

var colorvalues = [
    { title: "White",   value: "#FFFFFF" }, { title: "Red",    value: "#FF0000" },
    { title: "Green",   value: "#00FF00" }, { title: "Blue",   value: "#0000FF" },
    { title: "Yellow",  value: "#FFFF00" }, { title: "Cyan",   value: "#00FFFF" },
    { title: "Magenta", value: "#FF00FF" }, { title: "Orange", value: "#FF8000" },
    { title: "Pink",    value: "#FFB6C1" }, { title: "None",   value: "#000000" },
];

var actions = [
    { title: "Play/Pause",    value: "toggleplay"   },
    { title: "Stop",          value: "stop"         },
    { title: "Next",          value: "next"         },
    { title: "Preivous",      value: "previous"     },
    { title: "Seek Forward",  value: "seekfwd"      },
    { title: "Seek Backward", value: "seekback"     },
    { title: "Pause All",     value: "pauseall"     },
    { title: "Toggle Mute",   value: "togglemute"   },
    { title: "Volume Up",     value: "volumeup"     },
    { title: "Volume Down",   value: "volumedown"   },
    { title: "Nothing",       value: "none"         },
];

function makelayout(settings) {
    var l = {
        values:    settings,
	layout:    [],
	has_error: false
    };

    l.layout.push({
	type:    "integer",
	title:   "Number of iPort Surface Mount with Button devices",
	setting: "devices",
    });

    if (settings.devices > 0) {
        let v = {
            type:    "integer",
            min:     100,
            max:     2000,
            title:   "Long Press Timeout (milliseconds)",
            subtitle: "This is how long you have to hold the button down to register as a long press.",
            setting: "longpresstimeout",
        };
        if (settings.longpresstimeout < v.min || settings.longpresstimeout > v.max) {
            v.error = "Long Press Timeout must be between 100 and 2000 milliseconds.";
            l.has_error = true; 
        }
        l.layout.push(v);

        v = {
            type:    "integer",
            min:     1,
            max:     60,
            title:   "Seek Amount (seconds)",
            setting: "seekamount",
        };
        if (settings.seekamount < 1 || settings.seekamount > 60) {
            v.error = "Seek Amount must be between 1 and 60 seconds.";
            l.has_error = true;
        }
        l.layout.push(v);

        v = {
            type:    "integer",
            min:     1,
            max:     100,
            title:   "Volume Change Amount (steps)",
            setting: "volumesteps",
        };
        if (settings.volumesteps < 1 || settings.volumesteps > 60) {
            v.error = "Volume Change Amount must be between 1 and 100 steps.";
            l.has_error = true;
        }
        l.layout.push(v);
    }

    let i = 0;
    while (i < settings.devices) {
        i++;
        let group = {
            type:        "group",
            title:       "Device #" + i,
            collapsable: true,
            items:       [],
        };

        let name = i;
        let ip  = settings["ip" + i];

        group.items.push({
	    type:    "string",
	    title:   "IP Address",
	    setting: "ip" + i
        });

        l.layout.push(group);

        let sm = sms[ip]; 
        if (!sm) continue;

        let conn = sm.conn;
        if (conn) {
            group.title = conn.deviceid + "  (" + conn.model + " " + conn.version + ")";

            group.items.push({
                type:    "zone",
                title:   "Zone",
                setting: "zone" + i
            });

            let ledgroup = {
                type:        "group",
                title:       "LEDs",
//                collapsable: true,
                items: [],
            };
            group.items.push(ledgroup);

            // defaults
	    if (!settings["led_playing_" + i]) settings["led_playing_" + i] = '#00FF00';
	    if (!settings["led_loading_" + i]) settings["led_loading_" + i] = '#00FFFF';
	    if (!settings["led_stopped_" + i]) settings["led_stopped_" + i] = '#FFFFFF';

            ledgroup.items.push({
                type:           "dropdown",
                title:          "Music Playing Color",
                setting:        "led_playing_" + i,
                values:         colorvalues,
                needs_feedback: true
            });
            ledgroup.items.push({
                type:           "dropdown",
                title:          "Music Loading Color",
                setting:        "led_loading_" + i,
                values:         colorvalues,
                needs_feedback: true
            });
            ledgroup.items.push({
                type:           "dropdown",
                title:          "Default Color",
                setting:        "led_stopped_" + i,
                values:         colorvalues,
                needs_feedback: true
            });

            let limit = 0;
            conn.keys.forEach(kvp => {
                let key = kvp.label.replace(/[^0-9]/g, '');

                // defaults
                if (!settings["press" + i + "_" + key]) {
                    if      (key == 1) settings["press" + i + "_" + key] = "toggleplay";
                    else if (key == 2) settings["press" + i + "_" + key] = "togglemute";
                    else if (key == 3) settings["press" + i + "_" + key] = "previous";
                    else if (key == 4) settings["press" + i + "_" + key] = "next";
                    else               settings["press" + i + "_" + key] = "none";
                }
                if (!settings["longpress" + i + "_" + key]) {
                    if (key == 1) settings["longpress" + i + "_" + key] = "stop";
                    else          settings["longpress" + i + "_" + key] = "none";
                }

                let keygroup = {
                    type:        "group",
                    title:       "Key " + key,
                    collapsable: true,
                    items: [],
                };
                group.items.push(keygroup);

                keygroup.items.push({
                    type:    "dropdown",
                    title:   "Press Action",
                    setting: "press" + i + "_" + key,
                    values:  actions
                });
                keygroup.items.push({
                    type:    "dropdown",
                    title:   "Long Press Action",
                    setting: "longpress" + i + "_" + key,
                    values:  actions
                });
            });
        } else if (sm.net) {
            group.items.push({
                type:    "label",
                title:   "Connecting to " + ip,
            });
        }
    }

    return l;
}

var svc_settings = new RoonApiSettings(roon, {
    get_settings: function(cb) {
        cb(makelayout(mysettings));
    },
    save_settings: function(req, isdryrun, settings) {
        ensure_connections(settings.values);

	let l = makelayout(settings.values);
        req.send_complete(l.has_error ? "NotValid" : "Success", { settings: l });

        if (settings.feedback) {
            for (var i in settings.feedback) {
                let propname = i;
                let propval = settings.feedback[i];
                var m = propname.match(/^led_[^_]+_([0-9]+)$/);
                if (m) {
                    let idx = m[1];
                    for (var ip in sms) {
                        let sm = sms[ip];
                        if (sm.idx == idx) {
                            sm.net.write('\nled=' + propval + '\n');
                            setTimeout(() => {
                                update_led(sm.ip, sm.idx, true);
                            }, 1000);
                            break;
                        }
                    }
                }
                break;
            }
        }

        if (!isdryrun && !l.has_error) {
            mysettings = l.values;
            update_status();
            svc_settings.update_settings(l);
            for (var ip in sms) update_led(ip, sms[ip].idx);
            roon.save_config("settings", mysettings);
        }
    }
});

var svc_status = new RoonApiStatus(roon);

function update_status() {
    var conns = 0, inits = 0, total = 0;
    let i = 0;
    while (i < mysettings.devices) {
        let ip = mysettings["ip" + ++i];
        if (!ip) continue;
        let sm = sms[ip];
        if (!sm) continue;

        total++;
        if (sm.conn) { conns++; continue; }
        if (sm.net)  { inits++; continue; }
    }

    var s = "";
    var err = false;
    if (total == 0) {
        s = "Not configured, please check settings";
        err = true;
    } else {
        if (conns > 0) {
            let t = conns + inits;
            if      (t == 1) s = "Connected to 1 device";
            else if (t >  1) s = "Connected to " + t + " devices";
            if (inits > 0) {
                if      (inits == 1) s = " (1 initializing)";
                else if (inits >  1) s = " (" + inits + " initializing)";
            }
        } else if (inits > 0) {
            if      (inits == 1) s = "Initializing 1 device";
            else if (inits >  1) s = "Initializing " + inits + " devices";
        } else {
            s = "Can not find configured devices, please check settings";
            err = true;
        }
    }
    svc_status.set_status(s + ".", err);
}

function update_led(ip, idx, force) {
    let sm = sms[ip]; 
    if (!sm || !sm.net) return;

    let z = mysettings['zone'+idx];
    if (!z || !core) { if (mysettings['led_stopped_' + idx]) sm.net.write('\nled=' + mysettings['led_stopped_' + idx] + '\n'); return; }

    var zone = core.services.RoonApiTransport.zone_by_object(z);
    if (!zone) { if (mysettings['led_stopped_' + idx]) sm.net.write('\nled=' + mysettings['led_stopped_' + idx] + '\n'); return; }

    if (sm.zonestate == zone.state && !force) return;
    sm.zonestate = zone.state;
    if      (zone.state == "playing" && mysettings['led_playing_' + idx]) sm.net.write('\nled=' + mysettings['led_playing_' + idx] + '\n');
    else if (zone.state == "loading" && mysettings['led_loading_' + idx]) sm.net.write('\nled=' + mysettings['led_loading_' + idx] + '\n');
    else if (                           mysettings['led_stopped_' + idx]) sm.net.write('\nled=' + mysettings['led_stopped_' + idx] + '\n');
}

function ensure_connections(settings) {
    var changed = false;
    let i = 0;
    while (i < settings.devices) {
        i++;
        let ip = settings["ip" + i];

        if (!ip) continue;

        let sm = sms[ip];
        if (sm && (sm.conn || sm.net)) continue;

        sm = sms[ip] = {
            idx:     i,
            ip:      ip,
            conn:    undefined,
            pressed: { },
            net:     new Net.Socket(),
        };

        sm.pinger = setInterval(() => {
            try { sm.net.write("\nled=?\n"); } catch (e) { }
        });

        changed = true;

        try {
            let idx = i;
            sm.net.connect(SM_BUTTONS_PORT, ip)

            sm.net.on('connect', () => {
                console.log("SM: connected", ip);
		update_status();
                svc_settings.update_settings();
                update_led(sm.ip, sm.idx);
            });

            sm.net.pipe(split())
                    .on('data', function (line) {
                        if (line[0] == '#') return;
                        if (line.startsWith("led=")) return;
                        var msg = JSON.parse(line);
                        if (!sm.conn) {
                            console.log("SM: got first line", ip);
                            sm.conn = msg;
                            update_status();
                            svc_settings.update_settings();

                        } else if (msg.events) {
                            msg.events.forEach(e => {
                            console.log("SM: got event", ip, e);
                                if (e.state == '1')
                                    ev_buttondown(sm, e.label.replace(/[^0-9]/g, ''));
                                else
                                    ev_buttonup(sm, e.label.replace(/[^0-9]/g, ''));
                            });
                        }
                    });
            sm.net.on('error', function(msg) { console.log("SM ERROR", msg); close_sm(ip); });
            sm.net.on('end', () => { close_sm(ip); });

        } catch (e) {
            sm.net.destroy();
            close_sm(ip);
        }
    }
    if (changed) {
        update_status();
        svc_settings.update_settings();
    }
}

function close_sm(ip) {
    console.log("SM: closed", ip);
    let sm = sms[ip];
    delete(sms[ip]);
    try { sm.net.destroy(); } catch (e) { }
    try { clearInterval(sm.pinger); } catch (e) { }
    update_status();
    svc_settings.update_settings();
}

var pressseq = 0;

function ev_buttondown(sm, key) {
    if (sm.pressed[key]) return;
//    console.log('sm clickdown: ' + key);
    var seq = ++pressseq;
    sm.pressed[key] = seq;
    setTimeout(() => {
        if (seq != sm.pressed[key]) return;
//	console.log('sm longpress: ' + key);
        sm.pressed[key] = 'longpressed';
        if (!core) return;
        console.log('sm longpress: ' + key);
        let k = "longpress" + sm.idx + "_" + key;
        if      (mysettings[k] == "toggleplay") core.services.RoonApiTransport.control      (mysettings['zone'+sm.idx], 'playpause');
        else if (mysettings[k] == "seekfwd")    core.services.RoonApiTransport.seek         (mysettings['zone'+sm.idx], 'relative', mysettings.seekamount);
        else if (mysettings[k] == "seekback")   core.services.RoonApiTransport.seek         (mysettings['zone'+sm.idx], 'relative', mysettings.seekamount * -1);
        else if (mysettings[k] == "stop")       core.services.RoonApiTransport.control      (mysettings['zone'+sm.idx], 'stop');
        else if (mysettings[k] == "pauseall")   core.services.RoonApiTransport.pause_all    ();
        else if (mysettings[k] == "next")       core.services.RoonApiTransport.control      (mysettings['zone'+sm.idx], 'next');
        else if (mysettings[k] == "previous")   core.services.RoonApiTransport.control      (mysettings['zone'+sm.idx], 'previous');
        else if (mysettings[k] == "togglemute") core.services.RoonApiTransport.mute         (mysettings['zone'+sm.idx], 'toggle');
        else if (mysettings[k] == "volumeup")   core.services.RoonApiTransport.change_volume(mysettings['zone'+sm.idx], 'relative_step', mysettings.volumesteps);
        else if (mysettings[k] == "volumedown") core.services.RoonApiTransport.change_volume(mysettings['zone'+sm.idx], 'relative_step', mysettings.volumesteps * -1);
    }, mysettings.longpresstimeout);
}

function ev_buttonup(sm, key) {
//    console.log('sm clickup: ' + key);
    if (!core) return;
    if (!sm.pressed[key]) return;
    if (sm.pressed[key] == "longpressed") {
        delete(sm.pressed[key]);
        return;
    }
    delete(sm.pressed[key]);
    console.log('sm press: ' + key);
    let k = "press" + sm.idx + "_" + key;
    if      (mysettings[k] == "toggleplay") core.services.RoonApiTransport.control      (mysettings['zone'+sm.idx], 'playpause');
    else if (mysettings[k] == "seekfwd")    core.services.RoonApiTransport.seek         (mysettings['zone'+sm.idx], 'relative', mysettings.seekamount);
    else if (mysettings[k] == "seekback")   core.services.RoonApiTransport.seek         (mysettings['zone'+sm.idx], 'relative', mysettings.seekamount * -1);
    else if (mysettings[k] == "stop")       core.services.RoonApiTransport.control      (mysettings['zone'+sm.idx], 'stop');
    else if (mysettings[k] == "pauseall")   core.services.RoonApiTransport.pause_all    ();
    else if (mysettings[k] == "next")       core.services.RoonApiTransport.control      (mysettings['zone'+sm.idx], 'next');
    else if (mysettings[k] == "previous")   core.services.RoonApiTransport.control      (mysettings['zone'+sm.idx], 'previous');
    else if (mysettings[k] == "togglemute") core.services.RoonApiTransport.mute         (mysettings['zone'+sm.idx], 'toggle');
    else if (mysettings[k] == "volumeup")   core.services.RoonApiTransport.change_volume(mysettings['zone'+sm.idx], 'relative_step', mysettings.volumesteps);
    else if (mysettings[k] == "volumedown") core.services.RoonApiTransport.change_volume(mysettings['zone'+sm.idx], 'relative_step', mysettings.volumesteps * -1);
}

ensure_connections(mysettings);
setInterval(() => ensure_connections(mysettings), 1000);

roon.start_discovery();
